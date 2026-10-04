import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Calculator, Heart, LogOut, Plus, RefreshCw, Smartphone, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { UserProfile } from '@/api/types'
import { useAiStatus } from '@/hooks/use-ai-status'
import { ItemPicker } from '@/components/app/item-picker'
import { NativeSelect } from '@/components/app/native-select'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getMeta } from '@/db/database'
import { saveRow } from '@/db/mutations'
import { logout } from '@/db/session'
import { syncNow, useSyncState } from '@/db/sync'
import { useFoodsById, useMe, useOutboxCount, useProfile, useRecipesById } from '@/hooks/use-data'
import { categories, categoryCodes } from '@/lib/categories'
import { activityLevels, computeTargets, goals, type ActivityLevel, type Goal, type Sex } from '@/lib/targets'
import { toggleInProfile } from '@/lib/profile'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const me = useMe()
  const profile = useProfile()
  return (
    <>
      <PageHeader title={me?.displayName ?? 'Profil'} subtitle={me?.email} back />
      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-4 pb-8 lg:mx-0 lg:grid lg:max-w-6xl lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0 lg:px-8">
        {profile && <TargetsSection key={profile.id + profile.updatedAt} profile={profile} />}
        <div className="space-y-6">
          {profile && <PreferencesSection profile={profile} />}
          <AppSection />
        </div>
      </main>
    </>
  )
}

const targetFields = [
  { key: 'targetKcal', label: 'Calorii', unit: 'kcal' },
  { key: 'targetProteinG', label: 'Proteine', unit: 'g' },
  { key: 'targetCarbsG', label: 'Carbohidrați', unit: 'g' },
  { key: 'targetFatG', label: 'Grăsimi', unit: 'g' },
  { key: 'targetFiberG', label: 'Fibre', unit: 'g' },
  { key: 'targetSodiumMg', label: 'Sodiu maxim', unit: 'mg' },
] as const

type TargetKey = (typeof targetFields)[number]['key']

