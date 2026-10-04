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
import { EstimatedBadge, GlycemicBadge, WeightLossBadge } from './badges'
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
    <form onSubmit={submit} className="space-y-5 lg:grid lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-8 lg:gap-y-5 lg:space-y-0">
      <div className="space-y-5 lg:col-start-1 lg:row-start-1">
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
      </div>

      <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
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
      </div>

      <div className="space-y-5 lg:col-start-1 lg:row-start-2">
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Note</h2>
          {draft.glycemicGrade || draft.weightLossGrade ? (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5">
                  Glicemic <GlycemicBadge grade={draft.glycemicGrade} />
                </span>
                <span className="flex items-center gap-1.5">
                  Slăbit <WeightLossBadge grade={draft.weightLossGrade} />
                </span>
              </div>
              {draft.gradesReason && <p className="text-sm text-muted-foreground">{draft.gradesReason}</p>}
              <div className="grid grid-cols-2 gap-3">
                <NativeSelect aria-label="Nota pentru glicemie" value={draft.glycemicGrade ?? ''} onChange={(e) => set('glycemicGrade', e.target.value || null)}>
                  {['A', 'B', 'C'].map((g) => (
                    <option key={g} value={g}>
                      Glicemic {g}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect aria-label="Nota pentru slăbit" value={draft.weightLossGrade ?? ''} onChange={(e) => set('weightLossGrade', e.target.value || null)}>
                  {['A', 'B', 'C'].map((g) => (
                    <option key={g} value={g}>
                      Slăbit {g}
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
      </div>
    </form>
  )
}
