import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSchema } from 'graphql-yoga';
import GraphQLJSON from 'graphql-type-json';
import type { AppContext } from './context.js';
import { resolvers } from './resolvers.js';

// backend/schema/*.graphql is the frozen API contract (legacy SDL verbatim).
const SCHEMA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'schema');

export function loadTypeDefs(): string[] {
  return readdirSync(SCHEMA_DIR)
    .filter((f) => f.endsWith('.graphql'))
    .sort()
    .map((f) => readFileSync(join(SCHEMA_DIR, f), 'utf8'));
}

export function buildSchema() {
  return createSchema<AppContext>({
    typeDefs: loadTypeDefs(),
    resolvers: {
      // graphql-type-json matches the legacy JSON scalar byte-for-byte
      JSON: GraphQLJSON,
      ...resolvers,
    },
  });
}
