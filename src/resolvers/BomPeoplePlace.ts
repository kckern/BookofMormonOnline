import { Model, Sequelize } from 'sequelize';
import { models as Models, sequelize, SQLQueryTypes } from '../config/database';
import { getSlug, Op, includeTranslation, translatedValue, includeModel, queryWhere } from './_common';

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
          includeTranslation({ [Op.or]: ['name', 'title'] }, lang),
          includeModel(info, Models.BomIndex, 'index', [
            includeModel(true, Models.BomLookup, 'text_guid', [includeModel(true, Models.BomText, 'text')])
          ]),
          {
            model: Models.BomPeopleRels.unscoped(),
            as: 'relationDst',
            include: [
              {
                model: Models.BomPeople,
                as: 'personSrc'
              }
            ]
          },
          {
            model: Models.BomPeopleRels.unscoped(),
            as: 'relationSrc',
            include: [
              {
                model: Models.BomPeople,
                as: 'personDst'
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
            includeModel(true, Models.BomLookup, 'text_guid', [includeModel(true, Models.BomText, 'text')])
          ])
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
            includeModel(info, Models.BomPlaces, 'places')].filter(x => !!x),
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
    }
  },

  People: {
    name: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'name');
    },
    title: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'title');
    },
    relations(item: any) {
      // console.log(item)
      var relationSrc: [any] = item?.getDataValue('relationSrc');
      var relationDst: [any] = item?.getDataValue('relationDst');
      var relations = [];
      for (var rel of relationSrc) {
        if (rel.getDataValue('srcrel'))
          relations.push({
            relation: rel.getDataValue('srcrel'),
            person: rel.getDataValue('personDst')
          });
      }
      for (var rel of relationDst) {
        if (rel.getDataValue('dstrel'))
          relations.push({
            relation: rel.getDataValue('dstrel'),
            person: rel.getDataValue('personSrc')
          });
      }
      return relations;
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
    info: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'info');
    },
    lat: async (item: any, args: any, { db, res }: any, info: any) => {
      return item.dataValues?._bom_places_coords?.lat || null;
    },
    lng: async (item: any, args: any, { db, res }: any, info: any) => {
      return item.dataValues?._bom_places_coords?.lng || null;
    },
    minZoom: async (item: any, args: any, { db, res }: any, info: any) => {
      return item.dataValues?._bom_places_coords?.min || null;
    },
    maxZoom: async (item: any, args: any, { db, res }: any, info: any) => {
      return item.dataValues?._bom_places_coords?.max || null;
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
    }
  },
  Map :{

    name: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'name');
    },
    desc: async (item: any, args: any, { db, res }: any, info: any) => {
      return translatedValue(item, 'desc');
    },
  }
};