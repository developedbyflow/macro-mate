import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronRight, Droplet, Flame, Plus, RefreshCw, Target, Trash2, Weight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { UserProfile, WeightEntry } from '@/api/types'
import { NumberStepper } from '@/components/app/number-stepper'
import { PageHeader } from '@/components/app/page-header'
import { KcalBars, WeightChart } from '@/components/app/progress-charts'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { deleteRow, newId, saveRow } from '@/db/mutations'
import { useFoodsById, useJournalBetween, useProfile, useVariantsById, useWeightEntries } from '@/hooks/use-data'
import { useDesktop } from '@/hooks/use-desktop'
import { useOwnerId } from '@/hooks/use-owner'
import i18n from '@/i18n'
import { addDays, longDate, shortDate, today } from '@/lib/dates'
import { kcal, kg, num, perWeek } from '@/lib/format'
import { goalProgress } from '@/lib/goals'
import type { Nutrients } from '@/lib/nutrition'
import { carbsByGlycemicGrade, dailyTotals, dateRange, streak, summarize, weightSeries } from '@/lib/progress'
import { targetFromProfile, targetsForWeight } from '@/lib/targets'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/progress')({
  component: ProgressPage,
})

const periods = [7, 30, 90] as const
type Period = (typeof periods)[number]

function ProgressPage() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(30)
  const end = today()
  const dates = useMemo(() => dateRange(end, period), [end, period])

  const profile = useProfile()
  const foods = useFoodsById()
  const variants = useVariantsById()
  const weights = useWeightEntries()
  const recentJournal = useJournalBetween(addDays(end, -89), end)

  const target = targetFromProfile(profile)
  const entries = useMemo(() => recentJournal.filter((e) => e.date >= dates[0]), [recentJournal, dates])
  const days = useMemo(() => dailyTotals(entries, dates), [entries, dates])
  const stats = useMemo(() => summarize(days, target), [days, target])
  const glycemic = useMemo(() => carbsByGlycemicGrade(entries, foods, variants), [entries, foods, variants])
  const loggedDates = useMemo(() => new Set(recentJournal.map((e) => e.date)), [recentJournal])

  return (
    <>
      <PageHeader title={t('nav.progress')} subtitle={stats ? t('progress.loggedOfPeriod', { logged: stats.logged, count: period }) : undefined} />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-8 lg:mx-0 lg:max-w-none lg:px-8">
        <GoalCard profile={profile} weights={weights} />

        <div className="flex gap-1.5">
          {periods.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                period === p ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {t('progress.period', { count: p })}
            </button>
          ))}
        </div>

        {stats ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label={t('progress.metrics.averagePerDay')} value={`${kcal(stats.avg.kcal)} kcal`} hint={target ? differenceText(stats.avg.kcal - target.kcal) : t('progress.metrics.fromLoggedDays', { count: stats.logged })} />
              <Metric label={t('progress.metrics.highestDay')} value={`${kcal(stats.highest.n.kcal)} kcal`} hint={shortDate(stats.highest.date)} />
              <Metric label={t('progress.metrics.lowestDay')} value={`${kcal(stats.lowest.n.kcal)} kcal`} hint={shortDate(stats.lowest.date)} />
              <Metric
                label={t('progress.metrics.daysInTarget')}
                value={stats.inTarget != null ? t('progress.metrics.inTargetOfLogged', { inTarget: stats.inTarget, logged: stats.logged }) : '—'}
                hint={stats.inTarget != null ? t('progress.metrics.percentOfLogged', { percent: Math.round((stats.inTarget / stats.logged) * 100) }) : t('progress.metrics.setTargets')}
              />
            </div>

            <section className="rounded-2xl border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <h2 className="mr-auto font-semibold">{t('progress.kcalChart.title')}</h2>
                <Legend className="bg-primary" label={t('progress.kcalChart.onOrUnder')} />
                <Legend className="bg-kcal" label={t('progress.kcalChart.over')} />
              </div>
              <KcalBars days={days} target={target?.kcal ?? null} />
            </section>
          </>
        ) : (
          <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            {t('progress.empty', { count: period })}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {stats && <MacroAverages avg={stats.avg} target={target} proteinDays={stats.proteinDays} logged={stats.logged} />}
          <WeightCard dates={dates} weights={weights} profile={profile} period={period} />
          {stats && <GlycemicCard share={glycemic} />}
          <StreakCard loggedDates={loggedDates} end={end} />
        </div>
      </main>
    </>
  )
}

