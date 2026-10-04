import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api, ApiError } from '@/api/client'
import type { RecipeDraft, RecipeVariant } from '@/api/types'
import { GradeBadges } from '@/components/app/badges'
import { useAiStatus } from '@/hooks/use-ai-status'
import { MacroLine } from '@/components/app/nutrients'
import { NumberStepper } from '@/components/app/number-stepper'
import { PageHeader } from '@/components/app/page-header'
import { difficultyLabel } from '@/lib/recipes'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { newId, saveRow } from '@/db/mutations'
import { useFoodsById, useJournal, useProfile } from '@/hooks/use-data'
import { useOwnerId } from '@/hooks/use-owner'
import { today } from '@/lib/dates'
import { kcal, servings } from '@/lib/format'
import { entryNutrients } from '@/lib/journal'
import { forGrams, sum, variantGrades, variantTotals } from '@/lib/nutrition'
import { foodName } from '@/lib/food-name'

export const Route = createFileRoute('/_app/recipes/generate')({
  component: GeneratePage,
})

function GeneratePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ownerId = useOwnerId()
  const ai = useAiStatus()
  const foods = useFoodsById()
  const profile = useProfile()
  const journal = useJournal(today())

  const ideas = [t('recipes.generate.ideas.appleDessert'), t('recipes.generate.ideas.chicken'), t('recipes.generate.ideas.eggs'), t('recipes.generate.ideas.soup')]
  const [prompt, setPrompt] = useState('')
  const [useRemaining, setUseRemaining] = useState(true)
  const [limitOn, setLimitOn] = useState(false)
  const [maxKcal, setMaxKcal] = useState(400)

  const remaining = useMemo(() => {
    if (!profile?.targetKcal) return null
    const eaten = sum(journal.map(entryNutrients))
    return {
      kcal: Math.max(0, profile.targetKcal - eaten.kcal),
      proteinG: Math.max(0, (profile.targetProteinG ?? 0) - eaten.proteinG),
      carbsG: Math.max(0, (profile.targetCarbsG ?? 0) - eaten.carbsG),
      fatG: Math.max(0, (profile.targetFatG ?? 0) - eaten.fatG),
    }
  }, [profile, journal])

  const generate = useMutation({
    mutationFn: () =>
      api.generateRecipe({
        prompt,
        maxKcalPerServing: limitOn ? maxKcal : null,
        remaining: !limitOn && useRemaining && remaining ? remaining : null,
      }),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t('recipes.generate.aiFailed')),
  })

  async function saveDraft(draft: RecipeDraft) {
    const recipeId = newId()
    await saveRow(
      'recipes',
      {
        id: recipeId,
        name: draft.name,
        instructions: draft.instructions,
        prepTimeMin: draft.prepTimeMin,
        difficulty: draft.difficulty,
        photoId: null,
        ingredientFoodIds: draft.ingredients.map((i) => i.foodId),
      },
      ownerId,
    )
    const variant = { recipeId, servings: draft.servings, ingredients: draft.ingredients.map((i) => ({ foodId: i.foodId, grams: i.grams })) }
    const perServing = variantTotals(variant as RecipeVariant, foods).perServing.kcal
    await saveRow('recipeVariants', { id: newId(), name: `${Math.round(perServing / 10) * 10} kcal`, ...variant }, ownerId)
    toast.success(t('recipes.generate.saved'))
    await navigate({ to: '/recipes/$recipeId', params: { recipeId } })
  }

  const blocked = !ai.online ? t('recipes.generate.offline') : !ai.configured ? t('recipes.generate.notConfigured') : null
  const draft = generate.data

  return (
    <>
      <PageHeader title={t('recipes.generate.title')} back />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-8 lg:mx-0 lg:grid lg:max-w-none lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0 lg:px-8">
        <div className="space-y-4">
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('recipes.generate.prompt')} className="min-h-24 text-base" maxLength={500} />
          {!prompt && (
            <div className="flex flex-wrap gap-1.5">
              {ideas.map((idea) => (
                <button key={idea} type="button" className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground" onClick={() => setPrompt(idea)}>
                  {idea}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-3 rounded-2xl border bg-card p-4 text-sm">
            <label className="flex items-center gap-3">
              <Checkbox checked={limitOn} onCheckedChange={(v) => setLimitOn(v === true)} />
              <span className="flex-1">{t('recipes.generate.limitPerServing')}</span>
              {limitOn && <NumberStepper value={maxKcal} onChange={setMaxKcal} step={50} min={50} max={2000} unit="kcal" size="sm" className="w-36" label={t('recipes.generate.kcalPerServing')} />}
            </label>
            {!limitOn && (
              <label className="flex items-center gap-3">
                <Checkbox checked={useRemaining} onCheckedChange={(v) => setUseRemaining(v === true)} disabled={!remaining} />
                <span className="flex-1">
                  {t('recipes.generate.fitRemaining')}
                  {remaining ? <span className="block text-xs text-muted-foreground">{t('nutrients.left', { value: kcal(remaining.kcal), unit: 'kcal' })}</span> : <span className="block text-xs text-muted-foreground">{t('recipes.generate.setTargetsFirst')}</span>}
                </span>
              </label>
            )}
            <p className="text-xs text-muted-foreground">{t('recipes.generate.foodsNote')}</p>
          </div>

          {blocked && <p className="text-sm text-destructive">{blocked}</p>}

          <Button size="lg" className="h-12 w-full text-base" disabled={!prompt.trim() || !!blocked || generate.isPending} onClick={() => generate.mutate()}>
            {generate.isPending ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
            {generate.isPending ? t('recipes.generate.cooking') : t('recipes.generate.submit')}
          </Button>
        </div>

        <div className="space-y-4">
          {draft ? (
            <DraftPreview draft={draft} onSave={() => void saveDraft(draft)} onRetry={() => generate.mutate()} retrying={generate.isPending} />
          ) : (
            <p className="hidden rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground lg:block">{t('recipes.generate.placeholder')}</p>
          )}
        </div>
      </main>
    </>
  )
}

function DraftPreview({ draft, onSave, onRetry, retrying }: { draft: RecipeDraft; onSave: () => void; onRetry: () => void; retrying: boolean }) {
  const { t } = useTranslation()
  const foods = useFoodsById()
  const variant = { id: 'draft', recipeId: 'draft', name: '', servings: draft.servings, ingredients: draft.ingredients } as unknown as RecipeVariant
  const totals = variantTotals(variant, foods)
  const scores = variantGrades(variant, foods)
  const steps = draft.instructions.split('\n').map((s) => s.trim()).filter(Boolean)

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4">
      <div>
        <h2 className="text-lg font-semibold">{draft.name}</h2>
        <p className="text-xs text-muted-foreground">
          {t('recipes.prepTime', { value: draft.prepTimeMin })} · {difficultyLabel(draft.difficulty)} · {servings(draft.servings)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <MacroLine n={totals.perServing} className="flex-1 text-sm" />
        <GradeBadges grades={scores} />
      </div>
      <p className="text-xs text-muted-foreground">{t('recipes.generate.valuesNote')}</p>

      <ul className="divide-y rounded-xl border">
        {draft.ingredients.map((i) => {
          const food = foods.get(i.foodId)
          return (
            <li key={i.foodId} className="flex justify-between px-3 py-2 text-sm">
              <span>{foodName(food) ?? t('recipes.generate.unknownFood')}</span>
              <span className="text-muted-foreground tabular-nums">
                {Math.round(i.grams)} g{food ? ` · ${Math.round(forGrams(food, i.grams).kcal)} kcal` : ''}
              </span>
            </li>
          )
        })}
      </ul>

      {draft.missing.length > 0 && (
        <div className="rounded-xl bg-kcal/10 p-3 text-sm">
          <div className="font-medium">{t('recipes.generate.missing')}</div>
          <ul className="mt-1 text-muted-foreground">
            {draft.missing.map((m) => (
              <li key={m.name}>
                {m.name} · {Math.round(m.grams)} g
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">{t('recipes.generate.missingHint')}</p>
        </div>
      )}

      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-3 text-sm leading-relaxed">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{index + 1}</span>
            <span className="pt-0.5">{step.replace(/^\d+[.)]\s*/, '')}</span>
          </li>
        ))}
      </ol>

      <div className="flex gap-2">
        <Button variant="outline" className="h-11 flex-1" onClick={onRetry} disabled={retrying}>
          <RefreshCw className="size-4" /> {t('recipes.generate.retry')}
        </Button>
        <Button className="h-11 flex-[2]" onClick={onSave}>
          {t('recipes.saveRecipe')}
        </Button>
      </div>
    </section>
  )
}
