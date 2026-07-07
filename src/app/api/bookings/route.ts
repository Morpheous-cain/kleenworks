// src/app/api/bookings/route.ts
//
// Customer self-service booking. Distinct from POST /api/vehicles
// (which is agent/attendant-only walk-in check-in) because a customer
// has no business calling that route directly — they don't have a
// plate-side agent verifying the vehicle in person, and they should
// only ever be able to book for themselves, never set an arbitrary
// customer_id.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth-helpers'
import { z } from 'zod'

const BookingSchema = z.object({
  plate:          z.string().min(1).transform(s => s.toUpperCase().trim()),
  branch_id:      z.string().uuid(),
  service_ids:    z.array(z.string()).min(1),
  service_names:  z.array(z.string()).min(1),
  total_amount:   z.number().min(0),
  scheduled_for:  z.string().datetime(),
})

// GET /api/bookings — a customer's own upcoming + past self-service bookings
export async function GET(request: NextRequest) {
  const { ctx, error } = await requireAuth()
  if (error) return error

  const supabase = await createClient()

  // Resolve this auth user's customer record — bookings are keyed by
  // customer_id, not auth user id directly.
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json([])
  }

  const { data, error: dbError } = await supabase
    .from('vehicles_live')
    .select('id, plate, status, services, total_amount, scheduled_for, created_at')
    .eq('tenant_id', ctx.tenantId)
    .eq('customer_id', customer.id)
    .eq('booking_source', 'customer-app')
    .order('scheduled_for', { ascending: false })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/bookings — customer books a wash for a future time slot
export async function POST(request: NextRequest) {
  const { ctx, error } = await requireAuth()
  if (error) return error

  const body = await request.json()
  const parsed = BookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Reject slots in the past — clock skew aside, a customer picking
  // "today, 2 hours ago" from a stale UI shouldn't silently succeed.
  if (new Date(parsed.data.scheduled_for).getTime() < Date.now() - 5 * 60 * 1000) {
    return NextResponse.json({ error: 'Selected time slot is in the past' }, { status: 400 })
  }

  const supabase = await createClient()

  // Resolve (or fail clearly if missing) this auth user's customer_id.
  // We never trust a customer_id from the request body — only the one
  // tied to the authenticated session.
  const { data: customer, error: custError } = await supabase
    .from('customers')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (custError || !customer) {
    return NextResponse.json(
      { error: 'No customer profile found for this account' },
      { status: 404 }
    )
  }

  // Confirm the branch actually belongs to this tenant — a customer
  // could otherwise probe branch_id values across tenants.
  const { data: branch, error: branchError } = await supabase
    .from('branches')
    .select('id')
    .eq('id', parsed.data.branch_id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (branchError || !branch) {
    return NextResponse.json({ error: 'Invalid branch' }, { status: 400 })
  }

  // Same duplicate-plate guard the agent route uses — prevents a
  // double-booking of the same plate while one booking is still open.
  const { data: existing } = await supabase
    .from('vehicles_live')
    .select('id, status')
    .eq('plate', parsed.data.plate)
    .eq('tenant_id', ctx.tenantId)
    .eq('branch_id', parsed.data.branch_id)
    .neq('status', 'Completed')
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: `${parsed.data.plate} already has an active booking (status: ${existing.status})` },
      { status: 409 }
    )
  }

  const { data: booking, error: insertError } = await supabase
    .from('vehicles_live')
    .insert({
      plate:           parsed.data.plate,
      tenant_id:       ctx.tenantId,
      branch_id:       parsed.data.branch_id,
      customer_id:     customer.id,
      services:        parsed.data.service_names,
      total_amount:    parsed.data.total_amount,
      scheduled_for:   parsed.data.scheduled_for,
      booking_source:  'customer-app',
      status:          'Queue',
      progress:        0,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(booking, { status: 201 })
}
