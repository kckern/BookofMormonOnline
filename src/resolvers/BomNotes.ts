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
        limit: 100
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
        const reference = scripture.generateReference(uniqueVerseIds);
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
