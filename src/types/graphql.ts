import { Request, Response } from 'express';
import { GraphQLResolveInfo } from 'graphql';

export interface GraphQLContext {
  req: Request;
  res: Response;
  lang: string;
  ip: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export type ResolverFn<TResult, TParent = unknown, TArgs = Record<string, unknown>> = (
  parent: TParent,
  args: TArgs,
  context: GraphQLContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

// Common argument types
export interface PaginationArgs {
  limit?: number;
  offset?: number;
}

export interface SlugArgs {
  slug: string;
}

export interface IdArgs {
  id: string | number;
}

// Response types
export interface AuthResponse {
  isSuccess: boolean;
  msg: string;
  user: UserData | null;
}

export interface UserData {
  id: string;
  user: string;
  name: string;
  email: string;
  token: string;
  social: string[];
  progress: number;
}
