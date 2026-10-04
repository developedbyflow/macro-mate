import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Ban, ChefHat, ChevronRight, Clock, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { GradeBadges } from '@/components/app/badges'
import { ConfirmDelete } from '@/components/app/confirm-delete'
import { MacroLine } from '@/components/app/nutrients'
import { PageHeader } from '@/components/app/page-header'
import { Photo } from '@/components/app/photo'
import { difficultyLabel, recipeSteps } from '@/lib/recipes'
import { Button } from '@/components/ui/button'
import { deleteRow } from '@/db/mutations'
import { useFoodsById, useProfile, useRecipe, useRecipeVariants, useUsersById } from '@/hooks/use-data'
import { servings } from '@/lib/format'
import { variantGrades, variantTotals } from '@/lib/nutrition'
import { inProfile, toggleInProfile } from '@/lib/profile'
import { cn } from '@/lib/utils'
import { foodName } from '@/lib/food-name'

export const Route = createFileRoute('/_app/recipes/$recipeId/')({
  component: RecipePage,
})

function RecipePage() {
  const { t } = useTranslation()
  const { recipeId } = Route.useParams()
  const navigate = useNavigate()
  const recipe = useRecipe(recipeId)
  const variants = useRecipeVariants(recipeId)
  const foods = useFoodsById()
  const profile = useProfile()
  const users = useUsersById()

  if (!recipe) return <PageHeader title={t('fallback.recipe')} back />
  if (recipe.deletedAt) {
    return (
      <>
        <PageHeader title={recipe.name} back />
        <p className="p-8 text-center text-sm text-muted-foreground">{t('recipes.detail.deleted')}</p>
      </>
    )
  }

  const favorite = inProfile(profile, 'favoriteRecipeIds', recipe.id)
  const excluded = inProfile(profile, 'excludedRecipeIds', recipe.id)
  const steps = recipeSteps(recipe.instructions)

  return (
    <>
      <PageHeader
        title={recipe.name}
        back
        actions={
          <>
            <Button variant="ghost" size="icon" aria-label={favorite ? t('recipes.detail.removeFavorite') : t('recipes.detail.addFavorite')} onClick={() => void toggleInProfile(profile, 'favoriteRecipeIds', recipe.id)}>
              <Star className={cn('size-5', favorite && 'fill-carbs text-carbs')} />
            </Button>
            <Button variant="ghost" size="icon" aria-label={t('recipes.detail.edit')} nativeButton={false} render={<Link to="/recipes/$recipeId/edit" params={{ recipeId }} />}>
              <Pencil className="size-5" />
            </Button>
          </>
        }
      />
      <main className="mx-auto max-w-2xl space-y-5 px-4 pt-4 pb-8 lg:mx-0 lg:grid lg:max-w-none lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0 lg:px-8">
        <div className="space-y-5">
          {recipe.photoId ? <Photo id={recipe.photoId} className="aspect-[16/9] w-full rounded-2xl" /> : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {recipe.prepTimeMin != null && (
              <span className="flex items-center gap-1">
                <Clock className="size-4" /> {t('recipes.prepTime', { value: recipe.prepTimeMin })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <ChefHat className="size-4" /> {difficultyLabel(recipe.difficulty)}
            </span>
            <span>{t('recipes.detail.by', { name: users.get(recipe.createdBy) ?? '—' })}</span>
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{t('recipes.detail.variants')}</h2>
              <Button size="sm" variant="secondary" nativeButton={false} render={<Link to="/recipes/$recipeId/variants/$variantId" params={{ recipeId, variantId: 'new' }} />}>
                <Plus className="size-4" /> {t('recipes.detail.addVariant')}
              </Button>
            </div>
            {variants.length === 0 && (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                {t('recipes.detail.noVariants')}
              </p>
            )}
            <ul className="space-y-2">
              {variants.map((variant) => {
                const totals = variantTotals(variant, foods)
                const scores = variantGrades(variant, foods)
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
                          {t('recipes.detail.perServing')} · {servings(variant.servings)} · {t('recipes.detail.gramsPerServing', { grams: Math.round(totals.gramsPerServing) })}
                        </div>
                      </div>
                      <GradeBadges grades={scores} />
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
            <h2 className="font-semibold">{t('recipes.ingredients')}</h2>
            <ul className="flex flex-wrap gap-1.5">
              {recipe.ingredientFoodIds.map((id) => (
                <li key={id} className="rounded-full bg-muted px-3 py-1 text-sm">
                  {foodName(foods.get(id)) ?? t('fallback.deletedFood')}
                </li>
              ))}
              {recipe.ingredientFoodIds.length === 0 && <li className="text-sm text-muted-foreground">{t('recipes.detail.noIngredients')}</li>}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">{t('recipes.instructions')}</h2>
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
              <p className="text-sm text-muted-foreground">{t('recipes.detail.notWritten')}</p>
            )}
          </section>

          <div className="flex flex-col gap-1 border-t pt-4">
            <Button
              variant="ghost"
              className={cn(excluded && 'text-destructive')}
              onClick={() => {
                void toggleInProfile(profile, 'excludedRecipeIds', recipe.id)
                toast(excluded ? t('recipes.detail.unexcludedToast') : t('recipes.detail.excludedToast'))
              }}
            >
              <Ban className="size-4" /> {excluded ? t('recipes.detail.excludedUndo') : t('recipes.detail.exclude')}
            </Button>
            <ConfirmDelete
              title={t('recipes.detail.deleteTitle', { name: recipe.name })}
              description={t('recipes.detail.deleteDescription')}
              onConfirm={async () => {
                for (const v of variants) await deleteRow('recipeVariants', v.id)
                await deleteRow('recipes', recipe.id)
                await navigate({ to: '/recipes' })
              }}
              trigger={
                <Button variant="ghost" className="text-destructive">
                  <Trash2 className="size-4" /> {t('recipes.detail.delete')}
                </Button>
              }
            />
          </div>
        </div>
      </main>
    </>
  )
}
