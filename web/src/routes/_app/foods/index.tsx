import { createFileRoute, Link } from '@tanstack/react-router'
import { Droplet, Plus, Search, Star, Weight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GlycemicBadge, WeightLossBadge } from '@/components/app/badges'
import { FoodTable } from '@/components/app/food-table'
import { PageHeader } from '@/components/app/page-header'
import { Photo } from '@/components/app/photo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useExclusions, useFoods, useProfile } from '@/hooks/use-data'
import { useDesktop } from '@/hooks/use-desktop'
import { categories, categoryCodes, categoryLabel } from '@/lib/categories'
import { kcal, num } from '@/lib/format'
import { isExcluded } from '@/lib/nutrition'
import { search } from '@/lib/search'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/foods/')({
  component: FoodsPage,
})

type Filter = { category: string | null; favorites: boolean; glycemic: string | null; weightLoss: string | null }

function FoodsPage() {
  const foods = useFoods()
  const profile = useProfile()
  const exclusions = useExclusions()
  const desktop = useDesktop()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>({ category: null, favorites: false, glycemic: null, weightLoss: null })

  const favorites = useMemo(() => new Set(profile?.favoriteFoodIds ?? []), [profile])

  const visible = useMemo(() => {
    const filtered = foods.filter(
      (f) =>
        !isExcluded(f, exclusions) &&
        (!filter.category || f.category === filter.category) &&
        (!filter.favorites || favorites.has(f.id)) &&
        (!filter.glycemic || f.glycemicGrade === filter.glycemic) &&
        (!filter.weightLoss || f.weightLossGrade === filter.weightLoss),
    )
    return search(filtered, query, (f) => `${f.name} ${f.brand ?? ''}`)
  }, [foods, exclusions, filter, favorites, query])

  const usedCategories = useMemo(() => categoryCodes.filter((c) => foods.some((f) => f.category === c && !isExcluded(f, exclusions))), [foods, exclusions])

  return (
    <>
      <PageHeader
        title="Alimente"
        subtitle={`${visible.length} din ${foods.length}`}
        actions={
          <Button size="sm" render={<Link to="/foods/new" />}>
            <Plus className="size-4" /> Adaugă
          </Button>
        }
      />
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 border-b border-border/60 bg-background/90 backdrop-blur-md lg:static lg:border-b-0">
        <div className="mx-auto max-w-2xl space-y-2 px-4 py-2 lg:mx-0 lg:max-w-6xl lg:px-8">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caută (merge și fără diacritice)" className="h-10 pl-9" />
          </div>
          <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
            <Chip active={filter.favorites} onClick={() => setFilter((f) => ({ ...f, favorites: !f.favorites }))}>
              <Star className="size-3.5" /> Favorite
            </Chip>
            {['A', 'B', 'C'].map((g) => (
              <Chip key={`glycemic-${g}`} active={filter.glycemic === g} onClick={() => setFilter((f) => ({ ...f, glycemic: f.glycemic === g ? null : g }))}>
                <Droplet className="size-3.5" /> Glicemic {g}
              </Chip>
            ))}
            {['A', 'B', 'C'].map((g) => (
              <Chip key={`weight-loss-${g}`} active={filter.weightLoss === g} onClick={() => setFilter((f) => ({ ...f, weightLoss: f.weightLoss === g ? null : g }))}>
                <Weight className="size-3.5" /> Slăbit {g}
              </Chip>
            ))}
            {usedCategories.map((c) => (
              <Chip key={c} active={filter.category === c} onClick={() => setFilter((f) => ({ ...f, category: f.category === c ? null : c }))}>
                {categories[c]}
              </Chip>
            ))}
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-2xl px-2 pt-1 lg:mx-0 lg:max-w-6xl lg:px-8 lg:pt-2 lg:pb-8">
        {desktop ? (
          visible.length > 0 && <FoodTable foods={visible} favorites={favorites} profile={profile} />
        ) : (
          <ul>
            {visible.map((food) => (
              <li key={food.id}>
                <Link to="/foods/$foodId" params={{ foodId: food.id }} className="flex items-center gap-3 rounded-xl px-2 py-2.5 active:bg-muted">
                  <Photo id={food.photoId} className="size-11 shrink-0 rounded-lg" fallback={<span className="text-sm font-semibold">{food.name.slice(0, 1)}</span>} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {favorites.has(food.id) && <Star className="size-3.5 shrink-0 fill-carbs text-carbs" />}
                      <span className="truncate">{food.name}</span>
                      {food.brand && <span className="truncate text-muted-foreground">· {food.brand}</span>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground tabular-nums">
                      {kcal(food.kcal)} kcal · P {num(food.proteinG)} · C {num(food.carbsG)} · G {num(food.fatG)} · {categoryLabel(food.category)}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <GlycemicBadge grade={food.glycemicGrade} />
                    <WeightLossBadge grade={food.weightLossGrade} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {visible.length === 0 && (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            {foods.length === 0 ? 'Baza e goală. Adaugă primul aliment.' : 'Nimic pentru filtrele alese.'}
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
