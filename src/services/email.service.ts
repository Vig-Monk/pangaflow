// =============================================================================
// soko-api/src/services/email.service.ts
// Dynamic Tenant-Aware Transporter Pool with Automatic Fallback Strategy
// =============================================================================

import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { env } from '../config/env';
import { getDecryptedSmtpCredentials } from '../modules/smtp/smtp.queries';
import pino from 'pino';

const logger = pino();

interface CachedTransporter {
  transporter: nodemailer.Transporter;
  fingerprint: string;
  fromAddress: string;
  replyToAddress?: string | null;
}

// In-memory pool of open SMTP connection pools per organization
const transporterPool = new Map<string, CachedTransporter>();

/**
 * Invalidates cached transporter when credentials for an org change.
 */
export function invalidateTransporterCache(orgId: string): void {
  const cached = transporterPool.get(orgId);
  if (cached) {
    cached.transporter.close();
    transporterPool.delete(orgId);
    logger.info({ orgId }, 'Invalidated cached SMTP transporter for organization');
  }
}

function computeFingerprint(host: string, port: number, user: string, pass: string): string {
  return crypto.createHash('sha256').update(`${host}:${port}:${user}:${pass}`).digest('hex');
}

/**
 * Resolves the authenticated transporter for a given tenant:
 * 1. Checks if the organization has verified custom SMTP credentials.
 * 2. Checks and reuses the active pool if fingerprint matches.
 * 3. Falls back to platform default SMTP if tenant has none configured.
 */
