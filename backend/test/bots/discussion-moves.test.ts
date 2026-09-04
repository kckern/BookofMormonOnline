/**
 * test/bots/discussion-moves.test.ts — move rotation + OP-response insertion.
 */
import { describe, it, expect } from 'vitest';
import { planMoves, moveInstruction, type DiscussionMove } from '../../src/bots/discussionMoves.js';

/** A deterministic random() that replays a fixed sequence (looping). */
const scripted = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe('planMoves', () => {
  it('never repeats a move back-to-back in the base sequence', () => {
    // Real RNG, many trials — the no-consecutive-repeat invariant must always hold.
    for (let trial = 0; trial < 200; trial++) {
      const turns = planMoves(5);
      const base = turns.filter((t) => !t.isOpenerResponse).map((t) => t.move);
      for (let i = 1; i < base.length; i++) expect(base[i]).not.toBe(base[i - 1]);
    }
  });

  it('inserts one opener-response right after the first clarify/pushback', () => {
    // First follower: wantFriction=false (>=0.5), pick index 1 of NON_FRICTION = 'clarify'.
    const turns = planMoves(1, scripted([0.9, 0.3]));
    expect(turns).toHaveLength(2);
    expect(turns[0]).toEqual({ isOpenerResponse: false, move: 'clarify' });
    expect(turns[1]).toEqual({ isOpenerResponse: true, move: 'respond' });
  });

  it('adds no opener-response when no clarify/pushback occurs', () => {
    // Force all non-friction, index 0 = 'expand' — but no consecutive repeats, so
    // it alternates; none are clarify/pushback triggers here.
    const turns = planMoves(2, scripted([0.9, 0.0, 0.9, 0.5]));
    expect(turns.some((t) => t.isOpenerResponse)).toBe(false);
    expect(turns.every((t) => t.move !== 'clarify' && t.move !== 'pushback')).toBe(true);
  });

  it('lands roughly half friction over many turns', () => {
    let friction = 0, total = 0;
    for (let trial = 0; trial < 300; trial++) {
      for (const t of planMoves(4)) {
        if (t.isOpenerResponse) continue;
        total++;
        if (t.move === 'pushback' || t.move === 'probe') friction++;
      }
    }
    const ratio = friction / total;
    expect(ratio).toBeGreaterThan(0.35);
    expect(ratio).toBeLessThan(0.65);
  });
});

describe('moveInstruction', () => {
  it('has a distinct instruction per move and always bans rubber-stamping', () => {
    const moves: DiscussionMove[] = ['expand', 'clarify', 'pushback', 'probe', 'reframe', 'concede_qualify', 'respond'];
    const texts = moves.map(moveInstruction);
    for (const t of texts) expect(t).toContain("Do NOT open with 'I agree'");
    expect(new Set(texts).size).toBe(moves.length); // all distinct
    expect(moveInstruction('pushback')).toContain('persona genuinely would'); // character-gated
    expect(moveInstruction('respond')).toContain('original poster');
  });
});
