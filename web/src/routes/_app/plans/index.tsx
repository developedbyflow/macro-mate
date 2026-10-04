import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { CalendarRange, ChevronRight, Copy, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { MealPlan } from '@/api/types'
import { MacroLine } from '@/components/app/nutrients'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { newId, saveRow } from '@/db/mutations'
import { useFoodsById, useMealPlans, useUsersById, useVariantsById } from '@/hooks/use-data'
import { useOwnerId } from '@/hooks/use-owner'
import { planTotals } from '@/lib/nutrition'

export const Route = createFileRoute('/_app/plans/')({
  component: PlansPage,
})

const defaultMealLabels = ['Mic dejun', 'Prânz', 'Cină']

function PlansPage() {
  const navigate = useNavigate()
  const ownerId = useOwnerId()
  const plans = useMealPlans()
  const foods = useFoodsById()
  const variants = useVariantsById()
  const users = useUsersById()

  async function create() {
    const id = newId()
    await saveRow(
      'mealPlans',
      { id, name: `Plan ${String.fromCharCode(65 + (plans.length % 26))}`, meals: defaultMealLabels.map((label) => ({ id: newId(), label, items: [] })) },
      ownerId,
    )
    await navigate({ to: '/plans/$planId', params: { planId: id } })
  }

  async function duplicate(plan: MealPlan) {
    const id = newId()
    await saveRow(
      'mealPlans',
      {
        id,
        name: `${plan.name} (copie)`,
        meals: plan.meals.map((m) => ({ ...m, id: newId(), items: m.items.map((i) => ({ ...i, id: newId() })) })),
      },
      ownerId,
    )
    toast.success('Am făcut o copie.')
  }

  return (
    <>
      <PageHeader
        title="Meal plan-uri"
        actions={
          <Button size="sm" onClick={() => void create()}>
            <Plus className="size-4" /> Plan nou
          </Button>
        }
      />
      <main className="mx-auto max-w-2xl space-y-2 px-4 pt-4 lg:mx-0 lg:grid lg:max-w-6xl lg:grid-cols-2 lg:gap-3 lg:space-y-0 lg:px-8 lg:pb-8 xl:grid-cols-3">
        {plans.map((plan) => {
          const { total } = planTotals(plan, foods, variants)
          return (
            <div key={plan.id} className="flex items-center gap-2 rounded-2xl border bg-card p-1 pr-2">
              <Link to="/plans/$planId" params={{ planId: plan.id }} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted active:bg-muted">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <CalendarRange className="size-5" />
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="truncate font-semibold">{plan.name}</div>
                  <MacroLine n={total} />
                  <div className="text-xs text-muted-foreground">
                    {plan.meals.length} {plan.meals.length === 1 ? 'masă' : 'mese'} · de {users.get(plan.createdBy) ?? '—'}
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
              <Button variant="ghost" size="icon" aria-label={`Copiază ${plan.name}`} onClick={() => void duplicate(plan)}>
                <Copy className="size-4" />
              </Button>
            </div>
          )
        })}
        {plans.length === 0 && (
          <div className="col-span-full px-6 py-16 text-center text-sm text-muted-foreground">
            Un meal plan e o zi: 1–5 mese, fiecare cu rețete și alimente. Fă primul plan și refolosește-l oricând.
          </div>
        )}
      </main>
    </>
  )
}
