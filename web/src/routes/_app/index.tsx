import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Check, ChevronLeft, ChevronRight, Copy, MoreHorizontal, Plus, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { JournalEntry, Meal, MealItem } from '@/api/types'
import { ItemPicker, type PickedItem } from '@/components/app/item-picker'
import { NativeSelect } from '@/components/app/native-select'
import { NumberStepper } from '@/components/app/number-stepper'
import { DaySummary, MacroLine } from '@/components/app/nutrients'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { db } from '@/db/database'
import { deleteRow, newId, saveRow } from '@/db/mutations'
import {
  useDayPlan,
  useFoodsById,
  useJournal,
  useMealPlans,
  useMealPlansById,
  useProfile,
  useRecipesById,
  useVariantsById,
} from '@/hooks/use-data'
import { useOwnerId } from '@/hooks/use-owner'
import { addDays, formatDay, today } from '@/lib/dates'
import { kcal } from '@/lib/format'
import { entryName, entryNutrients, logMealItem, pickedName, pickedToMealItem, updateEntryQuantity } from '@/lib/journal'
import { mealItemNutrients, sum } from '@/lib/nutrition'
import { cn } from '@/lib/utils'

type Search = { date?: string; add?: number }

export const Route = createFileRoute('/_app/')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    date: typeof search.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : undefined,
    add: search.add ? 1 : undefined,
  }),
  component: TodayPage,
})

const defaultLabels = ['Mic dejun', 'Prânz', 'Cină', 'Gustare']

type Group = { label: string; meal: Meal | null; entries: JournalEntry[] }

function TodayPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const date = search.date ?? today()
  const ownerId = useOwnerId()

  const profile = useProfile()
  const plans = useMealPlans()
  const plansById = useMealPlansById()
  const dayPlan = useDayPlan(date)
  const journal = useJournal(date)
  const foods = useFoodsById()
  const variants = useVariantsById()
  const recipes = useRecipesById()

  const [pickerLabel, setPickerLabel] = useState<string | null>(search.add ? 'Extra' : null)
  const [editing, setEditing] = useState<JournalEntry | null>(null)

  const plan = dayPlan?.mealPlanId ? plansById.get(dayPlan.mealPlanId) : undefined
  const activePlan = plan && !plan.deletedAt ? plan : undefined

  const groups = useMemo<Group[]>(() => {
    const labels = activePlan ? activePlan.meals.map((m) => m.label) : [...defaultLabels]
    for (const entry of journal) if (!labels.includes(entry.mealLabel)) labels.push(entry.mealLabel)
    return labels.map((label) => {
      const meal = activePlan?.meals.find((m) => m.label === label) ?? null
      const order = new Map(meal?.items.map((item, index) => [item.id, index]) ?? [])
      const position = (e: JournalEntry) => (e.mealItemId != null ? (order.get(e.mealItemId) ?? order.size) : order.size)
      return {
        label,
        meal,
        entries: journal.filter((e) => e.mealLabel === label).sort((a, b) => position(a) - position(b) || a.createdAt.localeCompare(b.createdAt)),
      }
    })
  }, [activePlan, journal])

  const eaten = useMemo(() => sum(journal.map(entryNutrients)), [journal])
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

  const recipeName = (id: string) => recipes.get(id)?.name ?? 'Rețetă'
  const nameOf = (item: MealItem) => entryName(item, foods, variants, recipeName)

  async function choosePlan(mealPlanId: string) {
    await saveRow('dayPlans', { id: dayPlan?.id ?? newId(), date, mealPlanId: mealPlanId || null }, ownerId)
  }

  async function logItem(label: string, item: MealItem) {
    await logMealItem({ date, mealLabel: label, item, foods, variants, name: nameOf(item), fromPlan: true }, ownerId)
  }

  async function logWholeMeal(group: Group) {
    if (!group.meal) return
    const logged = new Set(group.entries.map((e) => e.mealItemId))
    const missing = group.meal.items.filter((i) => !logged.has(i.id))
    for (const item of missing) await logItem(group.label, item)
    if (missing.length > 0) toast.success(`${group.label}: ${missing.length} ${missing.length === 1 ? 'element trecut' : 'elemente trecute'} în jurnal`)
  }

  async function addPicked(label: string, picked: PickedItem) {
    const item = pickedToMealItem(picked)
    await logMealItem({ date, mealLabel: label, item, foods, variants, name: pickedName(picked), fromPlan: false }, ownerId)
  }

  async function copyFromYesterday(label: string) {
    const yesterday = await db.journalEntries.where('date').equals(addDays(date, -1)).toArray()
    const source = yesterday.filter((e) => e.deletedAt == null && e.mealLabel === label)
    if (source.length === 0) {
      toast('Ieri nu ai nimic la ' + label + '.')
      return
    }
    const planItemIds = new Set(activePlan?.meals.flatMap((m) => m.items.map((i) => i.id)) ?? [])
    for (const entry of source) {
      await saveRow(
        'journalEntries',
        { ...entry, id: newId(), date, mealItemId: entry.mealItemId && planItemIds.has(entry.mealItemId) ? entry.mealItemId : null },
        ownerId,
      )
    }
    toast.success(`Am copiat ${source.length} ${source.length === 1 ? 'element' : 'elemente'} de ieri.`)
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Ziua anterioară" onClick={() => navigate({ search: { date: addDays(date, -1) } })}>
              <ChevronLeft className="size-5" />
            </Button>
            <span className="min-w-0 truncate capitalize">{formatDay(date)}</span>
            <Button variant="ghost" size="icon-sm" aria-label="Ziua următoare" onClick={() => navigate({ search: { date: addDays(date, 1) } })}>
              <ChevronRight className="size-5" />
            </Button>
          </span>
        }
      />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        <DaySummary eaten={eaten} target={target} />
        {!target && (
          <Link to="/profile" className="flex items-center gap-3 rounded-xl border border-dashed bg-card p-3 text-sm">
            <Target className="size-5 text-primary" />
            <span className="flex-1">Calculează-ți țintele de calorii și macro ca să vezi cât mai ai.</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        )}

        <div className="flex items-center gap-3">
          <span className="shrink-0 text-sm font-medium">Planul zilei</span>
          <NativeSelect className="flex-1" value={activePlan?.id ?? ''} onChange={(e) => void choosePlan(e.target.value)}>
            <option value="">Fără plan</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        {groups.map((group) => {
          const loggedIds = new Set(group.entries.map((e) => e.mealItemId))
          const planned = group.meal?.items.filter((i) => !loggedIds.has(i.id)) ?? []
          const groupKcal = sum(group.entries.map(entryNutrients)).kcal
          return (
            <section key={group.label} className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-2.5">
                <h2 className="flex-1 font-semibold">{group.label}</h2>
                <span className="text-sm text-muted-foreground tabular-nums">{kcal(groupKcal)} kcal</span>
                {planned.length > 0 && (
                  <Button size="sm" variant="secondary" onClick={() => void logWholeMeal(group)}>
                    <Check className="size-4" /> Tot
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Opțiuni ${group.label}`} />}>
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void copyFromYesterday(group.label)}>
                      <Copy className="size-4" /> Copiază de ieri
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <ul className="divide-y">
                {group.entries.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      type="button"
                      aria-label="Scoate din jurnal"
                      onClick={() => void deleteRow('journalEntries', entry.id)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    >
                      <Check className="size-4" />
                    </button>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(entry)}>
                      <div className="truncate text-sm font-medium">{entry.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.kind === 'food' ? `${Math.round(entry.grams ?? 0)} g` : `${entry.servings} ${entry.servings === 1 ? 'porție' : 'porții'}`}
                        {' · '}
                        <MacroLine n={entryNutrients(entry)} className="inline-flex" />
                      </div>
                    </button>
                  </li>
                ))}
                {planned.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      type="button"
                      aria-label="Trece în jurnal"
                      onClick={() => void logItem(group.label, item)}
                      className="size-7 shrink-0 rounded-full border-2 border-dashed border-muted-foreground/40 transition-colors active:bg-accent"
                    />
                    <div className="min-w-0 flex-1 opacity-70">
                      <div className="truncate text-sm">{nameOf(item)}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.kind === 'food' ? `${Math.round(item.grams ?? 0)} g` : `${item.servings} ${item.servings === 1 ? 'porție' : 'porții'}`}
                        {' · '}
                        {kcal(mealItemNutrients(item, foods, variants).kcal)} kcal · din plan
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setPickerLabel(group.label)}
                className={cn('flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary active:bg-muted', (group.entries.length > 0 || planned.length > 0) && 'border-t')}
              >
                <Plus className="size-4" /> Adaugă
              </button>
            </section>
          )
        })}
      </main>

      <ItemPicker
        open={pickerLabel !== null}
        onOpenChange={(open) => !open && setPickerLabel(null)}
        title={`Adaugă la ${pickerLabel ?? ''}`}
        onPick={(picked) => pickerLabel && void addPicked(pickerLabel, picked)}
      />

      <EntryEditor entry={editing} onClose={() => setEditing(null)} onSave={(entry, qty) => updateEntryQuantity(entry, qty, foods, variants, ownerId)} />
    </>
  )
}

function EntryEditor({
  entry,
  onClose,
  onSave,
}: {
  entry: JournalEntry | null
  onClose: () => void
  onSave: (entry: JournalEntry, quantity: number) => Promise<unknown>
}) {
  const [quantity, setQuantity] = useState(0)
  const [current, setCurrent] = useState<string | null>(null)

  if (entry && current !== entry.id) {
    setCurrent(entry.id)
    setQuantity(entry.kind === 'food' ? (entry.grams ?? 100) : (entry.servings ?? 1))
  }

  const isFood = entry?.kind === 'food'

  return (
    <Drawer open={entry !== null} onOpenChange={(open) => !open && (onClose(), setCurrent(null))}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{entry?.name}</DrawerTitle>
        </DrawerHeader>
        {entry && (
          <div className="space-y-4 p-4">
            <NumberStepper
              value={quantity}
              onChange={setQuantity}
              step={isFood ? 10 : 0.5}
              min={isFood ? 1 : 0.5}
              unit={isFood ? 'g' : 'porții'}
              className="w-full"
              label="cantitate"
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="h-11 flex-1"
                onClick={() => {
                  void deleteRow('journalEntries', entry.id)
                  onClose()
                  setCurrent(null)
                }}
              >
                Șterge
              </Button>
              <Button
                className="h-11 flex-[2]"
                onClick={() => {
                  void onSave(entry, quantity)
                  onClose()
                  setCurrent(null)
                }}
              >
                Salvează
              </Button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}
