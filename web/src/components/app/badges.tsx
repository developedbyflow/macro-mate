import { cn } from '@/lib/utils'

const gradeTone = {
  A: 'bg-grade-a/15 text-grade-a ring-grade-a/30',
  B: 'bg-grade-b/15 text-[color-mix(in_oklch,var(--grade-b),black_25%)] ring-grade-b/40 dark:text-grade-b',
  C: 'bg-grade-c/15 text-grade-c ring-grade-c/30',
} as const

export function GradeBadge({ grade, className }: { grade: string | null | undefined; className?: string }) {
  if (!grade) return null
  const tone = gradeTone[grade as keyof typeof gradeTone] ?? gradeTone.B
  return (
    <span
      title={`Sensibilitate la insulină: ${grade}`}
      className={cn('inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-bold ring-1 ring-inset', tone, className)}
    >
      {grade}
    </span>
  )
}

export function ScoreBadge({ score, className }: { score: number | null | undefined; className?: string }) {
  if (score == null) return null
  const tone = score >= 7 ? gradeTone.A : score >= 4 ? gradeTone.B : gradeTone.C
  return (
    <span
      title={`Scor pentru slăbit: ${score} din 10`}
      className={cn('inline-flex h-6 items-center justify-center gap-0.5 rounded-md px-1.5 text-xs font-semibold ring-1 ring-inset', tone, className)}
    >
      {score}
      <span className="font-normal opacity-70">/10</span>
    </span>
  )
}

export function EstimatedBadge() {
  return <span className="rounded bg-kcal/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-kcal uppercase">estimat</span>
}
