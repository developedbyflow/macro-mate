import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Check, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ShoppingList } from '@/api/types'
import { ConfirmDelete } from '@/components/app/confirm-delete'
import { NativeSelect } from '@/components/app/native-select'
import { NumberStepper } from '@/components/app/number-stepper'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteRow, saveRow } from '@/db/mutations'
import { useFoodsById, useMealPlans, useMealPlansById, useRecipesById, useShoppingList, useVariantsById } from '@/hooks/use-data'
import { useOwnerId } from '@/hooks/use-owner'
import { grams, units } from '@/lib/format'
import { buildShoppingList } from '@/lib/shopping'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/shopping/$listId')({
  component: ShoppingListPage,
})

function ShoppingListPage() {
  const { listId } = Route.useParams()
  const list = useShoppingList(listId)
  if (!list) return <PageHeader title="Listă" back />
  if (list.deletedAt) {
    return (
      <>
        <PageHeader title={list.name} back />
        <p className="p-8 text-center text-sm text-muted-foreground">Lista a fost ștearsă.</p>
      </>
    )
  }
  return <ListEditor list={list} />
}

function ListEditor({ list }: { list: ShoppingList }) {
  const navigate = useNavigate()
  const ownerId = useOwnerId()
  const allPlans = useMealPlans()
  const plans = useMealPlansById()
  const variants = useVariantsById()
  const recipes = useRecipesById()
  const foods = useFoodsById()
  const [name, setName] = useState(list.name)
  const [editingPlans, setEditingPlans] = useState(list.plans.length === 0)

  const groups = useMemo(() => buildShoppingList(list, { plans, variants, recipes, foods }), [list, plans, variants, recipes, foods])
  const checked = new Set(list.checkedKeys)
  const totalItems = groups.reduce((n, g) => n + g.items.length, 0)
  const doneItems = groups.reduce((n, g) => n + g.items.filter((i) => checked.has(i.key)).length, 0)

  function save(next: Partial<ShoppingList>) {
    return saveRow('shoppingLists', { ...list, ...next }, ownerId)
  }

  function toggle(key: string) {
    void save({ checkedKeys: checked.has(key) ? list.checkedKeys.filter((k) => k !== key) : [...list.checkedKeys, key] })
  }

  return (
    <>
      <PageHeader title={list.name} subtitle={totalItems > 0 ? `${doneItems} din ${totalItems} luate` : undefined} back />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-8">
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Planuri</h2>
            <Button variant="ghost" size="sm" onClick={() => setEditingPlans((v) => !v)}>
              {editingPlans ? 'Gata' : 'Schimbă'}
            </Button>
          </div>
          {editingPlans ? (
            <>
              <Input
                aria-label="Numele listei"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() && name !== list.name && void save({ name: name.trim() })}
                className="h-10"
              />
              {list.plans.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <NativeSelect
                    className="min-w-0 flex-1"
                    value={entry.mealPlanId}
                    onChange={(e) => void save({ plans: list.plans.map((p, i) => (i === index ? { ...p, mealPlanId: e.target.value } : p)) })}
                  >
                    {allPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <NumberStepper
                    value={entry.days}
                    onChange={(days) => void save({ plans: list.plans.map((p, i) => (i === index ? { ...p, days: Math.round(days) } : p)) })}
                    min={1}
                    max={60}
                    unit="zile"
                    className="w-36"
                    label="zile"
                  />
                  <Button variant="ghost" size="icon-sm" aria-label="Scoate planul" onClick={() => void save({ plans: list.plans.filter((_, i) => i !== index) })}>
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              {allPlans.length === 0 ? (
                <p className="text-sm text-muted-foreground">Fă întâi un meal plan.</p>
              ) : (
                <Button variant="outline" className="w-full border-dashed" onClick={() => void save({ plans: [...list.plans, { mealPlanId: allPlans[0].id, days: 5 }] })}>
                  <Plus className="size-4" /> Adaugă plan
                </Button>
              )}
            </>
          ) : (
            <ul className="space-y-1 text-sm">
              {list.plans.map((entry, index) => (
                <li key={index} className="flex justify-between">
                  <span>{plans.get(entry.mealPlanId)?.name ?? 'Plan șters'}</span>
                  <span className="text-muted-foreground">
                    × {entry.days} {entry.days === 1 ? 'zi' : 'zile'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {groups.map((group) => (
          <section key={group.key} className="overflow-hidden rounded-2xl border bg-card">
            <div className="border-b px-4 py-2.5">
              <h2 className="font-semibold">{group.title}</h2>
              {group.subtitle && <p className="text-xs text-muted-foreground">{group.subtitle}</p>}
            </div>
            <ul className="divide-y">
              {[...group.items]
                .sort((a, b) => Number(checked.has(a.key)) - Number(checked.has(b.key)))
                .map((item) => {
                  const done = checked.has(item.key)
                  return (
                    <li key={item.key}>
                      <button type="button" onClick={() => toggle(item.key)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted">
                        <span
                          className={cn(
                            'flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                            done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                          )}
                        >
                          {done && <Check className="size-4" />}
                        </span>
                        <span className={cn('flex-1 text-sm', done && 'text-muted-foreground line-through')}>{item.name}</span>
                        <span className={cn('text-sm font-medium tabular-nums', done && 'text-muted-foreground')}>
                          {grams(item.grams)}
                          {item.units != null && <span className="ml-1 text-xs font-normal text-muted-foreground">≈ {units(item.units, item.category)}</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
            </ul>
          </section>
        ))}

        {groups.length === 0 && list.plans.length > 0 && <p className="py-8 text-center text-sm text-muted-foreground">Planurile alese n-au încă mese.</p>}

        <div className="flex flex-col gap-1 border-t pt-4">
          {doneItems > 0 && (
            <Button variant="ghost" onClick={() => void save({ checkedKeys: [] })}>
              <RotateCcw className="size-4" /> Debifează tot
            </Button>
          )}
          <ConfirmDelete
            title={`Ștergi ${list.name}?`}
            description="Lista dispare pentru amândoi."
            onConfirm={async () => {
              await deleteRow('shoppingLists', list.id)
              await navigate({ to: '/shopping' })
            }}
            trigger={
              <Button variant="ghost" className="text-destructive">
                <Trash2 className="size-4" /> Șterge lista
              </Button>
            }
          />
        </div>
      </main>
    </>
  )
}
