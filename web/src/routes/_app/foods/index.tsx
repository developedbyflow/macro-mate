import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronDown, Droplet, Dumbbell, Plus, Refrigerator, Salad, Search, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GradeBadges } from '@/components/app/badges'
import { FoodTable } from '@/components/app/food-table'
import { PageHeader } from '@/components/app/page-header'
import { Photo } from '@/components/app/photo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useExclusions, useFoods, usePantryFoodIds } from '@/hooks/use-data'
import { useDesktop } from '@/hooks/use-desktop'
import { categoryCodes, categoryLabel } from '@/lib/categories'
import { kcal, num } from '@/lib/format'
import { foodGrades, isExcluded } from '@/lib/nutrition'
import { search } from '@/lib/search'
import { cn } from '@/lib/utils'
import { foodName, foodSearchText } from '@/lib/food-name'

export const Route = createFileRoute('/_app/foods/')({
  component: FoodsPage,
})

type Filter = { category: string | null; glycemic: string | null; protein: string | null; volume: string | null }

function FoodsPage() {
  const { t } = useTranslation()
  const foods = useFoods()
  const exclusions = useExclusions()
  const desktop = useDesktop()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>({ category: null, glycemic: null, protein: null, volume: null })
  const pantry = usePantryFoodIds()
  const [chosenScope, setScope] = useState<'pantry' | 'all' | null>(null)
  const scope = chosenScope ?? (pantry.size > 0 ? 'pantry' : 'all')

  const visible = useMemo(() => {
    const filtered = foods.filter((f) => {
      const grades = foodGrades(f)
      return (
        !isExcluded(f, exclusions) &&
        (!filter.category || f.category === filter.category) &&
        (scope === 'all' || pantry.has(f.id)) &&
        (!filter.glycemic || grades.glycemic === filter.glycemic) &&
        (!filter.protein || grades.protein === filter.protein) &&
        (!filter.volume || grades.volume === filter.volume)
      )
    })
    return search(filtered, query, foodSearchText)
  }, [foods, exclusions, filter, scope, pantry, query])

  const usedCategories = useMemo(() => categoryCodes.filter((c) => foods.some((f) => f.category === c && !isExcluded(f, exclusions))), [foods, exclusions])

  return (
    <>
      <PageHeader
        title={t('nav.foods')}
        subtitle={t('foods.list.shownOfTotal', { shown: visible.length, total: foods.length })}
        actions={
          <Button size="sm" nativeButton={false} render={<Link to="/foods/new" />}>
            <Plus className="size-4" /> {t('common.add')}
          </Button>
        }
      />
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 border-b border-border/60 bg-background/90 backdrop-blur-md lg:static lg:border-b-0">
        <div className="mx-auto max-w-2xl space-y-2 px-4 py-2 lg:mx-0 lg:max-w-none lg:px-8">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('foods.list.search')} className="h-10 pl-9" />
          </div>
          <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
            <div className="flex shrink-0 overflow-hidden rounded-full border text-xs font-medium">
              <button
                type="button"
                onClick={() => setScope('pantry')}
                className={cn('flex items-center gap-1 px-3 py-1', scope === 'pantry' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}
              >
                <Refrigerator className="size-3.5" /> {t('foods.pantry.count', { value: pantry.size })}
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={cn('px-3 py-1', scope === 'all' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}
              >
                {t('foods.list.wholeDatabase')}
              </button>
            </div>
            <GradeSelect icon={Droplet} label={t('foods.glycemic')} value={filter.glycemic} onChange={(glycemic) => setFilter((f) => ({ ...f, glycemic }))} />
            <GradeSelect icon={Dumbbell} label={t('grades.protein.label')} value={filter.protein} onChange={(protein) => setFilter((f) => ({ ...f, protein }))} />
            <GradeSelect icon={Salad} label={t('grades.volume.label')} value={filter.volume} onChange={(volume) => setFilter((f) => ({ ...f, volume }))} />
            {usedCategories.map((c) => (
              <Chip key={c} active={filter.category === c} onClick={() => setFilter((f) => ({ ...f, category: f.category === c ? null : c }))}>
                {categoryLabel(c)}
              </Chip>
            ))}
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-2xl px-2 pt-1 lg:mx-0 lg:max-w-none lg:px-8 lg:pt-2 lg:pb-8">
        {desktop ? (
          visible.length > 0 && <FoodTable foods={visible} pantry={pantry} />
        ) : (
          <ul>
            {visible.map((food) => (
              <li key={food.id}>
                <Link to="/foods/$foodId" params={{ foodId: food.id }} className="flex items-center gap-3 rounded-xl px-2 py-2.5 active:bg-muted">
                  <Photo id={food.photoId} className="size-11 shrink-0 rounded-lg" fallback={<span className="text-sm font-semibold">{foodName(food).slice(0, 1)}</span>} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {pantry.has(food.id) && <Refrigerator className="size-3.5 shrink-0 text-primary" />}
                      <span className="truncate">{foodName(food)}</span>
                      {food.brand && <span className="truncate text-muted-foreground">· {food.brand}</span>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground tabular-nums">
                      {kcal(food.kcal)} kcal · {t('nutrients.proteinShort')} {num(food.proteinG)} · {t('nutrients.carbsShort')} {num(food.carbsG)} · {t('nutrients.fatShort')} {num(food.fatG)} · {categoryLabel(food.category)}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <GradeBadges grades={foodGrades(food)} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {visible.length === 0 && (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            {foods.length === 0 ? t('foods.list.emptyDatabase') : t('foods.list.noResults')}
          </div>
        )}
      </main>
    </>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}

function GradeSelect({ icon: Icon, label, value, onChange }: { icon: LucideIcon; label: string; value: string | null; onChange: (value: string | null) => void }) {
  const { t } = useTranslation()
  return (
    <label
      className={cn(
        'relative flex shrink-0 cursor-pointer items-center gap-1 rounded-full border py-1 pr-6 pl-3 text-xs font-medium whitespace-nowrap transition-colors',
        value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
      )}
    >
      <Icon className="size-3.5" />
      <select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className="cursor-pointer appearance-none bg-transparent outline-none">
        <option value="">{t('foods.list.gradeAll', { label })}</option>
        {['A', 'B', 'C'].map((g) => (
          <option key={g} value={g}>
            {label} {g}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3" />
    </label>
  )
}
