# Transactional email rollout

## Scope

This system sends account-security and explicitly opted-in unread-activity mail. It has no campaign, audience, list, or bulk-send surface. AWS SES is isolated behind `src/mail/adapters/ses.ts`; producers and the outbox use the provider-neutral `Mailer` contract.

## Fail-closed switches

All three must be considered independently:

- `MAIL_SENDING_ENABLED`: master delivery switch.
- `MAIL_SECURITY_ENABLED`: password-reset and account-recovery lane.
- `MAIL_NOTIFICATIONS_ENABLED`: reply, mention, direct-message, invite, and summary lane.

Deploy code and migrations with all switches false. Enable security first. Notification email remains off until preferences have been exposed and users explicitly opt in.

## Delivery policy

| Event | First eligible send | Group hold | Later delivery |
| --- | ---: | ---: | --- |
| Password reset / account recovery | Immediate | 15-minute idempotency | Never summarized; 3/account/hour and 5/IP/hour |
| Reply | 5 minutes | 30 minutes/thread | Unread summary |
| Mention | 2 minutes | 30 minutes/thread | Unread summary |
| Direct message | 2 minutes | 20 minutes/conversation | Unread summary |
| Invite | Immediate once | None | No repeat |
| Reaction | In-app only | N/A | Never emailed |

Optional notifications are capped at 3/user/hour and 8/user/day. After the first summary, a group can produce at most one summary every two hours. Online recipients are deferred for up to 15 minutes. A read, dismissal, removed source notification, or channel read watermark cancels queued delivery. Summaries contain only counts and links; message bodies are never copied into the email queue or outbox.

## Translation grid

`bom_email_template_definition` owns the template key, version, category, and exact required-variable set. `bom_email_template` owns language-specific subject, preheader, body, CTA, brand, footer, review state, reviewer, and publication time. Runtime resolves an exact published language first, then published English and emits fallback telemetry. ICU MessageFormat handles plurals; undeclared or missing placeholders reject rendering. Layout HTML/CSS exists only in the renderer.

## Canary sequence

1. Keep all switches false and verify `/health`, GraphQL, worker startup logs, SQS access, and zero outbox delivery.
2. Use the SES mailbox simulator with a dedicated authorized canary account; verify delivery, bounce, complaint, suppression, retry, and DLQ behavior.
3. Set master and security true, notifications false. Exercise reset and account recovery and confirm generic anti-enumeration responses and rate limits.
4. Monitor outbox failures, SES complaint/bounce events, SQS age, DLQ depth, and application errors.
5. After preference UI acceptance, set notifications true. Opt in only test accounts first and validate grace, read cancellation, online deferral, holds, summaries, and caps.

## Rollback

Disable the affected lane first; the worker will not claim disabled-lane rows. Disable the master switch to stop all delivery. The schema is additive and can remain during rollback. The previous production `mail.env` is retained as `mail.env.pre-transactional-policy`.
