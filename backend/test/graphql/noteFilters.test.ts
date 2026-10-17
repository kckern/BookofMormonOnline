// notes-H1 (R3 blind review): textual-variant notes are critical-apparatus
// shorthand (manuscript sigla 𝒪/𝒫, "ATV" = Analysis of Textual Variants) that
// read as cipher on the Home front door; the sampler drops them.
import { describe, expect, it } from 'vitest';
import { isVariantNote, dropVariantNotes } from '../../src/graphql/resolvers/noteFilters.js';

describe('noteFilters', () => {
  it('flags sigla / ATV notes, keeps prose notes', () => {
    expect(isVariantNote('\u{1D4AA}, \u{1D4AB}was as eternal')).toBe(true);
    expect(isVariantNote('<i>ATV</i> raise up one unto or raise up a seer unto')).toBe(true);
    expect(isVariantNote('Alma gave the same admonition to Helaman at Alma 36:3.')).toBe(false);
    expect(isVariantNote('Fulfilled in the ATVs of later years')).toBe(false);
  });
  it('drops variant rows but never empties the pool', () => {
    const v = { text: 'ATV raise up one' };
    const p = { text: 'A readable note about the passage.' };
    expect(dropVariantNotes([v, p, v])).toEqual([p]);
    expect(dropVariantNotes([v])).toEqual([v]);
  });
});
