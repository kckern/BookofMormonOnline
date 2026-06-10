import type { ContentsRepository, DivisionRow } from '../data/contentsRepository.js';

export class ContentsService {
  constructor(private readonly contents: ContentsRepository) {}

  /** Table of contents roots: all divisions, or those matching the given slugs. */
  divisions(slugs: readonly string[] | null): Promise<DivisionRow[]> {
    return this.contents.divisions(slugs);
  }
}
