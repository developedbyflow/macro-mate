import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { BottomNav } from '@/components/app/bottom-nav'
import { SideNav } from '@/components/app/side-nav'
import { db, getMeta } from '@/db/database'
import { verifySession } from '@/db/session'
import { startBackgroundSync } from '@/db/sync'

let started = false

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    if (!(await getMeta('me'))) throw redirect({ to: '/login' })
  },
  component: AppLayout,
})

function AppLayout() {
  const navigate = useNavigate()

  useEffect(() => {
    if (started) return
    started = true
    void verifySession().then(async (valid) => {
      if (!valid) {
        started = false
        await db.meta.delete('me')
        await navigate({ to: '/login' })
        return
      }
      startBackgroundSync()
    })
  }, [navigate])

  return (
    <div className="min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60">
      <SideNav />
      <Outlet />
      <BottomNav />
    </div>
  )
}
