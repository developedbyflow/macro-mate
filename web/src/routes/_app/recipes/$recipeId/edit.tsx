import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/app/page-header'
import { RecipeForm } from '@/components/app/recipe-form'
import type { RecipeDraft } from '@/lib/recipes'
import { saveRow } from '@/db/mutations'
import { useRecipe } from '@/hooks/use-data'
import { useOwnerId } from '@/hooks/use-owner'

export const Route = createFileRoute('/_app/recipes/$recipeId/edit')({
  component: EditRecipePage,
})

function EditRecipePage() {
  const { t } = useTranslation()
  const { recipeId } = Route.useParams()
  const navigate = useNavigate()
  const ownerId = useOwnerId()
  const recipe = useRecipe(recipeId)

  async function save(draft: RecipeDraft) {
    await saveRow('recipes', { id: recipeId, ...draft }, ownerId)
    await navigate({ to: '/recipes/$recipeId', params: { recipeId }, replace: true })
  }

  return (
    <>
      <PageHeader title={t('recipes.edit.title')} back />
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-8 lg:mx-0 lg:max-w-none lg:px-8">{recipe && <RecipeForm initial={recipe} submitLabel={t('common.save')} onSubmit={save} />}</main>
    </>
  )
}
