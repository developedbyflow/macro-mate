import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

type Props = {
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
  className?: string
  size?: 'sm' | 'md'
  label?: string
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

export function NumberStepper({ value, onChange, step = 1, min = 0, max = 100000, unit, className, size = 'md', label }: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? String(round(value))

  function commit(next: number) {
    const clamped = Math.min(max, Math.max(min, round(next)))
    setDraft(null)
    if (clamped !== value) onChange(clamped)
  }

  const height = size === 'sm' ? 'h-8' : 'h-10'
  const button = cn(
    'flex shrink-0 items-center justify-center text-muted-foreground transition-colors active:bg-muted disabled:opacity-40',
    size === 'sm' ? 'w-8' : 'w-10',
  )

  return (
    <div className={cn('inline-flex items-center overflow-hidden rounded-lg border border-input bg-card', height, className)}>
      <button type="button" className={button} aria-label={t('common.decrease', { label: label ?? '' })} disabled={value <= min} onClick={() => commit(value - step)}>
        <Minus className="size-4" />
      </button>
      <label className="flex min-w-0 flex-1 items-baseline justify-center gap-0.5">
        <input
          inputMode="decimal"
          aria-label={label}
          className="w-full min-w-[3ch] bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
          style={{ width: `${Math.max(3, text.length + 1)}ch` }}
          value={text}
          onChange={(e) => setDraft(e.target.value.replace(',', '.'))}
          onFocus={(e) => {
            setDraft(String(round(value)))
            e.target.select()
          }}
          onBlur={() => {
            const parsed = Number.parseFloat(text)
            if (Number.isFinite(parsed)) commit(parsed)
            else setDraft(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </label>
      <button type="button" className={button} aria-label={t('common.increase', { label: label ?? '' })} disabled={value >= max} onClick={() => commit(value + step)}>
        <Plus className="size-4" />
      </button>
    </div>
  )
}
