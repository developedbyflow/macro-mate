import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { CalendarDays, Camera, ChartLine, Check, CircleCheck, ChevronLeft, ChevronRight, Copy, MoreHorizontal, Plus, ScanBarcode, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { JournalEntry, Meal, MealItem } from '@/api/types'
import { ItemPicker, type PickedItem } from '@/components/app/item-picker'
import { NativeSelect } from '@/components/app/native-select'
import { NumberStepper } from '@/components/app/number-stepper'
import { DaySummary, DaySummaryBar, MacroLine } from '@/components/app/nutrients'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { db } from '@/db/database'
import { deleteRow, newId, saveRow } from '@/db/mutations'
import {
  useDayPlan,
  useFoodsById,
  useJournal,
  useJournalBetween,
  useMealPlans,
  useMealPlansById,
  useProfile,
  useRecipesById,
  useVariantsById,
  useWeightEntries,
} from '@/hooks/use-data'
import { useDesktop } from '@/hooks/use-desktop'
import { useOwnerId } from '@/hooks/use-owner'
import { addDays, formatDay, longDate, today } from '@/lib/dates'
import { kcal, kg, servings } from '@/lib/format'
import { entryDisplayName, entryName, entryNutrients, logEstimatedItem, logMealItem, pickedName, pickedToMealItem, updateEntryQuantity } from '@/lib/journal'
import { defaultMeals, extraMeal, mealLabel, mealRank, sameMeal } from '@/lib/meals'
import { mealItemNutrients, scale, sum } from '@/lib/nutrition'
import { maintenanceKcal, projectedWeight, targetFromProfile } from '@/lib/targets'
import { cn } from '@/lib/utils'
import { currentWeight } from '@/lib/goals'
import { EstimatedBadge } from '@/components/app/badges'
import { MealScan, type ScanLine } from '@/components/app/meal-scan'

type Search = { date?: string; add?: number }

export const Route = createFileRoute('/_app/')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    date: typeof search.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : undefined,
    add: search.add ? 1 : undefined,
  }),
  component: TodayPage,
})

type Group = { label: string; meal: Meal | null; entries: JournalEntry[] }

