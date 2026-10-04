import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Ban, Heart, Pencil, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { GlycemicBadge, ProteinBadge, VolumeBadge } from '@/components/app/badges'
import { ConfirmDelete } from '@/components/app/confirm-delete'
import { NumberStepper } from '@/components/app/number-stepper'
import { NutrientTable } from '@/components/app/nutrients'
import { PageHeader } from '@/components/app/page-header'
import { Photo } from '@/components/app/photo'
import { Button } from '@/components/ui/button'
import { deleteRow } from '@/db/mutations'
import type { Food } from '@/api/types'
import { useFood, useProfile, useUsersById } from '@/hooks/use-data'
import { categoryLabel } from '@/lib/categories'
import { num, units } from '@/lib/format'
import { foodGrades, forGrams } from '@/lib/nutrition'
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
  const grades = foodGrades(food)

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
                Proteină <ProteinBadge grade={grades.protein} />
              </span>
              <span className="flex items-center gap-1.5">
                Volum <VolumeBadge grade={grades.volume} />
              </span>
            </div>
            {food.gradesReason ? (
              <p className="text-sm text-muted-foreground">{food.gradesReason}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Fără notă glicemică încă. Deschide „Editează” și apasă „Completează cu AI”. Proteina și volumul se calculează din valori.</p>
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
          <PortionNutrients food={food} />

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

function PortionNutrients({ food }: { food: Food }) {
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
        <NumberStepper value={grams} onChange={setGrams} step={10} min={1} max={2000} unit="g" size="sm" className="ml-auto w-32" label="grame" />
      </div>
      <NutrientTable
        n={forGrams(food, grams)}
        estimated={food.estimatedFields}
        caption={grams === unit ? `La ${units(1, food.category)} (${num(grams)} g)` : `La ${num(grams)} g`}
      />
    </div>
  )
}
