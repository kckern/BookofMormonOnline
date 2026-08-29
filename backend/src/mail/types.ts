export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: Record<string, string>;
}

export interface SendResult {
  ok: boolean;
  /** Opaque ID assigned by the configured delivery provider. */
  id?: string;
  error?: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<SendResult>;
}
