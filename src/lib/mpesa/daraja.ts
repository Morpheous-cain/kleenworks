/**
 * src/lib/mpesa/daraja.ts
 *
 * Thin client for Safaricom's Daraja API — sandbox environment only.
 * Switching to production later means changing DARAJA_BASE_URL and the
 * live credentials in .env; nothing in this file needs to change because
 * we never hardcode the sandbox host below — it comes from env so a
 * config change is the only thing required to go live.
 *
 * Sandbox docs: https://developer.safaricom.co.ke/Documentation
 */

const DARAJA_BASE_URL =
  process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke'

interface DarajaTokenResponse {
  access_token: string
  expires_in: string
}

interface StkPushResponse {
  MerchantRequestID: string
  CheckoutRequestID: string
  ResponseCode: string
  ResponseDescription: string
  CustomerMessage: string
}

interface StkPushErrorResponse {
  requestId?: string
  errorCode?: string
  errorMessage?: string
}

/**
 * Fetches a fresh OAuth access token from Daraja.
 * Tokens are short-lived (~1hr) — we don't cache across requests since
 * Vercel functions are stateless per-invocation; re-fetching each time
 * is the simplest correct approach for our transaction volume.
 */
export async function getDarajaAccessToken(): Promise<string> {
  const consumerKey = process.env.MPESA_CONSUMER_KEY
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET

  if (!consumerKey || !consumerSecret) {
    throw new Error('MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET not configured')
  }

  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')

  const res = await fetch(
    `${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: 'GET',
      headers: { Authorization: `Basic ${credentials}` },
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Daraja OAuth failed (${res.status}): ${text}`)
  }

  const data: DarajaTokenResponse = await res.json()
  return data.access_token
}

/**
 * Builds the Lipa Na M-Pesa Online password.
 * Formula per Daraja docs: Base64(Shortcode + Passkey + Timestamp)
 */
function buildPassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64')
}

/** Timestamp format Daraja requires: YYYYMMDDHHmmss */
function darajaTimestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  )
}

/**
 * Normalises a Kenyan phone number to the 2547XXXXXXXX format Daraja
 * requires. Accepts 07XXXXXXXX, +2547XXXXXXXX, 2547XXXXXXXX, or
 * 7XXXXXXXX and returns the canonical form. Throws on anything else
 * so we fail loudly before calling Safaricom with a bad number.
 */
export function normalizeKenyanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')

  if (digits.startsWith('254') && digits.length === 12) return digits
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`
  if (digits.startsWith('7') && digits.length === 9) return `254${digits}`
  if (digits.startsWith('1') && digits.length === 9) return `254${digits}` // some Safaricom ranges start with 1

  throw new Error(
    `Invalid Kenyan phone number: "${raw}". Expected formats: 07XXXXXXXX, 2547XXXXXXXX, or +2547XXXXXXXX`
  )
}

interface InitiateStkPushParams {
  /** Phone to charge, any accepted format — will be normalised */
  phone: string
  /** Amount in whole KES — Daraja sandbox rejects decimals */
  amount: number
  /** Our internal reference, shown in the STK prompt's account field */
  accountReference: string
  /** Shown to the customer as the transaction description */
  transactionDesc: string
}

/**
 * Initiates an STK Push ("Lipa Na M-Pesa Online") prompt on the
 * customer's phone. Returns the CheckoutRequestID/MerchantRequestID
 * which we must store — the callback that arrives later only contains
 * these IDs, not any of our own transaction data.
 */
export async function initiateStkPush(
  params: InitiateStkPushParams
): Promise<StkPushResponse> {
  const shortcode = process.env.MPESA_SHORTCODE
  const passkey = process.env.MPESA_PASSKEY
  const callbackUrl = process.env.MPESA_CALLBACK_URL

  if (!shortcode || !passkey) {
    throw new Error('MPESA_SHORTCODE / MPESA_PASSKEY not configured')
  }
  if (!callbackUrl) {
    throw new Error(
      'MPESA_CALLBACK_URL not configured — Daraja sandbox requires a public HTTPS URL. ' +
      'For local development, expose your dev server with ngrok and set this to the ngrok URL + /api/payments/mpesa/callback'
    )
  }

  const phone = normalizeKenyanPhone(params.phone)
  const timestamp = darajaTimestamp()
  const password = buildPassword(shortcode, passkey, timestamp)
  const accessToken = await getDarajaAccessToken()

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(params.amount), // sandbox rejects non-integer amounts
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: params.accountReference.slice(0, 12), // Daraja max length
    TransactionDesc: params.transactionDesc.slice(0, 13),    // Daraja max length
  }

  const res = await fetch(`${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json()

  if (!res.ok) {
    const err = data as StkPushErrorResponse
    throw new Error(err.errorMessage ?? `Daraja STK Push failed with status ${res.status}`)
  }

  return data as StkPushResponse
}

/**
 * Shape of the body Safaricom POSTs to our callback URL.
 * Only the fields we actually use are typed here — Daraja's payload
 * has more nested structure we don't need.
 */
export interface DarajaCallbackBody {
  Body: {
    stkCallback: {
      MerchantRequestID: string
      CheckoutRequestID: string
      ResultCode: number
      ResultDesc: string
      CallbackMetadata?: {
        Item: Array<{ Name: string; Value: string | number }>
      }
    }
  }
}

/** Pulls a named value out of Daraja's CallbackMetadata.Item array. */
export function getCallbackMetadataValue(
  body: DarajaCallbackBody,
  name: 'Amount' | 'MpesaReceiptNumber' | 'TransactionDate' | 'PhoneNumber'
): string | number | undefined {
  return body.Body.stkCallback.CallbackMetadata?.Item.find(i => i.Name === name)?.Value
}
