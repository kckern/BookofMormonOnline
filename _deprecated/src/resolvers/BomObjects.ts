import { models as Models } from '../config/database';
import { Op, includeTranslation, translatedValue, includeModel } from './_common';
import { lookupReference } from 'scripture-guide';

const getRequestedFields = (info: any): string[] => {
  if (!info || info === true) return [];
  try {
    const fieldNode = info.fieldNodes[0];
    if (!fieldNode || !fieldNode.selectionSet) return [];
    return (fieldNode.selectionSet.selections || [])
      .filter((s: any) => s.kind === 'Field')
      .map((s: any) => s.name.value);
  } catch (e) {
    return [];
  }
};

// Parse a verse_id from an xrel note string, e.g., "Slew Amalickiah on Christmas Eve (Alma 51:34)"
// Returns null when no parseable scripture reference is found.
const parseVerseIdFromNote = (note: string | null): number | null => {
  if (!note) return null;
  // Match patterns like "Alma 51:34", "1 Nephi 16:10", "3 Ne 11:1", possibly with a verse range "Alma 32:21-23"
  const match = note.match(/\b(?:[1-4]\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+\d+:\d+(?:-\d+)?/);
  if (!match) return null;
  try {
    const result = lookupReference(match[0]);
    const verseIds: number[] = result?.verse_ids || [];
    if (Array.isArray(verseIds) && verseIds.length > 0) return verseIds[0];
    return null;
  } catch (e) {
    return null;
  }
};

// One-time warning per missing slug to surface data-quality issues
const warnedMissing = new Set<string>();
const warnMissing = (dst_type: string, dst_slug: string) => {
  const key = `${dst_type}:${dst_slug}`;
  if (warnedMissing.has(key)) return;
  warnedMissing.add(key);
  console.warn(`[BomObjects] xrel target missing: ${key}`);
};

export default {
  Query: {
    object: async (root: any, args: any, context: any, info: any) => {
      const where = (args.slug && args.slug.length) ? { slug: args.slug } : undefined;
      return await Models.BomObjects.findAll({
        where,
        order: [['weight', 'DESC']],
      });
    },
  },
  Object: {
    name:        (item: any) => translatedValue(item, 'name'),
    subtitle:    (item: any) => translatedValue(item, 'subtitle'),
    description: (item: any) => translatedValue(item, 'description'),
    index: async (item: any) => {
      const slug = item.getDataValue ? item.getDataValue('slug') : item.slug;
      return await Models.BomIndex.findAll({
        where: { type: 'object', slug },
        order: [['verse_id', 'ASC']],
        // Index.slug walks text_guid → text; without this include every row
        // crashed with a getDataValue TypeError (docs/bugs/2026-06-09-object-index-getdatavalue-crash.md)
        include: [includeModel(true, Models.BomLookup, 'text_guid', [includeModel(true, Models.BomText, 'text')])],
      });
    },
    xrels: async (item: any) => {
      const slug = item.getDataValue ? item.getDataValue('slug') : item.slug;
      const rows: any[] = await Models.BomXrels.findAll({
        where: { src_type: 'object', src_slug: slug },
      });
      if (!rows.length) return [];

      const peopleSlugs: string[] = [];
      const placeSlugs: string[]  = [];
      const objectSlugs: string[] = [];
      for (const r of rows) {
        const dt = r.getDataValue('dst_type');
        const ds = r.getDataValue('dst_slug');
        if (dt === 'people') peopleSlugs.push(ds);
        else if (dt === 'place') placeSlugs.push(ds);
        else if (dt === 'object') objectSlugs.push(ds);
        // group: no lookup
      }

      const [people, places, objs] = await Promise.all([
        peopleSlugs.length ? Models.BomPeople.findAll({ where: { slug: [...new Set(peopleSlugs)] } }) : [],
        placeSlugs.length  ? Models.BomPlaces.findAll({ where: { slug: [...new Set(placeSlugs)]  } }) : [],
        objectSlugs.length ? Models.BomObjects.findAll({ where: { slug: [...new Set(objectSlugs)] } }) : [],
      ]);

      const peopleMap = new Map<string, any>(people.map((p: any) => [p.getDataValue('slug'), p]));
      const placeMap  = new Map<string, any>(places.map((p: any) => [p.getDataValue('slug'), p]));
      const objectMap = new Map<string, any>(objs.map((o: any) => [o.getDataValue('slug'), o]));

      const resolved = rows.map((r: any) => {
        const dst_type = r.getDataValue('dst_type');
        const dst_slug = r.getDataValue('dst_slug');
        const note     = r.getDataValue('note');
        let dst_name: string  = dst_slug;
        let dst_title: string | null = null;
        if (dst_type === 'people') {
          const p = peopleMap.get(dst_slug);
          if (p) { dst_name = p.getDataValue('name'); dst_title = p.getDataValue('title'); }
          else warnMissing(dst_type, dst_slug);
        } else if (dst_type === 'place') {
          const p = placeMap.get(dst_slug);
          if (p) { dst_name = p.getDataValue('name'); dst_title = p.getDataValue('info'); }
          else warnMissing(dst_type, dst_slug);
        } else if (dst_type === 'object') {
          const o = objectMap.get(dst_slug);
          if (o) { dst_name = o.getDataValue('name'); dst_title = o.getDataValue('subtitle'); }
          else warnMissing(dst_type, dst_slug);
        }
        // dst_type === 'group' falls through with dst_name = dst_slug
        return {
          rel:       r.getDataValue('rel'),
          srcweight: r.getDataValue('srcweight'),
          dst_type,
          dst_slug,
          dst_name,
          dst_title,
          note,
          verse_id:  parseVerseIdFromNote(note),
        };
      });

      // Sort: verse_id ASC NULLS LAST, srcweight ASC, dst_slug ASC
      resolved.sort((a, b) => {
        if (a.verse_id == null && b.verse_id == null) {
          // both null: fall through to srcweight
        } else if (a.verse_id == null) return 1;
        else if (b.verse_id == null) return -1;
        else if (a.verse_id !== b.verse_id) return a.verse_id - b.verse_id;
        if ((a.srcweight ?? 50) !== (b.srcweight ?? 50)) return (a.srcweight ?? 50) - (b.srcweight ?? 50);
        return a.dst_slug.localeCompare(b.dst_slug);
      });

      return resolved;
    },
  },
};

// Cross-resolver helpers (mirror BomPeoplePlace.ts:548-712)
export const loadObjectsFromTextGuid = async (guid: string, slugs: string[], lang: string) => {
  slugs = Array.isArray(slugs) ? slugs : slugs ? [slugs] : [];

  const objectSlugs = (await Models.BomLookup.findAll({
    attributes: ['text_guid'],
    where: { text_guid: guid },
    include: [{
      model: Models.BomIndex,
      as: 'bomIndexReference',
      attributes: ['slug'],
      where: { type: 'object' }
    }]
  }))?.map((item: any) => item.getDataValue('bomIndexReference').getDataValue('slug')).filter((x: any) => !!x);

  const uniqueSlugs = [...new Set([...(objectSlugs || []), ...slugs])];
  if (!uniqueSlugs.length) return [];

  const include: any[] = [];
  if (lang && lang !== 'en') {
    include.push(includeTranslation({ [Op.or]: ['name', 'subtitle', 'description'] }, lang));
  }

  return await Models.BomObjects.findAll({
    where: { slug: uniqueSlugs },
    include: include.filter(x => !!x),
  });
};

export const loadObjectsFromVerseIds = async (verse_ids: number[], lang: string) => {
  if (!verse_ids.length) return [];

  const minVerseId = Math.min(...verse_ids);
  const maxVerseId = Math.max(...verse_ids);

  const objectSlugs = (await Models.BomIndex.findAll({
    where: {
      type: 'object',
      verse_id:     { [Op.lte]: maxVerseId },
      verse_id_end: { [Op.gte]: minVerseId },
    },
    attributes: ['slug'],
  }))?.map((item: any) => item.getDataValue('slug')).filter((x: any) => !!x);

  const uniqueSlugs = [...new Set(objectSlugs || [])];
  if (!uniqueSlugs.length) return [];

  const include: any[] = [];
  if (lang && lang !== 'en') {
    include.push(includeTranslation({ [Op.or]: ['name', 'subtitle', 'description'] }, lang));
  }

  return await Models.BomObjects.findAll({
    where: { slug: uniqueSlugs },
    include: include.filter(x => !!x),
  });
};
