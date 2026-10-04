import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, OfflineError } from '@/api/client'
import { LanguageSwitch } from '@/components/app/language-switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login } from '@/db/session'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { invite?: string } => ({
    invite: typeof search.invite === 'string' && /^[\w-]{16,64}$/.test(search.invite) ? search.invite : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { invite } = Route.useSearch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: () => (invite ? navigate({ to: '/invite/$token', params: { token: invite } }) : navigate({ to: '/' })),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }

  const error = mutation.error
  const message =
    error instanceof OfflineError
      ? t('auth.login.offline')
      : error instanceof ApiError
        ? error.message
        : error
          ? t('auth.somethingWrong')
          : null

  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src="/pwa-192x192.png" alt="" className="size-16 rounded-2xl shadow-sm" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">MacroMate</h1>
            <p className="text-sm text-muted-foreground">{t('auth.login.tagline')}</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input id="email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Link to="/forgot-password" className="text-xs text-primary underline-offset-4 hover:underline">
                {t('auth.forgotLink')}
              </Link>
            </div>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" />
          </div>
          {message && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p>}
          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={mutation.isPending}>
            {mutation.isPending ? t('auth.login.loadingData') : t('auth.signIn')}
          </Button>
        </form>
        <LanguageSwitch className="mx-auto mt-6 h-8 w-44" />
      </div>
    </main>
  )
}
