import { CloudAlert, CloudCheck, CloudOff, CloudUpload, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useOutboxCount } from '@/hooks/use-data'
import { useOnline } from '@/hooks/use-online'
import { syncNow, useSyncState } from '@/db/sync'

export function SyncIndicator() {
  const { t } = useTranslation()
  const online = useOnline()
  const pending = useOutboxCount()
  const { running, lastError } = useSyncState()

  const [Icon, label, tone] = !online
    ? [CloudOff, pending > 0 ? t('sync.offlinePending', { pending }) : t('sync.offline'), 'text-muted-foreground']
    : running
      ? [RefreshCw, t('sync.running'), 'text-muted-foreground animate-spin']
      : lastError
        ? [CloudAlert, t('sync.failed', { error: lastError }), 'text-destructive']
        : pending > 0
          ? [CloudUpload, t('sync.pending', { pending }), 'text-kcal']
          : [CloudCheck, t('sync.done'), 'text-primary']

  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} onClick={() => void syncNow()} className="relative">
      <Icon className={`size-5 ${tone}`} />
      {pending > 0 && (
        <span className="absolute top-1 right-1 min-w-4 rounded-full bg-kcal px-1 text-[10px] leading-4 font-semibold text-white">
          {pending > 99 ? '99+' : pending}
        </span>
      )}
    </Button>
  )
}
