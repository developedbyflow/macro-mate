import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeftRight, Copy, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { RecipeVariant, VariantIngredient } from '@/api/types'
import { GlycemicBadge, WeightLossBadge } from '@/components/app/badges'
import { ConfirmDelete } from '@/components/app/confirm-delete'
import { ItemPicker } from '@/components/app/item-picker'
import { MacroLine, NutrientTable } from '@/components/app/nutrients'
import { NumberStepper } from '@/components/app/number-stepper'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteRow, newId, saveRow } from '@/db/mutations'
import { useExclusions, useFoods, useFoodsById, useRecipe, useVariant } from '@/hooks/use-data'
import { useDesktop } from '@/hooks/use-desktop'
import { useOwnerId } from '@/hooks/use-owner'
import { kcal } from '@/lib/format'
import { alternativesFor, forGrams, variantScores, variantTotals } from '@/lib/nutrition'

export const Route = createFileRoute('/_app/recipes/$recipeId/variants/$variantId')({
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  component: VariantPage,
})

type Draft = Pick<RecipeVariant, 'name' | 'servings' | 'ingredients'>

function VariantPage() {
  const { recipeId, variantId } = Route.useParams()
  const { from } = Route.useSearch()
  const isNew = variantId === 'new'
  const recipe = useRecipe(recipeId)
  const existing = useVariant(isNew ? (from ?? '') : variantId)
  const foods = useFoodsById()

  const initial = useMemo<Draft | null>(() => {
    if (!recipe || foods.size === 0) return null
    if (isNew && !from) return { name: '', servings: 1, ingredients: recipe.ingredientFoodIds.map((foodId) => ({ foodId, grams: foods.get(foodId)?.unitWeightG ?? 100 })) }
    if (!existing) return null
    return { name: isNew ? '' : existing.name, servings: existing.servings, ingredients: existing.ingredients.map((i) => ({ ...i })) }
  }, [recipe, existing, isNew, from, foods])

  if (!recipe || !initial) return <PageHeader title="Variantă" back />
  return <VariantEditor key={`${variantId}-${from ?? ''}`} recipeId={recipeId} recipeName={recipe.name} variantId={isNew ? null : variantId} initial={initial} />
}

