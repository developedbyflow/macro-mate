import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { FoodForm } from '@/components/app/food-form'
import { draftFromFood, foodFromDraft, type FoodDraft } from '@/lib/food-draft'
import { PageHeader } from '@/components/app/page-header'
import { saveRow } from '@/db/mutations'
import { useFood } from '@/hooks/use-data'
import { useOwnerId } from '@/hooks/use-owner'

export const Route = createFileRoute('/_app/foods/$foodId/edit')({
  component: EditFoodPage,
})

function EditFoodPage() {
  const { foodId } = Route.useParams()
  const navigate = useNavigate()
  const ownerId = useOwnerId()
  const food = useFood(foodId)

  async function save(draft: FoodDraft) {
    await saveRow('foods', { id: foodId, ...foodFromDraft(draft) }, ownerId)
    toast.success('Salvat.')
    await navigate({ to: '/foods/$foodId', params: { foodId }, replace: true })
  }

  return (
    <>
      <PageHeader title={food ? `Editează ${food.name}` : 'Editează'} back />
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-8 lg:mx-0 lg:max-w-6xl lg:px-8">{food && <FoodForm initial={draftFromFood(food)} submitLabel="Salvează" onSubmit={save} />}</main>
    </>
  )
}
