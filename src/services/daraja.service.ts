// =============================================================================
// src/services/daraja.service.ts
// Production Daraja (M-Pesa) integration service.
// This handles real money — every failure path is explicit, nothing is
// silently swallowed, and no promise is left unhandled.
// =============================================================================

import axios, { AxiosError } from 'axios';
import { env } from '../config/env';

// ---------------------------------------------------------------------------
// Types — defined at the top of the file, per spec
// ---------------------------------------------------------------------------

interface DarajaTokenResponse {
  access_token: string;
  expires_in: string;
}

export interface StkPushInput {
  phone: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  callbackUrl: string;
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  responseCode: string;
  customerMessage: string;
}

export interface MpesaCallbackResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  resultCode: number;
  resultDesc: string;
  mpesaReceiptNumber: string | null;
  transactionDate: string | null;
  phone: string | null;
  amount: number | null;
  isSuccess: boolean;
}

export class DarajaError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly context?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'DarajaError';
  }
}

// ---------------------------------------------------------------------------
// Internal Safaricom wire-format types — these mirror Daraja's actual JSON
// shapes exactly (verified against current Daraja documentation), and are
// intentionally NOT exported. Callers only ever see the clean typed
// interfaces above; this raw shape is an implementation detail.
// ---------------------------------------------------------------------------

interface DarajaStkPushRawResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

interface DarajaCallbackMetadataItem {
  Name: string;
  Value: string | number;
}

interface DarajaStkCallback {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  // CallbackMetadata is ONLY present when ResultCode === 0 (success).
  // A cancelled or failed push has no CallbackMetadata at all — this is
  // real Safaricom behavior, not a gap in this type.
  CallbackMetadata?: {
    Item: DarajaCallbackMetadataItem[];
  };
}

interface DarajaCallbackBody {
  Body: {
    stkCallback: DarajaStkCallback;
  };
}

// ---------------------------------------------------------------------------
// Token cache
// Module-level singleton cache — one Daraja app, one token, shared across
// every stkPush() call in this process. Daraja tokens last ~3600s; caching
// avoids requesting a new one on every single push, which both slows down
// each request and risks hitting Safaricom's OAuth rate limits under load.
// ---------------------------------------------------------------------------

interface TokenCache {
  token: string;
  expiresAt: number; // epoch ms
}

let tokenCache: TokenCache | null = null;

// Refresh 60s before actual expiry — avoids a race where a token that's
// valid when read from cache expires mid-flight before the STK Push
// request Safaricom receives it.
const TOKEN_REFRESH_MARGIN_MS = 60_000;

/**
 * Fetches a fresh OAuth token from Daraja and populates the cache.
 * Throws DarajaError on any failure — a token failure means every
 * subsequent stkPush() call in this process would fail too, so this
 * needs to surface loudly, not be swallowed.
 */
async function fetchNewToken(): Promise<TokenCache> {
  const credentials = Buffer.from(
    `${env.DARAJA_CONSUMER_KEY}:${env.DARAJA_CONSUMER_SECRET}`
  ).toString('base64');

  try {
    const response = await axios.get<DarajaTokenResponse>(
      `${env.DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${credentials}` },
        timeout: 10_000,
      }
    );

    const expiresInSeconds = parseInt(response.data.expires_in, 10);

    if (isNaN(expiresInSeconds)) {
      throw new DarajaError(
        'Daraja token response had a non-numeric expires_in value',
        'INVALID_TOKEN_RESPONSE',
        response.data
      );
    }

    return {
      token: response.data.access_token,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    };
  } catch (err) {
    if (err instanceof DarajaError) {
      throw err;
    }

    const axiosErr = err as AxiosError;
    throw new DarajaError(
      'Failed to obtain Daraja OAuth token',
      'TOKEN_FETCH_FAILED',
      {
        status: axiosErr.response?.status,
        data: axiosErr.response?.data,
        message: axiosErr.message,
      }
    );
  }
}

