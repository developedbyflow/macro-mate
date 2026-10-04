import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, MoreHorizontal, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Meal, MealItem, MealPlan } from '@/api/types'
import { ConfirmDelete } from '@/components/app/confirm-delete'
import { ItemPicker } from '@/components/app/item-picker'
import { DaySummary, MacroLine } from '@/components/app/nutrients'
import { NumberStepper } from '@/components/app/number-stepper'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { deleteRow, newId, saveRow } from '@/db/mutations'
import { useFoodsById, useMealPlan, useProfile, useRecipesById, useVariantsById } from '@/hooks/use-data'
import { useOwnerId } from '@/hooks/use-owner'
import { kcal } from '@/lib/format'
import { entryName, pickedToMealItem } from '@/lib/journal'
import { mealLabel } from '@/lib/meals'
import { mealItemNutrients, planTotals } from '@/lib/nutrition'
import { targetFromProfile } from '@/lib/targets'

export const Route = createFileRoute('/_app/plans/$planId')({
  component: PlanPage,
})

function PlanPage() {
  const { t } = useTranslation()
  const { planId } = Route.useParams()
  const plan = useMealPlan(planId)
  if (!plan) return <PageHeader title={t('plans.editor.title')} back />
  if (plan.deletedAt) {
    return (
      <>
        <PageHeader title={plan.name} back />
        <p className="p-8 text-center text-sm text-muted-foreground">{t('plans.editor.deleted')}</p>
      </>
    )
  }
  return <PlanEditor plan={plan} />
}

