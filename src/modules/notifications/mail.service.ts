import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';

// Workaround for potential ESM/CJS interop issues with @sendgrid/mail
const sendGrid = (sgMail as any).default || sgMail;

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
        if (apiKey) {
            sendGrid.setApiKey(apiKey);
        } else {
            this.logger.warn('SENDGRID_API_KEY not found in environment');
        }
    }

    /**
     * Send an email using a basic HTML template.
     */
    async sendEmail(to: string, subject: string, message: string) {
        const sendEmailToggle = this.configService.get<string>('SEND_EMAIL');

        if (sendEmailToggle !== 'true') {
            this.logger.log(`Email sending is disabled (SEND_EMAIL=${sendEmailToggle}). Skipping email to ${to}.`);
            return;
        }

        const from = this.configService.get<string>('SENDGRID_FROM_EMAIL') || 'no-reply@nftbid.com';
        const siteName = this.configService.get<string>('SITE_NAME') || 'NFT Bid Marketplace';

        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333;">${siteName}</h2>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 16px; color: #555;">${message}</p>
        <p style="font-size: 14px; color: #999; margin-top: 30px;">
          Best regards,<br />
          The ${siteName} Team
        </p>
      </div>
    `;

        const msg = {
            to,
            from,
            subject: `[${siteName}] ${subject}`,
            text: message,
            html,
        };

        try {
            await sendGrid.send(msg);
            this.logger.log(`Email sent to ${to}: ${subject}`);
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}`, error.response?.body || error.message);
        }
    }
}
