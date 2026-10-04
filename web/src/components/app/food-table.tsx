import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ArrowUpDown, Refrigerator } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Food } from '@/api/types'
import { useOwnerId } from '@/hooks/use-owner'
import { categoryLabel } from '@/lib/categories'
import { kcal, num } from '@/lib/format'
import { foodGrades } from '@/lib/nutrition'
import { togglePantry } from '@/lib/pantry'
import { cn } from '@/lib/utils'
import { GlycemicBadge, ProteinBadge, VolumeBadge } from './badges'
import { Photo } from './photo'
import { foodName } from '@/lib/food-name'
import { locale } from '@/i18n'

type NutrientKey = 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'sodiumMg'
type SortKey = 'name' | NutrientKey | 'glycemic' | 'protein' | 'volume'
type Sort = { key: SortKey; dir: 'asc' | 'desc' }

const nutrientColumns = [
  { key: 'kcal', label: 'nutrients.kcal', unit: 'kcal', dot: 'bg-kcal', wide: false },
  { key: 'proteinG', label: 'nutrients.protein', unit: 'g', dot: 'bg-protein', wide: false },
  { key: 'carbsG', label: 'foods.table.carbs', unit: 'g', dot: 'bg-carbs', wide: false },
  { key: 'fatG', label: 'nutrients.fat', unit: 'g', dot: 'bg-fat', wide: false },
  { key: 'fiberG', label: 'nutrients.fiber', unit: 'g', dot: 'bg-fiber', wide: true },
  { key: 'sodiumMg', label: 'nutrients.sodium', unit: 'mg', dot: 'bg-sodium', wide: true },
] as const satisfies readonly { key: NutrientKey; label: string; unit: string; dot: string; wide: boolean }[]

const ascendingFirst: SortKey[] = ['name', 'glycemic', 'protein', 'volume']

function sortValue(food: Food, key: SortKey) {
  if (key === 'name') return foodName(food)
  if (key === 'glycemic' || key === 'protein' || key === 'volume') return foodGrades(food)[key]
  return food[key]
}

function compareFoods({ key, dir }: Sort) {
  return (a: Food, b: Food) => {
    const x = sortValue(a, key)
    const y = sortValue(b, key)
    if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1
    const order = typeof x === 'string' ? x.localeCompare(String(y), locale()) : x - Number(y)
    return dir === 'asc' ? order : -order
  }
}

export function FoodTable({ foods, pantry }: { foods: Food[]; pantry: Set<string> }) {
  const { t } = useTranslation()
  const ownerId = useOwnerId()
  const navigate = useNavigate()
  const [sort, setSort] = useState<Sort | null>(null)

  const rows = useMemo(() => (sort ? [...foods].sort(compareFoods(sort)) : foods), [foods, sort])

  function toggleSort(key: SortKey) {
    const first = ascendingFirst.includes(key) ? 'asc' : 'desc'
    setSort((current) => {
      if (current?.key !== key) return { key, dir: first }
      if (current.dir === first) return { key, dir: first === 'asc' ? 'desc' : 'asc' }
      return null
    })
  }

  function header(key: SortKey, label: string, extra?: ReactNode) {
    const active = sort?.key === key
    const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={cn(
          'group/sort inline-flex items-center gap-1 rounded-md py-1 text-xs font-medium whitespace-nowrap transition-colors hover:text-foreground',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {extra}
        {label}
        <Icon className={cn('size-3.5', !active && 'invisible opacity-50 group-hover/sort:visible')} />
      </button>
    )
  }

  const th = 'sticky top-14 z-10 border-b bg-card px-3 py-2 font-normal'

  return (
    <div className="rounded-2xl border bg-card">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className={cn(th, 'w-10 rounded-tl-2xl pr-0')}>
              <span className="sr-only">{t('foods.table.pantry')}</span>
            </th>
            <th className={cn(th, 'text-left lg:w-[30%]')}>{header('name', t('foods.table.food'))}</th>
            {nutrientColumns.map((c) => (
              <th key={c.key} className={cn(th, 'px-2 text-right', c.wide && 'hidden min-[88rem]:table-cell')}>
                {header(c.key, t(c.label), <span className={cn('size-1.5 rounded-full', c.dot)} />)}
                <div className="pr-[1.125rem] text-[11px] text-muted-foreground/70">{c.unit}</div>
              </th>
            ))}
            <th className={cn(th, 'w-20 text-center')}>{header('glycemic', t('foods.glycemic'))}</th>
            <th className={cn(th, 'w-20 text-center')}>{header('protein', t('grades.protein.label'))}</th>
            <th className={cn(th, 'w-20 rounded-tr-2xl text-center')}>{header('volume', t('grades.volume.label'))}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((food) => {
            const inPantry = pantry.has(food.id)
            const grades = foodGrades(food)
            return (
              <tr
                key={food.id}
                onClick={() => void navigate({ to: '/foods/$foodId', params: { foodId: food.id } })}
                className="group cursor-pointer transition-colors hover:bg-muted/60 [&>td]:border-b [&>td]:border-border/60 last:[&>td]:border-b-0"
              >
                <td className="py-2 pr-0 pl-3">
                  <button
                    type="button"
                    aria-label={inPantry ? t('foods.pantry.removeNamed', { name: foodName(food) }) : t('foods.pantry.addNamed', { name: foodName(food) })}
                    title={inPantry ? t('foods.pantry.inPantry') : t('foods.pantry.add')}
                    aria-pressed={inPantry}
                    onClick={(e) => {
                      e.stopPropagation()
                      void togglePantry(food.id, inPantry, ownerId)
                    }}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-md transition-colors hover:bg-muted',
                      inPantry ? 'bg-primary/15 text-primary' : 'text-muted-foreground/40 hover:text-primary',
                    )}
                  >
                    <Refrigerator className="size-4" />
                  </button>
                </td>
                <td className="px-3 py-2">
                  <Link
                    to="/foods/$foodId"
                    params={{ foodId: food.id }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex min-w-0 items-center gap-3 outline-none focus-visible:underline"
                  >
                    <Photo id={food.photoId} className="size-9 shrink-0 rounded-lg" fallback={<span className="text-xs font-semibold">{foodName(food).slice(0, 1)}</span>} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{foodName(food)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[food.brand, categoryLabel(food.category), food.kitchenId != null ? t('foods.origin.kitchenShort') : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </Link>
                </td>
                {nutrientColumns.map((c) => {
                  const estimated = food.estimatedFields.includes(c.key)
                  const value = food[c.key]
                  return (
                    <td
                      key={c.key}
                      title={estimated ? t('foods.table.estimatedByAi') : undefined}
                      className={cn('py-2 pr-[1.625rem] pl-2 text-right tabular-nums', c.key === 'kcal' && 'font-semibold', estimated && 'text-kcal', c.wide && 'hidden min-[88rem]:table-cell')}
                    >
                      {c.key === 'kcal' || c.key === 'sodiumMg' ? kcal(value) : num(value)}
                    </td>
                  )
                })}
                <td className="px-3 py-2 text-center">
                  {grades.glycemic ? <GlycemicBadge grade={grades.glycemic} /> : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  {grades.protein ? <ProteinBadge grade={grades.protein} /> : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  {grades.volume ? <VolumeBadge grade={grades.volume} /> : <span className="text-muted-foreground">—</span>}
                </td>

              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="flex justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
        <span>{t('foods.table.count', { count: rows.length })}</span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-kcal" /> {t('foods.table.legend')}
        </span>
      </div>
    </div>
  )
}
