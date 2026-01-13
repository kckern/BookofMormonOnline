import { Model, Sequelize } from 'sequelize';
import { models, models as Models, sequelize, SQLQueryTypes } from '../config/database';
import { getSlug, Op, includeTranslation, translatedValue, includeModel, queryWhere } from './_common';
import {setLang, generateReference,lookupReference} from "scripture-guide";

// Cache for relationship labels to avoid repeated database calls
const labelsCache = new Map();

// Helper function to detect which fields are being requested in the GraphQL query
const getRequestedFields = (info: any, typeName: string): string[] => {
  if (!info || info === true) return [];
  
  try {
    // Get the field nodes from the GraphQL info object
    const fieldNode = info.fieldNodes[0];
    if (!fieldNode || !fieldNode.selectionSet) {
      return [];
    }
    
    // Get the selection nodes for the specified type
    const selections = fieldNode.selectionSet.selections || [];
    
    // Extract the field names that are being requested
    return selections
      .filter(selection => selection.kind === 'Field')
      .map(selection => selection.name.value);
  } catch (e) {
    console.error('Error extracting requested fields:', e);
    return [];
  }
};

// Helper function to include translations only for requested fields
const includeSelectiveTranslation = (
  possibleFields: string[], 
  info: any, 
  lang: string, 
  resolverType: string = 'person'
): object | null => {
  // Return early if no translation needed
  if (!lang || lang === 'en') return null;
  
  // Get requested fields from the current resolver context
  const requestedFields = info !== true ? getRequestedFields(info, resolverType) : [];
  
  // If we can't determine requested fields, include all possible fields for safety
  if (!requestedFields.length) {
    return includeTranslation({ [Op.or]: possibleFields }, lang);
  }
  
  // Only include translations for fields that are actually requested
  const fieldsToInclude = possibleFields.filter(field => 
    requestedFields.includes(field)
  );
  
  // If none of the requested fields need translation, return null
  if (!fieldsToInclude.length) return null;
  
  return includeTranslation({ [Op.or]: fieldsToInclude }, lang);
};

