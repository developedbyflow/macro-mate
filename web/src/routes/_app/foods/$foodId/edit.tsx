import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FoodForm } from '@/components/app/food-form'
import { draftFromFood, foodFromDraft, type FoodDraft } from '@/lib/food-draft'
import { PageHeader } from '@/components/app/page-header'
import { saveRow } from '@/db/mutations'
import { useCanEditFood, useFood } from '@/hooks/use-data'
import { useOwnerId } from '@/hooks/use-owner'
import { foodName } from '@/lib/food-name'

export const Route = createFileRoute('/_app/foods/$foodId/edit')({
  component: EditFoodPage,
})

function EditFoodPage() {
  const { t } = useTranslation()
  const { foodId } = Route.useParams()
  const navigate = useNavigate()
  const ownerId = useOwnerId()
  const food = useFood(foodId)
  const canEdit = useCanEditFood(food)

  async function save(draft: FoodDraft) {
    await saveRow('foods', { id: foodId, ...foodFromDraft(draft) }, ownerId)
    toast.success(t('foods.edit.saved'))
    await navigate({ to: '/foods/$foodId', params: { foodId }, replace: true })
  }

  return (
    <>
      <PageHeader title={food ? t('foods.edit.title', { name: foodName(food) }) : t('foods.edit.action')} back />
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-8 lg:mx-0 lg:max-w-none lg:px-8">{food && (canEdit ? <FoodForm initial={draftFromFood(food)} submitLabel={t('common.save')} onSubmit={save} /> : <p className="py-8 text-center text-sm text-muted-foreground">{t('foods.edit.notAllowed')}</p>)}</main>
    </>
  )
}
