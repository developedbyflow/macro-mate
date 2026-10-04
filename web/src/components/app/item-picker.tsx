import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, Refrigerator, ScanBarcode, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { Food, Recipe, RecipeVariant } from '@/api/types'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  useExclusions,
  useFoods,
  useFoodsById,
  usePantryFoodIds,
  useProfile,
  useRecentFoodIds,
  useRecipes,
  useVariants,
} from '@/hooks/use-data'
import { useDesktop } from '@/hooks/use-desktop'
import { foodGrades, forGrams, isExcluded, scale, variantTotals } from '@/lib/nutrition'
import { search } from '@/lib/search'
import { categoryLabel } from '@/lib/categories'
import { num, units } from '@/lib/format'
import { cn } from '@/lib/utils'
import { GradeBadges } from './badges'
import { MacroLine } from './nutrients'
import { NumberStepper } from './number-stepper'
import { Scanner } from './scanner'
import { foodName, foodSearchText } from '@/lib/food-name'

export type PickedItem =
  | { kind: 'food'; food: Food; grams: number }
  | { kind: 'variant'; recipe: Recipe; variant: RecipeVariant; servings: number }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onPick: (item: PickedItem) => void
  allowRecipes?: boolean
  confirmLabel?: string
  askQuantity?: boolean
  startScanning?: boolean
}

type Tab = 'all' | 'recent' | 'pantry' | 'recipes'

