import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/auth-helpers'

// GET /api/reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv
export async function GET(request: NextRequest) {
  const { ctx, error } = await requireManager()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const from      = searchParams.get('from') ?? new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const to        = searchParams.get('to')   ?? new Date().toISOString().split('T')[0]
  const branch_id = searchParams.get('branch_id') ?? ctx.branchId
  const fmt       = searchParams.get('format') ?? 'csv'

  const supabase = await createClient()

  let query = supabase
    .from('transactions')
    .select(`
      id, date, amount, status, payment_method, services,
      mpesa_receipt,
      vehicles_live:vehicle_id (plate)
    `)
    .eq('tenant_id', ctx.tenantId)
    .eq('status', 'Paid')
    .gte('date', `${from}T00:00:00.000Z`)
    .lte('date', `${to}T23:59:59.999Z`)
    .order('date', { ascending: false })

  if (branch_id) query = query.eq('branch_id', branch_id)

  const { data, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  const rows = data ?? []

  // ── Build CSV ─────────────────────────────────────────────────────────
  const headers = ['Date', 'Transaction ID', 'Plate', 'Services', 'Amount (KES)', 'Payment Method', 'M-Pesa Receipt', 'Status']

  const escape = (v: any) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  const csvRows = [
    headers.join(','),
    ...rows.map(r => [
      escape(r.date ? new Date(r.date).toLocaleDateString('en-KE') : ''),
      escape(r.id?.slice(0, 8)),
      escape((r.vehicles_live as any)?.plate ?? 'N/A'),
      escape(Array.isArray(r.services) ? r.services.join(' | ') : r.services ?? ''),
      escape(Number(r.amount).toFixed(2)),
      escape(r.payment_method ?? 'Cash'),
      escape(r.mpesa_receipt ?? ''),
      escape(r.status),
    ].join(','))
  ]

  // ── Summary rows ──────────────────────────────────────────────────────
  const totalRevenue = rows.reduce((s, r) => s + Number(r.amount), 0)
  const cashTotal    = rows.filter(r => r.payment_method === 'Cash').reduce((s, r) => s + Number(r.amount), 0)
  const mpesaTotal   = rows.filter(r => r.payment_method !== 'Cash').reduce((s, r) => s + Number(r.amount), 0)

  csvRows.push(
    '',
    `Summary,From: ${from},To: ${to}`,
    `Total Transactions,${rows.length}`,
    `Total Revenue (KES),${totalRevenue.toFixed(2)}`,
    `Cash Total (KES),${cashTotal.toFixed(2)}`,
    `M-Pesa Total (KES),${mpesaTotal.toFixed(2)}`,
    `Total Cash (Cash + M-Pesa),${(cashTotal + mpesaTotal).toFixed(2)}`,
    `Generated,${new Date().toISOString()}`,
    `Exported by,Kleen Works - Powered by Immersicloud`,
  )

  const csv = csvRows.join('\n')
  const filename = `KleenWorks_Transactions_${from}_to_${to}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-cache',
    },
  })
}
