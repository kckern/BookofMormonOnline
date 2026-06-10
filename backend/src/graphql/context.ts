import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { env } from '../config/env.js';
import { createLoaders, type Loaders } from '../data/loaders.js';
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

export interface AppContext {
  lang: string;
  sandbox: boolean;
  services: Services;
  loaders: Loaders;
}

/** Per-request context: lang-bound services + loaders, no shared mutable language state. */
export function buildContext(db: Kysely<DB>, lang: string): AppContext {
  const loaders = createLoaders(db, lang);
  return {
    lang,
    sandbox: env.SANDBOX,
    services: {
      labels: new LabelsService(new LabelsRepository(db, loaders.translator)),
      contents: new ContentsService(new ContentsRepository(db)),
      pages: new PagesService(new PageRepository(db)),
    },
    loaders,
  };
}
