import { shortDate } from '@/lib/dates'
import { kcal, kg } from '@/lib/format'
import type { DayTotal } from '@/lib/progress'
import { cn } from '@/lib/utils'

function axisDates(dates: string[]) {
  if (dates.length <= 2) return dates
  return [dates[0], dates[Math.floor((dates.length - 1) / 2)], dates[dates.length - 1]]
}

export function KcalBars({ days, target }: { days: DayTotal[]; target: number | null }) {
  const top = Math.max(target ?? 0, ...days.map((d) => d.n?.kcal ?? 0)) * 1.1 || 1
  return (
    <div>
      <div className="relative h-44">
        {target != null && (
          <div className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-muted-foreground/70" style={{ bottom: `${(target / top) * 100}%` }}>
            <span className="absolute right-0 bottom-0.5 rounded bg-card/90 px-1 text-[11px] text-muted-foreground tabular-nums">țintă {kcal(target)}</span>
          </div>
        )}
        <div className={cn('flex h-full items-end', days.length > 40 ? 'gap-px' : 'gap-1')}>
          {days.map((day) => {
            const over = target != null && day.n != null && day.n.kcal > target * 1.1
            return (
              <div key={day.date} className="flex h-full min-w-0 flex-1 items-end justify-center" title={`${shortDate(day.date)}: ${day.n ? `${kcal(day.n.kcal)} kcal` : 'nenotat'}`}>
                {day.n ? (
                  <div className={cn('w-full max-w-8 rounded-t-[3px]', over ? 'bg-kcal' : 'bg-primary')} style={{ height: `${(day.n.kcal / top) * 100}%` }} />
                ) : (
                  <div className="h-1 w-full max-w-8 rounded-full bg-muted" />
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        {axisDates(days.map((d) => d.date)).map((date) => (
          <span key={date}>{shortDate(date)}</span>
        ))}
      </div>
    </div>
  )
}

export function WeightChart({ dates, points, average }: { dates: string[]; points: (number | null)[]; average: (number | null)[] }) {
  const values = [...points, ...average].filter((v): v is number => v != null)
  if (values.length === 0) return null
  const low = Math.floor(Math.min(...values) - 0.5)
  const high = Math.ceil(Math.max(...values) + 0.5)
  const x = (i: number) => (dates.length === 1 ? 50 : (i / (dates.length - 1)) * 100)
  const y = (v: number) => ((high - v) / (high - low)) * 100

  const line = average
    .map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
    .filter(Boolean)
    .map((point, i) => `${i === 0 ? 'M' : 'L'}${point}`)
    .join(' ')

  return (
    <div className="flex gap-2">
      <div className="flex flex-col justify-between py-0.5 text-[11px] text-muted-foreground tabular-nums">
        <span>{high}</span>
        <span>{low}</span>
      </div>
      <div className="relative h-32 flex-1">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
          <path d={line} fill="none" className="stroke-protein" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {points.map((v, i) =>
          v == null ? null : (
            <span
              key={dates[i]}
              title={`${shortDate(dates[i])}: ${kg(v)}`}
              className="absolute size-1.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-muted-foreground/60"
              style={{ left: `${x(i)}%`, bottom: `${100 - y(v)}%` }}
            />
          ),
        )}
      </div>
    </div>
  )
}