export default {
  Query: {
    person: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      let indexSort = null;
      
      // Get requested fields using proper AST traversal
      const requestedFields = info !== true ? getRequestedFields(info, 'person') : [];
      const needsIndex = requestedFields.includes('index');
      const needsRelations = requestedFields.includes('relations');
      
      if (needsIndex) indexSort = ['index', 'verse_id'];
      
      // Only include relationships when explicitly requested
      // This can greatly reduce query complexity and time
      const includes = [];
      
      // Only include translations for requested fields
      const translationInclude = includeSelectiveTranslation(
        ['name', 'title', 'description'], 
        info, 
        lang,
        'person'
      );
      
      if (translationInclude) {
        includes.push(translationInclude);
      }
      
      // Only include index if requested
      if (needsIndex) {
        includes.push(
          includeModel(info, Models.BomIndex, 'index', [
            includeTranslation('text', lang),
            includeModel(true, Models.BomLookup, 'text_guid', [includeModel(true, Models.BomText, 'text')])
          ].filter(x => !!x))
        );
      }
      
      // Only include relationships if relations field is requested
      if (needsRelations) {
        includes.push(
          {
            model: Models.BomPeopleRels.unscoped(),
            as: 'relationDst',
            include: [
              {
                model: Models.BomPeople,
                as: 'personSrc',
                include: [includeTranslation({ [Op.or]: ['name', 'title'] }, lang)].filter(x => !!x)
              }
            ].filter(x => !!x)
          },
          {
            model: Models.BomPeopleRels.unscoped(),
            as: 'relationSrc',
            include: [
              {
                model: Models.BomPeople,
                as: 'personDst',
                include: [includeTranslation({ [Op.or]: ['name', 'title'] }, lang)].filter(x => !!x)
              }
            ].filter(x => !!x)
          }
        );
      }
      
      return Models.BomPeople.findAll({
        where: queryWhere(
          'slug',
          args.slug?.map((s: any) => s.replace(/^.*?\//, ''))
        ),
        include: includes.filter(x => !!x),
        order: ['weight', indexSort].filter(x => !!x)
      });
    },
    place: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      let indexSort = null;
      
      // Get requested fields using proper AST traversal
      const requestedFields = info !== true ? getRequestedFields(info, 'place') : [];
      const needsIndex = requestedFields.includes('index');
      const needsMaps = requestedFields.includes('maps');
      
      if (needsIndex) indexSort = ['index', 'verse_id'];
      
      // Only include relationships when explicitly requested
      const includes = [];
      
      // Only include translations for requested fields
      const translationInclude = includeSelectiveTranslation(
        ['name', 'info', 'label'], 
        info, 
        lang,
        'place'
      );
      
      if (translationInclude) {
        includes.push(translationInclude);
      }
      
      // Only include maps if requested
      if (needsMaps) {
        includes.push(
          includeModel(info, Models.BomMap, 'maps', [
            includeTranslation({ [Op.or]: ['name', 'desc'] }, lang)
          ].filter(x => !!x))
        );
      }
      
      // Only include index if requested
      if (needsIndex) {
        includes.push(
          includeModel(info, Models.BomIndex, 'index', [
            includeTranslation('text', lang),
            includeModel(true, Models.BomLookup, 'text_guid', [includeModel(true, Models.BomText, 'text')])
          ].filter(x => !!x))
        );
      }
      
      return Models.BomPlaces.findAll({
        where: queryWhere(
          'slug',
          args.slug?.map((s: any) => s.replace(/^.*?\//, ''))
        ),
        include: includes.filter(x => !!x),
        order: ['weight', indexSort].filter(x => !!x)
      });
    },
    maps: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      if ('slug' in args)
        return Models.BomMap.findAll({
          nest: false,
          where: {
            slug: args.slug
          },
          include: [
            includeTranslation({ [Op.or]: ['name', 'desc'] }, lang),
            includeModel(info, Models.BomPlaces, 'places',[
              includeTranslation({ [Op.or]: ['name', 'info','label'] }, lang)
            ])
          ].filter(x => !!x),
          order: ['priority']
        });
      return Models.BomMap.findAll({
        include: [includeTranslation({ [Op.or]: ['name', 'desc'] }, lang)].filter(x => !!x),
        order: ['priority']
      });
    },
    timeline: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      if ('slug' in args)
        return Models.BomTimeline.findAll({
          nest: false,
          where: {
            slug: args.slug
          },
          include: [
            {
              model: Models.BomText,
              as: 'text',
              required: false
            }
          ],
          order: ['y']
        });
      return Models.BomTimeline.findAll({
        include: [
          {
            model: Models.BomText,
            as: 'text',
            required: false
          }
        ],
        order: ['y']
      });
    },
    mapstory: async (root: any, args: any, context: any, info: any) => {

      return Models.BomMapStory.findOne({
        where: {
          slug: args.slug
        },
        include: [
          {
            model: Models.BomMapMove,
            as: 'moves',
            include: [
              includeTranslation({ [Op.or]: ['travelers', 'description'] }, context.lang)
            ]
          }
        ]
      });
    },
    mapstories: async (root: any, args: any, context: any, info: any) => {

      const mapSlug = args.map;
      return Models.BomMapStory.findAll({
        include: [
          includeTranslation({ [Op.or]: ['title', 'description'] }, context.lang),
          {
            model: Models.BomMapMove,
            as: 'moves',
            include: [
              includeTranslation({ [Op.or]: ['travelers', 'description'] }, context.lang),
              {
                model: Models.BomPlaces,
                as: 'startPlace',
                foreignKey: 'guid',
                sourceKey: 'start',
                include: [
                  includeTranslation({ [Op.or]: ['name', 'info'] }, context.lang),
                  {
                    model: Models.BomPlacesCoords,
                    as: 'coords',
                    where: {
                      map: mapSlug
                    },
                    required: true // Make sure this is true
                  }
                ].filter(x => !!x)
              },
              {
                model: Models.BomPlaces,
                as: 'endPlace',
                foreignKey: 'guid',
                sourceKey: 'end',
                include: [
                  includeTranslation({ [Op.or]: ['name', 'info'] }, context.lang),
                  {
                    model: Models.BomPlacesCoords,
                    as: 'coords',
                    where: {
                      map: mapSlug
                    },
                    required: true // Make sure this is true
                  }
                ].filter(x => !!x)
              },
              {
                model: Models.BomMapMoveCoords,
                as: 'coords',
                where: {
                  map: mapSlug
                },
                required: false // Make this false as it's optional
              },
              {
                model: Models.BomPeople,
                as: 'people',
                include: [includeTranslation({ [Op.or]: ['name', 'title'] }, context.lang)].filter(x => !!x)
              }
            ].filter(x => !!x)
          }
        ].filter(x => !!x)
      }).then((stories: any) => {
        return stories.map((story: any) => {
          const moves = story.getDataValue('moves').map((move: any) => {
            const start = move.dataValues.startPlace?.coords?.[0]?.dataValues?.lat;
            const end = move.dataValues.endPlace?.coords?.[0]?.dataValues?.lat;
            if(!start || !end) return null;
            return move;
          }).filter((x:any)=>!!x);
          if(!moves.length) return null;
          story.moves = moves.sort((a:any,b:any)=>a.seq-b.seq);
          return story;
        }).filter((x:any)=>!!x);
      });
      }

  },

  People: {
    name: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'name');
    },
    title: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'title');
    },
    description: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'description');
    },
    async relations(item: any, args: any, {lang}: any) {
      // Extract relationSrc and relationDst if they exist
      var relationSrc: [any] = item?.getDataValue('relationSrc') || [];
      var relationDst: [any] = item?.getDataValue('relationDst') || [];
      
      // Early return if there are no relationships
      if (!relationSrc.length && !relationDst.length) {
        return [];
      }
      
      // Get all relationship labels once and cache them per language
      const cacheKey = `peoplerel_${lang || 'en'}`;
      
      let allLabels;
      if (!labelsCache.has(cacheKey)) {
        allLabels = (await Models.BomLabel.findAll({
          raw: true,
          where: {
            type: 'peoplerel'
          },
          include: [{
            model: Models.BomTranslation,
            as: 'translation',
            where: { lang: lang },
            attributes: ['value'],
            required: false
          }]
        })).map((i:any)=>{return {
          label_id: i.label_id.replace(/^rel_/,''),
          label_text: i['translation.value'] || i.label_text
        }});
        
        // Store in cache - each language has its own cache entry
        labelsCache.set(cacheKey, allLabels);
      } else {
        allLabels = labelsCache.get(cacheKey);
      }
      
      // Build relations array with optimized handling
      const relations = [];
      
      // Process source relations
      for (const rel of relationSrc) {
        if (rel.getDataValue('srcrel')) {
          const relation = translatedValue(rel, 'srcrel');
          const person = rel.getDataValue('personDst');
          
          if (person) {
            const label = allLabels.find((l:any) => l.label_id === relation);
            relations.push({
              relation: label ? label.label_text : relation,
              person
            });
          }
        }
      }
      
      // Process destination relations
      for (const rel of relationDst) {
        if (rel.getDataValue('dstrel')) {
          const relation = translatedValue(rel, 'dstrel');
          const person = rel.getDataValue('personSrc');
          
          if (person) {
            const label = allLabels.find((l:any) => l.label_id === relation);
            relations.push({
              relation: label ? label.label_text : relation,
              person
            });
          }
        }
      }
      
      return relations;
    },
    index: async (item: any, args: any, { db, res }: any, info: any) => {
      const indices = item.getDataValue('index');
      
      // Handle the case when no indices are loaded
      if (!indices || !indices.length) {
        return [];
      }
      
      // Filter only people indices efficiently
      return indices.filter((i: any) => i.getDataValue('type') === 'people');
    }
  },

  Event: {
    heading: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'heading');
    },
    html: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'html');
    },
    date: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'date');
    },
    link: async (item: any, args: any, { db, res }: any, info: any) => {
      //console.log({item});
      return 'x';
      return getSlug('link', item.getDataValue('page')).then(slug => slug + '/' + item.getDataValue('link'));
    }
  },

  Place: {
    name: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'name');
    },
    label: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'label');
    },
    info: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'info');
    },
    lat: async (item: any, args: any, { db, res }: any, info: any) => {
      const coords = item.getDataValue('coords')?.[0]?.dataValues || item.dataValues?._bom_places_coords || {};
      return coords?.lat || null;
    },
    lng: async (item: any, args: any, { db, res }: any, info: any) => {
      const coords = item.getDataValue('coords')?.[0]?.dataValues || item.dataValues?._bom_places_coords || {};
      return coords?.lng || null;
    },
    minZoom: async (item: any, args: any, { db, res }: any, info: any) => {
      return item.dataValues?._bom_places_coords?.min || null;
    },
    maxZoom: async (item: any, args: any, { db, res }: any, info: any) => {
      return item.dataValues?._bom_places_coords?.max || null;
    },
    index: async (item: any, args: any, { db, res }: any, info: any) => {
      const indices = item.getDataValue('index');
      
      // Handle the case when no indices are loaded
      if (!indices || !indices.length) {
        return [];
      }
      
      // Filter only place indices efficiently
      return indices.filter((i: any) => i.getDataValue('type') === 'place');
    }
  },
  Index: {
    slug: async (item: any, args: any, { db, res }: any, info: any) => {
      const guid = item
        .getDataValue('text_guid')
        .getDataValue('text')
        .getDataValue('page');
      if (!guid) return 'contents';
      const num = item
        .getDataValue('text_guid')
        .getDataValue('text')
        .getDataValue('link');
      return getSlug('link', guid).then(slug => slug + '/' + num);
    },
    ref: async (item: any, args: any, { lang }: any, info: any) => {
      lang = lang || 'en';
      const from =  parseInt(item.getDataValue('verse_id'));
      const to =  parseInt(item.getDataValue('verse_id_end'));
      const range = [...new Set(Array.from({length: to - from + 1}, (_, i) => from + i))];
      if(lang !== 'en') setLang(lang);
      const ref = generateReference(range);
      return `${ref}`;

    },
    text: async (item: any, args: any, { db, res }: any, info: any) => {
      //console.log({item});
      return translatedValue(item, 'text');
    }
  },
  Map :{

    name: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'name');
    },
    desc: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'desc');
    },
  },
  MapStory: {
    title: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'title');
    },
    description: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'description');
    },
  },
  MapMove: {
    travelers: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'travelers');
    },
    description: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'description');
    },
    verse_ids: async (item: any, args: any, { db, res }: any, info: any) => {
      const ref = item.getDataValue('ref');
      const verse_ids = lookupReference(ref).verse_ids;
      if(!Array.isArray(verse_ids)) return null;
      return verse_ids;
    }
  },
};

