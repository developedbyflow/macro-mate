import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api, ApiError } from '@/api/client'
import type { RecipeDraft, RecipeVariant } from '@/api/types'
import { GradeBadge, ScoreBadge } from '@/components/app/badges'
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
import { entryNutrients } from '@/lib/journal'
import { forGrams, sum, variantScores, variantTotals } from '@/lib/nutrition'

export const Route = createFileRoute('/_app/recipes/generate')({
  component: GeneratePage,
})

const ideas = ['Am poftă de un desert cu mere', 'Ceva sățios cu pui, sub 500 kcal', 'Mic dejun cu ouă, rapid', 'O supă cu legume pentru 4 porții']

function GeneratePage() {
  const navigate = useNavigate()
  const ownerId = useOwnerId()
  const ai = useAiStatus()
  const foods = useFoodsById()
  const profile = useProfile()
  const journal = useJournal(today())

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
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'DeepSeek nu a răspuns.'),
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
    toast.success('Rețeta e salvată, cu prima variantă.')
    await navigate({ to: '/recipes/$recipeId', params: { recipeId } })
  }

  const blocked = !ai.online ? 'Ai nevoie de internet pentru generare.' : !ai.configured ? 'Cheia DeepSeek nu e setată pe server.' : null
  const draft = generate.data

  return (
    <>
      <PageHeader title="Generează rețetă" back />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-8">
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ce ai poftă să mănânci?" className="min-h-24 text-base" maxLength={500} />
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
            <span className="flex-1">Limită pe porție</span>
            {limitOn && <NumberStepper value={maxKcal} onChange={setMaxKcal} step={50} min={50} max={2000} unit="kcal" size="sm" className="w-36" label="kcal pe porție" />}
          </label>
          {!limitOn && (
            <label className="flex items-center gap-3">
              <Checkbox checked={useRemaining} onCheckedChange={(v) => setUseRemaining(v === true)} disabled={!remaining} />
              <span className="flex-1">
                Să încapă în ce mai am azi
                {remaining ? <span className="block text-xs text-muted-foreground">mai ai {Math.round(remaining.kcal)} kcal</span> : <span className="block text-xs text-muted-foreground">setează-ți întâi țintele în profil</span>}
              </span>
            </label>
          )}
          <p className="text-xs text-muted-foreground">Folosește doar alimente din bază, fără cele excluse de tine. Cele marcate „îmi place” au prioritate.</p>
        </div>

        {blocked && <p className="text-sm text-destructive">{blocked}</p>}

        <Button size="lg" className="h-12 w-full text-base" disabled={!prompt.trim() || !!blocked || generate.isPending} onClick={() => generate.mutate()}>
          {generate.isPending ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
          {generate.isPending ? 'DeepSeek gătește…' : 'Generează'}
        </Button>

        {draft && <DraftPreview draft={draft} onSave={() => void saveDraft(draft)} onRetry={() => generate.mutate()} retrying={generate.isPending} />}
      </main>
    </>
  )
}

function DraftPreview({ draft, onSave, onRetry, retrying }: { draft: RecipeDraft; onSave: () => void; onRetry: () => void; retrying: boolean }) {
  const foods = useFoodsById()
  const variant = { id: 'draft', recipeId: 'draft', name: '', servings: draft.servings, ingredients: draft.ingredients } as unknown as RecipeVariant
  const totals = variantTotals(variant, foods)
  const scores = variantScores(variant, foods)
  const steps = draft.instructions.split('\n').map((s) => s.trim()).filter(Boolean)

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4">
      <div>
        <h2 className="text-lg font-semibold">{draft.name}</h2>
        <p className="text-xs text-muted-foreground">
          {draft.prepTimeMin} min · {difficultyLabel(draft.difficulty)} · {draft.servings} {draft.servings === 1 ? 'porție' : 'porții'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <MacroLine n={totals.perServing} className="flex-1 text-sm" />
        <GradeBadge grade={scores.insulinGrade} />
        <ScoreBadge score={scores.weightLossScore} />
      </div>
      <p className="text-xs text-muted-foreground">Valorile sunt calculate de aplicație din alimentele din bază, pe o porție.</p>

      <ul className="divide-y rounded-xl border">
        {draft.ingredients.map((i) => {
          const food = foods.get(i.foodId)
          return (
            <li key={i.foodId} className="flex justify-between px-3 py-2 text-sm">
              <span>{food?.name ?? 'Aliment necunoscut'}</span>
              <span className="text-muted-foreground tabular-nums">
                {Math.round(i.grams)} g{food ? ` · ${Math.round(forGrams(food, i.grams).kcal)} kcal` : ''}
              </span>
            </li>
          )
        })}
      </ul>

      {draft.missing.length > 0 && (
        <div className="rounded-xl bg-kcal/10 p-3 text-sm">
          <div className="font-medium">Lipsesc din bază</div>
          <ul className="mt-1 text-muted-foreground">
            {draft.missing.map((m) => (
              <li key={m.name}>
                {m.name} · {Math.round(m.grams)} g
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">Adaugă-le în Alimente, apoi pune-le în variantă. Până atunci nu intră în calcul.</p>
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
          <RefreshCw className="size-4" /> Altă idee
        </Button>
        <Button className="h-11 flex-[2]" onClick={onSave}>
          Salvează rețeta
        </Button>
      </div>
    </section>
  )
}
