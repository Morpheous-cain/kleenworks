import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCallbackMetadataValue, type DarajaCallbackBody } from '@/lib/mpesa/daraja'

// POST /api/payments/mpesa/callback
//
// Safaricom calls this endpoint directly — there is no logged-in user,
// no session cookie, and no Authorization header we control. We cannot
// use requireAgent()/requireManager() here at all, which is why this is
// the one route in the app that uses the admin (service-role) client
// instead of the request-scoped one: there is no user session for RLS
// to evaluate against.
//
// Because this endpoint is unauthenticated by necessity, we verify
// integrity a different way: we only ever act on a CheckoutRequestID
// that we ourselves generated and stored during stk-push/route.ts. An
// attacker POSTing a fake callback with a CheckoutRequestID they don't
// know (a UUID-like Safaricom-generated string) simply won't match any
// row and the request is a no-op. We still 200 in that case — Safaricom
// retries failed-looking callbacks, and a no-op match is not a delivery
// failure on their side, so a 200 prevents pointless retries.
//
// Safaricom expects a 200 with a specific JSON body regardless of
// whether the payment succeeded — the HTTP status here just means
// "I received your callback", not "the payment worked".
export async function POST(request: NextRequest) {
  let body: DarajaCallbackBody

  try {
    body = await request.json()
  } catch {
    // Malformed JSON — still acknowledge so Safaricom doesn't retry
    // indefinitely against a request we can never parse.
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }

  const callback = body?.Body?.stkCallback
  if (!callback?.CheckoutRequestID) {
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }

  const admin = createAdminClient()

  // ── Find the transaction this callback belongs to ─────────────────
  const { data: transaction, error: findError } = await admin
    .from('transactions')
    .select('id, status, tenant_id, amount')
    .eq('checkout_request_id', callback.CheckoutRequestID)
    .maybeSingle()

  if (findError || !transaction) {
    // No matching row — either a replayed/duplicate callback we already
    // processed and cleared, or a CheckoutRequestID we never issued.
    // Acknowledge without erroring; there's nothing actionable here.
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }

  // Already resolved — Safaricom can send the same callback more than
  // once. Don't double-process (e.g. don't re-increment customer
  // totals if we ever add that side effect here).
  if (transaction.status !== 'Pending') {
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }

  // ── ResultCode 0 means the customer entered their PIN and paid ────
  if (callback.ResultCode === 0) {
    const receiptNumber = getCallbackMetadataValue(body, 'MpesaReceiptNumber')
    const paidAmount    = getCallbackMetadataValue(body, 'Amount')

    await admin
      .from('transactions')
      .update({
        status:  'Paid',
        receipt: receiptNumber ? String(receiptNumber) : null,
      })
      .eq('id', transaction.id)

    // Sanity check we log but don't act on: if Safaricom confirms a
    // different amount than we requested, something is wrong upstream
    // (shouldn't happen with STK Push, but cheap to guard).
    if (paidAmount && Number(paidAmount) !== Number(transaction.amount)) {
      console.warn(
        `M-Pesa amount mismatch on transaction ${transaction.id}: ` +
        `requested ${transaction.amount}, Safaricom confirmed ${paidAmount}`
      )
    }
  } else {
    // Non-zero ResultCode: customer cancelled, entered wrong PIN too
    // many times, insufficient funds, request timed out, etc.
    // ResultDesc is Safaricom's human-readable reason.
    await admin
      .from('transactions')
      .update({
        status:         'Failed',
        failure_reason: callback.ResultDesc ?? 'Unknown failure',
      })
      .eq('id', transaction.id)
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
}
