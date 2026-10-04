import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Ban, Flag, Heart, Pencil, Refrigerator, Trash2, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { GlycemicBadge, ProteinBadge, VolumeBadge } from '@/components/app/badges'
import { ConfirmDelete } from '@/components/app/confirm-delete'
import { NumberStepper } from '@/components/app/number-stepper'
import { NutrientTable } from '@/components/app/nutrients'
import { PageHeader } from '@/components/app/page-header'
import { Photo } from '@/components/app/photo'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/api/client'
import { useOnline } from '@/hooks/use-online'
import { errorText } from '@/lib/errors'
import { deleteRow } from '@/db/mutations'
import type { Food } from '@/api/types'
import { useCanEditFood, useFood, usePantryFoodIds, useProfile, useUsersById } from '@/hooks/use-data'
import { useOwnerId } from '@/hooks/use-owner'
import { categoryLabel } from '@/lib/categories'
import { num, units } from '@/lib/format'
import { foodGrades, forGrams } from '@/lib/nutrition'
import { togglePantry } from '@/lib/pantry'
import { inProfile, toggleInProfile } from '@/lib/profile'
import { cn } from '@/lib/utils'
import { foodName, foodReason } from '@/lib/food-name'

export const Route = createFileRoute('/_app/foods/$foodId/')({
  component: FoodPage,
})

const sources = {
  manual: 'foods.detail.sources.manual',
  open_food_facts: 'foods.detail.sources.openFoodFacts',
  label_photo: 'foods.detail.sources.labelPhoto',
  generic: 'foods.detail.sources.generic',
} as const

function sourceKey(source: string) {
  return Object.hasOwn(sources, source) ? sources[source as keyof typeof sources] : null
}

function FoodPage() {
  const { t } = useTranslation()
  const { foodId } = Route.useParams()
  const navigate = useNavigate()
  const food = useFood(foodId)
  const profile = useProfile()
  const users = useUsersById()
  const pantry = usePantryFoodIds()
  const ownerId = useOwnerId()
  const canEdit = useCanEditFood(food)
  const [reporting, setReporting] = useState(false)

  if (!food) return <PageHeader title={t('fallback.food')} back />
  if (food.deletedAt) {
    return (
      <>
        <PageHeader title={foodName(food)} back />
        <p className="p-8 text-center text-sm text-muted-foreground">{t('foods.detail.deleted')}</p>
      </>
    )
  }

  const inPantry = pantry.has(food.id)
  const liked = inProfile(profile, 'likedFoodIds', food.id)
  const excluded = inProfile(profile, 'excludedFoodIds', food.id)
  const grades = foodGrades(food)
  const source = sourceKey(food.source)

  return (
    <>
      <PageHeader
        title={foodName(food)}
        subtitle={[food.brand, categoryLabel(food.category)].filter(Boolean).join(' · ')}
        back
        actions={
          canEdit && (
            <Button variant="ghost" size="icon" aria-label={t('foods.edit.action')} nativeButton={false} render={<Link to="/foods/$foodId/edit" params={{ foodId }} />}>
              <Pencil className="size-5" />
            </Button>
          )
        }
      />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-8 lg:mx-0 lg:grid lg:max-w-none lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0 lg:px-8">
        <div className="space-y-4">
          {food.photoId && <Photo id={food.photoId} className="aspect-[4/3] w-full rounded-2xl" />}

          <section className="space-y-3 rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                {t('foods.glycemic')} <GlycemicBadge grade={food.glycemicGrade} />
                {!food.glycemicGrade && <span className="text-muted-foreground">—</span>}
              </span>
              <span className="flex items-center gap-1.5">
                {t('grades.protein.label')} <ProteinBadge grade={grades.protein} />
              </span>
              <span className="flex items-center gap-1.5">
                {t('grades.volume.label')} <VolumeBadge grade={grades.volume} />
              </span>
            </div>
            {foodReason(food) ? (
              <p className="text-sm text-muted-foreground">{foodReason(food)}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t('foods.detail.noGlycemicGrade')}</p>
            )}
          </section>

          <div className="grid grid-cols-3 gap-2">
            <Toggle
              active={inPantry}
              onClick={() => void togglePantry(food.id, inPantry, ownerId)}
              icon={Refrigerator}
              label={inPantry ? t('foods.pantry.inPantry') : t('foods.pantry.add')}
              activeClass="text-primary border-primary/50 bg-primary/10"
            />
            <Toggle active={liked} onClick={() => void toggleInProfile(profile, 'likedFoodIds', food.id)} icon={Heart} label={t('foods.detail.like')} activeClass="text-fat [&_svg]:fill-fat" />
            <Toggle
              active={excluded}
              onClick={() => {
                void toggleInProfile(profile, 'excludedFoodIds', food.id)
                toast(excluded ? t('foods.detail.includedToast') : t('foods.detail.excludedToast'))
              }}
              icon={Ban}
              label={excluded ? t('foods.detail.excluded') : t('foods.detail.exclude')}
              activeClass="text-destructive"
            />
          </div>
        </div>

        <div className="space-y-4">
          <PortionNutrients food={food} />

          <p className="text-center text-xs text-muted-foreground">
            {food.kitchenId == null ? t('foods.origin.base') : t('foods.origin.kitchen', { name: users.get(food.createdBy) ?? '—' })} · {source ? t(source) : food.source}
            {food.barcode && ` · ${t('foods.detail.barcode', { code: food.barcode })}`}
          </p>

          {food.kitchenId == null && !canEdit && (
            <div className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
              <p className="text-muted-foreground">{t('foods.detail.readOnly')}</p>
              <Button variant="outline" className="w-full" onClick={() => setReporting(true)}>
                <Flag className="size-4" /> {t('foods.report.action')}
              </Button>
            </div>
          )}
          <ReportDialog foodId={food.id} name={foodName(food)} open={reporting} onOpenChange={setReporting} />

          {canEdit && <ConfirmDelete
            title={t('foods.detail.deleteTitle', { name: foodName(food) })}
            description={t('foods.detail.deleteDescription')}
            onConfirm={async () => {
              await deleteRow('foods', food.id)
              await navigate({ to: '/foods' })
            }}
            trigger={
              <Button variant="ghost" className="w-full text-destructive">
                <Trash2 className="size-4" /> {t('foods.detail.deleteFood')}
              </Button>
            }
          />}
        </div>
      </main>
    </>
  )
}

