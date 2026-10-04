import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Camera, Keyboard, Loader2, ScanBarcode } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api, ApiError, OfflineError } from '@/api/client'
import { FoodForm } from '@/components/app/food-form'
import { useAiStatus } from '@/hooks/use-ai-status'
import { emptyDraft, enrichDraft, foodFromDraft, type FoodDraft } from '@/lib/food-draft'
import { PageHeader } from '@/components/app/page-header'
import { Scanner } from '@/components/app/scanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { db } from '@/db/database'
import { newId, saveRow } from '@/db/mutations'
import { useOwnerId } from '@/hooks/use-owner'
import { addToPantry } from '@/lib/pantry'
import { imageToDataUrl } from '@/lib/photos'
import { foodName, primaryNameField } from '@/lib/food-name'

type Mode = 'scan' | 'label' | 'manual'

export const Route = createFileRoute('/_app/foods/new')({
  validateSearch: (search: Record<string, unknown>): { mode?: Mode; barcode?: string } => ({
    mode: search.mode === 'scan' || search.mode === 'label' || search.mode === 'manual' ? search.mode : undefined,
    barcode: /^\d{6,14}$/.test(String(search.barcode ?? '')) ? String(search.barcode) : undefined,
  }),
  component: NewFoodPage,
})

type Step = { kind: 'choose' } | { kind: 'scanning' } | { kind: 'label' } | { kind: 'working'; message: string } | { kind: 'form'; draft: FoodDraft }

function NewFoodPage() {
  const { t } = useTranslation()
  const { mode, barcode } = Route.useSearch()
  const navigate = useNavigate()
  const ownerId = useOwnerId()
  const ai = useAiStatus()
  const [step, setStep] = useState<Step>(
    barcode ? { kind: 'working', message: t('foods.new.lookingUp') } : mode === 'scan' ? { kind: 'scanning' } : mode === 'label' ? { kind: 'label' } : mode === 'manual' ? { kind: 'form', draft: emptyDraft() } : { kind: 'choose' },
  )

  const withAi = useCallback(
    async (draft: FoodDraft, image?: string) => {
      if (!ai.online || !ai.configured) return draft
      setStep({ kind: 'working', message: image ? t('foods.new.aiReadingLabel') : t('foods.new.aiFilling') })
      try {
        return await enrichDraft(draft, image)
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : t('foods.new.aiFailed'))
        return draft
      }
    },
    [ai.online, ai.configured, t],
  )

  const onDetected = useCallback(
    async (code: string) => {
      const existing = await db.foods.where('barcode').equals(code).first()
      if (existing && !existing.deletedAt) {
        toast(t('foods.new.alreadyExists'))
        await navigate({ to: '/foods/$foodId', params: { foodId: existing.id } })
        return
      }

      setStep({ kind: 'working', message: t('foods.new.lookingUpOpenFoodFacts') })
      let draft: FoodDraft = { ...emptyDraft(), barcode: code }
      try {
        const product = await api.barcode(code)
        draft = {
          ...draft,
          [primaryNameField()]: product.name ?? '',
          brand: product.brand ?? '',
          source: 'open_food_facts',
          values: {
            kcal: product.values.kcal?.toString() ?? '',
            proteinG: product.values.proteinG?.toString() ?? '',
            carbsG: product.values.carbsG?.toString() ?? '',
            fatG: product.values.fatG?.toString() ?? '',
            fiberG: product.values.fiberG?.toString() ?? '',
            sodiumMg: product.values.sodiumMg?.toString() ?? '',
          },
        }
      } catch (error) {
        if (error instanceof OfflineError) toast(t('foods.new.offline'))
        else if (error instanceof ApiError && error.status === 404) toast(t('foods.new.notFound'))
        else toast.error(t('foods.new.lookupFailed'))
      }

      if (draft.source !== 'open_food_facts') {
        setStep({ kind: 'form', draft })
        return
      }
      setStep({ kind: 'form', draft: await withAi(draft) })
    },
    [navigate, withAi, t],
  )

  const lookedUp = useRef(false)
  useEffect(() => {
    if (!barcode || lookedUp.current) return
    lookedUp.current = true
    void onDetected(barcode)
  }, [barcode, onDetected])

  async function save(draft: FoodDraft) {
    const id = newId()
    await saveRow('foods', { id, ...foodFromDraft(draft) }, ownerId)
    await addToPantry(id, ownerId)
    toast.success(t('foods.new.added', { name: foodName(foodFromDraft(draft)) }))
    await navigate({ to: '/foods/$foodId', params: { foodId: id }, replace: true })
  }

  return (
    <>
      <PageHeader title={t('foods.new.title')} back />
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-8 lg:mx-0 lg:max-w-none lg:px-8">
        {step.kind === 'choose' && (
          <div className="space-y-3 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0">
            <BigChoice icon={ScanBarcode} title={t('foods.scanBarcode')} text={t('foods.new.scanText')} onClick={() => setStep({ kind: 'scanning' })} />
            <BigChoice icon={Camera} title={t('foods.new.labelTitle')} text={t('foods.new.labelText')} onClick={() => setStep({ kind: 'label' })} />
            <BigChoice icon={Keyboard} title={t('foods.new.manualTitle')} text={t('foods.new.manualText')} onClick={() => setStep({ kind: 'form', draft: emptyDraft() })} />
          </div>
        )}

        {step.kind === 'label' && <LabelStep disabledReason={!ai.online ? t('foods.new.needsInternet') : !ai.configured ? t('foods.aiKeyMissing') : null} onRead={async (draft, image) => setStep({ kind: 'form', draft: await withAi(draft, image) })} />}

        {step.kind === 'working' && (
          <div className="flex flex-col items-center gap-3 py-24 text-sm text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-primary" />
            {step.message}
          </div>
        )}

        {step.kind === 'form' && <FoodForm initial={step.draft} submitLabel={t('foods.new.saveFood')} onSubmit={save} />}
      </main>

      {step.kind === 'scanning' && <Scanner onDetected={(code) => void onDetected(code)} onClose={() => setStep({ kind: 'choose' })} />}
    </>
  )
}