function GoalCard({ profile, weights }: { profile: UserProfile | undefined; weights: WeightEntry[] }) {
  const { t } = useTranslation()
  if (!profile) return null
  const progress = goalProgress(profile, weights, today())

  if (!progress) {
    return (
      <Link to="/profile" className="flex items-center gap-3 rounded-2xl border border-dashed bg-card p-4 text-sm transition-colors hover:bg-muted">
        <Target className="size-5 shrink-0 text-primary" />
        <span className="flex-1">
          {profile.goal === 'maintain' ? t('progress.goal.maintainHint') : t('progress.goal.setGoalHint')}
        </span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
    )
  }

  const change = progress.current - progress.start
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Target className="size-4 text-muted-foreground" /> {t('progress.goal.title', { weight: kg(progress.goal) })}
        </h2>
        <Link to="/profile" className="text-sm font-medium text-primary hover:underline">
          {t('progress.goal.change')}
        </Link>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{kg(progress.start)}</span>
        <span className="font-semibold tabular-nums">
          {t('progress.goal.progress', {
            change: `${Math.abs(change) < 0.05 ? '' : change < 0 ? '−' : '+'}${kg(Math.abs(change))}`,
            total: kg(progress.total),
            percent: Math.round(progress.fraction * 100),
          })}
        </span>
        <span className="text-muted-foreground">{kg(progress.goal)}</span>
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.fraction * 100}%` }} />
      </div>

      {progress.reached ? (
        <p className="mt-3 text-sm">
          <Trans i18nKey="progress.goal.reached" values={{ weight: kg(progress.goal) }} components={{ strong: <strong /> }} />
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm">
            <Trans i18nKey="progress.goal.current" values={{ current: kg(progress.current), remaining: kg(progress.remaining) }} components={{ strong: <strong /> }} />
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
            {progress.plannedEnd && (
              <li>{t('progress.goal.plannedEnd', { rate: perWeek(progress.plannedRate), date: longDate(progress.plannedEnd) })}</li>
            )}
            <li>
              {progress.actualRate == null
                ? t('progress.goal.actualPending')
                : progress.actualEnd
                  ? t('progress.goal.actualEnd', { rate: perWeek(progress.actualRate), date: longDate(progress.actualEnd) })
                  : t('progress.goal.wrongDirection', { rate: perWeek(Math.abs(progress.actualRate)) })}
            </li>
          </ul>
        </>
      )}
    </section>
  )
}

function differenceText(difference: number) {
  if (Math.abs(difference) < 1) return i18n.t('progress.metrics.onTarget')
  return difference < 0 ? i18n.t('progress.metrics.underTarget', { kcal: kcal(-difference) }) : i18n.t('progress.metrics.overTarget', { kcal: kcal(difference) })
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div>
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn('size-2.5 rounded-sm', className)} />
      {label}
    </span>
  )
}

const macroRows = [
  { key: 'proteinG', label: 'nutrients.protein', unit: 'g', color: 'bg-protein' },
  { key: 'carbsG', label: 'nutrients.carbs', unit: 'g', color: 'bg-carbs' },
  { key: 'fatG', label: 'nutrients.fat', unit: 'g', color: 'bg-fat' },
  { key: 'fiberG', label: 'nutrients.fiber', unit: 'g', color: 'bg-fiber' },
  { key: 'sodiumMg', label: 'nutrients.sodium', unit: 'mg', color: 'bg-sodium' },
] as const

function MacroAverages({ avg, target, proteinDays, logged }: { avg: Nutrients; target: Partial<Nutrients> | null; proteinDays: number | null; logged: number }) {
  const { t } = useTranslation()
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-3 font-semibold">{t('progress.macros.title')}</h2>
      <div className="space-y-3">
        {macroRows.map((row) => {
          const goal = target?.[row.key]
          return (
            <div key={row.key} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
              <span className="text-muted-foreground">{t(row.label)}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', row.color)} style={{ width: `${goal ? Math.min(100, (avg[row.key] / goal) * 100) : 0}%` }} />
              </div>
              <span className="text-right tabular-nums">
                {num(avg[row.key])}
                {goal ? ` / ${num(goal)}` : ''} {row.unit}
              </span>
            </div>
          )
        })}
      </div>
      {proteinDays != null && (
        <p className="mt-3 text-xs text-muted-foreground">{t('progress.macros.proteinDays', { days: proteinDays, count: logged })}</p>
      )}
    </section>
  )
}

function GlycemicCard({ share }: { share: ReturnType<typeof carbsByGlycemicGrade> }) {
  const { t } = useTranslation()
  const total = share.A + share.B + share.C + share.unknown
  const parts = [
    { key: 'A', value: share.A, color: 'bg-grade-a', label: t('progress.glycemic.grade', { grade: 'A' }) },
    { key: 'B', value: share.B, color: 'bg-grade-b', label: t('progress.glycemic.grade', { grade: 'B' }) },
    { key: 'C', value: share.C, color: 'bg-grade-c', label: t('progress.glycemic.grade', { grade: 'C' }) },
    { key: 'unknown', value: share.unknown, color: 'bg-muted-foreground/40', label: t('progress.glycemic.ungraded') },
  ].filter((p) => p.value > 0)

  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Droplet className="size-4 text-muted-foreground" /> {t('progress.glycemic.title')}
      </h2>
      {total === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t('progress.glycemic.empty')}</p>
      ) : (
        <>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full">
            {parts.map((p) => (
              <div key={p.key} className={p.color} style={{ width: `${(p.value / total) * 100}%` }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {parts.map((p) => (
              <span key={p.key} className="flex items-center gap-1.5">
                <span className={cn('size-2.5 rounded-sm', p.color)} />
                {p.label}: {Math.round((p.value / total) * 100)}%
              </span>
            ))}
          </div>
          {share.topC.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">{t('progress.glycemic.topC', { foods: share.topC.map((c) => `${c.name} (${num(c.carbsG)} g)`).join(', ') })}</p>
          )}
        </>
      )}
    </section>
  )
}

function StreakCard({ loggedDates, end }: { loggedDates: Set<string>; end: string }) {
  const { t } = useTranslation()
  const count = streak(loggedDates, end)
  const lastDays = dateRange(end, 30)
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Flame className="size-4 text-muted-foreground" /> {t('progress.streak.title')}
        </h2>
        <span className="text-sm font-medium text-primary">{t('progress.streak.inARow', { count })}</span>
      </div>
      <div className="mt-3 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1">
        {lastDays.map((date) => (
          <span key={date} title={shortDate(date)} className={cn('aspect-square rounded-[3px] border', loggedDates.has(date) ? 'border-primary bg-primary' : 'bg-muted/50')} />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t('progress.streak.legend')}</p>
    </section>
  )
}

function WeightCard({ dates, weights, profile, period }: { dates: string[]; weights: WeightEntry[]; profile: UserProfile | undefined; period: Period }) {
  const { t } = useTranslation()
  const ownerId = useOwnerId()
  const [adding, setAdding] = useState(false)
  const series = useMemo(() => weightSeries(weights, dates), [weights, dates])
  const averages = series.average.filter((v): v is number => v != null)
  const current = averages.at(-1) ?? weights.at(-1)?.weightKg ?? null
  const change = averages.length >= 2 ? averages[averages.length - 1] - averages[0] : null
  const recent = weights.slice(-5).reverse()

  const roundedCurrent = current != null ? Math.round(current * 10) / 10 : null
  const newTargets = profile && roundedCurrent != null && profile.weightKg != null && Math.abs(roundedCurrent - profile.weightKg) >= 1 ? targetsForWeight(profile, roundedCurrent) : null

  async function updateTargets() {
    if (!profile || !newTargets || roundedCurrent == null) return
    await saveRow(
      'userProfiles',
      {
        ...profile,
        weightKg: roundedCurrent,
        targetKcal: newTargets.kcal,
        targetProteinG: newTargets.proteinG,
        targetCarbsG: newTargets.carbsG,
        targetFatG: newTargets.fatG,
        targetFiberG: newTargets.fiberG,
        targetSodiumMg: newTargets.sodiumMg,
      },
      profile.userId,
    )
    toast.success(t('progress.weight.recalculated', { weight: kg(roundedCurrent), kcal: kcal(newTargets.kcal) }))
  }

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Weight className="size-4 text-muted-foreground" /> {t('progress.weight.title')}
        </h2>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> {t('progress.weight.log')}
        </Button>
      </div>

      {current == null ? (
        <p className="mt-2 text-sm text-muted-foreground">{t('progress.weight.empty')}</p>
      ) : (
        <>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{kg(current)}</div>
          <p className="text-xs text-muted-foreground">
            {change != null
              ? t('progress.weight.change', { change: `${change <= 0 ? '−' : '+'}${kg(Math.abs(change))}`, count: period })
              : t('progress.weight.noChangeYet')}
          </p>
          {averages.length > 0 && (
            <div className="mt-3">
              <WeightChart dates={dates} points={series.points} average={series.average} />
            </div>
          )}
        </>
      )}

      {newTargets && profile?.weightKg != null && roundedCurrent != null && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-accent/60 p-3 text-sm">
          <p className="min-w-0 flex-1">
            {t('progress.weight.targetsOutdated', { weight: kg(profile.weightKg), current: kg(roundedCurrent), newKcal: kcal(newTargets.kcal), oldKcal: kcal(profile.targetKcal ?? 0) })}
          </p>
          <Button size="sm" onClick={() => void updateTargets()}>
            <RefreshCw className="size-4" /> {t('progress.weight.recalculate')}
          </Button>
        </div>
      )}

      {recent.length > 0 && (
        <ul className="mt-3 divide-y border-t text-sm">
          {recent.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 py-1.5">
              <span className="flex-1 text-muted-foreground">{shortDate(entry.date)}</span>
              <span className="font-medium tabular-nums">{kg(entry.weightKg)}</span>
              <Button variant="ghost" size="icon-sm" aria-label={t('progress.weight.deleteEntry', { date: shortDate(entry.date) })} onClick={() => void deleteRow('weightEntries', entry.id)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <WeightDrawer
        open={adding}
        onClose={() => setAdding(false)}
        initial={weights.at(-1)?.weightKg ?? profile?.weightKg ?? 80}
        onSave={async (date, weightKg) => {
          const existing = weights.find((w) => w.date === date)
          await saveRow('weightEntries', { id: existing?.id ?? newId(), date, weightKg }, ownerId)
          toast.success(t('progress.weight.logged', { weight: kg(weightKg), date: shortDate(date) }))
        }}
      />
    </section>
  )
}

function WeightDrawer({ open, onClose, initial, onSave }: { open: boolean; onClose: () => void; initial: number; onSave: (date: string, weightKg: number) => Promise<void> }) {
  const { t } = useTranslation()
  const desktop = useDesktop()
  const [weight, setWeight] = useState(initial)
  const [date, setDate] = useState(today())
  const [wasOpen, setWasOpen] = useState(false)

  if (open && !wasOpen) {
    setWasOpen(true)
    setWeight(initial)
    setDate(today())
  }
  if (!open && wasOpen) setWasOpen(false)

  return (
    <Drawer swipeDirection={desktop ? 'right' : 'down'} open={open} onOpenChange={(next) => !next && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('progress.weight.drawerTitle')}</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-4 p-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t('progress.weight.day')}</span>
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} className="h-10" />
          </label>
          <div className="space-y-1.5">
            <span className="block text-sm font-medium">{t('progress.weight.weight')}</span>
            <NumberStepper value={weight} onChange={setWeight} step={0.1} min={20} max={400} unit="kg" className="w-full" label={t('progress.weight.kilograms')} />
          </div>
          <Button
            size="lg"
            className="h-12 w-full text-base"
            onClick={() => {
              void onSave(date, weight)
              onClose()
            }}
          >
            {t('common.save')}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
