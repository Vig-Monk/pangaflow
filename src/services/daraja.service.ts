// =============================================================================
// src/services/daraja.service.ts
// Multi-tenant Daraja (Lipa Na M-Pesa) service supporting dynamic per-org credentials.
// =============================================================================

import axios, { AxiosError } from 'axios';

export interface DarajaCredentials {
  tillType: 'till' | 'paybill';
  shortcode: string;
  storeNumber?: string | null;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  environment: 'sandbox' | 'production';
}

interface DarajaTokenResponse {
  access_token: string;
  expires_in: string;
}

export interface StkPushInput {
  credentials: DarajaCredentials;
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
  CallbackMetadata?: {
    Item: DarajaCallbackMetadataItem[];
  };
}

interface DarajaCallbackBody {
  Body: {
    stkCallback: DarajaStkCallback;
  };
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

// Per-org/per-credential token cache map to avoid cross-tenant token collisions
const tokenCacheMap = new Map<string, TokenCache>();
const TOKEN_REFRESH_MARGIN_MS = 60_000;

function getBaseUrl(environment: 'sandbox' | 'production'): string {
  return environment === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

/**
 * Retrieves an active OAuth token for the specific merchant credentials,
 * utilizing in-memory cache when valid.
 */
export async function getAccessToken(creds: DarajaCredentials): Promise<string> {
  const cacheKey = `${creds.environment}:${creds.shortcode}:${creds.consumerKey}`;
  const now = Date.now();
  const cached = tokenCacheMap.get(cacheKey);

  if (cached && cached.expiresAt - now > TOKEN_REFRESH_MARGIN_MS) {
    return cached.token;
  }

  const credentials = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString('base64');
  const baseUrl = getBaseUrl(creds.environment);

  try {
    const response = await axios.get<DarajaTokenResponse>(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${credentials}` },
        timeout: 12_000,
      }
    );

    const expiresInSeconds = parseInt(response.data.expires_in, 10);
    if (isNaN(expiresInSeconds)) {
      throw new DarajaError('Invalid token response from Safaricom', 'INVALID_TOKEN_RESPONSE');
    }

    const freshCache: TokenCache = {
      token: response.data.access_token,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    };
    tokenCacheMap.set(cacheKey, freshCache);
    return freshCache.token;
  } catch (err) {
    if (err instanceof DarajaError) throw err;
    const axiosErr = err as AxiosError<{ error?: string; errorMessage?: string }>;
    throw new DarajaError(
      axiosErr.response?.data?.errorMessage || 'Failed to authenticate with Safaricom Daraja',
      'AUTH_FAILED',
      axiosErr.response?.data
    );
  }
}

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

function normalizePhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.startsWith('254') && digitsOnly.length === 12) return digitsOnly;
  if (digitsOnly.startsWith('0') && digitsOnly.length === 10) return `254${digitsOnly.slice(1)}`;
  if (digitsOnly.length === 9) return `254${digitsOnly}`;
  throw new DarajaError(`Invalid Kenyan phone number format: ${phone}`, 'INVALID_PHONE');
}

/**
 * Initiates an STK Push with the merchant's specific credentials and till type.
 */
export async function stkPush(input: StkPushInput): Promise<StkPushResult> {
  const { credentials } = input;
  const normalizedPhone = normalizePhone(input.phone);
  const token = await getAccessToken(credentials);
  const timestamp = generateTimestamp();

  const businessShortCode =
    credentials.tillType === 'till' && credentials.storeNumber
      ? credentials.storeNumber
      : credentials.shortcode;

  const rawPassword = `${businessShortCode}${credentials.passkey}${timestamp}`;
  const password = Buffer.from(rawPassword).toString('base64');
  const baseUrl = getBaseUrl(credentials.environment);

  const transactionType =
    credentials.tillType === 'till'
      ? 'CustomerBuyGoodsOnline'
      : 'CustomerPayBillOnline';

  // Safaricom strictly enforces <= 12 characters for AccountReference and <= 13 for TransactionDesc
  const sanitizedRef =
    input.accountReference.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase() || 'SOKO';
  const sanitizedDesc = input.transactionDesc.slice(0, 13) || 'Soko Payment';

  try {
    const response = await axios.post<DarajaStkPushRawResponse>(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: transactionType,
        Amount: Math.round(input.amount),
        PartyA: normalizedPhone,
        PartyB: credentials.shortcode,
        PhoneNumber: normalizedPhone,
        CallBackURL: input.callbackUrl,
        AccountReference: sanitizedRef,
        TransactionDesc: sanitizedDesc,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20_000,
      }
    );

    if (response.data.ResponseCode !== '0') {
      throw new DarajaError(
        response.data.ResponseDescription || 'STK Push rejected by Safaricom',
        'STK_REJECTED',
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
    if (err instanceof DarajaError) throw err;
    const axiosErr = err as AxiosError<{ errorMessage?: string; ResponseDescription?: string }>;
    throw new DarajaError(
      axiosErr.response?.data?.errorMessage ||
        axiosErr.response?.data?.ResponseDescription ||
        'STK Push request failed with Safaricom',
      'STK_FAILED',
      axiosErr.response?.data
    );
  }
}

function isDarajaCallbackBody(body: unknown): body is DarajaCallbackBody {
  if (typeof body !== 'object' || body === null) return false;
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.Body !== 'object' || candidate.Body === null) return false;
  const bodyField = candidate.Body as Record<string, unknown>;
  if (typeof bodyField.stkCallback !== 'object' || bodyField.stkCallback === null) return false;
  const stkCallback = bodyField.stkCallback as Record<string, unknown>;
  return (
    typeof stkCallback.MerchantRequestID === 'string' &&
    typeof stkCallback.CheckoutRequestID === 'string' &&
    typeof stkCallback.ResultCode === 'number'
  );
}

function extractMetadataValue(
  items: DarajaCallbackMetadataItem[],
  name: string
): string | number | null {
  const item = items.find((i) => i.Name === name);
  return item?.Value ?? null;
}

export function parseCallback(body: unknown): MpesaCallbackResult {
  if (!isDarajaCallbackBody(body)) {
    throw new DarajaError('Invalid callback payload', 'INVALID_PAYLOAD');
  }

  const callback = body.Body.stkCallback;
  const isSuccess = callback.ResultCode === 0;

  if (!isSuccess || !callback.CallbackMetadata) {
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
  return {
    checkoutRequestId: callback.CheckoutRequestID,
    merchantRequestId: callback.MerchantRequestID,
    resultCode: callback.ResultCode,
    resultDesc: callback.ResultDesc,
    mpesaReceiptNumber: String(extractMetadataValue(items, 'MpesaReceiptNumber') ?? ''),
    transactionDate: String(extractMetadataValue(items, 'TransactionDate') ?? ''),
    phone: String(extractMetadataValue(items, 'PhoneNumber') ?? ''),
    amount: Number(extractMetadataValue(items, 'Amount') ?? 0),
    isSuccess: true,
  };
}