import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronRight, Droplet, Flame, Plus, RefreshCw, Target, Trash2, Weight } from 'lucide-react'
import { useMemo, useState } from 'react'
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
      <PageHeader title="Progres" subtitle={stats ? `${stats.logged} din ${period} zile notate` : undefined} />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-8 lg:mx-0 lg:max-w-6xl lg:px-8">
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
              {p === 7 ? '7 zile' : `${p} de zile`}
            </button>
          ))}
        </div>

        {stats ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="Media pe zi" value={`${kcal(stats.avg.kcal)} kcal`} hint={target ? differenceText(stats.avg.kcal - target.kcal) : `din ${stats.logged} zile notate`} />
              <Metric label="Cea mai mare zi" value={`${kcal(stats.highest.n.kcal)} kcal`} hint={shortDate(stats.highest.date)} />
              <Metric label="Cea mai mică zi" value={`${kcal(stats.lowest.n.kcal)} kcal`} hint={shortDate(stats.lowest.date)} />
              <Metric
                label="Zile în țintă (±10%)"
                value={stats.inTarget != null ? `${stats.inTarget} din ${stats.logged}` : '—'}
                hint={stats.inTarget != null ? `${Math.round((stats.inTarget / stats.logged) * 100)}% din zilele notate` : 'setează-ți țintele în Profil'}
              />
            </div>

            <section className="rounded-2xl border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <h2 className="mr-auto font-semibold">Calorii pe zi</h2>
                <Legend className="bg-primary" label="în țintă sau sub" />
                <Legend className="bg-kcal" label="peste țintă" />
              </div>
              <KcalBars days={days} target={target?.kcal ?? null} />
            </section>
          </>
        ) : (
          <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            Nu ai notat nimic în {period === 7 ? 'ultimele 7 zile' : `ultimele ${period} de zile`}. Când notezi mese în Azi, aici apar media, zilele cele mai mari și cele mai mici.
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
  if (!profile) return null
  const progress = goalProgress(profile, weights, today())

  if (!progress) {
    return (
      <Link to="/profile" className="flex items-center gap-3 rounded-2xl border border-dashed bg-card p-4 text-sm transition-colors hover:bg-muted">
        <Target className="size-5 shrink-0 text-primary" />
        <span className="flex-1">
          {profile.goal === 'maintain'
            ? 'Obiectivul tău e menținerea. Dacă vrei să slăbești sau să pui masă, alege în Profil greutatea țintă și ritmul.'
            : 'Alege în Profil o greutate țintă și un ritm, ca să vezi aici cât mai ai și când ajungi.'}
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
          <Target className="size-4 text-muted-foreground" /> Obiectiv: {kg(progress.goal)}
        </h2>
        <Link to="/profile" className="text-sm font-medium text-primary hover:underline">
          Schimbă
        </Link>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{kg(progress.start)}</span>
        <span className="font-semibold tabular-nums">
          {Math.abs(change) < 0.05 ? '' : change < 0 ? '−' : '+'}
          {kg(Math.abs(change))} din {kg(progress.total)} · {Math.round(progress.fraction * 100)}%
        </span>
        <span className="text-muted-foreground">{kg(progress.goal)}</span>
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.fraction * 100}%` }} />
      </div>

      {progress.reached ? (
        <p className="mt-3 text-sm">
          Ai ajuns la {kg(progress.goal)}. Treci pe <strong>Menținere</strong> în Profil, ca ținta de calorii să nu mai scadă.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm">
            Acum: <strong>{kg(progress.current)}</strong>. Mai ai {kg(progress.remaining)}.
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
            {progress.plannedEnd && (
              <li>
                Cu ritmul ales, {perWeek(progress.plannedRate)}, ajungi pe {longDate(progress.plannedEnd)}.
              </li>
            )}
            <li>
              {progress.actualRate == null
                ? 'Ritmul tău real apare după două săptămâni de cântăriri.'
                : progress.actualEnd
                  ? `Ritmul tău real, după media pe 7 zile, e ${perWeek(progress.actualRate)}: ajungi pe ${longDate(progress.actualEnd)}.`
                  : `În ultimele săptămâni, media s-a mișcat în direcția opusă, cu ${perWeek(Math.abs(progress.actualRate))}.`}
            </li>
          </ul>
        </>
      )}
    </section>
  )
}

function differenceText(difference: number) {
  if (Math.abs(difference) < 1) return 'exact pe țintă'
  return difference < 0 ? `${kcal(-difference)} sub țintă` : `${kcal(difference)} peste țintă`
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
  { key: 'proteinG', label: 'Proteine', unit: 'g', color: 'bg-protein' },
  { key: 'carbsG', label: 'Carbohidrați', unit: 'g', color: 'bg-carbs' },
  { key: 'fatG', label: 'Grăsimi', unit: 'g', color: 'bg-fat' },
  { key: 'fiberG', label: 'Fibre', unit: 'g', color: 'bg-fiber' },
  { key: 'sodiumMg', label: 'Sodiu', unit: 'mg', color: 'bg-sodium' },
] as const

function MacroAverages({ avg, target, proteinDays, logged }: { avg: Nutrients; target: Partial<Nutrients> | null; proteinDays: number | null; logged: number }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-3 font-semibold">Macro, media pe zi</h2>
      <div className="space-y-3">
        {macroRows.map((row) => {
          const goal = target?.[row.key]
          return (
            <div key={row.key} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
              <span className="text-muted-foreground">{row.label}</span>
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
        <p className="mt-3 text-xs text-muted-foreground">
          Proteina atinsă în {proteinDays} din {logged} zile.
        </p>
      )}
    </section>
  )
}

function GlycemicCard({ share }: { share: ReturnType<typeof carbsByGlycemicGrade> }) {
  const total = share.A + share.B + share.C + share.unknown
  const parts = [
    { key: 'A', value: share.A, color: 'bg-grade-a', label: 'Glicemic A' },
    { key: 'B', value: share.B, color: 'bg-grade-b', label: 'Glicemic B' },
    { key: 'C', value: share.C, color: 'bg-grade-c', label: 'Glicemic C' },
    { key: 'unknown', value: share.unknown, color: 'bg-muted-foreground/40', label: 'fără notă' },
  ].filter((p) => p.value > 0)

  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Droplet className="size-4 text-muted-foreground" /> De unde vin carbohidrații
      </h2>
      {total === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Niciun carbohidrat notat în perioada asta.</p>
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
            <p className="mt-3 text-xs text-muted-foreground">
              Cei mai mulți carbohidrați C au venit din: {share.topC.map((c) => `${c.name} (${num(c.carbsG)} g)`).join(', ')}.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function StreakCard({ loggedDates, end }: { loggedDates: Set<string>; end: string }) {
  const count = streak(loggedDates, end)
  const lastDays = dateRange(end, 30)
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Flame className="size-4 text-muted-foreground" /> Zile notate
        </h2>
        <span className="text-sm font-medium text-primary">{count === 1 ? '1 zi la rând' : `${count} zile la rând`}</span>
      </div>
      <div className="mt-3 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1">
        {lastDays.map((date) => (
          <span key={date} title={shortDate(date)} className={cn('aspect-square rounded-[3px] border', loggedDates.has(date) ? 'border-primary bg-primary' : 'bg-muted/50')} />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Ultimele 30 de zile; verde = ai notat ceva în ziua aceea.</p>
    </section>
  )
}

function WeightCard({ dates, weights, profile, period }: { dates: string[]; weights: WeightEntry[]; profile: UserProfile | undefined; period: Period }) {
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
    toast.success(`Țintele sunt recalculate pentru ${kg(roundedCurrent)}: ${kcal(newTargets.kcal)} kcal pe zi.`)
  }

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Weight className="size-4 text-muted-foreground" /> Greutate
        </h2>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Notează
        </Button>
      </div>

      {current == null ? (
        <p className="mt-2 text-sm text-muted-foreground">Notează prima cântărire. Cântărește-te dimineața, înainte să mănânci, ca valorile să se poată compara.</p>
      ) : (
        <>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{kg(current)}</div>
          <p className="text-xs text-muted-foreground">
            {change != null
              ? `${change <= 0 ? '−' : '+'}${kg(Math.abs(change))} în ${period === 7 ? '7 zile' : `${period} de zile`}, după media pe 7 zile`
              : 'media pe 7 zile; apare și schimbarea după a doua cântărire'}
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
            Țintele sunt calculate pentru {kg(profile.weightKg)}. Media ta e acum {kg(roundedCurrent)}: {kcal(newTargets.kcal)} kcal în loc de {kcal(profile.targetKcal ?? 0)}.
          </p>
          <Button size="sm" onClick={() => void updateTargets()}>
            <RefreshCw className="size-4" /> Recalculează
          </Button>
        </div>
      )}

      {recent.length > 0 && (
        <ul className="mt-3 divide-y border-t text-sm">
          {recent.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 py-1.5">
              <span className="flex-1 text-muted-foreground">{shortDate(entry.date)}</span>
              <span className="font-medium tabular-nums">{kg(entry.weightKg)}</span>
              <Button variant="ghost" size="icon-sm" aria-label={`Șterge cântărirea din ${shortDate(entry.date)}`} onClick={() => void deleteRow('weightEntries', entry.id)}>
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
          toast.success(`${kg(weightKg)} notat pentru ${shortDate(date)}.`)
        }}
      />
    </section>
  )
}

function WeightDrawer({ open, onClose, initial, onSave }: { open: boolean; onClose: () => void; initial: number; onSave: (date: string, weightKg: number) => Promise<void> }) {
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
          <DrawerTitle>Notează greutatea</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-4 p-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Ziua</span>
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} className="h-10" />
          </label>
          <div className="space-y-1.5">
            <span className="block text-sm font-medium">Greutatea</span>
            <NumberStepper value={weight} onChange={setWeight} step={0.1} min={20} max={400} unit="kg" className="w-full" label="kilograme" />
          </div>
          <Button
            size="lg"
            className="h-12 w-full text-base"
            onClick={() => {
              void onSave(date, weight)
              onClose()
            }}
          >
            Salvează
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
