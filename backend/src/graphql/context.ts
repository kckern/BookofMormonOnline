import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { env } from '../config/env.js';
import { Translator } from '../data/translator.js';
import { LabelsRepository } from '../data/labelsRepository.js';
import { LabelsService } from '../services/labels.js';

export interface Services {
  labels: LabelsService;
}

export interface AppContext {
  lang: string;
  sandbox: boolean;
  services: Services;
}

/** Per-request context: lang-bound services, no shared mutable language state. */
export function buildContext(db: Kysely<DB>, lang: string): AppContext {
  const translator = new Translator(db, lang);
  return {
    lang,
    sandbox: env.SANDBOX,
    services: {
      labels: new LabelsService(new LabelsRepository(db, translator)),
    },
  };
}
