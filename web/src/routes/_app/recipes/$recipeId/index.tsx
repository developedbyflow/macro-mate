import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Ban, ChefHat, ChevronRight, Clock, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { GlycemicBadge, WeightLossBadge } from '@/components/app/badges'
import { ConfirmDelete } from '@/components/app/confirm-delete'
import { MacroLine } from '@/components/app/nutrients'
import { PageHeader } from '@/components/app/page-header'
import { Photo } from '@/components/app/photo'
import { difficultyLabel } from '@/lib/recipes'
import { Button } from '@/components/ui/button'
import { deleteRow } from '@/db/mutations'
import { useFoodsById, useProfile, useRecipe, useRecipeVariants, useUsersById } from '@/hooks/use-data'
import { variantScores, variantTotals } from '@/lib/nutrition'
import { inProfile, toggleInProfile } from '@/lib/profile'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/recipes/$recipeId/')({
  component: RecipePage,
})

function RecipePage() {
  const { recipeId } = Route.useParams()
  const navigate = useNavigate()
  const recipe = useRecipe(recipeId)
  const variants = useRecipeVariants(recipeId)
  const foods = useFoodsById()
  const profile = useProfile()
  const users = useUsersById()

  if (!recipe) return <PageHeader title="Rețetă" back />
  if (recipe.deletedAt) {
    return (
      <>
        <PageHeader title={recipe.name} back />
        <p className="p-8 text-center text-sm text-muted-foreground">Rețeta a fost ștearsă.</p>
      </>
    )
  }

  const favorite = inProfile(profile, 'favoriteRecipeIds', recipe.id)
  const excluded = inProfile(profile, 'excludedRecipeIds', recipe.id)
  const steps = recipe.instructions.split('\n').map((s) => s.trim()).filter(Boolean)

  return (
    <>
      <PageHeader
        title={recipe.name}
        back
        actions={
          <>
            <Button variant="ghost" size="icon" aria-label={favorite ? 'Scoate de la favorite' : 'Adaugă la favorite'} onClick={() => void toggleInProfile(profile, 'favoriteRecipeIds', recipe.id)}>
              <Star className={cn('size-5', favorite && 'fill-carbs text-carbs')} />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Editează" render={<Link to="/recipes/$recipeId/edit" params={{ recipeId }} />}>
              <Pencil className="size-5" />
            </Button>
          </>
        }
      />
      <main className="mx-auto max-w-2xl space-y-5 px-4 pt-4 pb-8 lg:mx-0 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0 lg:px-8">
        <div className="space-y-5">
          {recipe.photoId ? <Photo id={recipe.photoId} className="aspect-[16/9] w-full rounded-2xl" /> : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {recipe.prepTimeMin != null && (
              <span className="flex items-center gap-1">
                <Clock className="size-4" /> {recipe.prepTimeMin} min
              </span>
            )}
            <span className="flex items-center gap-1">
              <ChefHat className="size-4" /> {difficultyLabel(recipe.difficulty)}
            </span>
            <span>de {users.get(recipe.createdBy) ?? '—'}</span>
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Variante</h2>
              <Button size="sm" variant="secondary" render={<Link to="/recipes/$recipeId/variants/$variantId" params={{ recipeId, variantId: 'new' }} />}>
                <Plus className="size-4" /> Variantă
              </Button>
            </div>
            {variants.length === 0 && (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Rețeta main n-are cantități. Fă o variantă cu gramaje (ex. „600 kcal”) ca să o poți pune în planuri.
              </p>
            )}
            <ul className="space-y-2">
              {variants.map((variant) => {
                const totals = variantTotals(variant, foods)
                const scores = variantScores(variant, foods)
                return (
                  <li key={variant.id}>
                    <Link
                      to="/recipes/$recipeId/variants/$variantId"
                      params={{ recipeId, variantId: variant.id }}
                      className="flex items-center gap-3 rounded-xl border bg-card p-3 active:bg-muted"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-medium">{variant.name}</div>
                        <MacroLine n={totals.perServing} />
                        <div className="text-xs text-muted-foreground">
                          pe porție · {variant.servings} {variant.servings === 1 ? 'porție' : 'porții'} · {Math.round(totals.gramsPerServing)} g / porție
                        </div>
                      </div>
                      <GlycemicBadge grade={scores.glycemicGrade} />
                      <WeightLossBadge grade={scores.weightLossGrade} />
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <div className="space-y-5">
          <section className="space-y-2">
            <h2 className="font-semibold">Ingrediente</h2>
            <ul className="flex flex-wrap gap-1.5">
              {recipe.ingredientFoodIds.map((id) => (
                <li key={id} className="rounded-full bg-muted px-3 py-1 text-sm">
                  {foods.get(id)?.name ?? 'Aliment șters'}
                </li>
              ))}
              {recipe.ingredientFoodIds.length === 0 && <li className="text-sm text-muted-foreground">Niciun ingredient în lista main.</li>}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Mod de preparare</h2>
            {steps.length > 0 ? (
              <ol className="space-y-2">
                {steps.map((step, index) => (
                  <li key={index} className="flex gap-3 text-sm leading-relaxed">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{index + 1}</span>
                    <span className="pt-0.5">{step.replace(/^\d+[.)]\s*/, '')}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Nescris încă.</p>
            )}
          </section>

          <div className="flex flex-col gap-1 border-t pt-4">
            <Button
              variant="ghost"
              className={cn(excluded && 'text-destructive')}
              onClick={() => {
                void toggleInProfile(profile, 'excludedRecipeIds', recipe.id)
                toast(excluded ? 'Rețeta nu mai e exclusă.' : 'Exclusă: n-o mai vezi în liste.')
              }}
            >
              <Ban className="size-4" /> {excluded ? 'Exclusă pentru mine (anulează)' : 'Exclude pentru mine'}
            </Button>
            <ConfirmDelete
              title={`Ștergi ${recipe.name}?`}
              description="Se șterg rețeta și toate variantele ei, pentru toți."
              onConfirm={async () => {
                for (const v of variants) await deleteRow('recipeVariants', v.id)
                await deleteRow('recipes', recipe.id)
                await navigate({ to: '/recipes' })
              }}
              trigger={
                <Button variant="ghost" className="text-destructive">
                  <Trash2 className="size-4" /> Șterge rețeta
                </Button>
              }
            />
          </div>
        </div>
      </main>
    </>
  )
}
