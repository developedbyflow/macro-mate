import { Droplet, Weight } from 'lucide-react'
import { cn } from '@/lib/utils'

const gradeTone = {
  A: 'bg-grade-a/15 text-grade-a ring-grade-a/30',
  B: 'bg-grade-b/15 text-[color-mix(in_oklch,var(--grade-b),black_25%)] ring-grade-b/40 dark:text-grade-b',
  C: 'bg-grade-c/15 text-grade-c ring-grade-c/30',
} as const

const grades = {
  glycemic: { icon: Droplet, label: 'Impact glicemic', meaning: { A: 'mic', B: 'mediu', C: 'mare' } },
  weightLoss: { icon: Weight, label: 'Slăbit', meaning: { A: 'bun', B: 'mediu', C: 'slab' } },
} as const

function GradeBadge({ kind, grade, className }: { kind: keyof typeof grades; grade: string | null | undefined; className?: string }) {
  if (!grade) return null
  const key = (grade in gradeTone ? grade : 'B') as keyof typeof gradeTone
  const { icon: Icon, label, meaning } = grades[kind]
  return (
    <span
      title={`${label}: ${grade} (${meaning[key]})`}
      className={cn('inline-flex h-6 items-center justify-center gap-0.5 rounded-md px-1.5 text-xs font-bold ring-1 ring-inset', gradeTone[key], className)}
    >
      <Icon className="size-3 opacity-70" />
      {grade}
    </span>
  )
}

export function GlycemicBadge(props: { grade: string | null | undefined; className?: string }) {
  return <GradeBadge kind="glycemic" {...props} />
}

export function WeightLossBadge(props: { grade: string | null | undefined; className?: string }) {
  return <GradeBadge kind="weightLoss" {...props} />
}

export function EstimatedBadge() {
  return <span className="rounded bg-kcal/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-kcal uppercase">estimat</span>
}
