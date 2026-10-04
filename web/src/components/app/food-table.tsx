import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ArrowUpDown, Star } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { Food, UserProfile } from '@/api/types'
import { categoryLabel } from '@/lib/categories'
import { kcal, num } from '@/lib/format'
import { foodGrades } from '@/lib/nutrition'
import { toggleInProfile } from '@/lib/profile'
import { cn } from '@/lib/utils'
import { GlycemicBadge, ProteinBadge, VolumeBadge } from './badges'
import { Photo } from './photo'

type NutrientKey = 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'sodiumMg'
type SortKey = 'name' | 'category' | NutrientKey | 'glycemic' | 'protein' | 'volume'
type Sort = { key: SortKey; dir: 'asc' | 'desc' }

const nutrientColumns: { key: NutrientKey; label: string; unit: string; dot: string; wide?: boolean }[] = [
  { key: 'kcal', label: 'Calorii', unit: 'kcal', dot: 'bg-kcal' },
  { key: 'proteinG', label: 'Proteine', unit: 'g', dot: 'bg-protein' },
  { key: 'carbsG', label: 'Carbo', unit: 'g', dot: 'bg-carbs' },
  { key: 'fatG', label: 'Grăsimi', unit: 'g', dot: 'bg-fat' },
  { key: 'fiberG', label: 'Fibre', unit: 'g', dot: 'bg-fiber', wide: true },
  { key: 'sodiumMg', label: 'Sodiu', unit: 'mg', dot: 'bg-sodium', wide: true },
]

const ascendingFirst: SortKey[] = ['name', 'category', 'glycemic', 'protein', 'volume']

function sortValue(food: Food, key: SortKey) {
  if (key === 'name') return food.name
  if (key === 'category') return categoryLabel(food.category)
  if (key === 'glycemic' || key === 'protein' || key === 'volume') return foodGrades(food)[key]
  return food[key]
}

function compareFoods({ key, dir }: Sort) {
  return (a: Food, b: Food) => {
    const x = sortValue(a, key)
    const y = sortValue(b, key)
    if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1
    const order = typeof x === 'string' ? x.localeCompare(String(y), 'ro') : x - Number(y)
    return dir === 'asc' ? order : -order
  }
}

export function FoodTable({ foods, favorites, profile }: { foods: Food[]; favorites: Set<string>; profile: UserProfile | undefined }) {
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
              <span className="sr-only">Favorit</span>
            </th>
            <th className={cn(th, 'text-left')}>{header('name', 'Aliment')}</th>
            <th className={cn(th, 'hidden text-left 2xl:table-cell')}>{header('category', 'Categorie')}</th>
            {nutrientColumns.map((c) => (
              <th key={c.key} className={cn(th, 'px-2 text-right', c.wide && 'hidden xl:table-cell')}>
                {header(c.key, c.label, <span className={cn('size-1.5 rounded-full', c.dot)} />)}
                <div className="pr-[1.125rem] text-[11px] text-muted-foreground/70">{c.unit}</div>
              </th>
            ))}
            <th className={cn(th, 'w-20 text-center')}>{header('glycemic', 'Glicemic')}</th>
            <th className={cn(th, 'w-20 text-center')}>{header('protein', 'Proteină')}</th>
            <th className={cn(th, 'w-20 rounded-tr-2xl text-center')}>{header('volume', 'Volum')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((food) => {
            const favorite = favorites.has(food.id)
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
                    aria-label={favorite ? `Scoate ${food.name} de la favorite` : `Adaugă ${food.name} la favorite`}
                    aria-pressed={favorite}
                    onClick={(e) => {
                      e.stopPropagation()
                      void toggleInProfile(profile, 'favoriteFoodIds', food.id)
                    }}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted hover:text-carbs"
                  >
                    <Star className={cn('size-4', favorite && 'fill-carbs text-carbs')} />
                  </button>
                </td>
                <td className="px-3 py-2">
                  <Link
                    to="/foods/$foodId"
                    params={{ foodId: food.id }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex min-w-0 items-center gap-3 outline-none focus-visible:underline"
                  >
                    <Photo id={food.photoId} className="size-9 shrink-0 rounded-lg" fallback={<span className="text-xs font-semibold">{food.name.slice(0, 1)}</span>} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{food.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {food.brand ?? <span className="2xl:hidden">{categoryLabel(food.category)}</span>}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="hidden px-3 py-2 whitespace-nowrap text-muted-foreground 2xl:table-cell">{categoryLabel(food.category)}</td>
                {nutrientColumns.map((c) => {
                  const estimated = food.estimatedFields.includes(c.key)
                  const value = food[c.key]
                  return (
                    <td
                      key={c.key}
                      title={estimated ? 'Valoare estimată de AI' : undefined}
                      className={cn('py-2 pr-[1.625rem] pl-2 text-right tabular-nums', c.key === 'kcal' && 'font-semibold', estimated && 'text-kcal', c.wide && 'hidden xl:table-cell')}
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
        <span>
          {rows.length} {rows.length === 1 ? 'aliment' : 'alimente'} · valori la 100 g
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-kcal" /> portocaliu = estimat de AI
        </span>
      </div>
    </div>
  )
}
