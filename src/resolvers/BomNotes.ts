import { models as Models } from '../config/database';
import { getSlug, Op, includeTranslation, translatedValue, includeModel, queryWhere } from './_common';
import { split, SentenceSplitterSyntax } from 'sentence-splitter';
import scripture from '../library/scripture';

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
        limit: 5
      });
    },
    fax: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      let filter = args.filter;
      let where = filter === 'pdf' ? { com: 0, hide: 0 } : { fax: 1 };
      const model = Models.BomXtrasFax;
      return model.findAll({
        where: where,
        order: ['weight'],
        include: [includeTranslation({ [Op.or]: ['title', 'info'] }, lang)].filter(x => !!x)
      });
    },
    history: async (root: any, args: any, context: any, info: any) => {
      const lang = context.lang ? context.lang : null;
      let conditions = {
        where: {slug:args.slug},
        order: ['seq'],
        include: [includeTranslation({ [Op.or]: ['source','author','document','citation','teaser','transcript'] }, lang)].filter(x => !!x)
      };
      if(!args.slug) delete conditions.where;
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
    reference: (item: any, args: any, { db, res }: any, info: any) => {
      let start: number = parseInt(item.getDataValue('verse_id'));
      let end: number = start - 1 + parseInt(item.getDataValue('verse_range'));
      let range: Array<number> = Array(end - start + 1)
        .fill(0)
        .map((_, idx) => start + idx);
      return scripture.generateReference(range);
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
    }
  }
};
