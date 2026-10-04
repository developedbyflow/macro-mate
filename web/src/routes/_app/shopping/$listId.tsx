import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Check, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const { listId } = Route.useParams()
  const list = useShoppingList(listId)
  if (!list) return <PageHeader title={t('shopping.editor.title')} back />
  if (list.deletedAt) {
    return (
      <>
        <PageHeader title={list.name} back />
        <p className="p-8 text-center text-sm text-muted-foreground">{t('shopping.editor.deleted')}</p>
      </>
    )
  }
  return <ListEditor list={list} />
}

function ListEditor({ list }: { list: ShoppingList }) {
  const { t } = useTranslation()
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
      <PageHeader title={list.name} subtitle={totalItems > 0 ? t('shopping.editor.progress', { done: doneItems, total: totalItems }) : undefined} back />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-8 lg:mx-0 lg:grid lg:max-w-none lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0 lg:px-8">
        <div className="space-y-4 lg:sticky lg:top-[4.5rem]">
          <section className="space-y-3 rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{t('nav.plans')}</h2>
              <Button variant="ghost" size="sm" onClick={() => setEditingPlans((v) => !v)}>
                {editingPlans ? t('shopping.editor.done') : t('shopping.editor.change')}
              </Button>
            </div>
            {editingPlans ? (
              <>
                <Input
                  aria-label={t('shopping.editor.nameLabel')}
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
                      unit={t('shopping.editor.days')}
                      className="w-36"
                      label={t('shopping.editor.days')}
                    />
                    <Button variant="ghost" size="icon-sm" aria-label={t('shopping.editor.removePlan')} onClick={() => void save({ plans: list.plans.filter((_, i) => i !== index) })}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                {allPlans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('shopping.editor.needPlan')}</p>
                ) : (
                  <Button variant="outline" className="w-full border-dashed" onClick={() => void save({ plans: [...list.plans, { mealPlanId: allPlans[0].id, days: 5 }] })}>
                    <Plus className="size-4" /> {t('shopping.editor.addPlan')}
                  </Button>
                )}
              </>
            ) : (
              <ul className="space-y-1 text-sm">
                {list.plans.map((entry, index) => (
                  <li key={index} className="flex justify-between">
                    <span>{plans.get(entry.mealPlanId)?.name ?? t('shopping.editor.deletedPlan')}</span>
                    <span className="text-muted-foreground">{t('shopping.editor.dayCount', { count: entry.days })}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4">
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

          {groups.length === 0 && list.plans.length > 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t('shopping.editor.noMeals')}</p>}

          <div className="flex flex-col gap-1 border-t pt-4">
            {doneItems > 0 && (
              <Button variant="ghost" onClick={() => void save({ checkedKeys: [] })}>
                <RotateCcw className="size-4" /> {t('shopping.editor.uncheckAll')}
              </Button>
            )}
            <ConfirmDelete
              title={t('shopping.editor.deleteTitle', { name: list.name })}
              description={t('shopping.editor.deleteDescription')}
              onConfirm={async () => {
                await deleteRow('shoppingLists', list.id)
                await navigate({ to: '/shopping' })
              }}
              trigger={
                <Button variant="ghost" className="text-destructive">
                  <Trash2 className="size-4" /> {t('shopping.editor.deleteList')}
                </Button>
              }
            />
          </div>
        </div>
      </main>
    </>
  )
}
