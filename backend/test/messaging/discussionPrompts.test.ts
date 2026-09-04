import { describe, expect, test } from 'vitest';
import { openerPrompts, validatePromptBundle } from '../../src/bots/discussionPrompts.js';

describe('discussion prompt localization', () => {
  test('reports every missing surface in an incomplete bundle', () => {
    expect(validatePromptBundle({ openerTask: '과제' })).toContain('openerLength');
    expect(validatePromptBundle({ openerTask: '과제' })).toContain('moves.respond');
  });

  test('substitutes localized block text into an authored highlight instruction', () => {
    const prompts = openerPrompts({ highlightInstruction: '다음 본문: {{blockText}}' }, '니파이의 기록');
    expect(prompts).toContain('다음 본문: 니파이의 기록');
  });
});
