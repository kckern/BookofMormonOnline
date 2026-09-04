/**
 * bots/discussionMoves.ts — conversation dynamics for managed discussions.
 *
 * Without direction, every follow-up reply defaults to "I agree…" — a chain of
 * rubber-stamps. Instead we assign each turn a distinct discourse MOVE from a
 * rotation, so a thread has real dynamics: some build, some question, some push
 * back, some reframe. Friction (disagreement) lands ~half the time and is
 * character-gated in the instruction — a bot dissents only where its persona
 * genuinely would. After the first clarify/pushback, the original poster gets a
 * turn to respond, for genuine back-and-forth.
 */

export type DiscussionMove =
  | 'expand'
  | 'clarify'
  | 'pushback'
  | 'probe'
  | 'reframe'
  | 'concede_qualify'
  | 'respond';

const FRICTION: DiscussionMove[] = ['pushback', 'probe'];
const NON_FRICTION: DiscussionMove[] = ['expand', 'clarify', 'reframe', 'concede_qualify'];

/** Moves that invite the original poster to answer back. */
export const OP_RESPONSE_TRIGGERS: DiscussionMove[] = ['clarify', 'pushback'];

export interface PlannedTurn {
  /** true when this turn is the opener re-entering to respond. */
  isOpenerResponse: boolean;
  move: DiscussionMove;
}

/**
 * Plan the move for each follow-up turn: ~50% friction, never two of the same
 * move back-to-back, never a bare agreement. Then insert ONE opener-response
 * turn right after the first clarify/pushback (bounded so the opener doesn't
 * dominate). `random` is injectable for deterministic tests.
 */
export function planMoves(followerCount: number, random: () => number = Math.random): PlannedTurn[] {
  const seq: DiscussionMove[] = [];
  for (let i = 0; i < followerCount; i++) {
    const wantFriction = random() < 0.5;
    const base = wantFriction ? FRICTION : NON_FRICTION;
    const pool = base.filter((m) => m !== seq[i - 1]);
    const choices = pool.length ? pool : base;
    seq.push(choices[Math.floor(random() * choices.length)]!);
  }

  const turns: PlannedTurn[] = seq.map((move) => ({ isOpenerResponse: false, move }));
  const firstTrigger = turns.findIndex((t) => OP_RESPONSE_TRIGGERS.includes(t.move));
  if (firstTrigger >= 0) {
    turns.splice(firstTrigger + 1, 0, { isOpenerResponse: true, move: 'respond' });
  }
  return turns;
}

const ANTI_STAMP = "Do NOT open with 'I agree' or restate consensus.";

/** The move-specific instruction appended to a reply turn's guidance. */
export function moveInstruction(move: DiscussionMove): string {
  const body = ((): string => {
    switch (move) {
      case 'expand':
        return 'MOVE — expand: build on a specific point already made; add a further reason, implication, or distinction. Advance the thought rather than echoing it.';
      case 'clarify':
        return 'MOVE — clarify: ask ONE genuine clarifying question of a specific prior speaker — surface an ambiguity or press for a definition. End on the question.';
      case 'pushback':
        return 'MOVE — pushback: disagree with a specific claim already made, but ONLY where your historical persona genuinely would. State the disagreement plainly with its reason. If your persona would not dissent here, sharpen a probing question instead.';
      case 'probe':
        return 'MOVE — probe: stress-test the reasoning. Name a tension, edge case, or unexamined assumption in a prior point and invite the thread to think it through.';
      case 'reframe':
        return 'MOVE — reframe: recast the discussion through your configured lens — a different angle or category — without dismissing the prior point.';
      case 'concede_qualify':
        return 'MOVE — concede then qualify: grant the prior point, then add ONE substantive qualification that complicates it. The caveat must do real work; never a bare agreement.';
      case 'respond':
        return 'MOVE — respond as the original poster: a participant has questioned or challenged your opening claim. Answer their specific point directly — resolve the question or defend and refine your claim.';
    }
  })();
  return `${body} ${ANTI_STAMP}`;
}
