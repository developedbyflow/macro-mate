import { Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { difficulties, type RecipeDraft } from '@/lib/recipes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useFoodsById } from '@/hooks/use-data'
import { cn } from '@/lib/utils'
import { ItemPicker } from './item-picker'
import { NumberStepper } from './number-stepper'
import { PhotoInput } from './photo'

export function RecipeForm({ initial, submitLabel, onSubmit }: { initial: RecipeDraft; submitLabel: string; onSubmit: (draft: RecipeDraft) => Promise<void> }) {
  const [draft, setDraft] = useState(initial)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const foods = useFoodsById()

  function set<K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) {
      setError('Pune un nume.')
      return
    }
    setSaving(true)
    try {
      await onSubmit({ ...draft, name: draft.name.trim() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0">
      <div className="space-y-5">
        <PhotoInput value={draft.photoId} onChange={(id) => set('photoId', id)} label="Poză (opțional)" />

        <div className="space-y-1.5">
          <Label htmlFor="recipe-name">Nume</Label>
          <Input id="recipe-name" value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="ex. Omletă cu spanac" className="h-10" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="block text-sm font-medium">Timp</span>
            <NumberStepper value={draft.prepTimeMin ?? 0} onChange={(v) => set('prepTimeMin', v)} step={5} min={0} max={600} unit="min" className="w-full" label="minute" />
          </div>
          <div className="space-y-1.5">
            <span className="block text-sm font-medium">Dificultate</span>
            <div className="grid h-10 grid-cols-3 overflow-hidden rounded-lg border">
              {difficulties.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => set('difficulty', d.value)}
                  className={cn('text-xs font-medium transition-colors', draft.difficulty === d.value ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Ingrediente</h2>
            <span className="text-xs text-muted-foreground">fără cantități; le pui în variante</span>
          </div>
          <ul className="divide-y rounded-xl border bg-card">
            {draft.ingredientFoodIds.map((id) => (
              <li key={id} className="flex items-center gap-2 py-1 pr-1 pl-4">
                <span className="flex-1 truncate text-sm">{foods.get(id)?.name ?? 'Aliment șters'}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Scoate ingredientul"
                  onClick={() => set('ingredientFoodIds', draft.ingredientFoodIds.filter((x) => x !== id))}
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => setPicking(true)} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary">
                <Plus className="size-4" /> Adaugă ingredient
              </button>
            </li>
          </ul>
        </section>
      </div>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="instructions">Mod de preparare</Label>
          <Textarea
            id="instructions"
            value={draft.instructions}
            onChange={(e) => set('instructions', e.target.value)}
            placeholder={'1. Bate ouăle.\n2. Călește spanacul.\n3. …'}
            className="min-h-40 lg:min-h-80"
          />
        </div>

        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={saving}>
          {submitLabel}
        </Button>
      </div>

      <ItemPicker
        open={picking}
        onOpenChange={setPicking}
        title="Ingredient"
        allowRecipes={false}
        askQuantity={false}
        onPick={(picked) => {
          if (picked.kind === 'food' && !draft.ingredientFoodIds.includes(picked.food.id)) set('ingredientFoodIds', [...draft.ingredientFoodIds, picked.food.id])
        }}
      />
    </form>
  )
}
