import { models as Models, sequelize as Sequelize } from '../config/database';
import { getSlug, Op, includeTranslation, translatedValue, includeModel, queryWhere } from './_common';
import { split, SentenceSplitterSyntax } from 'sentence-splitter';
import scripture from '../library/scripture';
import { lookupReference } from 'scripture-guide';
import { loadPeopleFromTextGuid, loadPeopleFromVerseIds, loadPlacesFromVerseIds, loadNotesFromTextGuid } from './BomPeoplePlace';
import { loadObjectsFromTextGuid, loadObjectsFromVerseIds } from './BomObjects';
import { queryDB } from '../library/db';
import { organizeRelatedScriptures } from './lib';

export default {
  Query: {
    publications: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : 'en';
      return Models.BomXtrasSource.findAll({
        where: queryWhere('source_lang', lang)
      });
    },
    commentary: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      return Models.BomXtrasCommentary.findAll({
        where: queryWhere('id', args.id),
        include: [
          includeModel(info, Models.BomXtrasSource, 'publication'),
          includeModel(
            info,
            Models.BomText,
            'location',
            [
              includeModel(info, Models.BomNarration, 'narration', [includeTranslation('description', lang)]),
              includeModel(info, Models.BomSection, 'parent_section', [includeTranslation('title', lang)]),
              includeModel(info, Models.BomPage, 'parent_page', [includeTranslation('title', lang)])
            ].filter(x => !!x)
          )
        ].filter(x => !!x),
        limit: 100
      });
    },
    fax: async (root: any, args: any, context: any, info: any) => {
      const fetchResults = async (model: any, where: any, lang: string) => {
        return await model.findAll({
          where: where,
          order: ['weight'],
          include: [includeTranslation({ [Op.or]: ['title', 'info'] }, lang)].filter(x => !!x)
        });
      };
    
      let lang = context.lang ? context.lang : null;
      let filter = args.filter;
      let where = filter === 'pdf' ? { com: 0, hide: 0, lang: lang } : { fax: 1, lang: lang};
      const model = Models.BomXtrasFax;
    
      let results = await fetchResults(model, where, lang);
    
      if (results.length === 0 && lang !== 'en') {
        lang = 'en';
        where = filter === 'pdf' ? { com: 0, hide: 0, lang: lang } : { fax: 1, lang: lang };
        results = await fetchResults(model, where, lang);
      }
    
      return results;
    },
    faxIndex: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      const faxSlug = args.slug;
      //type FaxIndex { slug: String pages: [[Int]] }

      const items = await Models.BomXtrasFaxIndex.findAll({
        where: {
          version: faxSlug
        },
        attributes: [
          'version',
          'page',
          [Sequelize.fn('MIN', Sequelize.col('verse_id')), 'first_verse_id'],
          [Sequelize.fn('MAX', Sequelize.col('verse_id')), 'last_verse_id'],
          [Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('verse_id'))), 'verse_count']
        ],
        group: ['version', 'page'],
        order: ['version', 'page']
      });
      return {
        slug: faxSlug,
        pages: items.map((x: any, i: number) => {
          const prevItem = items[i - 1];
          const firstWholeVerseIsFirstContent = !prevItem || prevItem && prevItem.getDataValue('last_verse_id') !== x.getDataValue('first_verse_id');
          const vals = [x.getDataValue('first_verse_id'), x.getDataValue('verse_count')];
          if(firstWholeVerseIsFirstContent) vals.push(1);
          return vals;
        })
      };
    },
    history: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      const where: any = {};
      if (args.slug)      where.slug      = args.slug;
      if (args.archive)   where.archive   = args.archive;
      if (args.principal?.length) where.principal = { [Op.in]: args.principal };
      const conditions: any = {
        order: ['seq'],
        include: [includeTranslation({ [Op.or]: ['source','author','document','citation','teaser','transcript'] }, lang)].filter(x => !!x)
      };
      if (Object.keys(where).length) conditions.where = where;
      return Models.BomXtrasHistory.findAll(conditions);
    },
    image: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      if ('id' in args)
        return Models.BomXtrasImage.findAll({
          where: queryWhere('id', args.id),
          include: [
            includeTranslation({ [Op.or]: ['title'] }, lang),
            includeModel(
              info,
              Models.BomText,
              'location',
              [
                includeModel(info, Models.BomNarration, 'narration', [includeTranslation('description', lang)]),
                includeModel(info, Models.BomSection, 'parent_section', [includeTranslation('title', lang)]),
                includeModel(info, Models.BomPage, 'parent_page', [includeTranslation('title', lang)])
              ].filter(x => !!x)
            )
          ].filter(x => !!x)
        });
      return null;
    },
    chiasmus: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      const id = args.id;
    const config = {
      where: queryWhere('chiasmus_id', id),
      include: [includeTranslation({ [Op.or]: ['line_text', 'highlights','label','title'] }, lang)].filter(x => !!x)
    };
      if(!id) delete config.where;
      const lines = await Models.BomXtrasChiasmus.findAll(config);

      const chiasms =  lines.reduce((acc: any, item: any) => {
        const chiasmus_id = item.chiasmus_id; // Assuming each item has a chiasmus_id property

        const scheme = lines.filter((x:any)=>x.chiasmus_id === chiasmus_id).map((x:any)=>x.line_key).join('');
        const uniqueVerseIds = lines.filter((x:any)=>x.chiasmus_id === chiasmus_id).map((x:any)=>{
          const {verse_id, verses} = x;
          const versesIds = [];
          for(let i = 0; i < verses; i++){
            versesIds.push(parseInt(verse_id) + i);
          }
          return versesIds
        }).flat().filter((x:any,i:any,a:any)=>a.indexOf(x) === i);
        const reference = scripture.generateReference(uniqueVerseIds, lang);
        // title of first line 
        const firstLine = lines.find((x:any)=>x.chiasmus_id === chiasmus_id);
        if (!acc[chiasmus_id]) {
          acc[chiasmus_id] = {
            reference,
            title: firstLine.getDataValue('title'),
            scheme,
            chiasmus_id,
            lines: []
          };
        }

        acc[chiasmus_id].lines.push({
          guid: item.guid,
          line_key: item.line_key,
          line_text: item.line_text,
          highlights: item.highlights,
          label: item.label
        });

        return acc;
      }, {});
      return Object.values(chiasms);
    },
    passagenotes: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      
      // Handle both verse_ids array and start/end verse_id parameters
      let verse_ids: number[] = [];
      
      if (args.verse_ids && Array.isArray(args.verse_ids)) {
        verse_ids = args.verse_ids;
      } else if (args.start_verse_id && args.end_verse_id) {
        // Generate array from start to end verse_id (inclusive)
        const start = parseInt(args.start_verse_id);
        const end = parseInt(args.end_verse_id);
        if (start <= end) {
          verse_ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        }
      } else if (args.start_verse_id) {
        // Just a single verse if only start_verse_id is provided
        verse_ids = [parseInt(args.start_verse_id)];
      }
      
      if (!verse_ids.length) {
        return {
          commentary: [],
          sources: [],
          chiasmus: [],
          people: [],
          places: [],
          objects: [],
          images: [],
          notes: [],
          fax: [],
          mapstory: [],
          refs: []
        };
      }

      const [
        commentary,
        sources,
        chiasmus,
        images,
        fax,
        mapstory,
        textGuids,
        refs
      ] = await Promise.all([
        // Commentary
        Models.BomXtrasCommentary.findAll({
          where: {
            verse_id: verse_ids,
            is_note: { [Op.ne]: 1 }
          },
          include: [
            includeModel(info, Models.BomXtrasSource, 'publication'),
            includeModel(info, Models.BomText, 'location')
          ].filter(x => !!x),
          limit: 100
        }),
        
        // Sources
        Models.BomXtrasSource.findAll({
          where: queryWhere('source_lang', lang || 'en')
        }),
        
        // Chiasmus
        Models.BomXtrasChiasmus.findAll({
          where: {
            verse_id: verse_ids
          },
          include: [includeTranslation({ [Op.or]: ['line_text', 'highlights','label','title'] }, lang)].filter(x => !!x)
        }),
        
        // Images - get via text guids since they don't have verse_id directly
        (async () => {
          const lookups = await Models.BomLookup.findAll({
            where: {
              verse_id: verse_ids
            },
            attributes: ['text_guid'],
            raw: true
          });
          const textGuids = [...new Set(lookups.map((l: any) => l.text_guid))];
          if (textGuids.length === 0) return [];
          return await Models.BomXtrasImage.findAll({
            where: {
              location_guid: textGuids
            },
            include: [
              includeTranslation({ [Op.or]: ['title'] }, lang),
              includeModel(info, Models.BomText, 'location')
            ].filter(x => !!x)
          });
        })(),
        
        // Fax
        Models.BomXtrasFax.findAll({
          where: {
            fax: 1,
            lang: lang || 'en'
          },
          include: [includeTranslation({ [Op.or]: ['title', 'info'] }, lang)].filter(x => !!x)
        }),
        
        // Map stories - need to check by reference parsing since moves don't have verse_id
        (async () => {
          const stories = await Models.BomMapStory.findAll({
            include: [
              includeTranslation({ [Op.or]: ['title', 'description'] }, lang),
              {
                model: Models.BomMapMove,
                as: 'moves',
                required: false,
                include: [
                  includeTranslation({ [Op.or]: ['travelers', 'description'] }, lang)
                ].filter(x => !!x)
              }
            ].filter(x => !!x)
          });
          // Filter stories that have moves with relevant verse references
          return stories.filter((story: any) => 
            story.moves && story.moves.some((move: any) => {
              const ref = move.getDataValue('ref');
              if (!ref) return false;
              try {
                const { verse_ids: moveVerseIds } = lookupReference(ref) || { verse_ids: [] };
                return moveVerseIds && moveVerseIds.some((vid: number) => verse_ids.includes(vid));
              } catch {
                return false;
              }
            })
          );
        })(),
        
        // Get text guids for loading people, places, and notes
        Models.BomLookup.findAll({
          where: {
            verse_id: verse_ids
          },
          attributes: ['text_guid'],
          raw: true
        }),
        
        // Refs/Cross-references
        (async () => {
          if (!verse_ids || verse_ids.length === 0) {
            return [];
          }
          const placeholders = verse_ids.map(() => '?').join(',');
          const sql = `SELECT dst_verse_id as verse_id,\`type\`,significant,dst_ref as ref
            FROM \`scripture.guide\`.scripture_references 
            WHERE src_verse_id IN (${placeholders})
            AND \`type\` = "xref"
            AND significant IN (0,1,-1)`;
          const refsData = await queryDB(sql, verse_ids);
          return organizeRelatedScriptures(refsData);
        })()
      ]);

      // Get unique text guids
      const guids = [...new Set(textGuids.map((t: any) => t.text_guid).filter(guid => guid))];
      
      // Load people, places, objects, and notes using both verse-based and text-guid-based approaches
      const [people, places, objects, notes] = await Promise.all([
        // Load people from both verse IDs and text GUIDs
        Promise.all([
          loadPeopleFromVerseIds(verse_ids, lang),
          guids.length > 0 ? Promise.all(guids.map(guid => loadPeopleFromTextGuid(guid, [], lang))).then(results => results.flat()) : []
        ]).then(results => results.flat()),

        // Load places directly from verse IDs via BomIndex
        loadPlacesFromVerseIds(verse_ids, lang),

        // Load objects from both verse IDs and text GUIDs
        Promise.all([
          loadObjectsFromVerseIds(verse_ids, lang),
          guids.length > 0 ? Promise.all(guids.map(guid => loadObjectsFromTextGuid(guid, [], lang))).then(results => results.flat()) : []
        ]).then(results => results.flat()),

        // Load notes from text GUIDs
        guids.length > 0 ? Promise.all(guids.map(guid => loadNotesFromTextGuid(guid, lang))).then(results => results.flat()) : []
      ]);

      // Process chiasmus data similar to the existing chiasmus resolver
      const processedChiasmus = chiasmus.reduce((acc: any, item: any) => {
        const chiasmus_id = item.chiasmus_id;
        if (!acc[chiasmus_id]) {
          acc[chiasmus_id] = {
            reference: scripture.generateReference([item.verse_id], lang),
            title: item.getDataValue('title'),
            scheme: item.line_key,
            chiasmus_id,
            lines: []
          };
        }
        acc[chiasmus_id].lines.push({
          guid: item.guid,
          line_key: item.line_key,
          line_text: item.line_text,
          highlights: item.highlights,
          label: item.label
        });
        return acc;
      }, {});

      return {
        commentary: commentary || [],
        sources: sources || [],
        chiasmus: Object.values(processedChiasmus) || [],
        people: people || [],
        places: places || [],
        objects: objects || [],
        images: images || [],
        notes: notes || [],
        fax: fax || [],
        mapstory: mapstory || [],
        refs: refs || []
      };
    }
  },
  Mutation: {},
  Image: {
    title: (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item,"title");
    }
  },
  HistoricalDocument:{
    source: (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item,"source");
    },
    author: (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item,"author");
    },
    document: (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item,"document");
    },
    citation: (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item,"citation");
    },
    teaser: (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item,"teaser");
    },
    transcript: (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item,"transcript");
    }
  },
  Commentary: {
    reference: (item: any, args: any, { db, res, lang }: any, info: any) => {
      let start: number = parseInt(item.getDataValue('verse_id'));
      let end: number = start - 1 + parseInt(item.getDataValue('verse_range'));
      let range: Array<number> = Array(end - start + 1)
        .fill(0)
        .map((_, idx) => start + idx);
      return scripture.generateReference(range, lang);
    },
    preview: (item: any, args: any, { db, res }: any, info: any) => {
      let text = item.getDataValue('text');
      let isNote = item.getDataValue('is_note');
      if([-1,1].includes(isNote)) return text.replace(/(<([^>]+)>)/gi, '');
      //remove html tags
      text = text.replace(/(<([^>]+)>)/gi, '').replace(/&#(\d+);/g, function(match, dec) {
        return String.fromCharCode(dec);
      }).replace(/\s+/g, ' ').trim();

      const sentences = split(text).map(x=>x.raw).filter(x=>{
        if(/[()]/.test(x)) return false;
        if(/[\[\]]/.test(x)) return false;
        if(/p\.\s*\d+/.test(x)) return false;
        if(x.split(';').length > 2) return false;
        return true;
      }).join('').replace(/\s+/g, ' ').trim();


      const words = sentences.split(' ')
      let preview = words.slice(0, 50).join(' ');
      if (words.length > 50) {
        preview = preview.trim() + '...';
      }
      return preview.replace(/\s+/g, ' ').trim();
    }
  },
  Fax: {
    title: (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item,"title");
    },
    info: (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item,"info");
    },
    index: (item: any, args: any, { db, res }: any, info: any) => {
      return [0];
    }
  }
};
