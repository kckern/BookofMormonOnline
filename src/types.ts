export interface Comment {
  msgId: number,
  userId: string,
  content: string,
  createdAt: number,
  deleted: Boolean
}

export * from './types/graphql';
