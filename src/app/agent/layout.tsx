'use client'

/**
 * src/app/agent/layout.tsx
 * Guards the /agent route — only agents get in.
 * Also provides the sign-out button on every agent page.
 */

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-3">
        <Loader2 className="size-6 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    )
  }

  if (!user) return null

  // Agent and attendant share this page now — attendant's job console
  // was merged into the Workflow tab below, so both roles are allowed in.
  if (user.role !== 'agent' && user.role !== 'attendant') {
    const dest = user.role === 'manager' ? '/manager' : '/customer'
    router.replace(dest)
    return null
  }

  return (
    <div className="relative">
      <div className="fixed top-4 right-4 z-50">
        <Button
          onClick={signOut}
          variant="outline"
          size="sm"
          className="gap-2 rounded-xl bg-white shadow-sm border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 font-bold text-xs uppercase tracking-widest"
        >
          <LogOut className="size-3.5" />
          Sign Out
        </Button>
      </div>
      {children}
    </div>
  )
}
