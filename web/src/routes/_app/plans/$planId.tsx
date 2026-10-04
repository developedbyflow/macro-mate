import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, MoreHorizontal, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
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
import { mealItemNutrients, planTotals } from '@/lib/nutrition'

export const Route = createFileRoute('/_app/plans/$planId')({
  component: PlanPage,
})

function PlanPage() {
  const { planId } = Route.useParams()
  const plan = useMealPlan(planId)
  if (!plan) return <PageHeader title="Plan" back />
  if (plan.deletedAt) {
    return (
      <>
        <PageHeader title={plan.name} back />
        <p className="p-8 text-center text-sm text-muted-foreground">Planul a fost șters.</p>
      </>
    )
  }
  return <PlanEditor plan={plan} />
}

function PlanEditor({ plan }: { plan: MealPlan }) {
  const navigate = useNavigate()
  const ownerId = useOwnerId()
  const foods = useFoodsById()
  const variants = useVariantsById()
  const recipes = useRecipesById()
  const profile = useProfile()
  const [name, setName] = useState(plan.name)
  const [pickingFor, setPickingFor] = useState<string | null>(null)

  const totals = planTotals(plan, foods, variants)
  const target = profile?.targetKcal
    ? {
        kcal: profile.targetKcal,
        proteinG: profile.targetProteinG ?? undefined,
        carbsG: profile.targetCarbsG ?? undefined,
        fatG: profile.targetFatG ?? undefined,
        fiberG: profile.targetFiberG ?? undefined,
        sodiumMg: profile.targetSodiumMg ?? undefined,
      }
    : null

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

  const recipeName = (id: string) => recipes.get(id)?.name ?? 'Rețetă'
  const pickingMeal = plan.meals.find((m) => m.id === pickingFor)

  return (
    <>
      <PageHeader title={plan.name} subtitle={`${kcal(totals.total.kcal)} kcal pe zi`} back />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-8 lg:mx-0 lg:grid lg:max-w-5xl lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0 lg:px-8">
        <div className="space-y-4 lg:sticky lg:top-[4.5rem]">
          <Input
            aria-label="Numele planului"
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
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Opțiuni ${meal.label}`} />}>
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled={index === 0} onClick={() => void move(index, -1)}>
                      <ArrowUp className="size-4" /> Mută mai sus
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={index === plan.meals.length - 1} onClick={() => void move(index, 1)}>
                      <ArrowDown className="size-4" /> Mută mai jos
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => void setMeals(plan.meals.filter((m) => m.id !== meal.id))}>
                      <Trash2 className="size-4" /> Șterge masa
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
                          aria-label="Scoate"
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
                          label="grame"
                        />
                      ) : (
                        <NumberStepper
                          value={item.servings ?? 1}
                          onChange={(servings) => void updateItem(meal.id, item.id, { servings })}
                          step={0.5}
                          min={0.5}
                          max={20}
                          unit="porții"
                          size="sm"
                          className="w-full"
                          label="porții"
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
                <Plus className="size-4" /> Adaugă rețetă sau aliment
              </button>
            </section>
          ))}

          {plan.meals.length < 5 && (
            <Button
              variant="outline"
              className="h-11 w-full border-dashed"
              onClick={() => void setMeals([...plan.meals, { id: newId(), label: `Masa ${plan.meals.length + 1}`, items: [] }])}
            >
              <Plus className="size-4" /> Adaugă masă ({plan.meals.length}/5)
            </Button>
          )}

          <ConfirmDelete
            title={`Ștergi ${plan.name}?`}
            description="Dispare pentru toți. Jurnalul păstrează ce ai notat deja."
            onConfirm={async () => {
              await deleteRow('mealPlans', plan.id)
              await navigate({ to: '/plans' })
            }}
            trigger={
              <Button variant="ghost" className="w-full text-destructive">
                <Trash2 className="size-4" /> Șterge planul
              </Button>
            }
          />
        </div>
      </main>

      <ItemPicker
        open={pickingFor !== null}
        onOpenChange={(open) => !open && setPickingFor(null)}
        title={`Adaugă la ${pickingMeal?.label ?? ''}`}
        confirmLabel="Pune în masă"
        onPick={(picked) => pickingFor && void updateMeal(pickingFor, (m) => ({ ...m, items: [...m.items, pickedToMealItem(picked)] }))}
      />
    </>
  )
}

function MealLabel({ meal, onRename }: { meal: Meal; onRename: (label: string) => void }) {
  const [value, setValue] = useState(meal.label)
  return (
    <input
      aria-label="Eticheta mesei"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value.trim() && value !== meal.label && onRename(value.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 font-semibold outline-none focus:bg-muted"
    />
  )
}