function TodayPage() {
  const { t } = useTranslation()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const date = search.date ?? today()
  const ownerId = useOwnerId()
  const desktop = useDesktop()

  const profile = useProfile()
  const plans = useMealPlans()
  const plansById = useMealPlansById()
  const dayPlan = useDayPlan(date)
  const journal = useJournal(date)
  const foods = useFoodsById()
  const variants = useVariantsById()
  const recipes = useRecipesById()

  const [pickerLabel, setPickerLabel] = useState<string | null>(search.add ? extraMeal() : null)
  const [pickerScan, setPickerScan] = useState(false)
  const [editing, setEditing] = useState<JournalEntry | null>(null)
  const [copying, setCopying] = useState<{ label?: string } | null>(null)
  const [scanning, setScanning] = useState(false)

  const plan = dayPlan?.mealPlanId ? plansById.get(dayPlan.mealPlanId) : undefined
  const activePlan = plan && !plan.deletedAt ? plan : undefined

  const groups = useMemo<Group[]>(() => {
    const planned = activePlan ? activePlan.meals.map((m) => m.label) : []
    const extra: string[] = []
    for (const entry of [...journal].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (![...planned, ...extra].some((label) => sameMeal(label, entry.mealLabel))) extra.push(entry.mealLabel)
    }
    const labels = [...planned, ...extra.sort((a, b) => mealRank(a) - mealRank(b))]
    return labels.map((label) => {
      const meal = activePlan?.meals.find((m) => m.label === label) ?? null
      const order = new Map(meal?.items.map((item, index) => [item.id, index]) ?? [])
      const position = (e: JournalEntry) => (e.mealItemId != null ? (order.get(e.mealItemId) ?? order.size) : order.size)
      return {
        label,
        meal,
        entries: journal.filter((e) => sameMeal(e.mealLabel, label)).sort((a, b) => position(a) - position(b) || a.createdAt.localeCompare(b.createdAt)),
      }
    })
  }, [activePlan, journal])

  const eaten = useMemo(() => sum(journal.map(entryNutrients)), [journal])
  const target = targetFromProfile(profile)

  const recipeName = (id: string) => recipes.get(id)?.name ?? t('fallback.recipe')
  const nameOf = (item: MealItem) => entryName(item, foods, variants, recipeName)

  async function choosePlan(mealPlanId: string) {
    await saveRow('dayPlans', { id: dayPlan?.id ?? newId(), date, mealPlanId: mealPlanId || null, completedAt: dayPlan?.completedAt ?? null }, ownerId)
  }

  async function setCompleted(done: boolean) {
    await saveRow('dayPlans', { id: dayPlan?.id ?? newId(), date, mealPlanId: dayPlan?.mealPlanId ?? null, completedAt: done ? new Date().toISOString() : null }, ownerId)
  }

  async function logItem(label: string, item: MealItem) {
    await logMealItem({ date, mealLabel: label, item, foods, variants, name: nameOf(item), fromPlan: true }, ownerId)
  }

  async function logWholeMeal(group: Group) {
    if (!group.meal) return
    const logged = new Set(group.entries.map((e) => e.mealItemId))
    const missing = group.meal.items.filter((i) => !logged.has(i.id))
    for (const item of missing) await logItem(group.label, item)
    if (missing.length > 0) toast.success(t('today.meal.logged', { meal: mealLabel(group.label), count: missing.length }))
  }

  async function addPicked(label: string, picked: PickedItem) {
    const item = pickedToMealItem(picked)
    await logMealItem({ date, mealLabel: label, item, foods, variants, name: pickedName(picked), fromPlan: false }, ownerId)
  }

  async function copyFrom(day: string, label?: string) {
    const entries = await db.journalEntries.where('date').equals(day).toArray()
    const source = entries
      .filter((e) => e.deletedAt == null && (label == null || sameMeal(e.mealLabel, label)))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const yesterday = day === addDays(date, -1)
    if (source.length === 0) {
      if (yesterday) toast(label ? t('today.copy.nothingInMeal', { meal: mealLabel(label) }) : t('today.copy.nothingYesterday'))
      else toast(label ? t('today.copy.nothingInMealOn', { meal: mealLabel(label), date: longDate(day) }) : t('today.copy.nothingOn', { date: longDate(day) }))
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
    toast.success(yesterday ? t('today.copy.copied', { count: source.length }) : t('today.copy.copiedFrom', { count: source.length, date: longDate(day) }))
  }

  function copyFromYesterday(label?: string) {
    return copyFrom(addDays(date, -1), label)
  }

  function currentMeal() {
    const hour = new Date().getHours()
    const index = hour < 11 ? 0 : hour < 16 ? 1 : hour < 21 ? 2 : 3
    return groups[Math.min(index, groups.length - 1)]?.label ?? defaultMeals(4)[index]
  }

  function scanIntoCurrentMeal() {
    setPickerScan(true)
    setPickerLabel(currentMeal())
  }

  const scanMeals = [...groups.map((g) => g.label), ...defaultMeals(4).filter((label) => !groups.some((g) => sameMeal(g.label, label)))]

  async function addScanned(meal: string, lines: ScanLine[]) {
    for (const line of lines) {
      if (line.kind === 'food') {
        const item: MealItem = { id: newId(), kind: 'food', foodId: line.foodId, grams: line.grams, variantId: null, servings: null }
        await logMealItem({ date, mealLabel: meal, item, foods, variants, name: nameOf(item), fromPlan: false }, ownerId)
      } else {
        await logEstimatedItem({ date, mealLabel: meal, name: line.name, grams: line.grams, nutrients: scale(line.base, line.grams / Math.max(1, line.baseGrams)) }, ownerId)
      }
    }
    toast.success(t('today.scan.added', { count: lines.length, meal: mealLabel(meal) }))
  }

  const planPicker = (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-sm font-medium">{t('today.dayPlan')}</span>
      <NativeSelect className="flex-1" value={activePlan?.id ?? ''} onChange={(e) => void choosePlan(e.target.value)}>
        <option value="">{t('today.noPlan')}</option>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  )

  const copyDayButton = (
    <div className="flex gap-2">
      <Button variant="outline" className="h-10 flex-1 border-dashed lg:flex-none" onClick={() => void copyFromYesterday()}>
        <Copy className="size-4" /> {t('today.copyYesterday')}
      </Button>
      <Button variant="outline" className="h-10 flex-1 border-dashed lg:flex-none" onClick={() => setCopying({})}>
        <CalendarDays className="size-4" /> {t('today.copyFromDate')}
      </Button>
    </div>
  )

  const targetPrompt = !target && (
    <Link to="/profile" className="flex items-center gap-3 rounded-xl border border-dashed bg-card p-3 text-sm">
      <Target className="size-5 text-primary" />
      <span className="flex-1">{t('today.targetPrompt')}</span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  )

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={t('today.previousDay')} onClick={() => navigate({ search: { date: addDays(date, -1) } })}>
              <ChevronLeft className="size-5" />
            </Button>
            <span className="min-w-0 truncate capitalize">{formatDay(date)}</span>
            {dayPlan?.completedAt && <CircleCheck className="size-4 shrink-0 text-primary" aria-label={t('today.complete.done')} />}
            <Button variant="ghost" size="icon-sm" aria-label={t('today.nextDay')} onClick={() => navigate({ search: { date: addDays(date, 1) } })}>
              <ChevronRight className="size-5" />
            </Button>
          </span>
        }
        actions={
          <>
            <Button variant="ghost" size="icon" aria-label={t('today.scan.open')} title={t('today.scan.open')} onClick={() => setScanning(true)}>
              <Camera className="size-5" />
            </Button>
            <Button variant="ghost" size="icon" aria-label={t('today.scanToCurrentMeal')} onClick={scanIntoCurrentMeal}>
              <ScanBarcode className="size-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={t('today.dayMenu')} />}>
                <MoreHorizontal className="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void copyFromYesterday()}>
                  <Copy className="size-4" /> {t('today.copyWholeYesterday')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCopying({})}>
                  <CalendarDays className="size-4" /> {t('today.copyFromDate')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 lg:max-w-none lg:space-y-5 lg:px-8 lg:pb-8">
        {desktop ? (
          <>
            <Link to="/progress" aria-label={t('today.viewProgress')} className="block rounded-2xl transition-opacity hover:opacity-90">
              <DaySummaryBar eaten={eaten} target={target} aside={<WeekStats />} />
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-80">{planPicker}</div>
              {journal.length === 0 && copyDayButton}
              {targetPrompt}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <Link to="/progress" aria-label={t('today.viewProgress')} className="block rounded-2xl transition-opacity hover:opacity-90">
              <DaySummary eaten={eaten} target={target} />
            </Link>
            <ProgressTeaser />
            {targetPrompt}
            {planPicker}
            {journal.length === 0 && copyDayButton}
          </div>
        )}

        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0 min-[110rem]:grid-cols-4">
          {groups.map((group) => {
            const loggedIds = new Set(group.entries.map((e) => e.mealItemId))
            const planned = group.meal?.items.filter((i) => !loggedIds.has(i.id)) ?? []
            const groupTotal = sum(group.entries.map(entryNutrients))
            return (
              <section key={group.label} className="overflow-hidden rounded-2xl border bg-card">
                <div className="flex items-center gap-2 border-b px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{mealLabel(group.label)}</h2>
                    <MacroLine n={groupTotal} className="mt-0.5" />
                  </div>
                  {planned.length > 0 && (
                    <Button size="sm" variant="secondary" onClick={() => void logWholeMeal(group)}>
                      <Check className="size-4" /> {t('today.meal.logAll')}
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t('today.meal.options', { meal: mealLabel(group.label) })} />}>
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => void copyFromYesterday(group.label)}>
                        <Copy className="size-4" /> {t('today.meal.copyFromYesterday')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCopying({ label: group.label })}>
                        <CalendarDays className="size-4" /> {t('today.copyFromDate')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <ul className="divide-y">
                  {group.entries.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                      <button
                        type="button"
                        aria-label={t('today.meal.removeFromLog')}
                        onClick={() => void deleteRow('journalEntries', entry.id)}
                        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      >
                        <Check className="size-4" />
                      </button>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(entry)}>
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <span className="truncate">{entryDisplayName(entry, foods)}</span>
                          {entry.kind === 'food' && !entry.foodId && <EstimatedBadge />}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {entry.kind === 'food' ? `${Math.round(entry.grams ?? 0)} g` : servings(entry.servings ?? 0)}
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
                        aria-label={t('today.meal.addToLog')}
                        onClick={() => void logItem(group.label, item)}
                        className="size-7 shrink-0 rounded-full border-2 border-dashed border-muted-foreground/40 transition-colors active:bg-accent"
                      />
                      <div className="min-w-0 flex-1 opacity-70">
                        <div className="truncate text-sm">{nameOf(item)}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.kind === 'food' ? `${Math.round(item.grams ?? 0)} g` : servings(item.servings ?? 0)}
                          {' · '}
                          {t('today.meal.plannedKcal', { kcal: kcal(mealItemNutrients(item, foods, variants).kcal) })}
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
                  <Plus className="size-4" /> {t('common.add')}
                </button>
              </section>
            )
          })}
          {!activePlan && <NewMealCard taken={groups.map((g) => g.label)} empty={groups.length === 0} onChoose={setPickerLabel} />}
        </div>

        {(journal.length > 0 || dayPlan?.completedAt) && (
          <DayCompletion date={date} eatenKcal={eaten.kcal} completed={dayPlan?.completedAt != null} onChange={(done) => void setCompleted(done)} />
        )}
      </main>

      <ItemPicker
        open={pickerLabel !== null}
        onOpenChange={(open) => {
          if (open) return
          setPickerLabel(null)
          setPickerScan(false)
        }}
        startScanning={pickerScan}
        title={t('today.addTo', { meal: mealLabel(pickerLabel ?? '') })}
        onPick={(picked) => pickerLabel && void addPicked(pickerLabel, picked)}
      />

      <MealScan open={scanning} onOpenChange={setScanning} meals={scanMeals} defaultMeal={currentMeal()} onAdd={addScanned} />

      <CopyFromDay
        target={copying}
        current={date}
        onClose={() => setCopying(null)}
        onCopy={(day) => {
          void copyFrom(day, copying?.label)
          setCopying(null)
        }}
      />

      <EntryEditor entry={editing} onClose={() => setEditing(null)} onSave={(entry, qty) => updateEntryQuantity(entry, qty, foods, variants, ownerId)} />
    </>
  )
}

