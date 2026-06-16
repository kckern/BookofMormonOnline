import { createUserLoader, UserLoader } from './userLoader';

export interface DataLoaders {
  userLoader: UserLoader;
}

export const createDataLoaders = (): DataLoaders => ({
  userLoader: createUserLoader()
});

export { createUserLoader } from './userLoader';
