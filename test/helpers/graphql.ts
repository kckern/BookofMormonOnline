import { ApolloServer } from 'apollo-server-express';
import typeDefs from '../../src/typeDefs';
import resolvers from '../../src/resolvers';

// Create test server instance
let testServer: ApolloServer | null = null;

export const getTestServer = (): ApolloServer => {
  if (!testServer) {
    testServer = new ApolloServer({
      typeDefs,
      resolvers,
      context: () => ({
        lang: 'en',
        ip: '127.0.0.1'
      })
    });
  }
  return testServer;
};

// Execute GraphQL query for testing
export const executeQuery = async <T = any>(
  query: string,
  variables?: Record<string, any>
): Promise<{ data?: T; errors?: readonly any[] }> => {
  const server = getTestServer();
  const result = await server.executeOperation({
    query,
    variables
  });

  return {
    data: result.data as T,
    errors: result.errors
  };
};

// Execute GraphQL mutation for testing
export const executeMutation = async <T = any>(
  mutation: string,
  variables?: Record<string, any>
): Promise<{ data?: T; errors?: readonly any[] }> => {
  return executeQuery<T>(mutation, variables);
};

// Helper for authenticated queries
export const executeAuthQuery = <T = any>(
  query: string,
  token: string,
  variables?: Record<string, unknown>
): Promise<{ data?: T; errors?: readonly any[] }> => {
  return executeQuery<T>(query, { ...variables, token });
};

// Common query fragments
export const fragments = {
  user: `
    fragment UserFields on User {
      user
      email
      name
      bookmark
      progress { completed started }
    }
  `,
  page: `
    fragment PageFields on Page {
      title
      slug
      sections { title slug }
    }
  `,
  textBlock: `
    fragment TextBlockFields on TextBlock {
      guid
      slug
      heading
      content
      duration
    }
  `,
  person: `
    fragment PersonFields on People {
      slug
      name
      title
      classification
      description
    }
  `,
  place: `
    fragment PlaceFields on Place {
      slug
      name
      info
      type
      location
    }
  `
};
