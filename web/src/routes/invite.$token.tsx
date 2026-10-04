import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api, ApiError, OfflineError } from '@/api/client'
import { LanguageSwitch } from '@/components/app/language-switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getMeta } from '@/db/database'
import { joinKitchen } from '@/db/kitchen'
import { register } from '@/db/session'
import i18n from '@/i18n'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/invite/$token')({
  component: InvitePage,
})

function errorText(error: unknown) {
  if (error instanceof OfflineError) return i18n.t('auth.invite.offline')
  if (error instanceof ApiError) return error.message
  return error ? i18n.t('auth.somethingWrong') : null
}

function InvitePage() {
  const { t } = useTranslation()
  const { token } = Route.useParams()
  const navigate = useNavigate()
  const me = useLiveQuery(async () => (await getMeta('me')) ?? null, [], 'loading' as const)
  const invite = useQuery({ queryKey: ['invite', token], queryFn: () => api.invite(token), retry: false })

  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/pwa-192x192.png" alt="" className="size-16 rounded-2xl shadow-sm" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('auth.invite.title')}</h1>
            {invite.data && <p className="text-sm text-muted-foreground">{t('auth.invite.invitedBy', { names: invite.data.members.join(', ') })}</p>}
          </div>
        </div>

        {invite.isPending || me === 'loading' ? (
          <p className="text-center text-sm text-muted-foreground">{t('auth.loading')}</p>
        ) : invite.isError ? (
          <div className="space-y-4 rounded-2xl border bg-card p-5 text-center text-sm">
            <p>{errorText(invite.error)}</p>
            <Button render={<Link to="/" />} variant="secondary" className="w-full">
              {t('auth.invite.goToApp')}
            </Button>
          </div>
        ) : me ? (
          <JoinForm token={token} name={me.displayName} onJoined={() => void navigate({ to: '/' })} />
        ) : (
          <RegisterForm token={token} onRegistered={() => void navigate({ to: '/' })} />
        )}

        <LanguageSwitch className="mx-auto h-8 w-44" />
      </div>
    </main>
  )
}

function JoinForm({ token, name, onJoined }: { token: string; name: string; onJoined: () => void }) {
  const { t } = useTranslation()
  const [bringMine, setBringMine] = useState(true)
  const join = useMutation({
    mutationFn: () => joinKitchen(token, bringMine),
    onSuccess: () => {
      toast.success(t('auth.invite.joined'))
      onJoined()
    },
  })

  const options = [
    { value: true, title: t('auth.invite.bringAll'), text: t('auth.invite.bringAllText') },
    { value: false, title: t('auth.invite.bringNothing'), text: t('auth.invite.bringNothingText') },
  ]

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5 text-sm shadow-xs">
      <p>
        <Trans i18nKey="auth.invite.signedInAs" values={{ name }} components={{ strong: <strong /> }} />
      </p>
      <fieldset className="space-y-2">
        <legend className="mb-2 font-medium">{t('auth.invite.bringQuestion')}</legend>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={bringMine === option.value}
            onClick={() => setBringMine(option.value)}
            className={cn('w-full rounded-xl border p-3 text-left transition-colors', bringMine === option.value ? 'border-primary bg-primary/10' : 'bg-card hover:bg-muted')}
          >
            <span className="block font-medium">{option.title}</span>
            <span className="block text-xs text-muted-foreground">{option.text}</span>
          </button>
        ))}
      </fieldset>
      {join.error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">{errorText(join.error)}</p>}
      <Button size="lg" className="h-11 w-full text-base" disabled={join.isPending} onClick={() => join.mutate()}>
        {join.isPending ? t('auth.invite.moving') : t('auth.invite.join')}
      </Button>
    </div>
  )
}

function RegisterForm({ token, onRegistered }: { token: string; onRegistered: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const signUp = useMutation({ mutationFn: () => register(token, email.trim(), name.trim(), password), onSuccess: onRegistered })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setProblem(t('auth.invite.nameMissing'))
    if (password.length < 10) return setProblem(t('auth.invite.passwordTooShort'))
    setProblem(null)
    signUp.mutate()
  }

  const message = problem ?? errorText(signUp.error)

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t('auth.invite.name')}</Label>
          <Input id="name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} required className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input id="email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t('auth.password')}</Label>
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" />
          <p className="text-xs text-muted-foreground">{t('auth.invite.passwordHint')}</p>
        </div>
        {message && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p>}
        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={signUp.isPending}>
          {signUp.isPending ? t('auth.invite.creating') : t('auth.invite.register')}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t('auth.invite.haveAccount')}{' '}
        <Link to="/login" search={{ invite: token }} className="font-medium text-primary hover:underline">
          {t('auth.signIn')}
        </Link>
      </p>
    </div>
  )
}
