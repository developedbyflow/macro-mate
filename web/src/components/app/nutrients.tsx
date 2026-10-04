import { grams, kcal, mg, num } from '@/lib/format'
import type { Nutrients } from '@/lib/nutrition'
import { cn } from '@/lib/utils'

export function MacroLine({ n, className }: { n: Nutrients; className?: string }) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground tabular-nums', className)}>
      <span className="font-semibold text-foreground">{kcal(n.kcal)} kcal</span>
      <span>
        <span className="text-protein">P</span> {num(n.proteinG)}
      </span>
      <span>
        <span className="text-carbs">C</span> {num(n.carbsG)}
      </span>
      <span>
        <span className="text-fat">G</span> {num(n.fatG)}
      </span>
    </span>
  )
}

const rows = [
  { key: 'kcal', label: 'Calorii', format: (v: number) => `${kcal(v)} kcal`, color: 'bg-kcal' },
  { key: 'proteinG', label: 'Proteine', format: grams, color: 'bg-protein' },
  { key: 'carbsG', label: 'Carbohidrați', format: grams, color: 'bg-carbs' },
  { key: 'fatG', label: 'Grăsimi', format: grams, color: 'bg-fat' },
  { key: 'fiberG', label: 'Fibre', format: grams, color: 'bg-fiber' },
  { key: 'sodiumMg', label: 'Sodiu', format: mg, color: 'bg-sodium' },
] as const

export function NutrientTable({ n, estimated = [], caption }: { n: Nutrients; estimated?: string[]; caption?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {caption && <div className="border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">{caption}</div>}
      <dl className="divide-y">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className={cn('size-2 rounded-full', row.color)} />
            <dt className="flex-1 text-muted-foreground">
              {row.label}
              {estimated.includes(row.key) && <span className="ml-2 text-[10px] font-semibold text-kcal uppercase">estimat</span>}
            </dt>
            <dd className="font-medium tabular-nums">{row.format(n[row.key])}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

type Target = Partial<Nutrients>

export function MacroProgress({
  label,
  eaten,
  target,
  unit,
  color,
  limit = false,
}: {
  label: string
  eaten: number
  target: number | undefined
  unit: string
  color: string
  limit?: boolean
}) {
  const pct = target ? Math.min(100, (eaten / target) * 100) : 0
  const over = target != null && eaten > target
  const left = target != null ? target - eaten : null
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {num(eaten)}
          {target != null && ` / ${num(target)}`} {unit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-[width]', over && limit ? 'bg-destructive' : color)} style={{ width: `${pct}%` }} />
      </div>
      {left != null && (
        <div className={cn('text-[11px] tabular-nums', over ? (limit ? 'text-destructive' : 'text-kcal') : 'text-muted-foreground')}>
          {over ? `${num(-left)} ${unit} peste` : limit ? `mai ai voie ${num(left)} ${unit}` : `mai ai ${num(left)} ${unit}`}
        </div>
      )}
    </div>
  )
}

export function DaySummary({ eaten, target }: { eaten: Nutrients; target: Target | null }) {
  const kcalTarget = target?.kcal
  const left = kcalTarget != null ? kcalTarget - eaten.kcal : null
  const pct = kcalTarget ? Math.min(1, eaten.kcal / kcalTarget) : 0
  const circumference = 2 * Math.PI * 42

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-xs">
      <div className="flex items-center gap-4">
        <div className="relative size-28 shrink-0">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" className="stroke-muted" strokeWidth="9" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
              className={cn('transition-[stroke-dashoffset] duration-500', left != null && left < 0 ? 'stroke-destructive' : 'stroke-kcal')}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - pct)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {left != null ? (
              <>
                <span className="text-2xl leading-none font-bold tabular-nums">{kcal(Math.abs(left))}</span>
                <span className="mt-1 text-[11px] text-muted-foreground">{left >= 0 ? 'kcal rămase' : 'kcal peste'}</span>
              </>
            ) : (
              <>
                <span className="text-2xl leading-none font-bold tabular-nums">{kcal(eaten.kcal)}</span>
                <span className="mt-1 text-[11px] text-muted-foreground">kcal</span>
              </>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          <MacroProgress label="Proteine" eaten={eaten.proteinG} target={target?.proteinG} unit="g" color="bg-protein" />
          <MacroProgress label="Carbohidrați" eaten={eaten.carbsG} target={target?.carbsG} unit="g" color="bg-carbs" />
          <MacroProgress label="Grăsimi" eaten={eaten.fatG} target={target?.fatG} unit="g" color="bg-fat" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-3">
        <MacroProgress label="Fibre" eaten={eaten.fiberG} target={target?.fiberG} unit="g" color="bg-fiber" />
        <MacroProgress label="Sodiu" eaten={eaten.sodiumMg} target={target?.sodiumMg} unit="mg" color="bg-sodium" limit />
      </div>
      {kcalTarget != null && (
        <p className="mt-3 text-center text-xs text-muted-foreground tabular-nums">
          {kcal(eaten.kcal)} din {kcal(kcalTarget)} kcal
        </p>
      )}
    </section>
  )
}