function VariantEditor({ recipeId, recipeName, variantId, initial }: { recipeId: string; recipeName: string; variantId: string | null; initial: Draft }) {
  const navigate = useNavigate()
  const ownerId = useOwnerId()
  const foods = useFoodsById()
  const allFoods = useFoods()
  const exclusions = useExclusions()
  const [draft, setDraft] = useState<Draft>(initial)
  const [dirty, setDirty] = useState(variantId === null)
  const [picking, setPicking] = useState(false)
  const [swapIndex, setSwapIndex] = useState<number | null>(null)
  const desktop = useDesktop()

  const asVariant = { ...draft, id: variantId ?? 'draft', recipeId } as RecipeVariant
  const totals = variantTotals(asVariant, foods)
  const scores = variantScores(asVariant, foods)
  const suggestedName = `${Math.round(totals.perServing.kcal / 10) * 10} kcal`

  function update(next: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...next }))
    setDirty(true)
  }

  function setIngredient(index: number, ingredient: VariantIngredient) {
    update({ ingredients: draft.ingredients.map((x, i) => (i === index ? ingredient : x)) })
  }

  async function save() {
    const id = variantId ?? newId()
    await saveRow('recipeVariants', { id, recipeId, name: draft.name.trim() || suggestedName, servings: draft.servings, ingredients: draft.ingredients }, ownerId)
    setDirty(false)
    toast.success('Varianta e salvată.')
    if (!variantId) await navigate({ to: '/recipes/$recipeId/variants/$variantId', params: { recipeId, variantId: id }, replace: true })
  }

  const swapping = swapIndex !== null ? draft.ingredients[swapIndex] : null
  const swapFood = swapping ? foods.get(swapping.foodId) : undefined
  const alternatives = swapFood && swapping ? alternativesFor(swapFood, swapping.grams, allFoods, exclusions) : []

  return (
    <>
      <PageHeader title={variantId ? draft.name || 'Variantă' : 'Variantă nouă'} subtitle={recipeName} back />
      <main className="mx-auto max-w-2xl space-y-5 px-4 pt-4 pb-28 lg:mx-0 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6 lg:space-y-0 lg:px-8">
        <div className="space-y-5">
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="variant-name">Nume</Label>
              <Input id="variant-name" value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder={suggestedName} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <span className="block text-sm font-medium">Porții</span>
              <NumberStepper value={draft.servings} onChange={(v) => update({ servings: Math.max(1, Math.round(v)) })} min={1} max={50} label="porții" className="w-32" />
            </div>
          </div>

          <section className="space-y-2 rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Pe o porție</span>
              <span className="flex gap-1">
                <GlycemicBadge grade={scores.glycemicGrade} />
                <WeightLossBadge grade={scores.weightLossGrade} />
              </span>
            </div>
            <MacroLine n={totals.perServing} className="text-sm" />
            <p className="text-xs text-muted-foreground">
              Toată rețeta: {kcal(totals.total.kcal)} kcal · {Math.round(totals.grams)} g
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Ingrediente (pentru toată rețeta)</h2>
            <ul className="divide-y rounded-2xl border bg-card">
              {draft.ingredients.map((ingredient, index) => {
                const food = foods.get(ingredient.foodId)
                return (
                  <li key={`${ingredient.foodId}-${index}`} className="space-y-2 p-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{food?.name ?? 'Aliment șters'}</div>
                        {food && <div className="text-xs text-muted-foreground tabular-nums">{kcal(forGrams(food, ingredient.grams).kcal)} kcal</div>}
                      </div>
                      <Button variant="ghost" size="icon-sm" aria-label="Schimbă cu un aliment similar" disabled={!food} onClick={() => setSwapIndex(index)}>
                        <ArrowLeftRight className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Scoate" onClick={() => update({ ingredients: draft.ingredients.filter((_, i) => i !== index) })}>
                        <X className="size-4" />
                      </Button>
                    </div>
                    <NumberStepper
                      value={ingredient.grams}
                      onChange={(grams) => setIngredient(index, { ...ingredient, grams })}
                      step={food?.unitWeightG ? Math.round(food.unitWeightG / 2) : 10}
                      min={1}
                      unit="g"
                      size="sm"
                      className="w-full"
                      label={`grame ${food?.name ?? ''}`}
                    />
                  </li>
                )
              })}
              <li>
                <button type="button" onClick={() => setPicking(true)} className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-primary">
                  <Plus className="size-4" /> Adaugă ingredient
                </button>
              </li>
            </ul>
          </section>
        </div>

        <div className="space-y-5 lg:sticky lg:top-[4.5rem]">
          <NutrientTable n={totals.perServing} caption="Valori pe o porție" />

          {variantId && (
            <div className="flex flex-col gap-1 border-t pt-4">
              <Button variant="ghost" onClick={() => void navigate({ to: '/recipes/$recipeId/variants/$variantId', params: { recipeId, variantId: 'new' }, search: { from: variantId } })}>
                <Copy className="size-4" /> Fă o variantă nouă pornind de aici
              </Button>
              <ConfirmDelete
                title="Ștergi varianta?"
                description="Planurile care o folosesc o vor pierde."
                onConfirm={async () => {
                  await deleteRow('recipeVariants', variantId)
                  await navigate({ to: '/recipes/$recipeId', params: { recipeId } })
                }}
                trigger={
                  <Button variant="ghost" className="text-destructive">
                    <Trash2 className="size-4" /> Șterge varianta
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </main>

      {dirty && (
        <div className="pb-safe fixed inset-x-0 bottom-16 z-30 border-t bg-background/95 backdrop-blur-md lg:bottom-0 lg:left-60">
          <div className="mx-auto max-w-2xl px-4 py-3 lg:mx-0 lg:max-w-5xl lg:px-8">
            <Button size="lg" className="h-12 w-full text-base" onClick={() => void save()} disabled={draft.ingredients.length === 0}>
              Salvează varianta · {kcal(totals.perServing.kcal)} kcal / porție
            </Button>
          </div>
        </div>
      )}

      <ItemPicker
        open={picking}
        onOpenChange={setPicking}
        title="Ingredient"
        allowRecipes={false}
        confirmLabel="Pune în variantă"
        onPick={(picked) => picked.kind === 'food' && update({ ingredients: [...draft.ingredients, { foodId: picked.food.id, grams: picked.grams }] })}
      />

      <Drawer swipeDirection={desktop ? 'right' : 'down'} open={swapIndex !== null} onOpenChange={(open) => !open && setSwapIndex(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>În loc de {swapFood?.name}</DrawerTitle>
            <DrawerDescription>Din aceeași categorie, cu gramajul ajustat ca să rămână aceleași calorii.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-2 p-4">
            {alternatives.map(({ food, grams }) => (
              <button
                key={food.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left active:bg-muted"
                onClick={() => {
                  if (swapIndex !== null) setIngredient(swapIndex, { foodId: food.id, grams })
                  setSwapIndex(null)
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {food.name} <span className="text-muted-foreground">· {grams} g</span>
                  </div>
                  <MacroLine n={forGrams(food, grams)} />
                </div>
                <GlycemicBadge grade={food.glycemicGrade} />
                <WeightLossBadge grade={food.weightLossGrade} />
              </button>
            ))}
            {alternatives.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nu am găsit alimente similare în aceeași categorie.</p>}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
