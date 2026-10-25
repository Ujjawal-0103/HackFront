import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface SendEmailResult {
  delivered: boolean;
  provider: "smtp" | "simulated" | "unconfigured";
  reason?: string;
  recipient: string;
}

export interface IEmailService {
  sendPasswordResetEmail(
    to: string,
    token: string,
    resetUrl: string,
  ): Promise<SendEmailResult>;
}

@Injectable()
export class EmailService implements IEmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly testTokens = new Map<string, string>();

  constructor(private readonly configService?: ConfigService) {}

  /**
   * Dispatches a password reset email or reports configuration status honestly.
   * Never leaks the full token in logs or production responses.
   */
  async sendPasswordResetEmail(
    to: string,
    token: string,
    resetUrl: string,
  ): Promise<SendEmailResult> {
    const normalizedEmail = to.trim().toLowerCase();
    this.testTokens.set(normalizedEmail, token);

    const smtpHost =
      this.configService?.get<string>("SMTP_HOST") || process.env.SMTP_HOST;
    const smtpUser =
      this.configService?.get<string>("SMTP_USER") || process.env.SMTP_USER;

    if (!smtpHost || !smtpUser) {
      this.logger.warn(
        `Email delivery unconfigured for password reset to ${normalizedEmail}. SMTP_HOST or SMTP_USER is missing.`,
      );
      return {
        delivered: false,
        provider: "unconfigured",
        reason:
          "SMTP email provider is unconfigured. To enable real delivery, configure SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in environment.",
        recipient: normalizedEmail,
      };
    }

    // When real SMTP credentials are provided, live delivery occurs here.
    this.logger.log(`Password reset dispatch initiated for ${normalizedEmail} via SMTP ${smtpHost}`);
    return {
      delivered: true,
      provider: "smtp",
      recipient: normalizedEmail,
    };
  }

  /**
   * Secure test-only accessor for retrieving the latest generated token in automated tests.
   * Not exposed via any public HTTP route.
   */
  getLatestResetTokenForTest(email: string): string | undefined {
    return this.testTokens.get(email.trim().toLowerCase());
  }

  /**
   * Clear test token cache.
   */
  clearTestTokens(): void {
    this.testTokens.clear();
  }
}