function DayCompletion({ date, eatenKcal, completed, onChange }: { date: string; eatenKcal: number; completed: boolean; onChange: (done: boolean) => void }) {
  const { t } = useTranslation()
  const profile = useProfile()
  const weights = useWeightEntries()

  if (!completed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-5 text-center lg:flex-row lg:justify-between lg:text-left">
        <p className="text-sm text-muted-foreground">{t('today.complete.hint')}</p>
        <Button className="h-11 px-5" onClick={() => onChange(true)}>
          <CircleCheck className="size-4" /> {t('today.complete.action')}
        </Button>
      </div>
    )
  }

  const weight = (profile && (currentWeight(weights, date) ?? profile.weightKg)) ?? null
  const maintenance = profile && weight != null ? maintenanceKcal(profile, weight) : null
  const projected = weight != null && maintenance != null ? projectedWeight(weight, eatenKcal, maintenance) : null
  const change = projected != null && weight != null ? projected - weight : 0
  const sign = change > 0.05 ? '+' : change < -0.05 ? '−' : ''

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-5 lg:flex-row lg:items-center lg:gap-5">
      <CircleCheck className="size-8 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="font-semibold">{t('today.complete.done')}</h2>
        {projected != null ? (
          <p className="text-sm text-muted-foreground">
            <Trans
              i18nKey="today.complete.projection"
              values={{ weight: kg(projected), change: `${sign}${kg(Math.abs(change))}` }}
              components={{ strong: <strong className="text-foreground" /> }}
            />
          </p>
        ) : (
          <Link to="/profile" className="text-sm text-primary underline-offset-4 hover:underline">
            {t('today.complete.needsProfile')}
          </Link>
        )}
      </div>
      <Button variant="ghost" className="h-10 self-start lg:self-center" onClick={() => onChange(false)}>
        {t('today.complete.reopen')}
      </Button>
    </section>
  )
}