export const loadPeopleFromTextGuid = async (guid: string, slugs: string[], lang) => {
  slugs = Array.isArray(slugs) ? slugs : slugs ? [slugs] : [];
  
  // Use the newly added index on text_guid to make this query more efficient
  const peopleSlugs = (await Models.BomLookup.findAll({
    attributes: ['text_guid'],
    where: {
      text_guid: guid
    },
    include: [
      {
        model: Models.BomIndex,
        as: 'bomIndexReference',
        attributes: ['slug'],
        where: {
          type: 'people' // retrieved slugs for 'people' type
        }
      }
    ]
  }))?.map((item: any) => item.getDataValue('bomIndexReference').getDataValue('slug')).filter(x => !!x);

  const uniqueSlugs = [...new Set([...peopleSlugs, ...slugs])];
  
  // Return early if no slugs to avoid unnecessary DB query
  if (!uniqueSlugs.length) {
    return [];
  }

  // Load people using query function above
  // Only include translation if language is not English
  const include = [];
  if (lang && lang !== 'en') {
    include.push(includeTranslation({ [Op.or]: ['name', 'title', 'description'] }, lang));
  }
  
  const people = await Models.BomPeople.findAll({
    where: {
      slug: uniqueSlugs
    },
    include: include.filter(x => !!x),
  });

  return people;
}