/**
 * Returns a valid access token, using the cache when the cached token
 * still has more than TOKEN_REFRESH_MARGIN_MS of life left, fetching a
 * fresh one otherwise. This is the only function in this file that reads
 * or writes the module-level tokenCache.
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now();

  if (tokenCache && tokenCache.expiresAt - now > TOKEN_REFRESH_MARGIN_MS) {
    return tokenCache.token;
  }

  const fresh = await fetchNewToken();
  tokenCache = fresh;
  return fresh.token;
}

// ---------------------------------------------------------------------------
// Password + timestamp generation for STK Push
// Daraja requires a base64(shortcode + passkey + timestamp) password and
// a matching timestamp string on every STK Push request.
// ---------------------------------------------------------------------------

function generateTimestamp(): string {
  const now = new Date();
  const pad = (n: number): string => n.toString().padStart(2, '0');

  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

function generatePassword(timestamp: string): string {
  const raw = `${env.DARAJA_SHORTCODE}${env.DARAJA_PASSKEY}${timestamp}`;
  return Buffer.from(raw).toString('base64');
}

/**
 * Normalizes a Kenyan phone number to Daraja's required 2547XXXXXXXX
 * format. Accepts common input variants: 07XXXXXXXX, 7XXXXXXXX,
 * +2547XXXXXXXX, 2547XXXXXXXX.
 */
function normalizePhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');

  if (digitsOnly.startsWith('254') && digitsOnly.length === 12) {
    return digitsOnly;
  }

  if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
    return `254${digitsOnly.slice(1)}`;
  }

  if (digitsOnly.length === 9) {
    return `254${digitsOnly}`;
  }

  throw new DarajaError(
    `Unrecognized phone number format: ${phone}`,
    'INVALID_PHONE_FORMAT',
    { input: phone }
  );
}

// ---------------------------------------------------------------------------
// stkPush
// ---------------------------------------------------------------------------

/**
 * Initiates an STK Push — the customer receives a payment prompt on their
 * phone. This function only returns confirmation that Safaricom ACCEPTED
 * the request; the actual payment result arrives later via the callback
 * URL, parsed by parseCallback() below.
 *
 * Throws DarajaError on:
 *   - token acquisition failure
 *   - invalid phone number format
 *   - Safaricom rejecting the push request itself (bad credentials,
 *     malformed request, insufficient permissions, etc.)
 */
