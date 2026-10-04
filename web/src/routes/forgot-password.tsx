import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client'
import { AuthLayout } from '@/components/app/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorText } from '@/lib/errors'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const mutation = useMutation({ mutationFn: () => api.forgotPassword(email.trim()) })

  function submit(e: FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }

  const message = errorText(mutation.error)

  return (
    <AuthLayout title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')}>
      {mutation.isSuccess ? (
        <p className="rounded-2xl border bg-card p-5 text-sm">{t('auth.forgot.sent', { email: email.trim() })}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input id="email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
          </div>
          {message && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p>}
          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={mutation.isPending}>
            {mutation.isPending ? t('auth.forgot.sending') : t('auth.forgot.send')}
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
