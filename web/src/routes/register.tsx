import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { AuthLayout } from '@/components/app/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorText } from '@/lib/errors'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const signUp = useMutation({ mutationFn: () => api.signUp(email.trim(), name.trim(), password) })
  const resend = useMutation({
    mutationFn: () => api.resendConfirmation(email.trim()),
    onSuccess: () => toast.success(t('auth.register.resent')),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setProblem(t('auth.register.nameMissing'))
    if (password.length < 10) return setProblem(t('auth.passwordTooShort'))
    setProblem(null)
    signUp.mutate()
  }

  const message = problem ?? errorText(signUp.error)

  return (
    <AuthLayout title={t('auth.register.title')} subtitle={t('auth.register.subtitle')}>
      {signUp.isSuccess ? (
        <div className="space-y-4 rounded-2xl border bg-card p-5 text-sm">
          <p>{t('auth.register.sent', { email: email.trim() })}</p>
          <Button variant="outline" className="h-10 w-full" disabled={resend.isPending} onClick={() => resend.mutate()}>
            {t('auth.register.resend')}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t('auth.register.name')}</Label>
            <Input id="name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input id="email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" />
            <p className="text-xs text-muted-foreground">{t('auth.passwordHint')}</p>
          </div>
          {message && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p>}
          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={signUp.isPending}>
            {signUp.isPending ? t('auth.register.creating') : t('auth.register.create')}
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t('auth.register.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t('auth.signIn')}
        </Link>
      </p>
    </AuthLayout>
  )
}
