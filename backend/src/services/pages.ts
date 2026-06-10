import type { PageRow } from '../data/loaders.js';
import type { PageRepository } from '../data/pageRepository.js';

export class PagesService {
  constructor(private readonly pages: PageRepository) {}

  bySlugs(slugs: readonly string[] | null): Promise<PageRow[]> {
    return this.pages.pages(slugs);
  }
}