async function resolveTransporterForOrg(orgId?: string): Promise<{
  transporter: nodemailer.Transporter;
  from: string;
  replyTo?: string | null;
} | null> {
  // 1. Check for Tenant-Specific SMTP
  if (orgId) {
    try {
      const creds = await getDecryptedSmtpCredentials(orgId);

      if (creds && creds.status === 'verified') {
        const fingerprint = computeFingerprint(
          creds.smtpHost,
          creds.smtpPort,
          creds.smtpUser,
          creds.smtpPass
        );

        const cached = transporterPool.get(orgId);
        if (cached && cached.fingerprint === fingerprint) {
          return {
            transporter: cached.transporter,
            from: cached.fromAddress,
            replyTo: cached.replyToAddress,
          };
        }

        // Evict old transporter if exists
        if (cached) {
          cached.transporter.close();
        }

        const freshTransporter = nodemailer.createTransport({
          host: creds.smtpHost,
          port: creds.smtpPort,
          secure: creds.smtpSecure,
          auth: {
            user: creds.smtpUser,
            pass: creds.smtpPass,
          },
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
        });

        const fromAddress = `"${creds.fromName}" <${creds.fromEmail}>`;

        transporterPool.set(orgId, {
          transporter: freshTransporter,
          fingerprint,
          fromAddress,
          replyToAddress: creds.replyTo,
        });

        return {
          transporter: freshTransporter,
          from: fromAddress,
          replyTo: creds.replyTo,
        };
      }
    } catch (err: any) {
      logger.warn({ err: err.message, orgId }, 'Failed to resolve tenant custom SMTP. Attempting platform fallback.');
    }
  }

  // 2. Global Platform Fallback SMTP
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    const globalCached = transporterPool.get('__platform_default__');
    const globalFingerprint = computeFingerprint(
      env.SMTP_HOST,
      env.SMTP_PORT,
      env.SMTP_USER,
      env.SMTP_PASS
    );

    if (globalCached && globalCached.fingerprint === globalFingerprint) {
      return {
        transporter: globalCached.transporter,
        from: globalCached.fromAddress,
      };
    }

    const platformTransporter = nodemailer.createTransport({
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

    transporterPool.set('__platform_default__', {
      transporter: platformTransporter,
      fingerprint: globalFingerprint,
      fromAddress: env.SMTP_FROM,
    });

    return {
      transporter: platformTransporter,
      from: env.SMTP_FROM,
    };
  }

  return null;
}

export interface EmailDownloadItem {
  bookTitle: string;
  format: string;
  token: string;
}

export interface SendOrderEmailPayload {
  orgId?: string;
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
  const mailChannel = await resolveTransporterForOrg(payload.orgId);
  if (!mailChannel) {
    logger.warn({ orgId: payload.orgId }, 'No verified tenant SMTP or platform fallback configured. Email skipped.');
    return false;
  }

  const frontendUrl = env.FRONTEND_URL.replace(/\/$/, '');
  const publicApiUrl = env.API_PUBLIC_URL.replace(/\/$/, '');
  const recoveryUrl = `${frontendUrl}/checkout/confirm?orderId=${payload.orderId}&phone=${encodeURIComponent(payload.customerPhone)}`;
  const orderRef = payload.orderId.slice(0, 8).toUpperCase();

  const digitalDownloadCardsHtml = payload.downloads.length > 0
    ? `
      <div style="margin: 24px 0; padding: 20px; background-color: #F8F9FA; border-radius: 12px; border: 1px solid #E5E7EB;">
        <h3 style="margin: 0 0 14px 0; color: #111315; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">
          📖 Your Digital Editions (Direct Download)
        </h3>
        <p style="margin: 0 0 16px 0; font-size: 13px; color: #656F7D; line-height: 1.5;">
          Your digital copies are hosted in high-speed storage and ready to read immediately. Access is valid for 90 days.
        </p>
        ${payload.downloads.map(dl => {
          const dlLink = `${publicApiUrl}/api/v1/books/download/${dl.token}?redirect=true`;
          return `
            <div style="margin-bottom: 12px; padding: 14px; background: #FFFFFF; border-radius: 8px; border: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #111315; font-size: 14px; display: block;">${dl.bookTitle}</strong>
                <span style="display: inline-block; margin-top: 4px; padding: 2px 8px; background: #111315; color: #E50914; font-size: 10px; font-weight: bold; border-radius: 4px; text-transform: uppercase;">
                  ${dl.format.toUpperCase()} EBOOK
                </span>
              </div>
              <div style="margin-top: 8px;">
                <a href="${dlLink}" style="background-color: #E50914; color: #FFFFFF; text-decoration: none; padding: 10px 18px; font-size: 12px; font-weight: bold; border-radius: 6px; display: inline-block;">
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
        <div style="font-size: 28px; font-family: monospace; font-weight: 800; letter-spacing: 6px; color: #111315; margin: 10px 0;">
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
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; margin: 0; padding: 24px; color: #14171A;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E5E7EB; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
          
          <div style="background-color: #111315; padding: 32px 24px; text-align: center;">
            <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; letter-spacing: -0.5px;">EbookStore</h1>
            <p style="color: #E50914; margin: 6px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">
              Order Confirmed &amp; Verified
            </p>
          </div>

          <div style="padding: 32px 24px;">
            <p style="font-size: 15px; margin-top: 0;">
              Hello <strong>${payload.customerName}</strong>,
            </p>
            <p style="font-size: 14px; color: #656F7D; line-height: 1.6;">
              Thank you for your purchase. Your payment of <strong>KSh ${payload.total.toLocaleString('en-KE')}</strong> for Order <strong>#${orderRef}</strong> has been received and confirmed.
            </p>

            ${digitalDownloadCardsHtml}
            ${physicalDeliveryHtml}

            <div style="text-align: center; margin: 32px 0 16px 0;">
              <a href="${recoveryUrl}" style="background-color: #E50914; color: #FFFFFF; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: bold; border-radius: 8px; display: inline-block; box-shadow: 0 2px 8px rgba(229, 9, 20, 0.3);">
                View Live Order &amp; Library Access
              </a>
            </div>

            <p style="font-size: 12px; color: #9AA2AD; text-align: center; margin-top: 12px;">
              You can access this link at any time to recover your order details or digital downloads.
            </p>

            <div style="border-top: 1px solid #E5E7EB; margin-top: 28px; padding-top: 20px; font-size: 12px; color: #656F7D;">
              <div><strong>Destination:</strong> ${payload.deliveryLocation}</div>
              <div style="margin-top: 4px;"><strong>Customer Contact:</strong> ${payload.customerPhone}</div>
            </div>
          </div>

          <div style="background-color: #0B0C0E; padding: 20px; text-align: center; font-size: 11px; color: #9AA2AD; border-top: 1px solid rgba(255,255,255,0.1);">
            &copy; ${new Date().getFullYear()} EbookStore • Instant Cloudflare R2 Digital Delivery.<br>
            Need assistance? Reach out to your bookstore concierge directly on WhatsApp.
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await mailChannel.transporter.sendMail({
      from: mailChannel.from,
      to: payload.toEmail,
      replyTo: mailChannel.replyTo || undefined,
      subject: `📚 Your Books Are Ready! [Order #${orderRef}]`,
      html: htmlBody,
    });
    logger.info({ to: payload.toEmail, orderRef, from: mailChannel.from }, 'Transactional order confirmation email dispatched');
    return true;
  } catch (err: any) {
    logger.error({ err: err.message, to: payload.toEmail, orderRef }, 'Failed to dispatch order email');
    return false;
  }
}