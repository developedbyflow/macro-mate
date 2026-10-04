import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Ban, Heart, Pencil, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { GlycemicBadge, WeightLossBadge } from '@/components/app/badges'
import { ConfirmDelete } from '@/components/app/confirm-delete'
import { MacroLine, NutrientTable } from '@/components/app/nutrients'
import { PageHeader } from '@/components/app/page-header'
import { Photo } from '@/components/app/photo'
import { Button } from '@/components/ui/button'
import { deleteRow } from '@/db/mutations'
import { useFood, useProfile, useUsersById } from '@/hooks/use-data'
import { categoryLabel } from '@/lib/categories'
import { forGrams, per100 } from '@/lib/nutrition'
import { inProfile, toggleInProfile } from '@/lib/profile'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/foods/$foodId/')({
  component: FoodPage,
})

const sources: Record<string, string> = {
  manual: 'scris manual',
  open_food_facts: 'din Open Food Facts',
  label_photo: 'citit de pe etichetă',
  generic: 'valori generice',
}

function FoodPage() {
  const { foodId } = Route.useParams()
  const navigate = useNavigate()
  const food = useFood(foodId)
  const profile = useProfile()
  const users = useUsersById()

  if (!food) return <PageHeader title="Aliment" back />
  if (food.deletedAt) {
    return (
      <>
        <PageHeader title={food.name} back />
        <p className="p-8 text-center text-sm text-muted-foreground">Alimentul a fost șters.</p>
      </>
    )
  }

  const favorite = inProfile(profile, 'favoriteFoodIds', food.id)
  const liked = inProfile(profile, 'likedFoodIds', food.id)
  const excluded = inProfile(profile, 'excludedFoodIds', food.id)

  return (
    <>
      <PageHeader
        title={food.name}
        subtitle={[food.brand, categoryLabel(food.category)].filter(Boolean).join(' · ')}
        back
        actions={
          <Button variant="ghost" size="icon" aria-label="Editează" render={<Link to="/foods/$foodId/edit" params={{ foodId }} />}>
            <Pencil className="size-5" />
          </Button>
        }
      />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-8 lg:mx-0 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0 lg:px-8">
        <div className="space-y-4">
          {food.photoId && <Photo id={food.photoId} className="aspect-[4/3] w-full rounded-2xl" />}

          <section className="space-y-3 rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                Glicemic <GlycemicBadge grade={food.glycemicGrade} />
                {!food.glycemicGrade && <span className="text-muted-foreground">—</span>}
              </span>
              <span className="flex items-center gap-1.5">
                Slăbit <WeightLossBadge grade={food.weightLossGrade} />
                {!food.weightLossGrade && <span className="text-muted-foreground">—</span>}
              </span>
            </div>
            {food.gradesReason ? (
              <p className="text-sm text-muted-foreground">{food.gradesReason}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Fără note încă. Deschide „Editează” și apasă „Completează cu AI”.</p>
            )}
          </section>

          <div className="grid grid-cols-3 gap-2">
            <Toggle active={favorite} onClick={() => void toggleInProfile(profile, 'favoriteFoodIds', food.id)} icon={Star} label="Favorit" activeClass="text-carbs [&_svg]:fill-carbs" />
            <Toggle active={liked} onClick={() => void toggleInProfile(profile, 'likedFoodIds', food.id)} icon={Heart} label="Îmi place" activeClass="text-fat [&_svg]:fill-fat" />
            <Toggle
              active={excluded}
              onClick={() => {
                void toggleInProfile(profile, 'excludedFoodIds', food.id)
                toast(excluded ? 'Nu mai e exclus.' : 'Exclus: nu-l mai vezi în liste, alternative și rețete generate.')
              }}
              icon={Ban}
              label={excluded ? 'Exclus' : 'Exclude'}
              activeClass="text-destructive"
            />
          </div>
        </div>

        <div className="space-y-4">
          <NutrientTable n={per100(food)} estimated={food.estimatedFields} caption="La 100 g" />

          {food.unitWeightG && (
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="text-xs text-muted-foreground">O bucată ≈ {Math.round(food.unitWeightG)} g</div>
              <MacroLine n={forGrams(food, food.unitWeightG)} className="text-sm" />
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Adăugat de {users.get(food.createdBy) ?? '—'} · {sources[food.source] ?? food.source}
            {food.barcode && ` · cod ${food.barcode}`}
          </p>

          <ConfirmDelete
            title={`Ștergi ${food.name}?`}
            description="Dispare din listă pentru toți. Rețetele și jurnalul care îl folosesc își păstrează valorile."
            onConfirm={async () => {
              await deleteRow('foods', food.id)
              await navigate({ to: '/foods' })
            }}
            trigger={
              <Button variant="ghost" className="w-full text-destructive">
                <Trash2 className="size-4" /> Șterge alimentul
              </Button>
            }
          />
        </div>
      </main>
    </>
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
  icon: typeof Star
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
