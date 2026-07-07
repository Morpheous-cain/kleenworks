import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/auth-helpers'

// GET /api/services — public, no auth needed (customers + agents both use this)
export async function GET(request: NextRequest) {
  // Try to get tenant context; fall back to first tenant if unauthenticated
  // (customer booking flow calls this without a manager session)
  let tenantId: string | null = null

  try {
    const supabaseAnon = await createClient()
    const { data: { user } } = await supabaseAnon.auth.getUser()
    if (user) {
      const { data: role } = await supabaseAnon
        .from('user_roles').select('tenant_id').eq('user_id', user.id).single()
      tenantId = role?.tenant_id ?? null
    }
  } catch { /* unauthenticated caller — fall through */ }

  const supabase = await createClient()

  let query = supabase
    .from('services')
    .select('id, name, category, price, duration, usp')
    .order('category').order('price')

  if (tenantId) query = query.eq('tenant_id', tenantId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/services — manager creates a new service
export async function POST(request: NextRequest) {
  const { ctx, error } = await requireManager()
  if (error) return error

  const body = await request.json()
  const { name, category, price, duration, usp } = body

  if (!name || price === undefined) {
    return NextResponse.json({ error: 'name and price are required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error: dbError } = await supabase
    .from('services')
    .insert({ tenant_id: ctx.tenantId, name, category: category ?? 'Wash', price, duration: duration ?? 30, usp: usp ?? '' })
    .select().single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
