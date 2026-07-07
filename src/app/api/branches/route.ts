import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireManager, requireAuth } from '@/lib/auth-helpers'

// GET /api/branches
// Managers get the full branch record (used for branch management).
// Any other authenticated role (e.g. a customer picking a branch to
// book a wash at) gets a minimal subset — just enough to populate a
// branch picker, nothing operational like staffing/inventory data.
export async function GET(request: NextRequest) {
  const managerCheck = await requireManager()

  if (!managerCheck.error) {
    const supabase = await createClient()
    const { data, error: dbError } = await supabase
      .from('branches')
      .select('*')
      .eq('tenant_id', managerCheck.ctx.tenantId)
      .order('created_at', { ascending: true })

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  // Not a manager — fall back to a basic auth check and a trimmed
  // response (id, name, location, status only).
  const { ctx, error } = await requireAuth()
  if (error) return error

  const supabase = await createClient()
  const { data, error: dbError } = await supabase
    .from('branches')
    .select('id, name, location, status')
    .eq('tenant_id', ctx.tenantId)
    .eq('status', 'Open')
    .order('created_at', { ascending: true })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/branches — create a new branch
export async function POST(request: NextRequest) {
  const { ctx, error } = await requireManager()
  if (error) return error

  const body = await request.json()
  const { name, location, status = 'Open' } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Branch name is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error: dbError } = await supabase
    .from('branches')
    .insert({
      tenant_id: ctx.tenantId,
      name:      name.trim(),
      location:  location?.trim() ?? null,
      status,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
