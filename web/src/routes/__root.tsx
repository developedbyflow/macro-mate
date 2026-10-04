import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Toaster } from '@/components/ui/sonner'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
})

function Root() {
  return (
    <>
      <Outlet />
      <UpdatePrompt />
      <Toaster position="top-center" richColors />
    </>
  )
}

function UpdatePrompt() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!needRefresh) return
    toast(t('common.newVersion'), {
      duration: Infinity,
      action: { label: t('common.update'), onClick: () => void updateServiceWorker(true) },
    })
  }, [needRefresh, updateServiceWorker, t])

  return null
}
