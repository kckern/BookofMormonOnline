/**
 * test/bots/reply-shape.test.ts
 *
 * Unit tests for the reply length + link histogram. Reformer discussion replies
 * must be concise with controlled variety (1→15% · 2→45% · 3→25% · 4→15%),
 * capped at 4 normally / 6 when linking, ~1/3 attaching a scripture link.
 */

import { describe, it, expect } from 'vitest';
import { sampleReplyShape, replyLengthInstruction } from '../../src/bots/replyShape.js';

// sampleReplyShape draws random() twice: first → sentence bucket, second → link.
const withDraws = (sentenceDraw: number, linkDraw: number) => {
  let calls = 0;
  return sampleReplyShape(() => (calls++ === 0 ? sentenceDraw : linkDraw));
};

describe('sampleReplyShape', () => {
  it('maps the histogram buckets to sentence targets', () => {
    expect(withDraws(0.10, 0.9).targetSentences).toBe(1); // < 0.15
    expect(withDraws(0.50, 0.9).targetSentences).toBe(2); // 0.15–0.60
    expect(withDraws(0.70, 0.9).targetSentences).toBe(3); // 0.60–0.85
    expect(withDraws(0.90, 0.9).targetSentences).toBe(4); // ≥ 0.85
  });

  it('raises the cap to 6 when linking, else 4', () => {
    const linking = withDraws(0.5, 0.1); // second draw < 0.33 → link
    expect(linking.wantsLink).toBe(true);
    expect(linking.cap).toBe(6);

    const plain = withDraws(0.5, 0.9); // second draw ≥ 0.33 → no link
    expect(plain.wantsLink).toBe(false);
    expect(plain.cap).toBe(4);
  });
});

describe('replyLengthInstruction', () => {
  it('is word-anchored, marked as overriding, and asks for a scripture when linking', () => {
    const plain = replyLengthInstruction({ targetSentences: 2, cap: 4, wantsLink: false });
    expect(plain).toContain('2 short sentences');
    expect(plain).toContain('under ~44 words'); // 2 * 22
    expect(plain).toContain('OVERRIDES');

    const linked = replyLengthInstruction({ targetSentences: 3, cap: 6, wantsLink: true });
    expect(linked).toContain('additional supporting scripture');
    expect(linked).toContain('under ~96 words'); // 3 * 22 + 30
  });

  it('uses singular "one short sentence" for a target of 1', () => {
    expect(replyLengthInstruction({ targetSentences: 1, cap: 4, wantsLink: false }))
      .toContain('one short sentence');
  });
});
