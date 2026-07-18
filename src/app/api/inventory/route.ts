import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/auth-helpers'

// GET /api/inventory?low_stock=true
export async function GET(request: NextRequest) {
  const { ctx, error } = await requireManager()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const lowStockOnly = searchParams.get('low_stock') === 'true'

  const supabase = await createClient()
  let query = supabase
    .from('inventory_items')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq('branch_id', ctx.branchId!)
    .order('name')

  const { data, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // Annotate each item with a low_stock flag
  const annotated = data.map(item => ({
    ...item,
    is_low_stock: item.stock <= item.low_stock_threshold,
  }))

  const result = lowStockOnly
    ? annotated.filter(item => item.is_low_stock)
    : annotated

  return NextResponse.json(result)
}

// POST /api/inventory - Add new inventory item
export async function POST(request: NextRequest) {
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
      stock: quantity || 0,
      unit: unit || 'units',
      low_stock_threshold: reorder_level || 5,
      cost_per_unit: cost_per_unit || 0,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