function BigChoice({ icon: Icon, title, text, onClick }: { icon: typeof Camera; title: string; text: string; onClick: () => void }) {
  const descriptionId = useId()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      aria-describedby={descriptionId}
      className="flex w-full items-start gap-4 rounded-2xl border bg-card p-4 text-left shadow-xs transition-colors hover:bg-muted active:bg-muted"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span id={descriptionId} className="block text-sm text-muted-foreground">{text}</span>
      </span>
    </button>
  )
}

function LabelStep({ onRead, disabledReason }: { onRead: (draft: FoodDraft, image: string) => Promise<void>; disabledReason: string | null }) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [image, setImage] = useState<string | null>(null)

  async function pick(file: File | undefined) {
    if (!file) return
    setImage(await imageToDataUrl(file))
  }

  return (
    <div className="space-y-4 lg:max-w-xl">
      <p className="text-sm text-muted-foreground">{t('foods.label.hint')}</p>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('foods.label.namePlaceholder')} className="h-10" />
      {image ? (
        <img src={image} alt={t('foods.label.imageAlt')} className="max-h-80 w-full rounded-xl object-contain" />
      ) : (
        <Button variant="outline" className="h-32 w-full flex-col gap-2" onClick={() => input.current?.click()}>
          <Camera className="size-6" />
          {t('foods.label.takePhoto')}
        </Button>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      {disabledReason && <p className="text-sm text-destructive">{disabledReason}</p>}
      <div className="flex gap-2">
        {image && (
          <Button variant="outline" className="h-11 flex-1" onClick={() => setImage(null)}>
            {t('foods.label.otherPhoto')}
          </Button>
        )}
        <Button className="h-11 flex-[2]" disabled={!image || !!disabledReason} onClick={() => image && void onRead({ ...emptyDraft(), [primaryNameField()]: name }, image)}>
          {t('foods.label.read')}
        </Button>
      </div>
    </div>
  )
}