export async function stkPush(input: StkPushInput): Promise<StkPushResult> {
  const normalizedPhone = normalizePhone(input.phone);
  const token = await getAccessToken();
  const timestamp = generateTimestamp();
  const password = generatePassword(timestamp);

  try {
    const response = await axios.post<DarajaStkPushRawResponse>(
      `${env.DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: env.DARAJA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(input.amount),
        PartyA: normalizedPhone,
        PartyB: env.DARAJA_SHORTCODE,
        PhoneNumber: normalizedPhone,
        CallBackURL: input.callbackUrl,
        AccountReference: input.accountReference,
        TransactionDesc: input.transactionDesc,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15_000,
      }
    );

    if (response.data.ResponseCode !== '0') {
      throw new DarajaError(
        response.data.ResponseDescription || 'STK Push was rejected by Safaricom',
        'STK_PUSH_REJECTED',
        response.data
      );
    }

    return {
      checkoutRequestId: response.data.CheckoutRequestID,
      merchantRequestId: response.data.MerchantRequestID,
      responseCode: response.data.ResponseCode,
      customerMessage: response.data.CustomerMessage,
    };
  } catch (err) {
    if (err instanceof DarajaError) {
      throw err;
    }

    const axiosErr = err as AxiosError<{ errorMessage?: string; errorCode?: string }>;
    throw new DarajaError(
      axiosErr.response?.data?.errorMessage || 'STK Push request failed',
      axiosErr.response?.data?.errorCode || 'STK_PUSH_FAILED',
      {
        status: axiosErr.response?.status,
        data: axiosErr.response?.data,
        message: axiosErr.message,
      }
    );
  }
}

// ---------------------------------------------------------------------------
// parseCallback
// ---------------------------------------------------------------------------

/**
 * Type guard confirming an unknown request body matches Safaricom's actual
 * STK callback envelope shape: { Body: { stkCallback: {...} } }.
 */
function isDarajaCallbackBody(body: unknown): body is DarajaCallbackBody {
  if (typeof body !== 'object' || body === null) return false;

  const candidate = body as Record<string, unknown>;
  if (typeof candidate.Body !== 'object' || candidate.Body === null) return false;

  const bodyField = candidate.Body as Record<string, unknown>;
  if (typeof bodyField.stkCallback !== 'object' || bodyField.stkCallback === null) {
    return false;
  }

  const stkCallback = bodyField.stkCallback as Record<string, unknown>;

  return (
    typeof stkCallback.MerchantRequestID === 'string' &&
    typeof stkCallback.CheckoutRequestID === 'string' &&
    typeof stkCallback.ResultCode === 'number' &&
    typeof stkCallback.ResultDesc === 'string'
  );
}

/**
 * Extracts a named value from the CallbackMetadata.Item array.
 * Safaricom's success callback carries transaction details as an array of
 * {Name, Value} pairs, not a flat object — this is real Daraja behavior,
 * not an unusual encoding choice on our end.
 */
function extractMetadataValue(
  items: DarajaCallbackMetadataItem[],
  name: string
): string | number | null {
  const item = items.find((i) => i.Name === name);
  return item?.Value ?? null;
}

/**
 * Parses Safaricom's STK Push callback body into a clean, typed result.
 *
 * CRITICAL: Safaricom's success callback (ResultCode === 0) includes a
 * CallbackMetadata.Item array with Amount, MpesaReceiptNumber,
 * TransactionDate, and PhoneNumber. A failed or cancelled push
 * (ResultCode !== 0, e.g. 1032 = "cancelled by user") has NO
 * CallbackMetadata field at all. This function handles both cases
 * explicitly rather than assuming the metadata is always present.
 *
 * Throws DarajaError if the body doesn't match Safaricom's known callback
 * envelope shape at all (malformed, wrong endpoint hit, etc.) — this
 * should never happen from Safaricom itself, but a route handler receiving
 * arbitrary POST bodies from the public internet must not trust the shape
 * of what's exists at that URL.
 */
export function parseCallback(body: unknown): MpesaCallbackResult {
  if (!isDarajaCallbackBody(body)) {
    throw new DarajaError(
      'Request body does not match the expected Daraja STK callback shape',
      'INVALID_CALLBACK_SHAPE',
      body
    );
  }

  const callback = body.Body.stkCallback;
  const isSuccess = callback.ResultCode === 0;

  if (!isSuccess || !callback.CallbackMetadata) {
    // Failed, cancelled, or timed-out push — no metadata to extract.
    return {
      checkoutRequestId: callback.CheckoutRequestID,
      merchantRequestId: callback.MerchantRequestID,
      resultCode: callback.ResultCode,
      resultDesc: callback.ResultDesc,
      mpesaReceiptNumber: null,
      transactionDate: null,
      phone: null,
      amount: null,
      isSuccess: false,
    };
  }

  const items = callback.CallbackMetadata.Item;

  const amount = extractMetadataValue(items, 'Amount');
  const receiptNumber = extractMetadataValue(items, 'MpesaReceiptNumber');
  const transactionDate = extractMetadataValue(items, 'TransactionDate');
  const phone = extractMetadataValue(items, 'PhoneNumber');

  return {
    checkoutRequestId: callback.CheckoutRequestID,
    merchantRequestId: callback.MerchantRequestID,
    resultCode: callback.ResultCode,
    resultDesc: callback.ResultDesc,
    mpesaReceiptNumber: receiptNumber !== null ? String(receiptNumber) : null,
    transactionDate: transactionDate !== null ? String(transactionDate) : null,
    phone: phone !== null ? String(phone) : null,
    amount: amount !== null ? Number(amount) : null,
    isSuccess: true,
  };
}