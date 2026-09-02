import { describe, expect, it } from 'vitest';
import { chooseAudienceRespondent } from '../../src/bots/scheduler.js';

const eck = { bot_id: 'eck', response_weight: 100, topic_triggers: ['grace', 'baptism'] };
const clement = { bot_id: 'clement', response_weight: 50, topic_triggers: JSON.stringify(['marriage', 'authority']) };

describe('chooseAudienceRespondent', () => {
  it('returns no audience voice when the configured chance misses', () => {
    expect(chooseAudienceRespondent([eck], 'Baptism and grace', 35, () => 0.9)).toBeUndefined();
  });

  it('only selects respondents whose DB triggers match the topic', () => {
    expect(chooseAudienceRespondent([eck, clement], 'Jacob 2 marriage and wives', 100, () => 0))
      .toEqual(clement);
  });

  it('accepts JSON-column values returned as either arrays or strings', () => {
    expect(chooseAudienceRespondent([eck], 'A question about BAPTISM', 100, () => 0))
      .toEqual(eck);
    expect(chooseAudienceRespondent([clement], 'A question about authority', 100, () => 0))
      .toEqual(clement);
  });

  it('never admits an audience respondent with no topic match', () => {
    expect(chooseAudienceRespondent([eck, clement], 'Alma 32 faith as a seed', 100, () => 0))
      .toBeUndefined();
  });
});
