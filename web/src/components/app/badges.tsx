import { Droplet, Dumbbell, Salad } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Grades } from '@/lib/nutrition'
import { cn } from '@/lib/utils'

const gradeTone = {
  A: 'bg-grade-a/15 text-grade-a ring-grade-a/30',
  B: 'bg-grade-b/15 text-[color-mix(in_oklch,var(--grade-b),black_25%)] ring-grade-b/40 dark:text-grade-b',
  C: 'bg-grade-c/15 text-grade-c ring-grade-c/30',
} as const

const grades = {
  glycemic: Droplet,
  protein: Dumbbell,
  volume: Salad,
} as const

function GradeBadge({ kind, grade, className }: { kind: keyof typeof grades; grade: string | null | undefined; className?: string }) {
  const { t } = useTranslation()
  if (!grade) return null
  const key = (grade in gradeTone ? grade : 'B') as keyof typeof gradeTone
  const Icon = grades[kind]
  return (
    <span
      title={t('grades.title', { label: t(`grades.${kind}.label`), grade, meaning: t(`grades.${kind}.${key}`) })}
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

export function ProteinBadge(props: { grade: string | null | undefined; className?: string }) {
  return <GradeBadge kind="protein" {...props} />
}

export function VolumeBadge(props: { grade: string | null | undefined; className?: string }) {
  return <GradeBadge kind="volume" {...props} />
}

export function GradeBadges({ grades }: { grades: Grades | null }) {
  if (!grades) return null
  return (
    <>
      <GlycemicBadge grade={grades.glycemic} />
      <ProteinBadge grade={grades.protein} />
      <VolumeBadge grade={grades.volume} />
    </>
  )
}

export function EstimatedBadge() {
  const { t } = useTranslation()
  return <span className="rounded bg-kcal/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-kcal uppercase">{t('common.estimated')}</span>
}
