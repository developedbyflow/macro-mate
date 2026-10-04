import { useMutation } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAiStatus } from '@/hooks/use-ai-status'
import { draftValues, enrichDraft, nutrientFields, type FoodDraft, type NutrientKey } from '@/lib/food-draft'
import { categories, categoryCodes } from '@/lib/categories'
import { cn } from '@/lib/utils'
import { EstimatedBadge, GradeBadge, ScoreBadge } from './badges'
import { NativeSelect } from './native-select'
import { PhotoInput } from './photo'

type Props = {
  initial: FoodDraft
  submitLabel: string
  onSubmit: (draft: FoodDraft) => Promise<void>
}

export function FoodForm({ initial, submitLabel, onSubmit }: Props) {
  const [draft, setDraft] = useState(initial)
  const [errors, setErrors] = useState<string[]>([])
  const ai = useAiStatus()

  const enrich = useMutation({
    mutationFn: () => enrichDraft(draft),
    onSuccess: (next) => {
      setDraft(next)
      toast.success('DeepSeek a completat valorile și notele.')
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Nu am putut ajunge la DeepSeek.'),
  })

  const save = useMutation({ mutationFn: () => onSubmit(draft) })

  function set<K extends keyof FoodDraft>(key: K, value: FoodDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function setValue(key: NutrientKey, value: string) {
    setDraft((d) => ({ ...d, values: { ...d.values, [key]: value }, estimatedFields: d.estimatedFields.filter((f) => f !== key) }))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const problems: string[] = []
    if (!draft.name.trim()) problems.push('Pune un nume.')
    if (!draft.category) problems.push('Alege o categorie.')
    const values = draftValues(draft)
    if (nutrientFields.some((f) => values[f.key] == null)) problems.push('Completează toate valorile (sau apasă „Completează cu AI”).')
    setErrors(problems)
    if (problems.length === 0) save.mutate()
  }

  const missingCount = nutrientFields.filter((f) => !draft.values[f.key].trim()).length
  const aiHint = !ai.online ? 'Ai nevoie de internet pentru AI.' : !ai.configured ? 'Cheia DeepSeek nu e setată pe server.' : null

  return (
    <form onSubmit={submit} className="space-y-5">
      <PhotoInput value={draft.photoId} onChange={(id) => set('photoId', id)} label="Poză la produs (opțional)" />

      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nume</Label>
          <Input id="name" value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="ex. Iaurt grecesc 2%" className="h-10" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="brand">Marcă</Label>
            <Input id="brand" value={draft.brand} onChange={(e) => set('brand', e.target.value)} placeholder="opțional" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Categorie</Label>
            <NativeSelect id="category" value={draft.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">Alege…</option>
              {categoryCodes.map((code) => (
                <option key={code} value={code}>
                  {categories[code]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold">Valori la 100 g</h2>
            {draft.barcode && <p className="text-xs text-muted-foreground">Cod de bare {draft.barcode}</p>}
          </div>
          <Button type="button" variant="secondary" size="sm" disabled={!!aiHint || enrich.isPending} onClick={() => enrich.mutate()}>
            <Sparkles className="size-4" />
            {enrich.isPending ? 'Se gândește…' : missingCount > 0 ? 'Completează cu AI' : 'Recalculează notele'}
          </Button>
        </div>
        {aiHint && <p className="text-xs text-muted-foreground">{aiHint}</p>}
        <div className="grid grid-cols-2 gap-3">
          {nutrientFields.map((field) => (
            <label key={field.key} className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {field.label}
                {draft.estimatedFields.includes(field.key) && <EstimatedBadge />}
              </span>
              <div className="relative">
                <Input
                  inputMode="decimal"
                  value={draft.values[field.key]}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  className={cn('h-10 pr-12 tabular-nums', draft.estimatedFields.includes(field.key) && 'border-kcal/60 bg-kcal/5')}
                  placeholder="—"
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{field.unit}</span>
              </div>
            </label>
          ))}
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Greutatea unei bucăți</span>
          <div className="relative">
            <Input inputMode="decimal" value={draft.unitWeightG} onChange={(e) => set('unitWeightG', e.target.value)} placeholder="opțional, ex. 120 pentru o banană" className="h-10 pr-10" />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">g</span>
          </div>
        </label>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Note</h2>
        {draft.insulinGrade || draft.weightLossScore ? (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5">
                Insulină <GradeBadge grade={draft.insulinGrade} />
              </span>
              <span className="flex items-center gap-1.5">
                Slăbit <ScoreBadge score={draft.weightLossScore} />
              </span>
            </div>
            {draft.scoresReason && <p className="text-sm text-muted-foreground">{draft.scoresReason}</p>}
            <div className="grid grid-cols-2 gap-3">
              <NativeSelect aria-label="Nota de insulină" value={draft.insulinGrade ?? ''} onChange={(e) => set('insulinGrade', e.target.value || null)}>
                {['A', 'B', 'C'].map((g) => (
                  <option key={g} value={g}>
                    Insulină {g}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect aria-label="Scorul pentru slăbit" value={draft.weightLossScore ?? ''} onChange={(e) => set('weightLossScore', Number(e.target.value))}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={s}>
                    Slăbit {s}/10
                  </option>
                ))}
              </NativeSelect>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Notele le dă DeepSeek. Apasă „Completează cu AI”. Dacă salvezi fără ele, le poți calcula mai târziu din fișa alimentului.
          </p>
        )}
      </section>

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={save.isPending}>
        {submitLabel}
      </Button>
    </form>
  )
}