function CopyFromDay({
  target,
  current,
  onClose,
  onCopy,
}: {
  target: { label?: string } | null
  current: string
  onClose: () => void
  onCopy: (day: string) => void
}) {
  const { t } = useTranslation()
  const [day, setDay] = useState(() => addDays(current, -1))
  const [shownFor, setShownFor] = useState<{ label?: string } | null>(null)

  if (target !== shownFor) {
    setShownFor(target)
    if (target) setDay(addDays(current, -1))
  }

  const sameDay = day === current

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{target?.label ? t('today.copyDialog.titleMeal', { meal: mealLabel(target.label) }) : t('today.copyDialog.title')}</DialogTitle>
        </DialogHeader>
        <form
          id="copy-from-day"
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (day && !sameDay) onCopy(day)
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t('today.copyDialog.day')}</span>
            <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} required className="h-10" />
          </label>
          {sameDay && <p className="text-xs text-destructive">{t('today.copyDialog.sameDay')}</p>}
        </form>
        <DialogFooter>
          <Button type="submit" form="copy-from-day" className="h-10" disabled={!day || sameDay}>
            <Copy className="size-4" /> {t('today.copyDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewMealCard({ taken, empty, onChoose }: { taken: string[]; empty: boolean; onChoose: (label: string) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const suggestions = defaultMeals(4).filter((label) => !taken.some((existing) => sameMeal(existing, label)))

  function close() {
    setOpen(false)
    setName('')
  }

  function choose(label: string) {
    const clean = label.trim()
    if (!clean) return
    onChoose(taken.find((existing) => sameMeal(existing, clean)) ?? clean)
    close()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed px-4 py-5 text-sm transition-colors hover:bg-muted active:bg-muted"
      >
        <span className="flex items-center gap-2 font-medium text-primary">
          <Plus className="size-4" /> {t('today.newMeal.add')}
        </span>
        {empty && <span className="text-xs text-muted-foreground">{t('today.newMeal.empty')}</span>}
      </button>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        choose(name)
      }}
      className="space-y-3 rounded-2xl border border-dashed bg-card p-4"
    >
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('today.newMeal.placeholder')} maxLength={60} className="h-10" />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((label) => (
            <Button key={label} type="button" variant="outline" size="sm" onClick={() => choose(label)}>
              {label}
            </Button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="h-10 flex-1" onClick={close}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="h-10 flex-[2]" disabled={!name.trim()}>
          {t('today.newMeal.next')}
        </Button>
      </div>
    </form>
  )
}

