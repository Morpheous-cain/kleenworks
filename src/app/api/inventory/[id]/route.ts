import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/auth-helpers'

// DELETE /api/inventory/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireManager()
  if (error) return error

  const { id } = await params
  const supabase = await createClient()

  const { error: dbError } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

// POST /api/inventory/[id] - Add new inventory item (bulk create)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireManager()
  if (error) return error

  const body = await request.json()
  const { name, quantity, unit, reorder_level, cost_per_unit } = body

  if (!name || quantity === undefined) {
    return NextResponse.json({ error: 'Name and quantity are required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error: dbError } = await supabase
    .from('inventory_items')
    .insert({
      tenant_id: ctx.tenantId,
      branch_id: ctx.branchId,
      name,
      quantity: quantity || 0,
      unit: unit || 'units',
      reorder_level: reorder_level || 5,
      cost_per_unit: cost_per_unit || 0,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}