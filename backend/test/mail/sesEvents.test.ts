import { describe, expect, it } from 'vitest';
import { parseSesEvent } from '../../src/mail/adapters/sesEvents.js';

describe('SES delivery-event adapter', () => {
  it('normalizes an SNS-wrapped bounce into the provider-neutral contract', () => {
    const body = JSON.stringify({
      MessageId: 'sns-event-1',
      Message: JSON.stringify({
        eventType: 'Bounce',
        mail: { messageId: 'provider-message-1', timestamp: '2026-08-29T12:00:00Z' },
        bounce: { bouncedRecipients: [{ emailAddress: 'User@Example.com' }] },
      }),
    });
    expect(parseSesEvent(body, 'queue-1')).toMatchObject({
      id: 'sns-event-1',
      providerMessageId: 'provider-message-1',
      type: 'bounce',
      recipients: ['User@Example.com'],
    });
  });
});
