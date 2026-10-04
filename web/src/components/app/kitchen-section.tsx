import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Check, Copy, DoorOpen, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api, ApiError } from '@/api/client'
import type { KitchenInfo } from '@/api/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { leaveKitchen, removeMember, restoreArchive } from '@/db/kitchen'
import { useMe } from '@/hooks/use-data'
import { useOnline } from '@/hooks/use-online'
import i18n from '@/i18n'
import { longDate } from '@/lib/dates'
import { ConfirmDelete } from './confirm-delete'

function archiveText(archive: NonNullable<KitchenInfo['archive']>) {
  const parts = [
    [archive.recipes, 'profile.kitchen.archive.recipes'],
    [archive.mealPlans, 'profile.kitchen.archive.mealPlans'],
    [archive.shoppingLists, 'profile.kitchen.archive.shoppingLists'],
    [archive.pantryItems, 'profile.kitchen.archive.pantryItems'],
  ] as const
  return parts
    .filter(([count]) => count > 0)
    .map(([count, key]) => i18n.t(key, { count }))
    .join(', ')
}

function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : i18n.t('profile.kitchen.somethingWrong')
}

export function KitchenSection() {
  const { t } = useTranslation()
  const online = useOnline()
  const me = useMe()
  const queryClient = useQueryClient()
  const kitchen = useQuery({ queryKey: ['kitchen'], queryFn: api.kitchen, enabled: online })
  const [invite, setInvite] = useState<{ url: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [askArchive, setAskArchive] = useState(false)

  const refresh = (info?: KitchenInfo) => (info ? queryClient.setQueryData(['kitchen'], info) : queryClient.invalidateQueries({ queryKey: ['kitchen'] }))

  const createInvite = useMutation({
    mutationFn: api.createInvite,
    onSuccess: (created) => {
      setCopied(false)
      setInvite({ url: `${window.location.origin}/invite/${created.token}`, expiresAt: created.expiresAt })
    },
    onError: (error) => toast.error(errorText(error)),
  })

  const leave = useMutation({
    mutationFn: leaveKitchen,
    onSuccess: async (result) => {
      await refresh()
      toast.success(t('profile.kitchen.left'))
      if (result.hasArchive) setAskArchive(true)
    },
    onError: (error) => toast.error(errorText(error)),
  })

  const restore = useMutation({
    mutationFn: restoreArchive,
    onSuccess: (info) => {
      refresh(info)
      toast.success(t('profile.kitchen.restored'))
    },
    onError: (error) => toast.error(errorText(error)),
  })

  const remove = useMutation({
    mutationFn: removeMember,
    onSuccess: (info) => refresh(info),
    onError: (error) => toast.error(errorText(error)),
  })

  async function copy() {
    if (!invite) return
    if (navigator.share) {
      await navigator.share({ title: 'MacroMate', text: t('profile.kitchen.shareText'), url: invite.url }).catch(() => undefined)
      return
    }
    await navigator.clipboard.writeText(invite.url)
    setCopied(true)
  }

  const data = kitchen.data
  const archive = data?.archive
  const archiveItems = archive ? archiveText(archive) : ''

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t('profile.kitchen.title')}</h2>
      <div className="space-y-4 rounded-2xl border bg-card p-4 text-sm">
        <p className="text-muted-foreground">{t('profile.kitchen.intro')}</p>

        {!online ? (
          <p className="text-muted-foreground">{t('profile.kitchen.offline')}</p>
        ) : !data ? (
          <p className="text-muted-foreground">{kitchen.isError ? errorText(kitchen.error) : t('profile.kitchen.loading')}</p>
        ) : (
          <>
            <ul className="divide-y rounded-xl border">
              {data.members.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="flex-1">
                    {member.displayName}
                    {member.id === me?.id && <span className="text-muted-foreground"> {t('profile.kitchen.you')}</span>}
                    {member.id === data.ownerId && <span className="text-muted-foreground"> · {t('profile.kitchen.owner')}</span>}
                  </span>
                  {member.id !== me?.id && data.ownerId === me?.id && (
                    <ConfirmDelete
                      title={t('profile.kitchen.removeTitle', { name: member.displayName })}
                      description={t('profile.kitchen.removeDescription')}
                      confirmLabel={t('profile.kitchen.remove')}
                      onConfirm={() => remove.mutateAsync(member.id).then(() => undefined)}
                      trigger={<Button variant="ghost" size="sm" className="text-destructive">{t('profile.kitchen.remove')}</Button>}
                    />
                  )}
                </li>
              ))}
            </ul>

            {invite ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input readOnly value={invite.url} className="h-10 font-mono text-xs" onFocus={(e) => e.target.select()} />
                  <Button variant="secondary" className="h-10" onClick={() => void copy()}>
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? t('profile.kitchen.copied') : t('profile.kitchen.send')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t('profile.kitchen.linkNote', { date: longDate(invite.expiresAt.slice(0, 10)) })}</p>
              </div>
            ) : (
              <Button variant="secondary" className="h-10 w-full" disabled={createInvite.isPending} onClick={() => createInvite.mutate()}>
                <UserPlus className="size-4" /> {t('profile.kitchen.invite')}
              </Button>
            )}

            {data.members.length > 1 && (
              <ConfirmDelete
                title={t('profile.kitchen.leaveTitle')}
                description={t('profile.kitchen.leaveDescription')}
                confirmLabel={t('profile.kitchen.leave')}
                onConfirm={() => leave.mutateAsync().then(() => undefined)}
                trigger={
                  <Button variant="ghost" className="h-10 w-full text-destructive">
                    <DoorOpen className="size-4" /> {t('profile.kitchen.leaveKitchen')}
                  </Button>
                }
              />
            )}

            {archive && (
              <div className="space-y-2 rounded-xl bg-muted/60 p-3">
                <p className="flex items-center gap-2 font-medium">
                  <Archive className="size-4 text-muted-foreground" /> {t('profile.kitchen.archive.title')}
                </p>
                <p className="text-muted-foreground">{archiveItems ? t('profile.kitchen.archive.contents', { items: archiveItems }) : t('profile.kitchen.archive.contentsEmpty')}</p>
                <Button variant="outline" size="sm" disabled={restore.isPending} onClick={() => restore.mutate()}>
                  {t('profile.kitchen.archive.restore')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <AlertDialog open={askArchive} onOpenChange={setAskArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('profile.kitchen.archive.askTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveItems ? t('profile.kitchen.archive.askDescription', { items: archiveItems }) : t('profile.kitchen.archive.askDescriptionEmpty')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('profile.kitchen.archive.notNow')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                restore.mutate()
                setAskArchive(false)
              }}
            >
              {t('profile.kitchen.archive.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
