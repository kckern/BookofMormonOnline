// Home-sampler note filters (notes-H1, R3 blind review). Textual-variant notes
// are written in critical-apparatus shorthand — manuscript sigla 𝒪 (original)
// and 𝒫 (printer's manuscript), "ATV" (Skousen's Analysis of Textual Variants)
// — which reads as cipher to a newcomer on the front door. The Read page still
// shows them in place; only the Home sample skips them.
const VARIANT_NOTE = /[\u{1D4AA}\u{1D4AB}]|\bATV\b/u;
const plain = (html: string | null | undefined) => (html ?? '').replace(/<[^>]*>/g, '');

export const isVariantNote = (text: string | null | undefined): boolean => VARIANT_NOTE.test(plain(text));

/** Drop variant notes, falling back to the original rows rather than none. */
export function dropVariantNotes<T extends { text?: string | null }>(rows: T[]): T[] {
  const kept = rows.filter((r) => !isVariantNote(r.text));
  return kept.length ? kept : rows;
}
