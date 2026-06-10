import type { Division } from '../domain/contents.js';
import type { ContentsRepository } from '../data/contentsRepository.js';

export class ContentsService {
  constructor(private readonly contents: ContentsRepository) {}

  /** Table of contents: all divisions, or those matching the given slugs. */
  divisions(slugs: readonly string[] | null): Promise<Division[]> {
    return this.contents.divisions(slugs);
  }
}
