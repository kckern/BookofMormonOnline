import { GraphQLError } from 'graphql';
import { AppError, ErrorCode } from '../library/errors';
import { logError } from '../library/utils/logger';

export const formatGraphQLError = (error: GraphQLError): GraphQLError => {
  const originalError = error.originalError;

  // Log the error
  logError('GraphQL Error', originalError || new Error(error.message), {
    path: error.path,
    locations: error.locations
  });

  // If it's our custom error, preserve the code
  if (originalError instanceof AppError) {
    return new GraphQLError(originalError.message, {
      extensions: {
        code: originalError.code,
        details: originalError.details
      }
    });
  }

  // For unexpected errors, return generic message in production
  if (process.env.NODE_ENV === 'production') {
    return new GraphQLError('An unexpected error occurred', {
      extensions: { code: ErrorCode.INTERNAL_ERROR }
    });
  }

  // In development, include full error details
  return error;
};
