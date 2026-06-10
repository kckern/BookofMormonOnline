/** Table of contents: a division of the record, its pages, their sections. */
export interface SectionSummary {
  title: string | null;
  slug: string | null;
}

export interface PageSummary {
  title: string | null;
  slug: string | null;
  /** texts per section, in reading order — powers the divisionShell selection */
  counts: number[];
  sections: SectionSummary[];
}

export interface Division {
  title: string | null;
  slug: string | null;
  description: string | null;
  weight: number;
  pages: PageSummary[];
}
