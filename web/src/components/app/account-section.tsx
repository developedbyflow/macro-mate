import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteAccount, saveMe } from '@/db/session'
import { useMe } from '@/hooks/use-data'
import { useOnline } from '@/hooks/use-online'
import { errorText } from '@/lib/errors'
import { ConfirmDelete } from './confirm-delete'

export function AccountSection() {
  const { t } = useTranslation()
  const me = useMe()
  const online = useOnline()

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t('profile.account.title')}</h2>
      <div className="divide-y rounded-2xl border bg-card text-sm">
        {me && <NameForm key={me.displayName} current={me.displayName} disabled={!online} />}
        {me && !me.isDemo && <EmailForm current={me.email} disabled={!online} />}
        {me && !me.isDemo && <PasswordForm disabled={!online} />}
        {me?.isDemo && <p className="p-4 text-muted-foreground">{t('profile.account.demo')}</p>}
        {me && <DeleteAccount demo={me.isDemo} disabled={!online} />}
      </div>
      {!online && <p className="text-xs text-muted-foreground">{t('profile.account.offline')}</p>}
    </section>
  )
}

function NameForm({ current, disabled }: { current: string; disabled: boolean }) {
  const { t } = useTranslation()
  const [name, setName] = useState(current)
  const mutation = useMutation({
    mutationFn: () => api.changeName(name.trim()),
    onSuccess: async (me) => {
      await saveMe(me)
      toast.success(t('profile.account.nameSaved'))
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <form onSubmit={submit} className="space-y-2 p-4">
      <label htmlFor="account-name" className="block font-medium">
        {t('profile.account.name')}
      </label>
      <div className="flex gap-2">
        <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" className="h-10 flex-1" />
        <Button type="submit" variant="secondary" className="h-10" disabled={disabled || mutation.isPending || !name.trim() || name.trim() === current}>
          {t('common.save')}
        </Button>
      </div>
      <Problem error={mutation.error} />
    </form>
  )
}

function EmailForm({ current, disabled }: { current: string; disabled: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: () => api.changeEmail(email.trim(), password),
    onSuccess: () => {
      setSentTo(email.trim())
      setOpen(false)
      setEmail('')
      setPassword('')
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <div className="space-y-3 p-4">
      <Line label={t('profile.account.email')} value={current}>
        {!open && (
          <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
            {t('profile.account.change')}
          </Button>
        )}
      </Line>
      {sentTo && !open && <p className="rounded-lg bg-primary/10 px-3 py-2 text-primary">{t('profile.account.linkSent', { email: sentTo })}</p>}
      {open && (
        <form onSubmit={submit} className="space-y-2">
          <Input type="email" inputMode="email" autoComplete="email" placeholder={t('profile.account.newEmail')} value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10" />
          <Input type="password" autoComplete="current-password" placeholder={t('profile.account.currentPassword')} value={password} onChange={(e) => setPassword(e.target.value)} required className="h-10" />
          <Problem error={mutation.error} />
          <FormButtons pending={mutation.isPending} disabled={disabled} label={t('profile.account.sendLink')} onCancel={() => setOpen(false)} />
        </form>
      )}
    </div>
  )
}

function PasswordForm({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: () => api.changePassword(current, next),
    onSuccess: () => {
      toast.success(t('profile.account.passwordChanged'))
      setOpen(false)
      setCurrent('')
      setNext('')
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (next.length < 10) return setProblem(t('auth.passwordTooShort'))
    setProblem(null)
    mutation.mutate()
  }

  return (
    <div className="space-y-3 p-4">
      <Line label={t('profile.account.password')} value="••••••••••">
        {!open && (
          <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
            {t('profile.account.change')}
          </Button>
        )}
      </Line>
      {open && (
        <form onSubmit={submit} className="space-y-2">
          <Input type="password" autoComplete="current-password" placeholder={t('profile.account.currentPassword')} value={current} onChange={(e) => setCurrent(e.target.value)} required className="h-10" />
          <Input type="password" autoComplete="new-password" placeholder={t('profile.account.newPassword')} value={next} onChange={(e) => setNext(e.target.value)} required className="h-10" />
          <p className="text-xs text-muted-foreground">{t('auth.passwordHint')}</p>
          {problem ? <p className="text-destructive">{problem}</p> : <Problem error={mutation.error} />}
          <FormButtons pending={mutation.isPending} disabled={disabled} label={t('profile.account.savePassword')} onCancel={() => setOpen(false)} />
        </form>
      )}
    </div>
  )
}

function DeleteAccount({ demo, disabled }: { demo: boolean; disabled: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')

  async function confirm() {
    try {
      await deleteAccount(demo ? null : password)
      toast.success(t('profile.account.delete.done'))
      await navigate({ to: '/login' })
    } catch (error) {
      toast.error(errorText(error))
    }
  }

  return (
    <div className="space-y-2 p-4">
      {!demo && (
        <Input
          type="password"
          autoComplete="current-password"
          placeholder={t('profile.account.delete.password')}
          aria-label={t('profile.account.delete.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10"
        />
      )}
      <ConfirmDelete
        title={t('profile.account.delete.title')}
        description={t('profile.account.delete.description')}
        confirmLabel={t('profile.account.delete.confirm')}
        onConfirm={confirm}
        trigger={
          <Button variant="ghost" className="h-10 w-full text-destructive" disabled={disabled || (!demo && password.length === 0)}>
            <Trash2 className="size-4" /> {t('profile.account.delete.action')}
          </Button>
        }
      />
    </div>
  )
}

function Line({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        <div className="truncate text-muted-foreground">{value}</div>
      </div>
      {children}
    </div>
  )
}

function FormButtons({ pending, disabled, label, onCancel }: { pending: boolean; disabled: boolean; label: string; onCancel: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex gap-2">
      <Button type="button" variant="ghost" className="h-10 flex-1" onClick={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button type="submit" className="h-10 flex-[2]" disabled={disabled || pending}>
        {label}
      </Button>
    </div>
  )
}

function Problem({ error }: { error: unknown }) {
  const message = errorText(error)
  return message ? <p className="text-destructive">{message}</p> : null
}
