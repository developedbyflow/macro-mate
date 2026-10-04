import { useMutation } from '@tanstack/react-query'
import { Camera, Info, Loader2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client'
import type { MealScanResult } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useFoodsById } from '@/hooks/use-data'
import { useDesktop } from '@/hooks/use-desktop'
import { errorText } from '@/lib/errors'
import { foodName } from '@/lib/food-name'
import { num } from '@/lib/format'
import { mealLabel } from '@/lib/meals'
import { forGrams, scale, sum, zero, type Nutrients } from '@/lib/nutrition'
import { imageToDataUrl } from '@/lib/photos'
import { EstimatedBadge } from './badges'
import { NativeSelect } from './native-select'
import { NumberStepper } from './number-stepper'
import { MacroLine } from './nutrients'

export type ScanLine =
  | { key: string; kind: 'food'; foodId: string; grams: number; served: number }
  | { key: string; kind: 'estimated'; name: string; grams: number; base: Nutrients; baseGrams: number }

function linesFrom(result: MealScanResult): ScanLine[] {
  return [
    ...result.foods.map((f, i): ScanLine => ({ key: `food-${i}`, kind: 'food', foodId: f.foodId, grams: f.grams, served: f.servedGrams })),
    ...result.estimated.map(
      (e, i): ScanLine => ({
        key: `estimated-${i}`,
        kind: 'estimated',
        name: e.name,
        grams: e.grams,
        baseGrams: e.grams,
        base: { kcal: e.kcal, proteinG: e.proteinG, carbsG: e.carbsG, fatG: e.fatG, fiberG: e.fiberG, sodiumMg: e.sodiumMg },
      }),
    ),
  ]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  meals: string[]
  defaultMeal: string
  onAdd: (meal: string, lines: ScanLine[]) => Promise<void>
}

export function MealScan({ open, onOpenChange, meals, defaultMeal, onAdd }: Props) {
  const { t } = useTranslation()
  const desktop = useDesktop()
  const foods = useFoodsById()
  const input = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<string | null>(null)
  const [lines, setLines] = useState<ScanLine[] | null>(null)
  const [note, setNote] = useState('')
  const [meal, setMeal] = useState(defaultMeal)
  const [adding, setAdding] = useState(false)

  const scan = useMutation({
    mutationFn: (dataUrl: string) => api.scanMeal(dataUrl),
    onSuccess: (result) => {
      setLines(linesFrom(result))
      setNote(result.note)
    },
  })

  function reset() {
    setImage(null)
    setLines(null)
    setNote('')
    scan.reset()
  }

  function close(next: boolean) {
    onOpenChange(next)
    if (next) setMeal(defaultMeal)
    else reset()
  }

  async function pick(file: File | undefined) {
    if (!file) return
    reset()
    const dataUrl = await imageToDataUrl(file, 1280)
    setImage(dataUrl)
    scan.mutate(dataUrl)
  }

  function nutrientsOf(line: ScanLine): Nutrients | null {
    if (line.kind === 'estimated') return scale(line.base, line.grams / Math.max(1, line.baseGrams))
    const food = foods.get(line.foodId)
    return food ? forGrams(food, line.grams) : null
  }

  function nameOf(line: ScanLine) {
    return line.kind === 'estimated' ? line.name : (foodName(foods.get(line.foodId)) ?? t('fallback.deletedFood'))
  }

  function update(key: string, grams: number) {
    setLines((current) => current?.map((line) => (line.key === key ? { ...line, grams } : line)) ?? null)
  }

  function remove(key: string) {
    setLines((current) => current?.filter((line) => line.key !== key) ?? null)
  }

  async function add() {
    if (!lines || lines.length === 0) return
    setAdding(true)
    try {
      await onAdd(meal, lines)
      close(false)
    } finally {
      setAdding(false)
    }
  }

  const total = sum((lines ?? []).map((line) => nutrientsOf(line) ?? zero))
  const options = meals.includes(meal) ? meals : [meal, ...meals]

  return (
    <Drawer swipeDirection={desktop ? 'right' : 'down'} open={open} onOpenChange={close}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('today.scan.title')}</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-4 overflow-y-auto p-4">
          <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />

          {!image ? (
            <div className="space-y-3">
              <Button variant="outline" className="h-32 w-full flex-col gap-2 border-dashed" onClick={() => input.current?.click()}>
                <Camera className="size-6" />
                {t('today.scan.pick')}
              </Button>
              <p className="text-xs text-muted-foreground">{t('today.scan.pickHint')}</p>
            </div>
          ) : (
            <img src={image} alt="" className="max-h-56 w-full rounded-xl object-cover" />
          )}

          {scan.isPending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {t('today.scan.working')}
            </p>
          )}

          {scan.isError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorText(scan.error) ?? t('today.scan.failed')}</p>}

          {lines && (
            <div className="space-y-3">
              {note && (
                <p className="flex gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" /> {note}
                </p>
              )}
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('today.scan.nothing')}</p>
              ) : (
                <>
                  <ul className="divide-y rounded-xl border bg-card">
                    {lines.map((line) => {
                      const name = nameOf(line)
                      const n = nutrientsOf(line)
                      return (
                        <li key={line.key} className="flex items-center gap-2 px-3 py-2.5">
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 text-sm font-medium">
                              <span className="truncate">{name}</span>
                              {line.kind === 'estimated' && <EstimatedBadge />}
                            </div>
                            {line.kind === 'food' && Math.abs(line.served - line.grams) > line.served * 0.15 && (
                              <div className="text-xs text-muted-foreground">{t('today.scan.served', { grams: num(line.served) })}</div>
                            )}
                            {n && <MacroLine n={n} />}
                          </div>
                          <NumberStepper value={line.grams} onChange={(grams) => update(line.key, grams)} step={10} min={1} max={3000} unit="g" size="sm" className="w-32 shrink-0" label={t('today.scan.grams')} />
                          <Button variant="ghost" size="icon-sm" aria-label={t('today.scan.remove', { name })} onClick={() => remove(line.key)}>
                            <X className="size-4" />
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                  <div className="flex items-center justify-between gap-3 px-1 text-sm">
                    <span className="font-medium">{t('today.scan.total')}</span>
                    <MacroLine n={total} />
                  </div>
                  <p className="text-xs text-muted-foreground">{t('today.scan.estimatedNote')}</p>
                  <label className="flex items-center gap-3">
                    <span className="shrink-0 text-sm font-medium">{t('today.scan.meal')}</span>
                    <NativeSelect className="flex-1" value={meal} onChange={(e) => setMeal(e.target.value)}>
                      {options.map((label) => (
                        <option key={label} value={label}>
                          {mealLabel(label)}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                </>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="h-11 flex-1" onClick={() => input.current?.click()}>
                  {t('today.scan.another')}
                </Button>
                {lines.length > 0 && (
                  <Button className="h-11 flex-[2]" disabled={adding} onClick={() => void add()}>
                    {t('today.scan.add')}
                  </Button>
                )}
              </div>
            </div>
          )}

          {scan.isError && (
            <Button variant="outline" className="h-11 w-full" onClick={() => input.current?.click()}>
              {t('today.scan.another')}
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
