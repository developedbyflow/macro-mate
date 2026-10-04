import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PageHeader } from '@/components/app/page-header'
import { RecipeForm } from '@/components/app/recipe-form'
import { emptyRecipe, type RecipeDraft } from '@/lib/recipes'
import { newId, saveRow } from '@/db/mutations'
import { useOwnerId } from '@/hooks/use-owner'

export const Route = createFileRoute('/_app/recipes/new')({
  component: NewRecipePage,
})

function NewRecipePage() {
  const navigate = useNavigate()
  const ownerId = useOwnerId()

  async function save(draft: RecipeDraft) {
    const id = newId()
    await saveRow('recipes', { id, ...draft }, ownerId)
    await navigate({ to: '/recipes/$recipeId', params: { recipeId: id }, replace: true })
  }

  return (
    <>
      <PageHeader title="Rețetă nouă" back />
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-8">
        <RecipeForm initial={emptyRecipe()} submitLabel="Salvează rețeta" onSubmit={save} />
      </main>
    </>
  )
}
