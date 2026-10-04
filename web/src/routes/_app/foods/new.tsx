import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Camera, Keyboard, Loader2, ScanBarcode } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
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
import { imageToDataUrl } from '@/lib/photos'

type Mode = 'scan' | 'label' | 'manual'

export const Route = createFileRoute('/_app/foods/new')({
  validateSearch: (search: Record<string, unknown>): { mode?: Mode } => ({
    mode: search.mode === 'scan' || search.mode === 'label' || search.mode === 'manual' ? search.mode : undefined,
  }),
  component: NewFoodPage,
})

type Step = { kind: 'choose' } | { kind: 'scanning' } | { kind: 'label' } | { kind: 'working'; message: string } | { kind: 'form'; draft: FoodDraft }

function NewFoodPage() {
  const { mode } = Route.useSearch()
  const navigate = useNavigate()
  const ownerId = useOwnerId()
  const ai = useAiStatus()
  const [step, setStep] = useState<Step>(
    mode === 'scan' ? { kind: 'scanning' } : mode === 'label' ? { kind: 'label' } : mode === 'manual' ? { kind: 'form', draft: emptyDraft() } : { kind: 'choose' },
  )

  const withAi = useCallback(
    async (draft: FoodDraft, image?: string) => {
      if (!ai.online || !ai.configured) return draft
      setStep({ kind: 'working', message: image ? 'DeepSeek citește eticheta…' : 'DeepSeek completează valorile și notele…' })
      try {
        return await enrichDraft(draft, image)
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : 'DeepSeek nu a răspuns. Completează manual.')
        return draft
      }
    },
    [ai.online, ai.configured],
  )

  const onDetected = useCallback(
    async (code: string) => {
      const existing = await db.foods.where('barcode').equals(code).first()
      if (existing && !existing.deletedAt) {
        toast('Produsul e deja în bază.')
        await navigate({ to: '/foods/$foodId', params: { foodId: existing.id } })
        return
      }

      setStep({ kind: 'working', message: 'Caut produsul în Open Food Facts…' })
      let draft: FoodDraft = { ...emptyDraft(), barcode: code }
      try {
        const product = await api.barcode(code)
        draft = {
          ...draft,
          name: product.name ?? '',
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
        if (error instanceof OfflineError) toast('Ești offline. Completează manual; notele le poți calcula mai târziu.')
        else if (error instanceof ApiError && error.status === 404) toast('Produsul nu e în Open Food Facts. Fă o poză la etichetă sau completează manual.')
        else toast.error('Căutarea a eșuat.')
      }

      if (draft.source !== 'open_food_facts') {
        setStep({ kind: 'form', draft })
        return
      }
      setStep({ kind: 'form', draft: await withAi(draft) })
    },
    [navigate, withAi],
  )

  async function save(draft: FoodDraft) {
    const id = newId()
    await saveRow('foods', { id, ...foodFromDraft(draft) }, ownerId)
    toast.success(`${draft.name} a fost adăugat.`)
    await navigate({ to: '/foods/$foodId', params: { foodId: id }, replace: true })
  }

  return (
    <>
      <PageHeader title="Aliment nou" back />
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-8">
        {step.kind === 'choose' && (
          <div className="space-y-3">
            <BigChoice icon={ScanBarcode} title="Scanează codul de bare" text="Caut produsul în Open Food Facts, iar ce lipsește completează DeepSeek." onClick={() => setStep({ kind: 'scanning' })} />
            <BigChoice icon={Camera} title="Poză la etichetă" text="DeepSeek citește valorile nutriționale din poză." onClick={() => setStep({ kind: 'label' })} />
            <BigChoice icon={Keyboard} title="Scriu manual" text="Completezi tu, iar AI-ul poate umple golurile." onClick={() => setStep({ kind: 'form', draft: emptyDraft() })} />
          </div>
        )}

        {step.kind === 'label' && <LabelStep disabledReason={!ai.online ? 'Ai nevoie de internet.' : !ai.configured ? 'Cheia DeepSeek nu e setată pe server.' : null} onRead={async (draft, image) => setStep({ kind: 'form', draft: await withAi(draft, image) })} />}

        {step.kind === 'working' && (
          <div className="flex flex-col items-center gap-3 py-24 text-sm text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-primary" />
            {step.message}
          </div>
        )}

        {step.kind === 'form' && <FoodForm initial={step.draft} submitLabel="Salvează alimentul" onSubmit={save} />}
      </main>

      {step.kind === 'scanning' && <Scanner onDetected={(code) => void onDetected(code)} onClose={() => setStep({ kind: 'choose' })} />}
    </>
  )
}

function BigChoice({ icon: Icon, title, text, onClick }: { icon: typeof Camera; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-4 rounded-2xl border bg-card p-4 text-left shadow-xs transition-colors active:bg-muted">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{text}</span>
      </span>
    </button>
  )
}

function LabelStep({ onRead, disabledReason }: { onRead: (draft: FoodDraft, image: string) => Promise<void>; disabledReason: string | null }) {
  const input = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [image, setImage] = useState<string | null>(null)

  async function pick(file: File | undefined) {
    if (!file) return
    setImage(await imageToDataUrl(file))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Fă o poză clară la tabelul cu valori nutriționale. Numele e opțional: dacă îl lași gol, îl citește DeepSeek de pe ambalaj.</p>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nume (opțional)" className="h-10" />
      {image ? (
        <img src={image} alt="Eticheta" className="max-h-80 w-full rounded-xl object-contain" />
      ) : (
        <Button variant="outline" className="h-32 w-full flex-col gap-2" onClick={() => input.current?.click()}>
          <Camera className="size-6" />
          Fă poza
        </Button>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      {disabledReason && <p className="text-sm text-destructive">{disabledReason}</p>}
      <div className="flex gap-2">
        {image && (
          <Button variant="outline" className="h-11 flex-1" onClick={() => setImage(null)}>
            Altă poză
          </Button>
        )}
        <Button className="h-11 flex-[2]" disabled={!image || !!disabledReason} onClick={() => image && void onRead({ ...emptyDraft(), name }, image)}>
          Citește eticheta
        </Button>
      </div>
    </div>
  )
}