export function ItemPicker({ open, onOpenChange, title, onPick, allowRecipes = true, confirmLabel, askQuantity = true, startScanning = false }: Props) {
  const { t } = useTranslation()
  const desktop = useDesktop()
  const navigate = useNavigate()
  const foods = useFoods()
  const foodsById = useFoodsById()
  const recipes = useRecipes()
  const variants = useVariants()
  const profile = useProfile()
  const exclusions = useExclusions()
  const recent = useRecentFoodIds()

  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('recent')
  const [selected, setSelected] = useState<PickedItem | null>(null)
  const [scanning, setScanning] = useState(false)
  const [autoScanned, setAutoScanned] = useState(false)

  if (open && startScanning && !autoScanned) {
    setAutoScanned(true)
    setScanning(true)
  }
  if (!open && autoScanned) setAutoScanned(false)

  function reset() {
    setQuery('')
    setSelected(null)
    setTab('recent')
  }

  const effectiveTab: Tab = tab === 'recent' && recent.length === 0 ? 'all' : tab

  const visibleFoods = useMemo(() => foods.filter((f) => !isExcluded(f, exclusions)), [foods, exclusions])
  const pantry = usePantryFoodIds()
  const excludedRecipes = useMemo(() => new Set(profile?.excludedRecipeIds ?? []), [profile])

  const recipeRows = useMemo(() => {
    return recipes
      .filter((r) => !excludedRecipes.has(r.id))
      .filter((r) => !r.ingredientFoodIds.some((id) => exclusions.foodIds.has(id) || exclusions.categories.has(foodsById.get(id)?.category ?? '')))
      .flatMap((recipe) =>
        variants
          .filter((v) => v.recipeId === recipe.id)
          .map((variant) => ({ recipe, variant, perServing: variantTotals(variant, foodsById).perServing })),
      )
  }, [recipes, variants, foodsById, exclusions, excludedRecipes])

  const foodRows = useMemo(() => {
    if (query.trim()) return search(visibleFoods, query, foodSearchText)
    if (effectiveTab === 'recent') return recent.map((id) => foodsById.get(id)).filter((f): f is Food => !!f && !f.deletedAt && !isExcluded(f, exclusions))
    if (effectiveTab === 'pantry') return visibleFoods.filter((f) => pantry.has(f.id))
    return visibleFoods
  }, [query, effectiveTab, visibleFoods, recent, foodsById, exclusions, pantry])

  const filteredRecipes = useMemo(
    () => (query.trim() ? search(recipeRows, query, (r) => `${r.recipe.name} ${r.variant.name}`) : recipeRows),
    [recipeRows, query],
  )

  const showRecipes = allowRecipes && (effectiveTab === 'recipes' || query.trim().length > 0)

  function onDetected(code: string) {
    setScanning(false)
    const food = foods.find((f) => f.barcode === code)
    if (food) choose({ kind: 'food', food, grams: food.unitWeightG ?? 100 })
    else
      toast(t('foods.picker.notInDatabase'), {
        action: { label: t('foods.picker.addIt'), onClick: () => void navigate({ to: '/foods/new', search: { barcode: code } }) },
      })
  }

  function confirm(item: PickedItem | null = selected) {
    if (!item) return
    onPick(item)
    onOpenChange(false)
    reset()
  }

  function choose(item: PickedItem) {
    if (askQuantity) setSelected(item)
    else confirm(item)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'recent', label: t('foods.picker.recent') },
    { key: 'pantry', label: t('foods.pantry.title') },
    { key: 'all', label: t('foods.picker.all') },
    ...(allowRecipes ? [{ key: 'recipes' as const, label: t('nav.recipes') }] : []),
  ]

  return (
    <>
      <Drawer
        swipeDirection={desktop ? 'right' : 'down'}
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next)
          if (!next) reset()
        }}
      >
        <DrawerContent className="data-[swipe-axis=y]:h-[88dvh] lg:w-[30rem]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center gap-1 text-left">
              {selected && (
                <Button variant="ghost" size="icon-sm" aria-label={t('foods.picker.backToList')} onClick={() => setSelected(null)}>
                  <ChevronLeft className="size-5" />
                </Button>
              )}
              {selected ? (selected.kind === 'food' ? foodName(selected.food) : selected.recipe.name) : title}
            </DrawerTitle>
          </DrawerHeader>

          {selected ? (
            <SelectedItem selected={selected} onChange={setSelected} onConfirm={() => confirm()} confirmLabel={confirmLabel ?? t('common.add')} />
          ) : (
            <>
              <div className="flex gap-2 px-4 pb-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('foods.picker.search')} className="h-10 pl-9" />
                </div>
                <Button variant="outline" size="icon-lg" className="size-10" aria-label={t('foods.scanBarcode')} onClick={() => setScanning(true)}>
                  <ScanBarcode className="size-5" />
                </Button>
              </div>
              {!query.trim() && (
                <div className="flex gap-1.5 px-4 pb-2">
                  {tabs.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setTab(option.key)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                        effectiveTab === option.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-6">
                {showRecipes && filteredRecipes.length > 0 && (
                  <section>
                    {query.trim() && <h3 className="px-2 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase">{t('nav.recipes')}</h3>}
                    {filteredRecipes.map(({ recipe, variant, perServing }) => (
                      <button
                        key={variant.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left active:bg-muted"
                        onClick={() => choose({ kind: 'variant', recipe, variant, servings: 1 })}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {recipe.name} <span className="text-muted-foreground">· {variant.name}</span>
                          </div>
                          <MacroLine n={perServing} />
                        </div>
                        <span className="text-[11px] text-muted-foreground">{t('foods.picker.perServing')}</span>
                      </button>
                    ))}
                  </section>
                )}
                {effectiveTab !== 'recipes' || query.trim() ? (
                  <section>
                    {query.trim() && showRecipes && filteredRecipes.length > 0 && (
                      <h3 className="px-2 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase">{t('nav.foods')}</h3>
                    )}
                    {foodRows.map((food) => (
                      <button
                        key={food.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left active:bg-muted"
                        onClick={() => choose({ kind: 'food', food, grams: food.unitWeightG ?? 100 })}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                            {pantry.has(food.id) && <Refrigerator className="size-3.5 shrink-0 text-primary" />}
                            <span className="truncate">{foodName(food)}</span>
                            {food.brand && <span className="truncate text-muted-foreground">· {food.brand}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {Math.round(food.kcal)} kcal / 100 g · {categoryLabel(food.category)}
                          </div>
                        </div>
                        <GradeBadges grades={foodGrades(food)} />
                      </button>
                    ))}
                    {foodRows.length === 0 && (
                      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                        {effectiveTab === 'pantry' && !query ? t('foods.picker.pantryEmpty') : t('foods.picker.nothingFound')}
                      </p>
                    )}
                  </section>
                ) : (
                  filteredRecipes.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t('foods.picker.noRecipes')}</p>
                )}
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
      {scanning && <Scanner onDetected={onDetected} onClose={() => setScanning(false)} />}
    </>
  )
}

function SelectedItem({
  selected,
  onChange,
  onConfirm,
  confirmLabel,
}: {
  selected: PickedItem
  onChange: (item: PickedItem) => void
  onConfirm: () => void
  confirmLabel: string
}) {
  const { t } = useTranslation()
  const foodsById = useFoodsById()

  if (selected.kind === 'food') {
    const { food, grams } = selected
    const unit = food.unitWeightG
    return (
      <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-6">
        <div className="flex items-center gap-2">
          <GradeBadges grades={foodGrades(food)} />
          <span className="text-xs text-muted-foreground">{categoryLabel(food.category)}</span>
        </div>
        <div className="space-y-2">
          <span className="block text-sm font-medium">{t('foods.picker.quantity')}</span>
          <NumberStepper value={grams} onChange={(g) => onChange({ ...selected, grams: g })} step={unit ? unit / 2 : 10} min={1} unit="g" className="w-full" label={t('foods.grams')} />
          {unit && (
            <div className="flex gap-2">
              {[0.5, 1, 2, 3].map((count) => (
                <Button key={count} variant="outline" size="sm" className="flex-1" onClick={() => onChange({ ...selected, grams: Math.round(unit * count) })}>
                  {units(count, food.category)}
                </Button>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl bg-muted/60 p-3">
          <MacroLine n={forGrams(food, grams)} className="text-sm" />
        </div>
        <Button size="lg" className="mt-auto h-12 text-base" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    )
  }

  const { variant, servings } = selected
  const totals = variantTotals(variant, foodsById)
  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-6">
      <p className="text-sm text-muted-foreground">
        {t('foods.picker.variantServings', { variant: variant.name, count: variant.servings, value: num(variant.servings) })}
      </p>
      <div className="space-y-2">
        <span className="block text-sm font-medium">{t('foods.picker.servings')}</span>
        <NumberStepper value={servings} onChange={(s) => onChange({ ...selected, servings: s })} step={0.5} min={0.5} max={20} className="w-full" label={t('units.servings')} />
      </div>
      <div className="rounded-xl bg-muted/60 p-3">
        <MacroLine n={scale(totals.perServing, servings)} className="text-sm" />
      </div>
      <Button size="lg" className="mt-auto h-12 text-base" onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </div>
  )
}
