import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/api/client'
import type { FoodDemand } from '@/api/types'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { syncNow } from '@/db/sync'
import { useMe } from '@/hooks/use-data'
import { useOnline } from '@/hooks/use-online'
import { categoryLabel } from '@/lib/categories'
import { longDate } from '@/lib/dates'
import { errorText } from '@/lib/errors'
import { currentLanguage } from '@/i18n'

export const Route = createFileRoute('/_app/admin')({
  component: AdminPage,
})

function AdminPage() {
  const { t } = useTranslation()
  const me = useMe()
  const online = useOnline()

  if (me && !me.isAdmin) {
    return (
      <>
        <PageHeader title={t('admin.title')} back />
        <p className="p-8 text-center text-sm text-muted-foreground">{t('errors.status', { status: 403 })}</p>
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('admin.title')} back />
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-8 lg:mx-0 lg:max-w-4xl lg:px-8">
        {!online ? (
          <p className="text-sm text-muted-foreground">{t('admin.offline')}</p>
        ) : (
          <Tabs defaultValue="demand">
            <TabsList>
              <TabsTrigger value="demand">{t('admin.tabs.demand')}</TabsTrigger>
              <TabsTrigger value="reports">{t('admin.tabs.reports')}</TabsTrigger>
              <TabsTrigger value="users">{t('admin.tabs.users')}</TabsTrigger>
            </TabsList>
            <TabsContent value="demand">
              <DemandTab />
            </TabsContent>
            <TabsContent value="reports">
              <ReportsTab />
            </TabsContent>
            <TabsContent value="users">
              <UsersTab myId={me?.id} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </>
  )
}

function Loading({ error }: { error: unknown }) {
  const { t } = useTranslation()
  return <p className="py-6 text-sm text-muted-foreground">{error ? errorText(error) : t('admin.loading')}</p>
}

function demandName(row: FoodDemand) {
  return currentLanguage() === 'en' && row.nameEn ? row.nameEn : row.name
}

function DemandTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const demand = useQuery({ queryKey: ['admin', 'demand'], queryFn: api.foodDemand })
  const promote = useMutation({
    mutationFn: (row: FoodDemand) => api.promoteFood(row.foodId),
    onSuccess: async (_, row) => {
      toast.success(t('admin.demand.promoted', { name: demandName(row) }))
      await queryClient.invalidateQueries({ queryKey: ['admin', 'demand'] })
      void syncNow()
    },
    onError: (error) => toast.error(errorText(error)),
  })

  return (
    <section className="space-y-3 pt-2">
      <p className="text-sm text-muted-foreground">{t('admin.demand.intro')}</p>
      {!demand.data ? (
        <Loading error={demand.error} />
      ) : demand.data.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">{t('admin.demand.empty')}</p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card text-sm">
          {demand.data.map((row) => (
            <li key={row.foodId} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {demandName(row)}
                  {row.brand && <span className="text-muted-foreground"> · {row.brand}</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('admin.demand.kitchens', { count: row.kitchens })} · {categoryLabel(row.category)}
                  {row.barcode && ` · ${row.barcode}`}
                </div>
              </div>
              {row.inBase ? (
                <span className="shrink-0 text-xs text-muted-foreground">{t('admin.demand.inBase')}</span>
              ) : (
                <Button size="sm" variant="secondary" className="shrink-0" disabled={promote.isPending} onClick={() => promote.mutate(row)}>
                  {t('admin.demand.promote')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ReportsTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const reports = useQuery({ queryKey: ['admin', 'reports'], queryFn: api.openReports })
  const resolve = useMutation({
    mutationFn: api.resolveReport,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] }),
    onError: (error) => toast.error(errorText(error)),
  })

  return (
    <section className="space-y-3 pt-2">
      <p className="text-sm text-muted-foreground">{t('admin.reports.intro')}</p>
      {!reports.data ? (
        <Loading error={reports.error} />
      ) : reports.data.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">{t('admin.reports.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {reports.data.map((report) => (
            <li key={report.id} className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
              <div className="font-medium">{report.foodName}</div>
              <p className="whitespace-pre-line">{report.message}</p>
              <p className="text-xs text-muted-foreground">{t('admin.reports.from', { name: report.reporterName, date: longDate(report.createdAt.slice(0, 10)) })}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" nativeButton={false} render={<Link to="/foods/$foodId" params={{ foodId: report.foodId }} />}>
                  {t('admin.reports.open')}
                </Button>
                <Button size="sm" variant="secondary" disabled={resolve.isPending} onClick={() => resolve.mutate(report.id)}>
                  {t('admin.reports.resolve')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function UsersTab({ myId }: { myId: string | undefined }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: api.adminUsers })
  const setAdmin = useMutation({
    mutationFn: ({ id, admin }: { id: string; admin: boolean }) => api.setAdmin(id, admin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
    onError: (error) => toast.error(errorText(error)),
  })

  return (
    <section className="space-y-3 pt-2">
      <p className="text-sm text-muted-foreground">{t('admin.users.intro')}</p>
      {!users.data ? (
        <Loading error={users.error} />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card text-sm">
          {users.data.map((user) => (
            <li key={user.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {user.displayName}
                  {user.id === myId && <span className="text-muted-foreground"> {t('admin.users.you')}</span>}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {user.email}
                  {!user.emailConfirmed && ` · ${t('admin.users.unconfirmed')}`}
                </div>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={user.isAdmin}
                  disabled={setAdmin.isPending}
                  onChange={(e) => setAdmin.mutate({ id: user.id, admin: e.target.checked })}
                />
                {t('admin.users.admin')}
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