export const loadPlacesFromTextGuid = async (guid: string, slugs: string[], lang: string) => {
  slugs = Array.isArray(slugs) ? slugs : slugs ? [slugs] : [];
  
  // Use the newly added index on text_guid to make this query more efficient
  const placeSlugs = (await Models.BomLookup.findAll({
    attributes: ['text_guid'],
    where: {
      text_guid: guid
    },
    include: [
      {
        model: Models.BomIndex,
        as: 'bomIndexReference',
        attributes: ['slug'],
        where: {
          type: 'place' // retrieved slugs for 'place' type
        }
      }
    ]
  }))?.map((item: any) => item.getDataValue('bomIndexReference').getDataValue('slug')).filter(x => !!x);

  const uniqueSlugs = [...new Set([...placeSlugs, ...slugs])];
  
  // Return early if no slugs to avoid unnecessary DB query
  if (!uniqueSlugs.length) {
    return [];
  }
  
  // Only include translation if language is not English
  const include = [];
  if (lang && lang !== 'en') {
    include.push(includeTranslation({ [Op.or]: ['name', 'info'] }, lang));
  }

  // Load places using query function above
  const places = await Models.BomPlaces.findAll({
    where: {
      slug: uniqueSlugs
    },
    include: include.filter(x => !!x),
  });

  return places;
}

