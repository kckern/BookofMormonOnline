/**
 * Split text into chunks no longer than ~maxChars, breaking on sentence
 * boundaries. Verses (short) return a single chunk. Long-form entities
 * (commentary/narration/pages, Phase 2) get multiple passages.
 */
export function chunkText(text: string, maxChars: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const sentences = trimmed.match(/[^.!?]+[.!?]*\s*/g) ?? [trimmed];
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (current && (current + s).length > maxChars) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