function TargetsSection({ profile }: { profile: UserProfile }) {
  const [inputs, setInputs] = useState({
    sex: (profile.sex ?? '') as Sex | '',
    birthYear: profile.birthYear?.toString() ?? '',
    heightCm: profile.heightCm?.toString() ?? '',
    weightKg: profile.weightKg?.toString() ?? '',
    activityLevel: (profile.activityLevel ?? 'light') as ActivityLevel,
    goal: (profile.goal ?? 'lose') as Goal,
  })
  const [targets, setTargets] = useState<Record<TargetKey, string>>(
    Object.fromEntries(targetFields.map((f) => [f.key, profile[f.key]?.toString() ?? ''])) as Record<TargetKey, string>,
  )

  const birthYear = Number(inputs.birthYear)
  const heightCm = Number(inputs.heightCm.replace(',', '.'))
  const weightKg = Number(inputs.weightKg.replace(',', '.'))
  const ready = inputs.sex !== '' && birthYear > 1900 && heightCm > 100 && weightKg > 30

  function calculate() {
    if (!ready) return
    const t = computeTargets({ sex: inputs.sex as Sex, birthYear, heightCm, weightKg, activityLevel: inputs.activityLevel, goal: inputs.goal })
    setTargets({
      targetKcal: String(t.kcal),
      targetProteinG: String(t.proteinG),
      targetCarbsG: String(t.carbsG),
      targetFatG: String(t.fatG),
      targetFiberG: String(t.fiberG),
      targetSodiumMg: String(t.sodiumMg),
    })
  }

  async function save() {
    const parsed = Object.fromEntries(
      targetFields.map((f) => {
        const value = Number.parseFloat(targets[f.key].replace(',', '.'))
        return [f.key, Number.isFinite(value) ? value : null]
      }),
    )
    await saveRow(
      'userProfiles',
      {
        ...profile,
        sex: inputs.sex || null,
        birthYear: birthYear || null,
        heightCm: heightCm || null,
        weightKg: weightKg || null,
        activityLevel: inputs.activityLevel,
        goal: inputs.goal,
        ...parsed,
      },
      profile.userId,
    )
    toast.success('Țintele sunt salvate.')
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Ținte zilnice</h2>
      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sex">
            <NativeSelect value={inputs.sex} onChange={(e) => setInputs((s) => ({ ...s, sex: e.target.value as Sex }))}>
              <option value="">Alege…</option>
              <option value="male">Bărbat</option>
              <option value="female">Femeie</option>
            </NativeSelect>
          </Field>
          <Field label="Anul nașterii">
            <Input inputMode="numeric" value={inputs.birthYear} onChange={(e) => setInputs((s) => ({ ...s, birthYear: e.target.value }))} className="h-10" />
          </Field>
          <Field label="Înălțime (cm)">
            <Input inputMode="decimal" value={inputs.heightCm} onChange={(e) => setInputs((s) => ({ ...s, heightCm: e.target.value }))} className="h-10" />
          </Field>
          <Field label="Greutate (kg)">
            <Input inputMode="decimal" value={inputs.weightKg} onChange={(e) => setInputs((s) => ({ ...s, weightKg: e.target.value }))} className="h-10" />
          </Field>
        </div>
        <Field label="Activitate">
          <NativeSelect value={inputs.activityLevel} onChange={(e) => setInputs((s) => ({ ...s, activityLevel: e.target.value as ActivityLevel }))}>
            {Object.entries(activityLevels).map(([key, level]) => (
              <option key={key} value={key}>
                {level.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Obiectiv">
          <div className="grid h-10 grid-cols-3 overflow-hidden rounded-lg border">
            {Object.entries(goals).map(([key, goal]) => (
              <button
                key={key}
                type="button"
                onClick={() => setInputs((s) => ({ ...s, goal: key as Goal }))}
                className={cn('text-xs font-medium', inputs.goal === key ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}
              >
                {goal.label}
              </button>
            ))}
          </div>
        </Field>
        <Button variant="secondary" className="h-10 w-full" disabled={!ready} onClick={calculate}>
          <Calculator className="size-4" /> Calculează
        </Button>
        <p className="text-xs text-muted-foreground">
          Formula Mifflin-St Jeor × activitate; slăbire −20%, masă +10%. Proteine 2 g/kg la slăbire (altfel 1,6), grăsimi 0,8 g/kg, restul carbohidrați.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4">
        {targetFields.map((field) => (
          <Field key={field.key} label={field.label}>
            <div className="relative">
              <Input
                inputMode="decimal"
                value={targets[field.key]}
                onChange={(e) => setTargets((t) => ({ ...t, [field.key]: e.target.value }))}
                className="h-10 pr-12 tabular-nums"
                placeholder="—"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{field.unit}</span>
            </div>
          </Field>
        ))}
        <Button className="col-span-2 h-11" onClick={() => void save()}>
          Salvează țintele
        </Button>
      </div>
    </section>
  )
}

function PreferencesSection({ profile }: { profile: UserProfile }) {
  const foods = useFoodsById()
  const recipes = useRecipesById()
  const [picking, setPicking] = useState<'exclude' | 'like' | null>(null)

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Preferințe și excluderi</h2>
      <p className="-mt-2 text-sm text-muted-foreground">Ce excluzi nu-ți mai apare în liste, alternative sau rețete generate. Se aplică doar contului tău.</p>

      <div className="space-y-2 rounded-2xl border bg-card p-4">
        <h3 className="text-sm font-semibold">Categorii excluse</h3>
        <div className="flex flex-wrap gap-1.5">
          {categoryCodes.map((code) => {
            const active = profile.excludedCategories.includes(code)
            return (
              <button
                key={code}
                type="button"
                onClick={() => void toggleInProfile(profile, 'excludedCategories', code)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  active ? 'border-destructive bg-destructive/10 text-destructive line-through' : 'bg-card text-muted-foreground',
                )}
              >
                {categories[code]}
              </button>
            )
          })}
        </div>
      </div>

      <ChipList
        title="Alimente excluse"
        items={profile.excludedFoodIds.map((id) => ({ id, label: foods.get(id)?.name ?? 'Aliment șters' }))}
        onRemove={(id) => void toggleInProfile(profile, 'excludedFoodIds', id)}
        onAdd={() => setPicking('exclude')}
      />
      <ChipList
        title="Rețete excluse"
        items={profile.excludedRecipeIds.map((id) => ({ id, label: recipes.get(id)?.name ?? 'Rețetă ștearsă' }))}
        onRemove={(id) => void toggleInProfile(profile, 'excludedRecipeIds', id)}
        hint="Le excluzi din pagina rețetei."
      />
      <ChipList
        title="Îmi place"
        icon={<Heart className="size-4 fill-fat text-fat" />}
        items={profile.likedFoodIds.map((id) => ({ id, label: foods.get(id)?.name ?? 'Aliment șters' }))}
        onRemove={(id) => void toggleInProfile(profile, 'likedFoodIds', id)}
        onAdd={() => setPicking('like')}
        hint="Generatorul de rețete le folosește cu prioritate."
      />

      <ItemPicker
        open={picking !== null}
        onOpenChange={(open) => !open && setPicking(null)}
        title={picking === 'exclude' ? 'Exclude un aliment' : 'Îmi place'}
        allowRecipes={false}
        askQuantity={false}
        onPick={(picked) => {
          if (picked.kind !== 'food') return
          const field = picking === 'exclude' ? 'excludedFoodIds' : 'likedFoodIds'
          if (!profile[field].includes(picked.food.id)) void toggleInProfile(profile, field, picked.food.id)
        }}
      />
    </section>
  )
}

function ChipList({
  title,
  items,
  onRemove,
  onAdd,
  hint,
  icon,
}: {
  title: string
  items: { id: string; label: string }[]
  onRemove: (id: string) => void
  onAdd?: () => void
  hint?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="space-y-2 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="flex-1 text-sm font-semibold">{title}</h3>
        {onAdd && (
          <Button variant="ghost" size="sm" onClick={onAdd}>
            <Plus className="size-4" /> Adaugă
          </Button>
        )}
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item.id} className="flex items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-3 text-xs">
              {item.label}
              <button type="button" aria-label={`Scoate ${item.label}`} className="rounded-full p-0.5 hover:bg-background" onClick={() => onRemove(item.id)}>
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{hint ?? 'Nimic încă.'}</p>
      )}
    </div>
  )
}

