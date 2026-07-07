import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAgent } from '@/lib/auth-helpers'

// GET /api/payments/mpesa/status/[id]
// Frontend polls this every 2-3s while the customer enters their PIN.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ctx, error } = await requireAgent()
  if (error) return error

  const supabase = await createClient()
  const { data, error: dbError } = await supabase
    .from('transactions')
    .select('id, status, receipt, failure_reason')
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

  return NextResponse.json(data)
}
