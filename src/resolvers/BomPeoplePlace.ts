import { Model, Sequelize } from 'sequelize';
import { models, models as Models, sequelize, SQLQueryTypes } from '../config/database';
import { getSlug, Op, includeTranslation, translatedValue, includeModel, queryWhere } from './_common';
import {setLang, generateReference,lookupReference} from "scripture-guide";

export default {
  Query: {
    person: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      let indexSort = null;
      if (info !== true) {
        let requestQuery = JSON.stringify(info.fieldNodes);
        if (new RegExp(`{"kind":"Name","value":"index"`).test(requestQuery)) indexSort = ['index', 'verse_id'];
      }
      return Models.BomPeople.findAll({
        where: queryWhere(
          'slug',
          args.slug?.map((s: any) => s.replace(/^.*?\//, ''))
        ),
        include: [
          includeTranslation({ [Op.or]: ['name', 'title',"description"] }, lang),
          includeModel(info, Models.BomIndex, 'index', [
            includeTranslation('text', lang), // Add translation here
            includeModel(true, Models.BomLookup, 'text_guid', [includeModel(true, Models.BomText, 'text')])
          ]),
          {
            model: Models.BomPeopleRels.unscoped(),
            as: 'relationDst',
            include: [
              //includeTranslation({ [Op.or]: ["srcrel", "dstrel"] }, lang),
              {
                model: Models.BomPeople,
                as: 'personSrc',
                include: [includeTranslation({ [Op.or]: ['name', 'title'] }, lang)].filter(x=>!!x)
              }
            ]
          },
          {
            model: Models.BomPeopleRels.unscoped(),
            as: 'relationSrc',
            include: [
             // includeTranslation({ [Op.or]: ["srcrel", "dstrel"] }, lang),
              {
                model: Models.BomPeople,
                as: 'personDst',
                include: [includeTranslation({ [Op.or]: ['name', 'title'] }, lang)].filter(x=>!!x)
              }
            ]
          }
          // includeModel(info, Models.BomPeopleRels, 'r'),
        ].filter(x => !!x),
        order: ['weight', indexSort].filter(x => !!x)
      });
    },
    place: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      let indexSort = null;
      if (info !== true) {
        let requestQuery = JSON.stringify(info.fieldNodes);
        if (new RegExp(`{"kind":"Name","value":"index"`).test(requestQuery)) indexSort = ['index', 'verse_id'];
      }
      return Models.BomPlaces.findAll({
        where: queryWhere(
          'slug',
          args.slug?.map((s: any) => s.replace(/^.*?\//, ''))
        ),
        include: [
          includeModel(info, Models.BomMap, 'maps',[includeTranslation({ [Op.or]: ['name', 'desc'] }, lang)]),
          includeTranslation({ [Op.or]: ['name', 'info'] }, lang),
          includeModel(info, Models.BomIndex, 'index', [
            includeTranslation('text', lang), // Add translation here
            includeModel(true, Models.BomLookup, 'text_guid', [includeModel(true, Models.BomText, 'text')])
          ].filter(x => !!x))
        ].filter(x => !!x),
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
                include: [includeTranslation({ [Op.or]: ['name', 'title'] }, context.lang)]
              }
            ]
          }
        ]
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
    async relations(item: any, args: any, {lang }: any) {


      var relationSrc: [any] = item?.getDataValue('relationSrc');
      var relationDst: [any] = item?.getDataValue('relationDst');
      var relations = [];
      for (var rel of relationSrc) {
        if (rel.getDataValue('srcrel'))
          relations.push({
            relation: translatedValue(rel, 'srcrel'),
            person: rel.getDataValue('personDst')
          });
      }
      for (var rel of relationDst) {
        if (rel.getDataValue('dstrel'))
          relations.push({
            relation: translatedValue(rel, 'dstrel'),
            person: rel.getDataValue('personSrc')
          });
      }
      const allLabels = (await Models.BomLabel.findAll({
        raw: true,
        //attributes: ['label_id','label_text'],
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
      })).map((i:any)=>{return {label_id:i.label_id.replace(/^rel_/,''),label_text:i['translation.value'] || i.label_text}});

      return relations.map((rel: any) => {
        if(!rel.person) return null;
        const label = allLabels.find((l:any)=>l.label_id==rel.relation);
        if(label) rel.relation = label?.['label_text'];
        return rel;
      }).filter((x:any)=>!!x);
    },
    index: async (item: any, args: any, { db, res }: any, info: any) => {
      return item.getDataValue('index').map((i: any) => {
        if(i.getDataValue('type') == 'people') return i;
        return null;
      }).filter((x:any)=>!!x);
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
      console.log({item});
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
      return item.getDataValue('index').map((i: any) => {
        if(i.getDataValue('type') == 'place') return i;
        return null;
      }).filter((x:any)=>!!x);
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

export  const loadPeopleFromTextGuid = async (guid: string, slugs: string[],lang) => {
  slugs = Array.isArray(slugs) ? slugs : slugs ? [slugs] : [];
//use Models.BoMLookup and Models.BomIndex to get the people slugs from the text_guid
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
}))?.map((item: any) => item.getDataValue('bomIndexReference').getDataValue('slug')).filter(x=>!!x);

const uniqueSlugs = [...new Set([...peopleSlugs, ...slugs])];

//load people using query function above
const people = await Models.BomPeople.findAll({
  where: {
    slug: uniqueSlugs
  },
  include: [includeTranslation({ [Op.or]: ['name', 'title', "description"] }, lang)].filter(x => !!x),
});


return people;


}

export const loadPlacesFromTextGuid = async (guid: string, slugs: string[], lang) => {
  slugs = Array.isArray(slugs) ? slugs : slugs ? [slugs] : [];
//use Models.BoMLookup and Models.BomIndex to get the people slugs from the text_guid
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
        type: 'places'
      }
    }
  ]
}))?.map((item: any) => item.getDataValue('bomIndexReference').getDataValue('slug')).filter(x=>!!x);
const uniqueSlugs = [...new Set([...placeSlugs, ...slugs])];
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