function AppSection() {
  const navigate = useNavigate()
  const pending = useOutboxCount()
  const { running, lastError, rejected } = useSyncState()
  const ai = useAiStatus()
  const lastSync = useLiveQuery(() => getMeta('lastSyncAt'))
  const standalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches

  async function signOut() {
    if (pending > 0 && !navigator.onLine) {
      toast.error(`Ai ${pending} modificări netrimise. Conectează-te la internet înainte să ieși, altfel se pierd.`)
      return
    }
    await logout()
    await navigate({ to: '/login' })
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Aplicația</h2>
      <div className="divide-y rounded-2xl border bg-card text-sm">
        <Row label="Sincronizare">
          <span className="text-right text-muted-foreground">
            {running ? 'în curs…' : lastSync ? new Intl.DateTimeFormat('ro-RO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(lastSync)) : 'niciodată'}
            {pending > 0 && <span className="block text-kcal">{pending} de trimis</span>}
            {lastError && <span className="block text-destructive">{lastError}</span>}
            {rejected > 0 && <span className="block text-destructive">{rejected} respinse de server</span>}
          </span>
          <Button variant="ghost" size="icon-sm" aria-label="Sincronizează acum" onClick={() => void syncNow()}>
            <RefreshCw className={cn('size-4', running && 'animate-spin')} />
          </Button>
        </Row>
        <Row label="AI (DeepSeek)">
          <span className="text-muted-foreground">{!ai.online ? 'offline' : ai.configured ? 'pregătit' : 'cheie nesetată pe server'}</span>
        </Row>
        {!standalone && (
          <div className="flex gap-3 p-4">
            <Smartphone className="size-5 shrink-0 text-primary" />
            <p className="text-muted-foreground">
              Pune aplicația pe ecranul telefonului. Pe iPhone: Safari → Share → „Add to Home Screen”. Pe Android: meniul Chrome → „Instalează aplicația”.
            </p>
          </div>
        )}
      </div>
      <Button variant="outline" className="h-11 w-full" onClick={() => void signOut()}>
        <LogOut className="size-4" /> Ieși din cont
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        <Link to="/" className="underline-offset-4 hover:underline">
          MacroMate
        </Link>{' '}
        · datele stau în telefon și se sincronizează când ai internet
      </p>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex-1 font-medium">{label}</span>
      {children}
    </div>
  )
}
