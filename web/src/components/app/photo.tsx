import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, ImageOff, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { db } from '@/db/database'
import { storePhoto } from '@/lib/photos'
import { cn } from '@/lib/utils'

function usePhotoUrl(id: string | null | undefined) {
  const local = useLiveQuery(async () => (id ? ((await db.photos.get(id)) ?? null) : null), [id], 'loading' as const)
  const objectUrl = useMemo(() => (local && local !== 'loading' ? URL.createObjectURL(local.blob) : null), [local])

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  if (!id || local === 'loading') return null
  return objectUrl ?? `/api/photos/${id}`
}

export function Photo({ id, className, fallback }: { id: string | null | undefined; className?: string; fallback?: ReactNode }) {
  const url = usePhotoUrl(id)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  if (!url || failedUrl === url) {
    return (
      <div className={cn('flex items-center justify-center bg-muted text-muted-foreground', className)}>
        {fallback ?? <ImageOff className="size-5 opacity-50" />}
      </div>
    )
  }
  return <img src={url} alt="" className={cn('object-cover', className)} onError={() => setFailedUrl(url)} loading="lazy" />
}

export function PhotoInput({ value, onChange, label }: { value: string | null; onChange: (id: string | null) => void; label?: string }) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      onChange(await storePhoto(file))
    } catch {
      toast.error(t('common.photoReadFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      {value ? (
        <div className="relative overflow-hidden rounded-xl">
          <Photo id={value} className="aspect-[4/3] w-full" />
          <button
            type="button"
            className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white"
            aria-label={t('common.removePhoto')}
            onClick={() => onChange(null)}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex h-24 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/40 text-sm text-muted-foreground transition-colors active:bg-muted"
        >
          <Camera className="size-6" />
          {busy ? t('common.processing') : (label ?? t('common.addPhoto'))}
        </button>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  )
}