function useWeekStats() {
  const end = today()
  const week = useJournalBetween(addDays(end, -6), end)
  const weights = useWeightEntries()
  const days = new Set(week.map((e) => e.date)).size
  return {
    average: days > 0 ? sum(week.map(entryNutrients)).kcal / days : null,
    lastWeight: weights.at(-1)?.weightKg,
  }
}

function ProgressTeaser() {
  const { t } = useTranslation()
  const { average, lastWeight } = useWeekStats()

  return (
    <Link to="/progress" className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm transition-colors hover:bg-muted">
      <ChartLine className="size-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{t('nav.progress')}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {average != null ? t('today.teaser.average', { kcal: kcal(average) }) : t('today.teaser.empty')}
          {lastWeight != null && ` · ${kg(lastWeight)}`}
        </span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  )
}

function WeekStats() {
  const { t } = useTranslation()
  const { average, lastWeight } = useWeekStats()

  return (
    <>
      <ChartLine className="size-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-sm font-medium">{t('nav.progress')}</span>
        <span className="block text-xs text-muted-foreground">{average != null ? t('today.teaser.average', { kcal: kcal(average) }) : t('today.teaser.empty')}</span>
        {lastWeight != null && <span className="block text-xs text-muted-foreground">{kg(lastWeight)}</span>}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
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
  const { t } = useTranslation()
  const desktop = useDesktop()
  const foods = useFoodsById()
  const [quantity, setQuantity] = useState(0)
  const [current, setCurrent] = useState<string | null>(null)

  if (entry && current !== entry.id) {
    setCurrent(entry.id)
    setQuantity(entry.kind === 'food' ? (entry.grams ?? 100) : (entry.servings ?? 1))
  }

  const isFood = entry?.kind === 'food'

  return (
    <Drawer swipeDirection={desktop ? 'right' : 'down'} open={entry !== null} onOpenChange={(open) => !open && (onClose(), setCurrent(null))}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{entry && entryDisplayName(entry, foods)}</DrawerTitle>
        </DrawerHeader>
        {entry && (
          <div className="space-y-4 p-4">
            <NumberStepper
              value={quantity}
              onChange={setQuantity}
              step={isFood ? 10 : 0.5}
              min={isFood ? 1 : 0.5}
              unit={isFood ? 'g' : t('units.servings')}
              className="w-full"
              label={t('today.editor.quantity')}
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
                {t('common.delete')}
              </Button>
              <Button
                className="h-11 flex-[2]"
                onClick={() => {
                  void onSave(entry, quantity)
                  onClose()
                  setCurrent(null)
                }}
              >
                {t('common.save')}
              </Button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}
