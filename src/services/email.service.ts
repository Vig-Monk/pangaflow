// =============================================================================
// soko-api/src/services/email.service.ts
// High-Reliability Transactional Order & Digital Download Email Delivery
// =============================================================================

import nodemailer from 'nodemailer';
import { env } from '../config/env';
import pino from 'pino';

const logger = pino();

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!transporter && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }
  return transporter;
}

export interface EmailDownloadItem {
  bookTitle: string;
  format: string;
  token: string;
}

export interface SendOrderEmailPayload {
  toEmail: string;
  customerName: string;
  customerPhone: string;
  orderId: string;
  total: number;
  downloads: EmailDownloadItem[];
  deliveryType: 'delivery' | 'pickup';
  deliveryConfirmationCode: string | null;
  deliveryLocation: string;
}

export async function sendOrderConfirmationEmail(
  payload: SendOrderEmailPayload
): Promise<boolean> {
  const mailer = getTransporter();
  if (!mailer) {
    logger.warn('SMTP transport not configured. Skipping email dispatch.');
    return false;
  }

  const frontendUrl = env.FRONTEND_URL.replace(/\/$/, '');
  const publicApiUrl = env.API_PUBLIC_URL.replace(/\/$/, '');
  const recoveryUrl = `${frontendUrl}/checkout/confirm?orderId=${payload.orderId}&phone=${encodeURIComponent(payload.customerPhone)}`;
  const orderRef = payload.orderId.slice(0, 8).toUpperCase();

  const digitalDownloadCardsHtml = payload.downloads.length > 0
    ? `
      <div style="margin: 24px 0; padding: 20px; background-color: #F4EFE6; border-radius: 12px; border: 1px solid #E2D7C3;">
        <h3 style="margin: 0 0 14px 0; color: #052219; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">
          📖 Your Digital Editions (Direct Download)
        </h3>
        <p style="margin: 0 0 16px 0; font-size: 13px; color: #5F6964; line-height: 1.5;">
          Your digital copies are hosted in high-speed storage and ready to read immediately. Access is valid for 90 days.
        </p>
        ${payload.downloads.map(dl => {
          const dlLink = `${publicApiUrl}/api/v1/books/download/${dl.token}?redirect=true`;
          return `
            <div style="margin-bottom: 12px; padding: 14px; background: #FFFFFF; border-radius: 8px; border: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #052219; font-size: 14px; display: block;">${dl.bookTitle}</strong>
                <span style="display: inline-block; margin-top: 4px; padding: 2px 8px; background: #052219; color: #2EE59D; font-size: 10px; font-weight: bold; border-radius: 4px; text-transform: uppercase;">
                  ${dl.format.toUpperCase()} EBOOK
                </span>
              </div>
              <div style="margin-top: 8px;">
                <a href="${dlLink}" style="background-color: #052219; color: #FFFFFF; text-decoration: none; padding: 10px 18px; font-size: 12px; font-weight: bold; border-radius: 6px; display: inline-block;">
                  Download ${dl.format.toUpperCase()}
                </a>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `
    : '';

  const physicalDeliveryHtml = payload.deliveryConfirmationCode
    ? `
      <div style="margin: 24px 0; padding: 18px; background-color: #F0FDF4; border: 1px dashed #16A34A; border-radius: 12px; text-align: center;">
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #166534; font-weight: bold; display: block;">
          Courier Delivery Handover Code
        </span>
        <div style="font-size: 28px; font-family: monospace; font-weight: 800; letter-spacing: 6px; color: #052219; margin: 10px 0;">
          ${payload.deliveryConfirmationCode.split('').join(' ')}
        </div>
        <p style="margin: 0; font-size: 12px; color: #4B5563;">
          Read this 4-digit code to your dispatch rider upon delivery to confirm handover.
        </p>
      </div>
    `
    : '';

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order #${orderRef} Confirmed</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF8F5; margin: 0; padding: 24px; color: #141E1A;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #EAE5DC; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
          
          <!-- Header -->
          <div style="background-color: #052219; padding: 32px 24px; text-align: center;">
            <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; letter-spacing: -0.5px;">Flemela Bookstore</h1>
            <p style="color: #2EE59D; margin: 6px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
              Order Confirmed &amp; Verified
            </p>
          </div>

          <!-- Body -->
          <div style="padding: 32px 24px;">
            <p style="font-size: 15px; margin-top: 0;">
              Hello <strong>${payload.customerName}</strong>,
            </p>
            <p style="font-size: 14px; color: #4A5568; line-height: 1.6;">
              Thank you for reading with Flemela. Your payment of <strong>KSh ${payload.total.toLocaleString('en-KE')}</strong> for Order <strong>#${orderRef}</strong> has been received and confirmed.
            </p>

            ${digitalDownloadCardsHtml}
            ${physicalDeliveryHtml}

            <!-- Permanent Recovery Button -->
            <div style="text-align: center; margin: 32px 0 16px 0;">
              <a href="${recoveryUrl}" style="background-color: #F05A36; color: #FFFFFF; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: bold; border-radius: 8px; display: inline-block; box-shadow: 0 2px 8px rgba(240, 90, 54, 0.3);">
                View Live Order &amp; Library Access
              </a>
            </div>

            <p style="font-size: 12px; color: #718096; text-align: center; margin-top: 12px;">
              You can access this link at any time to recover your order details or digital downloads.
            </p>

            <!-- Order Meta -->
            <div style="border-top: 1px solid #E2E8F0; margin-top: 28px; padding-top: 20px; font-size: 12px; color: #718096;">
              <div><strong>Destination:</strong> ${payload.deliveryLocation}</div>
              <div style="margin-top: 4px;"><strong>Customer Contact:</strong> ${payload.customerPhone}</div>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #F8F9FA; padding: 20px; text-align: center; font-size: 11px; color: #A0AEC0; border-top: 1px solid #EDF2F7;">
            &copy; ${new Date().getFullYear()} Flemela Bookstore • Sarit Centre, Westlands, Nairobi.<br>
            Need assistance? Reach out to our concierge at <a href="https://wa.me/254700000000" style="color: #052219; font-weight: bold;">WhatsApp Concierge</a>.
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await mailer.sendMail({
      from: env.SMTP_FROM,
      to: payload.toEmail,
      subject: `📚 Your Flemela Books Are Ready! [Order #${orderRef}]`,
      html: htmlBody,
    });
    logger.info(`Transactional email dispatched to ${payload.toEmail} for Order #${orderRef}`);
    return true;
  } catch (err: any) {
    logger.error({ err: err.message, to: payload.toEmail }, 'Failed to dispatch order email');
    return false;
  }
}