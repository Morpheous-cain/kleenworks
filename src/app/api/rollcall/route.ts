// src/app/api/rollcall/route.ts
//
// Staff clock-in / clock-out log.
// Supports two entry paths:
//   1. Manual — agent taps the button in the UI (this endpoint)
//   2. Fingerprint scanner — the scanner's controller POSTs a JSON
//      webhook to this same endpoint with { staff_id, action, source: 'fingerprint' }
//      We accept both paths identically; 'source' is stored for audit.
//
// DB table required (run migration 010_rollcall.sql):
//   rollcall_logs(id, tenant_id, staff_id, action, source, created_at)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAttendant } from '@/lib/auth-helpers'

// GET /api/rollcall?date=YYYY-MM-DD
// Returns today's clock-in/out events for the tenant's branch.
export async function GET(request: NextRequest) {
  const { ctx, error } = await requireAttendant()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const supabase = await createClient()

  const { data, error: dbError } = await supabase
    .from('rollcall_logs')
    .select('*, staff:staff(id, name, role)')
    .eq('tenant_id', ctx.tenantId)
    .gte('created_at', `${date}T00:00:00.000Z`)
    .lte('created_at', `${date}T23:59:59.999Z`)
    .order('created_at', { ascending: false })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/rollcall
// Body: { staff_id: uuid, action: 'clock-in' | 'clock-out', source?: 'manual' | 'fingerprint' }
//
// Fingerprint scanner integration note:
//   Configure your scanner's controller/middleware to POST JSON to:
//     https://sparkflow-sable.vercel.app/api/rollcall
//   with header: Authorization: Bearer <FINGERPRINT_WEBHOOK_SECRET>
//   and body: { "staff_id": "<uuid>", "action": "clock-in", "source": "fingerprint" }
//
//   The FINGERPRINT_WEBHOOK_SECRET env var must match what the scanner sends.
//   If it's not set, the endpoint falls back to requiring a valid Supabase
//   session (manual UI mode).
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { staff_id, action, source = 'manual' } = body

  if (!staff_id || !['clock-in', 'clock-out'].includes(action)) {
    return NextResponse.json(
      { error: 'staff_id and action (clock-in | clock-out) are required' },
      { status: 400 }
    )
  }

  // ── Fingerprint scanner path ────────────────────────────────────────────
  // If the request comes from a hardware scanner, it won't have a Supabase
  // session cookie — it authenticates via a shared webhook secret instead.
  const webhookSecret = process.env.FINGERPRINT_WEBHOOK_SECRET
  const authHeader = request.headers.get('Authorization')
  const isFromScanner =
    webhookSecret &&
    authHeader === `Bearer ${webhookSecret}`

  let tenantId: string

  if (isFromScanner) {
    // Trust the scanner — look up the staff member's tenant directly
    // using the service-role client so we don't need a session cookie.
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    const { data: staffRow, error: staffErr } = await admin
      .from('staff')
      .select('tenant_id')
      .eq('id', staff_id)
      .single()

    if (staffErr || !staffRow) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }
    tenantId = staffRow.tenant_id
  } else {
    // ── Manual UI path — require a valid Supabase session ──────────────
    const { ctx, error } = await requireAttendant()
    if (error) return error
    tenantId = ctx.tenantId
  }

  // ── Write the log entry ─────────────────────────────────────────────────
  // Use the standard (session or service-role) client depending on the path
  const supabase = isFromScanner
    ? (await import('@/lib/supabase/admin')).createAdminClient()
    : await (await import('@/lib/supabase/server')).createClient()

  const { data, error: insertError } = await supabase
    .from('rollcall_logs')
    .insert({ tenant_id: tenantId, staff_id, action, source })
    .select('*, staff:staff(id, name, role)')
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
