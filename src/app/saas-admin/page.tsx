import { redirect } from 'next/navigation'
import { requireSaasAdmin } from '@/lib/auth-helpers'
import { SaasAdminClient } from './SaasAdminClient'

// This page reads the request's auth cookie via Supabase on every load,
// so it can never be statically generated at build time — there is no
// request/cookie context available then. Forcing dynamic rendering
// also doubles as defense-in-depth for the role check: a statically
// cached version of this page could otherwise leak admin-only markup
// to the first visitor and then get served to everyone after that.
export const dynamic = 'force-dynamic'

// This route is restricted to the 'saas-admin' role only.
// Anyone else (including managers/agents/unauthenticated users) is
// redirected before any data or markup ever reaches the client.
export default async function SaaSAdminPage() {
  const { ctx, error } = await requireSaasAdmin()

  if (error || !ctx) {
    redirect('/signin')
  }

  return <SaasAdminClient />
}