function ReportDialog({ foodId, name, open, onOpenChange }: { foodId: string; name: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const online = useOnline()
  const [message, setMessage] = useState('')
  const send = useMutation({
    mutationFn: () => api.reportFood(foodId, message.trim()),
    onSuccess: () => {
      toast.success(t('foods.report.sent'))
      setMessage('')
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('foods.report.title', { name })}</DialogTitle>
          <DialogDescription>{t('foods.report.description')}</DialogDescription>
        </DialogHeader>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={4} placeholder={t('foods.report.placeholder')} aria-label={t('foods.report.title', { name })} />
        {!online && <p className="text-sm text-destructive">{t('foods.report.needsInternet')}</p>}
        {send.error && <p className="text-sm text-destructive">{errorText(send.error)}</p>}
        <DialogFooter>
          <Button disabled={!online || send.isPending || message.trim().length < 3} onClick={() => send.mutate()}>
            {t('foods.report.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Toggle({
  active,
  onClick,
  icon: Icon,
  label,
  activeClass,
}: {
  active: boolean
  onClick: () => void
  icon: LucideIcon
  label: string
  activeClass: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('flex flex-col items-center gap-1 rounded-xl border bg-card py-3 text-xs font-medium text-muted-foreground transition-colors active:bg-muted', active && activeClass)}
    >
      <Icon className="size-5" />
      {label}
    </button>
  )
}

function PortionNutrients({ food }: { food: Food }) {
  const { t } = useTranslation()
  const unit = food.unitWeightG ? Math.round(food.unitWeightG) : null
  const [grams, setGrams] = useState(100)
  const presets = [{ grams: 100, label: '100 g' }, ...(unit ? [{ grams: unit, label: `${units(1, food.category)} · ${unit} g` }] : [])]

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setGrams(preset.grams)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              grams === preset.grams ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {preset.label}
          </button>
        ))}
        <NumberStepper value={grams} onChange={setGrams} step={10} min={1} max={2000} unit="g" size="sm" className="ml-auto w-32" label={t('foods.grams')} />
      </div>
      <NutrientTable
        n={forGrams(food, grams)}
        estimated={food.estimatedFields}
        caption={grams === unit ? t('foods.detail.perUnit', { unit: units(1, food.category), grams: num(grams) }) : t('foods.detail.perGrams', { grams: num(grams) })}
      />
    </div>
  )
}
