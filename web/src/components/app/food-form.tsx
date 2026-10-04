import { useMutation } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAiStatus } from '@/hooks/use-ai-status'
import { draftValues, enrichDraft, nutrientFields, type FoodDraft, type NutrientKey } from '@/lib/food-draft'
import { categoryCodes, categoryLabel } from '@/lib/categories'
import { proteinGrade, volumeGrade } from '@/lib/nutrition'
import { cn } from '@/lib/utils'
import { EstimatedBadge, GlycemicBadge, ProteinBadge, VolumeBadge } from './badges'
import { NativeSelect } from './native-select'
import { PhotoInput } from './photo'
import { primaryNameField } from '@/lib/food-name'

type Props = {
  initial: FoodDraft
  submitLabel: string
  onSubmit: (draft: FoodDraft) => Promise<void>
}

export function FoodForm({ initial, submitLabel, onSubmit }: Props) {
  const { t } = useTranslation()
  const primary = primaryNameField()
  const secondary = primary === 'name' ? 'nameEn' : 'name'
  const [draft, setDraft] = useState(initial)
  const [errors, setErrors] = useState<string[]>([])
  const ai = useAiStatus()

  const enrich = useMutation({
    mutationFn: () => enrichDraft(draft),
    onSuccess: (next) => {
      setDraft(next)
      toast.success(t('foods.form.aiFilled'))
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t('foods.form.aiUnreachable')),
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
    if (!draft.name.trim() && !draft.nameEn.trim()) problems.push(t('foods.form.nameRequired'))
    if (!draft.category) problems.push(t('foods.form.categoryRequired'))
    const values = draftValues(draft)
    if (nutrientFields.some((f) => values[f.key] == null)) problems.push(t('foods.form.valuesRequired'))
    setErrors(problems)
    if (problems.length === 0) save.mutate()
  }

  const missingCount = nutrientFields.filter((f) => !draft.values[f.key].trim()).length
  const values = draftValues(draft)
  const computed =
    values.kcal != null && values.proteinG != null
      ? (() => {
          const n = { kcal: values.kcal, proteinG: values.proteinG, carbsG: 0, fatG: 0, fiberG: 0, sodiumMg: 0 }
          return { protein: proteinGrade(n), volume: volumeGrade(n) }
        })()
      : null
  const aiHint = !ai.online ? t('foods.form.aiNeedsInternet') : !ai.configured ? t('foods.aiKeyMissing') : null

  return (
    <form onSubmit={submit} className="space-y-5 lg:grid lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-8 lg:gap-y-5 lg:space-y-0">
      <div className="space-y-5 lg:col-start-1 lg:row-start-1">
        <PhotoInput value={draft.photoId} onChange={(id) => set('photoId', id)} label={t('foods.form.photo')} />

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t('foods.form.name')}</Label>
              <Input id="name" value={draft[primary]} onChange={(e) => set(primary, e.target.value)} placeholder={t('foods.form.namePlaceholder')} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name-other">{t('foods.form.nameOther')}</Label>
              <Input id="name-other" value={draft[secondary]} onChange={(e) => set(secondary, e.target.value)} placeholder={t('foods.form.nameOtherPlaceholder')} className="h-10" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="brand">{t('foods.form.brand')}</Label>
              <Input id="brand" value={draft.brand} onChange={(e) => set('brand', e.target.value)} placeholder={t('foods.form.optional')} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">{t('foods.form.category')}</Label>
              <NativeSelect id="category" value={draft.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">{t('foods.form.choose')}</option>
                {categoryCodes.map((code) => (
                  <option key={code} value={code}>
                    {categoryLabel(code)}
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
              <h2 className="font-semibold">{t('foods.form.valuesPer100')}</h2>
              {draft.barcode && <p className="text-xs text-muted-foreground">{t('foods.form.barcode', { code: draft.barcode })}</p>}
            </div>
            <Button type="button" variant="secondary" size="sm" disabled={!!aiHint || enrich.isPending} onClick={() => enrich.mutate()}>
              <Sparkles className="size-4" />
              {enrich.isPending ? t('foods.form.thinking') : missingCount > 0 ? t('foods.form.aiFill') : t('foods.form.recalculateGrades')}
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
            <span className="text-sm font-medium">{t('foods.form.unitWeight')}</span>
            <div className="relative">
              <Input inputMode="decimal" value={draft.unitWeightG} onChange={(e) => set('unitWeightG', e.target.value)} placeholder={t('foods.form.unitWeightPlaceholder')} className="h-10 pr-10" />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">g</span>
            </div>
          </label>
        </section>
      </div>

      <div className="space-y-5 lg:col-start-1 lg:row-start-2">
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="font-semibold">{t('foods.form.grades')}</h2>
          {computed && (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5">
                  {t('grades.protein.label')} <ProteinBadge grade={computed.protein} />
                </span>
                <span className="flex items-center gap-1.5">
                  {t('grades.volume.label')} <VolumeBadge grade={computed.volume} />
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{t('foods.form.computedFromValues')}</p>
            </div>
          )}
          {draft.glycemicGrade ? (
            <>
              <div className="flex items-center gap-1.5 text-sm">
                {t('foods.glycemic')} <GlycemicBadge grade={draft.glycemicGrade} />
              </div>
              {draft.gradesReason && <p className="text-sm text-muted-foreground">{draft.gradesReason}</p>}
              <NativeSelect aria-label={t('foods.form.glycemicGrade')} value={draft.glycemicGrade} onChange={(e) => set('glycemicGrade', e.target.value || null)}>
                {['A', 'B', 'C'].map((g) => (
                  <option key={g} value={g}>
                    {t('foods.glycemic')} {g}
                  </option>
                ))}
              </NativeSelect>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('foods.form.glycemicHint')}
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
