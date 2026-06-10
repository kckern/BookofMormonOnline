/** scripture domain resolvers — see docs/reference/backend-resolver-porting-guide.md */
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import { fetchScripture, fetchVerses } from '../../data/loaders/scripture.js';
import type {
  PassageRow,
  ScriptureResultsRow,
  VerseFlatRow,
  ScriptureVerseRow,
  PassageVerseRow,
} from '../../data/loaders/scripture.js';

export const scriptureResolvers: Resolvers = {
  Query: {
    scripture: async (_root, args, ctx: AppContext) => {
      const lang = ctx.lang ?? 'en';
      const ref = args.ref ?? null;
      const verse_ids = args.verse_ids
        ? args.verse_ids.filter((v): v is number => v !== null && v !== undefined)
        : null;
      const version = args.version ?? 'LDS';
      const db = (ctx.loaders as unknown as { _scriptureDb: Parameters<typeof fetchScripture>[0] })._scriptureDb;
      return fetchScripture(db, lang, ref, verse_ids, version);
    },
    verses: async (_root, args, ctx: AppContext) => {
      const lang = ctx.lang ?? 'en';
      const verse_ids = args.verse_ids
        ? args.verse_ids.filter((v): v is number => v !== null && v !== undefined)
        : [];
      if (!verse_ids.length) return [];
      const db = (ctx.loaders as unknown as { _scriptureDb: Parameters<typeof fetchVerses>[0] })._scriptureDb;
      return fetchVerses(db, lang, verse_ids);
    },
  },

  ScriptureResults: {
    ref: (parent) => (parent as ScriptureResultsRow).ref ?? null,
    passages: (parent) => (parent as ScriptureResultsRow).passages ?? null,
    verses: (parent) => (parent as ScriptureResultsRow).verses ?? null,
  },

  Passage: {
    reference: (parent) => (parent as PassageRow).reference ?? null,
    heading: (parent) => (parent as PassageRow).heading ?? null,
    meta: (parent) => (parent as PassageRow).meta ?? null,
    verses: (parent) => (parent as PassageRow).verses ?? null,
  },

  Scripture: {
    verse_id: (parent) => (parent as ScriptureVerseRow | VerseFlatRow).verse_id ?? null,
    reference: (parent) => (parent as VerseFlatRow).reference ?? null,
    heading: (parent) => (parent as VerseFlatRow).heading ?? null,
    book: (parent) => (parent as ScriptureVerseRow).book ?? null,
    chapter: (parent) => (parent as ScriptureVerseRow).chapter ?? null,
    verse: (parent) => (parent as ScriptureVerseRow | PassageVerseRow).verse ?? null,
    text: (parent) => (parent as ScriptureVerseRow | VerseFlatRow).text ?? null,
    version: () => null,
  },
};
