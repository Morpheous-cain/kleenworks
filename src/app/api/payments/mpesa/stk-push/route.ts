import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAgent } from '@/lib/auth-helpers'
import { initiateStkPush, normalizeKenyanPhone } from '@/lib/mpesa/daraja'
import { z } from 'zod'

const StkPushSchema = z.object({
  plate:            z.string().min(1).transform(s => s.toUpperCase().trim()),
  phone:            z.string().min(9),
  customer_id:      z.string().uuid().optional(),
  amount:           z.number().positive(),
  services:         z.array(z.string()).min(1),
  duration:         z.number().int().min(0).optional(),
  inventory_usage:  z.array(z.object({
    item_id: z.string().uuid(),
    qty:     z.number().int().positive(),
  })).default([]),
})

// POST /api/payments/mpesa/stk-push
//
// Flow:
//   1. Validate input, normalise phone to 2547XXXXXXXX
//   2. Create the transaction row via the existing create_transaction RPC
//      with payment_method = 'M-Pesa' (status starts 'Pending', same as
//      every other transaction — nothing special needed there)
//   3. Call Daraja to push the STK prompt to the customer's phone
//   4. Store the returned CheckoutRequestID/MerchantRequestID on the row
//      so the callback (which only carries those IDs) can find it later
//   5. If the Daraja call fails, we delete the transaction we just
//      created rather than leaving an orphaned Pending row with no
//      way to ever resolve to Paid or Failed
export async function POST(request: NextRequest) {
  const { ctx, error } = await requireAgent()
  if (error) return error

  const body = await request.json()
  const parsed = StkPushSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  let normalizedPhone: string
  try {
    normalizedPhone = normalizeKenyanPhone(parsed.data.phone)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  const supabase = await createClient()

  // ── Step 1: create the Pending transaction row ──────────────────────
  const { data: transactionId, error: rpcError } = await supabase.rpc(
    'create_transaction',
    {
      p_tenant_id:       ctx.tenantId,
      p_branch_id:       ctx.branchId,
      p_plate:           parsed.data.plate,
      p_customer_id:     parsed.data.customer_id ?? null,
      p_amount:          parsed.data.amount,
      p_payment_method:  'M-Pesa',
      p_services:        parsed.data.services,
      p_duration:        parsed.data.duration ?? 0,
      p_inventory_usage: parsed.data.inventory_usage,
    }
  )

  if (rpcError) {
    if (rpcError.message.includes('Insufficient stock')) {
      return NextResponse.json({ error: rpcError.message }, { status: 409 })
    }
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  // ── Step 2: fire the STK Push ─────────────────────────────────────────
  try {
    const stkResponse = await initiateStkPush({
      phone: normalizedPhone,
      amount: parsed.data.amount,
      accountReference: parsed.data.plate,
      transactionDesc: 'Carwash',
    })

    // ── Step 3: store the tracking IDs so the callback can find this row
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        checkout_request_id: stkResponse.CheckoutRequestID,
        merchant_request_id: stkResponse.MerchantRequestID,
        mpesa_phone:          normalizedPhone,
      })
      .eq('id', transactionId)
      .eq('tenant_id', ctx.tenantId)

    if (updateError) {
      // The push went out but we couldn't save the tracking ID — the
      // callback will arrive but we won't be able to match it. Surface
      // this clearly rather than silently leaving the row stuck Pending.
      return NextResponse.json(
        { error: `STK Push sent but failed to save tracking reference: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      transaction_id:      transactionId,
      checkout_request_id: stkResponse.CheckoutRequestID,
      customer_message:    stkResponse.CustomerMessage,
    }, { status: 201 })

  } catch (e: any) {
    // Daraja call failed (bad credentials, sandbox down, invalid phone
    // format Daraja itself rejected, etc). Clean up the orphaned
    // Pending row we created in Step 1 — it can never resolve since
    // no push went out and no callback will ever arrive for it.
    await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId)
      .eq('tenant_id', ctx.tenantId)

    return NextResponse.json(
      { error: `M-Pesa request failed: ${e.message}` },
      { status: 502 }
    )
  }
}
