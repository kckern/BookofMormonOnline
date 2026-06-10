import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { env } from '../config/env.js';
import { createLoaders, type Loaders } from '../data/loaders.js';
import { scriptureLoaders } from '../data/loaders/scripture.js';
import { scripturereadLoaders } from '../data/loaders/scriptureread.js';
import { scriptureextrasLoaders } from '../data/loaders/scriptureextras.js';
import { peopleplacesLoaders } from '../data/loaders/peopleplaces.js';
import { mapsLoaders } from '../data/loaders/maps.js';
import { objectsLoaders } from '../data/loaders/objects.js';
import { mediaLoaders } from '../data/loaders/media.js';
import { mediamiscLoaders } from '../data/loaders/mediamisc.js';
import { feedsmiscLoaders } from '../data/loaders/feedsmisc.js';
import { searchhistLoaders } from '../data/loaders/searchhist.js';
import { userauthLoaders } from '../data/loaders/userauth.js';
import { userprofileLoaders } from '../data/loaders/userprofile.js';
import { useractivityLoaders } from '../data/loaders/useractivity.js';
import { LabelsRepository } from '../data/labelsRepository.js';
import { LabelsService } from '../services/labels.js';
import { ContentsRepository } from '../data/contentsRepository.js';
import { ContentsService } from '../services/contents.js';
import { PageRepository } from '../data/pageRepository.js';
import { PagesService } from '../services/pages.js';

export interface Services {
  labels: LabelsService;
  contents: ContentsService;
  pages: PagesService;
}

/** Core loaders + every domain factory's loaders, one flat per-request registry. */
export type AllLoaders = Loaders &
  ReturnType<typeof scriptureLoaders> &
  ReturnType<typeof scripturereadLoaders> &
  ReturnType<typeof scriptureextrasLoaders> &
  ReturnType<typeof peopleplacesLoaders> &
  ReturnType<typeof mapsLoaders> &
  ReturnType<typeof objectsLoaders> &
  ReturnType<typeof mediaLoaders> &
  ReturnType<typeof mediamiscLoaders> &
  ReturnType<typeof feedsmiscLoaders> &
  ReturnType<typeof searchhistLoaders> &
  ReturnType<typeof userauthLoaders> &
  ReturnType<typeof userprofileLoaders> &
  ReturnType<typeof useractivityLoaders>;

export interface AppContext {
  lang: string;
  sandbox: boolean;
  /** Per-request IP (legacy `log` stores it); resolved from headers in index.ts. */
  ip: string;
  /** Bearer token from the Authorization header — messenger* resolvers resolve the acting user from it. */
  bearerToken?: string;
  /** Per-request User-Agent (the ping analytics beacon forwards it to Clicky). */
  ua?: string;
  /** Writable Kysely instance — wrap writes in runWrite() for sandbox safety. */
  db: Kysely<DB>;
  services: Services;
  loaders: AllLoaders;
}

/** Per-request context: lang-bound services + loaders, no shared mutable language state. */
export function buildContext(db: Kysely<DB>, lang: string, ip = '', bearerToken?: string, ua?: string): AppContext {
  const core = createLoaders(db, lang);
  const loaders: AllLoaders = {
    ...core,
    ...scriptureLoaders(db, lang, core),
    ...scripturereadLoaders(db, lang, core),
    ...scriptureextrasLoaders(db, lang, core),
    ...peopleplacesLoaders(db, lang, core),
    ...mapsLoaders(db, lang, core),
    ...objectsLoaders(db, lang, core),
    ...mediaLoaders(db, lang, core),
    ...mediamiscLoaders(db, lang, core),
    ...feedsmiscLoaders(db, lang, core),
    ...searchhistLoaders(db, lang, core),
    ...userauthLoaders(db, lang, core),
    ...userprofileLoaders(db, lang, core),
    ...useractivityLoaders(db, lang, core),
  };
  return {
    lang,
    sandbox: env.SANDBOX,
    ip,
    bearerToken,
    ua,
    db,
    services: {
      labels: new LabelsService(new LabelsRepository(db, core.translator)),
      contents: new ContentsService(new ContentsRepository(db)),
      pages: new PagesService(new PageRepository(db)),
    },
    loaders,
  };
}