function PlanEditor({ plan }: { plan: MealPlan }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ownerId = useOwnerId()
  const foods = useFoodsById()
  const variants = useVariantsById()
  const recipes = useRecipesById()
  const profile = useProfile()
  const [name, setName] = useState(plan.name)
  const [pickingFor, setPickingFor] = useState<string | null>(null)

  const totals = planTotals(plan, foods, variants)
  const target = targetFromProfile(profile)

  function save(next: Partial<MealPlan>) {
    return saveRow('mealPlans', { ...plan, ...next }, ownerId)
  }

  function setMeals(meals: Meal[]) {
    return save({ meals })
  }

  function updateMeal(mealId: string, change: (meal: Meal) => Meal) {
    return setMeals(plan.meals.map((m) => (m.id === mealId ? change(m) : m)))
  }

  function updateItem(mealId: string, itemId: string, change: Partial<MealItem>) {
    return updateMeal(mealId, (m) => ({ ...m, items: m.items.map((i) => (i.id === itemId ? { ...i, ...change } : i)) }))
  }

  function move(index: number, delta: number) {
    const meals = [...plan.meals]
    const [meal] = meals.splice(index, 1)
    meals.splice(index + delta, 0, meal)
    return setMeals(meals)
  }

  const recipeName = (id: string) => recipes.get(id)?.name ?? t('fallback.recipe')
  const pickingMeal = plan.meals.find((m) => m.id === pickingFor)

  return (
    <>
      <PageHeader title={plan.name} subtitle={t('plans.editor.kcalPerDay', { value: kcal(totals.total.kcal) })} back />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-8 lg:mx-0 lg:grid lg:max-w-none lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0 lg:px-8">
        <div className="space-y-4 lg:sticky lg:top-[4.5rem]">
          <Input
            aria-label={t('plans.editor.nameLabel')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== plan.name && void save({ name: name.trim() })}
            className="h-11 text-base font-semibold"
          />

          <DaySummary eaten={totals.total} target={target} />
        </div>

        <div className="space-y-4">
          {plan.meals.map((meal, index) => (
            <section key={meal.id} className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <MealLabel meal={meal} onRename={(label) => void updateMeal(meal.id, (m) => ({ ...m, label }))} />
                <span className="text-sm text-muted-foreground tabular-nums">{kcal(totals.meals[index].kcal)} kcal</span>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t('plans.editor.mealOptions', { meal: mealLabel(meal.label) })} />}>
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled={index === 0} onClick={() => void move(index, -1)}>
                      <ArrowUp className="size-4" /> {t('plans.editor.moveUp')}
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={index === plan.meals.length - 1} onClick={() => void move(index, 1)}>
                      <ArrowDown className="size-4" /> {t('plans.editor.moveDown')}
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => void setMeals(plan.meals.filter((m) => m.id !== meal.id))}>
                      <Trash2 className="size-4" /> {t('plans.editor.deleteMeal')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <ul className="divide-y">
                {meal.items.map((item) => {
                  const n = mealItemNutrients(item, foods, variants)
                  return (
                    <li key={item.id} className="space-y-2 px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{entryName(item, foods, variants, recipeName)}</div>
                          <MacroLine n={n} />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('plans.editor.removeItem')}
                          onClick={() => void updateMeal(meal.id, (m) => ({ ...m, items: m.items.filter((i) => i.id !== item.id) }))}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      {item.kind === 'food' ? (
                        <NumberStepper
                          value={item.grams ?? 100}
                          onChange={(grams) => void updateItem(meal.id, item.id, { grams })}
                          step={foods.get(item.foodId ?? '')?.unitWeightG ? Math.round(foods.get(item.foodId ?? '')!.unitWeightG! / 2) : 10}
                          min={1}
                          unit="g"
                          size="sm"
                          className="w-full"
                          label={t('plans.editor.grams')}
                        />
                      ) : (
                        <NumberStepper
                          value={item.servings ?? 1}
                          onChange={(servings) => void updateItem(meal.id, item.id, { servings })}
                          step={0.5}
                          min={0.5}
                          max={20}
                          unit={t('units.servings')}
                          size="sm"
                          className="w-full"
                          label={t('units.servings')}
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
              <button
                type="button"
                onClick={() => setPickingFor(meal.id)}
                className="flex w-full items-center gap-2 border-t px-4 py-2.5 text-sm font-medium text-primary active:bg-muted"
              >
                <Plus className="size-4" /> {t('plans.editor.addItem')}
              </button>
            </section>
          ))}

          {plan.meals.length < 5 && (
            <Button
              variant="outline"
              className="h-11 w-full border-dashed"
              onClick={() => void setMeals([...plan.meals, { id: newId(), label: t('plans.editor.newMealName', { number: plan.meals.length + 1 }), items: [] }])}
            >
              <Plus className="size-4" /> {t('plans.editor.addMeal', { current: plan.meals.length })}
            </Button>
          )}

          <ConfirmDelete
            title={t('plans.editor.deleteTitle', { name: plan.name })}
            description={t('plans.editor.deleteDescription')}
            onConfirm={async () => {
              await deleteRow('mealPlans', plan.id)
              await navigate({ to: '/plans' })
            }}
            trigger={
              <Button variant="ghost" className="w-full text-destructive">
                <Trash2 className="size-4" /> {t('plans.editor.deletePlan')}
              </Button>
            }
          />
        </div>
      </main>

      <ItemPicker
        open={pickingFor !== null}
        onOpenChange={(open) => !open && setPickingFor(null)}
        title={t('plans.editor.addTo', { meal: mealLabel(pickingMeal?.label ?? '') })}
        confirmLabel={t('plans.editor.putInMeal')}
        onPick={(picked) => pickingFor && void updateMeal(pickingFor, (m) => ({ ...m, items: [...m.items, pickedToMealItem(picked)] }))}
      />
    </>
  )
}

function MealLabel({ meal, onRename }: { meal: Meal; onRename: (label: string) => void }) {
  const { t } = useTranslation()
  const [value, setValue] = useState(meal.label)
  return (
    <input
      aria-label={t('plans.editor.mealNameLabel')}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value.trim() && value !== meal.label && onRename(value.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 font-semibold outline-none focus:bg-muted"
    />
  )
}
