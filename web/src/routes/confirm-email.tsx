import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client'
import { AuthLayout } from '@/components/app/auth-layout'
import { Button } from '@/components/ui/button'
import { getMeta } from '@/db/database'
import { saveMe } from '@/db/session'
import { errorText } from '@/lib/errors'

type Search = { userId?: string; email?: string; token?: string }

export const Route = createFileRoute('/confirm-email')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    userId: typeof search.userId === 'string' ? search.userId : undefined,
    email: typeof search.email === 'string' ? search.email : undefined,
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: ConfirmEmailPage,
})

function ConfirmEmailPage() {
  const { t } = useTranslation()
  const { userId, email, token } = Route.useSearch()
  const started = useRef(false)
  const complete = Boolean(userId && email && token)

  const mutation = useMutation({
    mutationFn: async () => {
      const me = await api.confirmEmail(userId ?? '', email ?? '', token ?? '')
      if ((await getMeta('me'))?.id === me.id) await saveMe(me)
      return me
    },
  })
  const { mutate } = mutation

  useEffect(() => {
    if (!complete || started.current) return
    started.current = true
    mutate()
  }, [complete, mutate])

  return (
    <AuthLayout title={t('auth.confirmEmail.title')}>
      <div className="space-y-4 rounded-2xl border bg-card p-5 text-sm">
        {!complete ? (
          <p>{t('auth.confirmEmail.invalid')}</p>
        ) : mutation.isSuccess ? (
          <p>{t('auth.confirmEmail.done', { email: mutation.data.email })}</p>
        ) : mutation.isError ? (
          <p className="text-destructive">{errorText(mutation.error)}</p>
        ) : (
          <p className="text-muted-foreground">{t('auth.confirmEmail.working')}</p>
        )}
        <Button variant="secondary" className="h-11 w-full" nativeButton={false} render={<Link to="/" />}>
          {t('auth.confirmEmail.goToApp')}
        </Button>
      </div>
    </AuthLayout>
  )
}