// Load people directly from verse IDs using BomIndex with proper range handling
export const loadPeopleFromVerseIds = async (verse_ids: number[], lang: string) => {
  if (!verse_ids.length) return [];
  
  const minVerseId = Math.min(...verse_ids);
  const maxVerseId = Math.max(...verse_ids);
  
  const peopleSlugs = (await Models.BomIndex.findAll({
    where: {
      type: 'people',
      // Check for overlap: entry starts before or at our max, and ends after or at our min
      verse_id: { [Op.lte]: maxVerseId },
      verse_id_end: { [Op.gte]: minVerseId }
    },
    attributes: ['slug']
  }))?.map((item: any) => item.getDataValue('slug')).filter(x => !!x);

  const uniqueSlugs = [...new Set(peopleSlugs)];
  
  if (uniqueSlugs.length === 0) return [];

  const people = await Models.BomPeople.findAll({
    where: {
      slug: uniqueSlugs
    },
    include: [includeTranslation({ [Op.or]: ['name', 'title', "description"] }, lang)].filter(x => !!x),
  });

  return people;
}

// Load places directly from verse IDs using BomIndex with proper range handling
export const loadPlacesFromVerseIds = async (verse_ids: number[], lang: string) => {
  if (!verse_ids.length) return [];
  
  const minVerseId = Math.min(...verse_ids);
  const maxVerseId = Math.max(...verse_ids);
  
  const placeSlugs = (await Models.BomIndex.findAll({
    where: {
      type: 'place', // Note: might be 'place' not 'places'
      // Check for overlap: entry starts before or at our max, and ends after or at our min
      verse_id: { [Op.lte]: maxVerseId },
      verse_id_end: { [Op.gte]: minVerseId }
    },
    attributes: ['slug']
  }))?.map((item: any) => item.getDataValue('slug')).filter(x => !!x);

  const uniqueSlugs = [...new Set(placeSlugs)];
  
  if (uniqueSlugs.length === 0) return [];

  const places = await Models.BomPlaces.findAll({
    where: {
      slug: uniqueSlugs
    },
    include: [includeTranslation({ [Op.or]: ['name', 'info'] }, lang)].filter(x => !!x),
  });

  return places;
}

export const loadNotesFromTextGuid = async (guid: string, lang) => {
  return (await Models.BomXtrasCommentary.findAll({
    where: {
      is_note: 1,
      location_guid: guid
    }
  })||[]).map((item: any) => {
    return {
      id: item.getDataValue('id'),
      title: item.getDataValue('title'),
      text: item.getDataValue('text'),
    };
  });
}