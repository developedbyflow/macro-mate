import { createFileRoute, Link } from '@tanstack/react-router'
import { Clock, Plus, Search, Sparkles, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GradeBadges } from '@/components/app/badges'
import { PageHeader } from '@/components/app/page-header'
import { Photo } from '@/components/app/photo'
import { difficultyLabel } from '@/lib/recipes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useExclusions, useFoodsById, useProfile, useRecipes, useVariants } from '@/hooks/use-data'
import { kcal } from '@/lib/format'
import { variantGrades, variantTotals } from '@/lib/nutrition'
import { search } from '@/lib/search'
import { cn } from '@/lib/utils'
import { ChefHat } from 'lucide-react'

export const Route = createFileRoute('/_app/recipes/')({
  component: RecipesPage,
})

function RecipesPage() {
  const recipes = useRecipes()
  const variants = useVariants()
  const foods = useFoodsById()
  const profile = useProfile()
  const exclusions = useExclusions()
  const [query, setQuery] = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)

  const favorites = useMemo(() => new Set(profile?.favoriteRecipeIds ?? []), [profile])
  const excludedRecipes = useMemo(() => new Set(profile?.excludedRecipeIds ?? []), [profile])

  const rows = useMemo(() => {
    const visible = recipes.filter(
      (r) =>
        !excludedRecipes.has(r.id) &&
        !r.ingredientFoodIds.some((id) => exclusions.foodIds.has(id) || exclusions.categories.has(foods.get(id)?.category ?? '')) &&
        (!onlyFavorites || favorites.has(r.id)),
    )
    return search(visible, query, (r) => r.name).map((recipe) => {
      const own = variants.filter((v) => v.recipeId === recipe.id)
      const perServing = own.map((v) => variantTotals(v, foods).perServing.kcal)
      const scores = own[0] ? variantGrades(own[0], foods) : null
      return { recipe, count: own.length, min: Math.min(...perServing), max: Math.max(...perServing), scores }
    })
  }, [recipes, variants, foods, exclusions, excludedRecipes, favorites, onlyFavorites, query])

  return (
    <>
      <PageHeader
        title="Rețete"
        actions={
          <Button size="sm" variant="secondary" render={<Link to="/recipes/generate" />}>
            <Sparkles className="size-4" /> Generează
          </Button>
        }
      />
      <div className="mx-auto flex max-w-2xl gap-2 px-4 pt-3 lg:mx-0 lg:max-w-6xl lg:px-8">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caută rețete" className="h-10 pl-9" />
        </div>
        <Button
          variant="outline"
          className={cn('size-10', onlyFavorites && 'border-carbs text-carbs')}
          aria-pressed={onlyFavorites}
          aria-label="Doar favorite"
          onClick={() => setOnlyFavorites((v) => !v)}
        >
          <Star className={cn('size-4', onlyFavorites && 'fill-carbs')} />
        </Button>
        <Button className="h-10" render={<Link to="/recipes/new" />}>
          <Plus className="size-4" /> Nouă
        </Button>
      </div>
      <main className="mx-auto grid max-w-2xl gap-3 px-4 pt-3 sm:grid-cols-2 lg:mx-0 lg:max-w-6xl lg:grid-cols-3 lg:gap-4 lg:px-8 lg:pb-8 xl:grid-cols-4">
        {rows.map(({ recipe, count, min, max, scores }) => (
          <Link key={recipe.id} to="/recipes/$recipeId" params={{ recipeId: recipe.id }} className="overflow-hidden rounded-2xl border bg-card shadow-xs transition-colors hover:bg-muted/60 active:bg-muted">
            <Photo id={recipe.photoId} className="aspect-[16/9] w-full" fallback={<ChefHat className="size-8 opacity-30" />} />
            <div className="space-y-1.5 p-3">
              <div className="flex items-start gap-2">
                <h2 className="flex-1 leading-tight font-semibold">{recipe.name}</h2>
                {favorites.has(recipe.id) && <Star className="size-4 shrink-0 fill-carbs text-carbs" />}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {recipe.prepTimeMin != null && (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" /> {recipe.prepTimeMin} min
                  </span>
                )}
                <span>{difficultyLabel(recipe.difficulty)}</span>
                <span>
                  {count === 0 ? 'fără variante' : count === 1 ? `${kcal(min)} kcal / porție` : `${kcal(min)}–${kcal(max)} kcal / porție`}
                </span>
              </div>
              {scores && (
                <div className="flex gap-1">
                  <GradeBadges grades={scores} />
                </div>
              )}
            </div>
          </Link>
        ))}
        {rows.length === 0 && (
          <div className="col-span-full px-6 py-16 text-center text-sm text-muted-foreground">
            {recipes.length === 0 ? 'Nicio rețetă încă. Scrie una sau generează una cu AI.' : 'Nimic pentru căutarea asta.'}
          </div>
        )}
      </main>
    </>
  )
}
