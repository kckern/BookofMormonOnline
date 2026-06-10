import type { CodegenConfig } from '@graphql-codegen/cli';

// Resolver types derived from the frozen contract (schema/*.graphql).
const config: CodegenConfig = {
  schema: 'schema/*.graphql',
  generates: {
    'codegen/graphql.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        contextType: '../src/graphql/context.js#AppContext',
        useTypeImports: true,
        scalars: { JSON: 'unknown' },
        defaultMapper: 'Partial<{T}>',
      },
    },
  },
};

export default config;
