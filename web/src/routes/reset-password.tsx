import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { AuthLayout } from '@/components/app/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorText } from '@/lib/errors'

type Search = { email?: string; token?: string }

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    email: typeof search.email === 'string' ? search.email : undefined,
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { email, token } = Route.useSearch()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => api.resetPassword(email ?? '', token ?? '', password),
    onSuccess: () => {
      toast.success(t('auth.reset.done'))
      void navigate({ to: '/login' })
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 10) return setProblem(t('auth.passwordTooShort'))
    if (password !== again) return setProblem(t('auth.reset.mismatch'))
    setProblem(null)
    mutation.mutate()
  }

  const message = problem ?? errorText(mutation.error)

  return (
    <AuthLayout title={t('auth.reset.title')} subtitle={email}>
      {!email || !token ? (
        <div className="space-y-4 rounded-2xl border bg-card p-5 text-sm">
          <p>{t('auth.reset.invalid')}</p>
          <Button variant="secondary" className="h-11 w-full" render={<Link to="/forgot-password" />}>
            {t('auth.reset.askAgain')}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
          <div className="space-y-1.5">
            <Label htmlFor="password">{t('auth.reset.newPassword')}</Label>
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" />
            <p className="text-xs text-muted-foreground">{t('auth.passwordHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="again">{t('auth.reset.again')}</Label>
            <Input id="again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required className="h-11" />
          </div>
          {message && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p>}
          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={mutation.isPending}>
            {mutation.isPending ? t('auth.reset.saving') : t('auth.reset.save')}
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="text-primary underline-offset-4 hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </AuthLayout>
  )
}
