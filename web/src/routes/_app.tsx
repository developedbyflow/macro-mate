import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomNav } from '@/components/app/bottom-nav'
import { Button } from '@/components/ui/button'
import { SideNav } from '@/components/app/side-nav'
import { db, getMeta } from '@/db/database'
import { logout, verifySession } from '@/db/session'
import { useMe } from '@/hooks/use-data'
import { locale } from '@/i18n'
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
      <DemoBanner />
      <Outlet />
      <BottomNav />
    </div>
  )
}

function DemoBanner() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const me = useMe()
  if (!me?.isDemo || !me.demoExpiresAt) return null

  const date = new Date(me.demoExpiresAt).toLocaleString(locale(), { weekday: 'long', hour: '2-digit', minute: '2-digit' })
  return (
    <div className="pt-safe flex items-center gap-3 border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100 lg:px-8">
      <p className="flex-1">{t('auth.demo.banner', { date })}</p>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={async () => {
          await logout()
          await navigate({ to: '/register' })
        }}
      >
        {t('auth.demo.createOwn')}
      </Button>
    </div>
  )
}
