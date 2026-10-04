import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Plus, ShoppingBasket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { newId, saveRow } from '@/db/mutations'
import { useMealPlansById, useShoppingLists } from '@/hooks/use-data'
import { useOwnerId } from '@/hooks/use-owner'
import { locale } from '@/i18n'

export const Route = createFileRoute('/_app/shopping/')({
  component: ShoppingPage,
})

function ShoppingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ownerId = useOwnerId()
  const lists = useShoppingLists()
  const plans = useMealPlansById()

  async function create() {
    const id = newId()
    const name = t('shopping.list.defaultName', { date: new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long' }).format(new Date()) })
    await saveRow('shoppingLists', { id, name, plans: [], checkedKeys: [] }, ownerId)
    await navigate({ to: '/shopping/$listId', params: { listId: id } })
  }

  return (
    <>
      <PageHeader
        title={t('nav.shopping')}
        actions={
          <Button size="sm" onClick={() => void create()}>
            <Plus className="size-4" /> {t('shopping.list.newList')}
          </Button>
        }
      />
      <main className="mx-auto max-w-2xl space-y-2 px-4 pt-4 lg:mx-0 lg:grid lg:max-w-none lg:grid-cols-2 lg:gap-3 lg:space-y-0 lg:px-8 lg:pb-8 xl:grid-cols-3 2xl:grid-cols-4">
        {lists.map((list) => (
          <Link key={list.id} to="/shopping/$listId" params={{ listId: list.id }} className="flex items-center gap-3 rounded-2xl border bg-card p-3 transition-colors hover:bg-muted active:bg-muted">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <ShoppingBasket className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{list.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {list.plans.length === 0
                  ? t('shopping.list.noPlans')
                  : list.plans.map((p) => t('shopping.list.planDays', { count: p.days, name: plans.get(p.mealPlanId)?.name ?? t('shopping.list.deletedPlan') })).join(', ')}
              </div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
        {lists.length === 0 && (
          <div className="col-span-full px-6 py-16 text-center text-sm text-muted-foreground">
            {t('shopping.list.empty')}
          </div>
        )}
      </main>
    </>
  )
}
