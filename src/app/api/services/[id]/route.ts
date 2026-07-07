import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/auth-helpers'

// PATCH /api/services/[id] — update price, name, duration, usp
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ctx, error } = await requireManager()
  if (error) return error

  const body = await request.json()
  const { name, category, price, duration, usp } = body

  const update: Record<string, unknown> = {}
  if (name      !== undefined) update.name     = name
  if (category  !== undefined) update.category = category
  if (price     !== undefined) update.price    = price
  if (duration  !== undefined) update.duration = duration
  if (usp       !== undefined) update.usp      = usp

  const supabase = await createClient()
  const { data, error: dbError } = await supabase
    .from('services')
    .update(update)
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .select().single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/services/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ctx, error } = await requireManager()
  if (error) return error

  const supabase = await createClient()
  const { error: dbError } = await supabase
    .from('services')
    .delete()
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
