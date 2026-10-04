import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthLayout } from '@/components/app/auth-layout'
import { Button } from '@/components/ui/button'
import { confirmAccount } from '@/db/session'
import { errorText } from '@/lib/errors'

type Search = { userId?: string; token?: string }

export const Route = createFileRoute('/confirm-account')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    userId: typeof search.userId === 'string' ? search.userId : undefined,
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: ConfirmAccountPage,
})

function ConfirmAccountPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { userId, token } = Route.useSearch()
  const started = useRef(false)
  const complete = Boolean(userId && token)

  const mutation = useMutation({
    mutationFn: () => confirmAccount(userId ?? '', token ?? ''),
    onSuccess: () => navigate({ to: '/', replace: true }),
  })
  const { mutate } = mutation

  useEffect(() => {
    if (!complete || started.current) return
    started.current = true
    mutate()
  }, [complete, mutate])

  return (
    <AuthLayout title={t('auth.confirmAccount.title')}>
      <div className="space-y-4 rounded-2xl border bg-card p-5 text-sm">
        {!complete ? (
          <p>{t('auth.confirmAccount.invalid')}</p>
        ) : mutation.isError ? (
          <p className="text-destructive">{errorText(mutation.error)}</p>
        ) : (
          <p className="text-muted-foreground">{t('auth.confirmAccount.working')}</p>
        )}
        {(!complete || mutation.isError) && (
          <Button variant="secondary" className="h-11 w-full" nativeButton={false} render={<Link to="/login" />}>
            {t('auth.confirmAccount.goToLogin')}
          </Button>
        )}
      </div>
    </AuthLayout>
  )
}
