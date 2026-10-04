import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeftRight, Copy, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { RecipeVariant, VariantIngredient } from '@/api/types'
import { GradeBadges } from '@/components/app/badges'
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
import { useExclusions, useFoods, useFoodsById, usePantryFoodIds, useRecipe, useVariant } from '@/hooks/use-data'
import { useDesktop } from '@/hooks/use-desktop'
import { useOwnerId } from '@/hooks/use-owner'
import { kcal } from '@/lib/format'
import { alternativesFor, foodGrades, forGrams, variantGrades, variantTotals } from '@/lib/nutrition'
import { foodName } from '@/lib/food-name'

export const Route = createFileRoute('/_app/recipes/$recipeId/variants/$variantId')({
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  component: VariantPage,
})

type Draft = Pick<RecipeVariant, 'name' | 'servings' | 'ingredients'>

function VariantPage() {
  const { t } = useTranslation()
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

  if (!recipe || !initial) return <PageHeader title={t('recipes.variant.title')} back />
  return <VariantEditor key={`${variantId}-${from ?? ''}`} recipeId={recipeId} recipeName={recipe.name} variantId={isNew ? null : variantId} initial={initial} />
}

function VariantEditor({ recipeId, recipeName, variantId, initial }: { recipeId: string; recipeName: string; variantId: string | null; initial: Draft }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ownerId = useOwnerId()
  const foods = useFoodsById()
  const allFoods = useFoods()
  const exclusions = useExclusions()
  const [draft, setDraft] = useState<Draft>(initial)
  const [dirty, setDirty] = useState(variantId === null)
  const [picking, setPicking] = useState(false)
  const pantry = usePantryFoodIds()
  const [swapIndex, setSwapIndex] = useState<number | null>(null)
  const desktop = useDesktop()

  const asVariant = { ...draft, id: variantId ?? 'draft', recipeId } as RecipeVariant
  const totals = variantTotals(asVariant, foods)
  const scores = variantGrades(asVariant, foods)
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
    toast.success(t('recipes.variant.saved'))
    if (!variantId) await navigate({ to: '/recipes/$recipeId/variants/$variantId', params: { recipeId, variantId: id }, replace: true })
  }

  const swapping = swapIndex !== null ? draft.ingredients[swapIndex] : null
  const swapFood = swapping ? foods.get(swapping.foodId) : undefined
  const alternatives = swapFood && swapping ? alternativesFor(swapFood, swapping.grams, allFoods, exclusions, pantry) : []

  return (
    <>
      <PageHeader title={variantId ? draft.name || t('recipes.variant.title') : t('recipes.variant.newTitle')} subtitle={recipeName} back />
      <main className="mx-auto max-w-2xl space-y-5 px-4 pt-4 pb-28 lg:mx-0 lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6 lg:space-y-0 lg:px-8">
        <div className="space-y-5">
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="variant-name">{t('recipes.name')}</Label>
              <Input id="variant-name" value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder={suggestedName} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <span className="block text-sm font-medium">{t('recipes.variant.servings')}</span>
              <NumberStepper value={draft.servings} onChange={(v) => update({ servings: Math.max(1, Math.round(v)) })} min={1} max={50} label={t('units.servings')} className="w-32" />
            </div>
          </div>

          <section className="space-y-2 rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('recipes.variant.perServing')}</span>
              <span className="flex gap-1">
                <GradeBadges grades={scores} />
              </span>
            </div>
            <MacroLine n={totals.perServing} className="text-sm" />
            <p className="text-xs text-muted-foreground">
              {t('recipes.variant.wholeRecipe', { kcal: kcal(totals.total.kcal), grams: Math.round(totals.grams) })}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">{t('recipes.variant.ingredients')}</h2>
            <ul className="divide-y rounded-2xl border bg-card">
              {draft.ingredients.map((ingredient, index) => {
                const food = foods.get(ingredient.foodId)
                return (
                  <li key={`${ingredient.foodId}-${index}`} className="space-y-2 p-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{foodName(food) ?? t('fallback.deletedFood')}</div>
                        {food && <div className="text-xs text-muted-foreground tabular-nums">{kcal(forGrams(food, ingredient.grams).kcal)} kcal</div>}
                      </div>
                      <Button variant="ghost" size="icon-sm" aria-label={t('recipes.variant.swap')} disabled={!food} onClick={() => setSwapIndex(index)}>
                        <ArrowLeftRight className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={t('recipes.variant.remove')} onClick={() => update({ ingredients: draft.ingredients.filter((_, i) => i !== index) })}>
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
                      label={t('recipes.variant.gramsOf', { food: foodName(food) ?? '' })}
                    />
                  </li>
                )
              })}
              <li>
                <button type="button" onClick={() => setPicking(true)} className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-primary">
                  <Plus className="size-4" /> {t('recipes.addIngredient')}
                </button>
              </li>
            </ul>
          </section>
        </div>

        <div className="space-y-5 lg:sticky lg:top-[4.5rem]">
          <NutrientTable n={totals.perServing} caption={t('recipes.variant.nutrientsCaption')} />

          {variantId && (
            <div className="flex flex-col gap-1 border-t pt-4">
              <Button variant="ghost" onClick={() => void navigate({ to: '/recipes/$recipeId/variants/$variantId', params: { recipeId, variantId: 'new' }, search: { from: variantId } })}>
                <Copy className="size-4" /> {t('recipes.variant.duplicate')}
              </Button>
              <ConfirmDelete
                title={t('recipes.variant.deleteTitle')}
                description={t('recipes.variant.deleteDescription')}
                onConfirm={async () => {
                  await deleteRow('recipeVariants', variantId)
                  await navigate({ to: '/recipes/$recipeId', params: { recipeId } })
                }}
                trigger={
                  <Button variant="ghost" className="text-destructive">
                    <Trash2 className="size-4" /> {t('recipes.variant.delete')}
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </main>

      {dirty && (
        <div className="pb-safe fixed inset-x-0 bottom-16 z-30 border-t bg-background/95 backdrop-blur-md lg:bottom-0 lg:left-60">
          <div className="mx-auto max-w-2xl px-4 py-3 lg:mx-0 lg:max-w-none lg:px-8">
            <Button size="lg" className="h-12 w-full text-base" onClick={() => void save()} disabled={draft.ingredients.length === 0}>
              {t('recipes.variant.save', { kcal: kcal(totals.perServing.kcal) })}
            </Button>
          </div>
        </div>
      )}

      <ItemPicker
        open={picking}
        onOpenChange={setPicking}
        title={t('recipes.ingredient')}
        allowRecipes={false}
        confirmLabel={t('recipes.variant.addToVariant')}
        onPick={(picked) => picked.kind === 'food' && update({ ingredients: [...draft.ingredients, { foodId: picked.food.id, grams: picked.grams }] })}
      />

      <Drawer swipeDirection={desktop ? 'right' : 'down'} open={swapIndex !== null} onOpenChange={(open) => !open && setSwapIndex(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t('recipes.variant.swapTitle', { food: swapFood?.name ?? '' })}</DrawerTitle>
            <DrawerDescription>{t('recipes.variant.swapDescription')}</DrawerDescription>
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
                    {foodName(food)} <span className="text-muted-foreground">· {grams} g</span>
                  </div>
                  <MacroLine n={forGrams(food, grams)} />
                </div>
                <GradeBadges grades={foodGrades(food)} />
              </button>
            ))}
            {alternatives.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('recipes.variant.noAlternatives')}</p>}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
