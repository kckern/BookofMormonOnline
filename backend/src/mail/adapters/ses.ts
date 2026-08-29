import type { EmailMessage, Mailer, SendResult } from '../types.js';

/** AWS-specific implementation. No code outside this adapter imports the SES SDK. */
export class SesMailer implements Mailer {
  #client: unknown | null = null;

  constructor(
    private readonly from: string,
    private readonly region: string,
    private readonly configurationSet?: string,
  ) {}

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
      if (!this.#client) this.#client = new SESClient({ region: this.region });
      const client = this.#client as InstanceType<typeof SESClient>;
      const output = await client.send(new SendEmailCommand({
        Source: this.from,
        ConfigurationSetName: this.configurationSet,
        Tags: Object.entries(message.tags ?? {}).map(([Name, Value]) => ({ Name, Value })),
        Destination: { ToAddresses: [message.to] },
        Message: {
          Subject: { Data: message.subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: message.html, Charset: 'UTF-8' },
            Text: { Data: message.text, Charset: 'UTF-8' },
          },
        },
      }));
      return { ok: true, id: output.MessageId };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[mailer:ses] send failed to=${message.to}: ${error}`);
      return { ok: false, error };
    }
  }
}
