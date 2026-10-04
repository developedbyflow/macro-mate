import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Calculator, Heart, LogOut, Plus, RefreshCw, Smartphone, X } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { UserProfile } from '@/api/types'
import { useAiStatus } from '@/hooks/use-ai-status'
import { ItemPicker } from '@/components/app/item-picker'
import { KitchenSection } from '@/components/app/kitchen-section'
import { LanguageSwitch } from '@/components/app/language-switch'
import { NativeSelect } from '@/components/app/native-select'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getMeta } from '@/db/database'
import { saveRow } from '@/db/mutations'
import { logout } from '@/db/session'
import { syncNow, useSyncState } from '@/db/sync'
import { useFoodsById, useMe, useOutboxCount, useProfile, useRecipesById } from '@/hooks/use-data'
import { locale } from '@/i18n'
import { categoryCodes, categoryLabel } from '@/lib/categories'
import { today } from '@/lib/dates'
import { decimal, kcal } from '@/lib/format'
import { activityLevels, computeTargets, energyPlan, goals, type ActivityLevel, type Goal, type Sex } from '@/lib/targets'
import { toggleInProfile } from '@/lib/profile'
import { cn } from '@/lib/utils'
import { foodName } from '@/lib/food-name'
import { AccountSection } from '@/components/app/account-section'

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const { t } = useTranslation()
  const me = useMe()
  const profile = useProfile()
  return (
    <>
      <PageHeader title={me?.displayName ?? t('common.profile')} subtitle={me?.email} back />
      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-4 pb-8 lg:mx-0 lg:grid lg:max-w-none lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0 lg:px-8">
        {profile && <TargetsSection key={profile.id + profile.updatedAt} profile={profile} />}
        <div className="space-y-6">
          <AccountSection />
          <KitchenSection />
          {profile && <PreferencesSection profile={profile} />}
          <AppSection />
        </div>
      </main>
    </>
  )
}

const targetFields = [
  { key: 'targetKcal', label: 'nutrients.kcal', unit: 'kcal' },
  { key: 'targetProteinG', label: 'nutrients.protein', unit: 'g' },
  { key: 'targetCarbsG', label: 'nutrients.carbs', unit: 'g' },
  { key: 'targetFatG', label: 'nutrients.fat', unit: 'g' },
  { key: 'targetFiberG', label: 'nutrients.fiber', unit: 'g' },
  { key: 'targetSodiumMg', label: 'profile.targets.maxSodium', unit: 'mg' },
] as const

type TargetKey = (typeof targetFields)[number]['key']

function TargetsSection({ profile }: { profile: UserProfile }) {
  const { t } = useTranslation()
  const [inputs, setInputs] = useState({
    sex: (profile.sex ?? '') as Sex | '',
    birthYear: profile.birthYear?.toString() ?? '',
    heightCm: profile.heightCm?.toString() ?? '',
    weightKg: profile.weightKg?.toString() ?? '',
    activityLevel: (profile.activityLevel ?? 'light') as ActivityLevel,
    goal: (profile.goal ?? 'lose') as Goal,
    goalWeightKg: profile.goalWeightKg?.toString() ?? '',
    weeklyRateKg: profile.weeklyRateKg || goals[(profile.goal ?? 'lose') as Goal].defaultRate,
  })
  const [plan, setPlan] = useState<ReturnType<typeof energyPlan> | null>(null)
  const [targets, setTargets] = useState<Record<TargetKey, string>>(
    Object.fromEntries(targetFields.map((f) => [f.key, profile[f.key]?.toString() ?? ''])) as Record<TargetKey, string>,
  )

  const birthYear = Number(inputs.birthYear)
  const heightCm = Number(inputs.heightCm.replace(',', '.'))
  const weightKg = Number(inputs.weightKg.replace(',', '.'))
  const ready = inputs.sex !== '' && birthYear > 1900 && heightCm > 100 && weightKg > 30
  const goalWeight = inputs.goal === 'maintain' ? null : Number.parseFloat(inputs.goalWeightKg.replace(',', '.')) || null
  const wrongDirection =
    goalWeight != null && weightKg > 0 && ((inputs.goal === 'lose' && goalWeight >= weightKg) || (inputs.goal === 'gain' && goalWeight <= weightKg))

  function chooseGoal(goal: Goal) {
    setInputs((s) => ({ ...s, goal, weeklyRateKg: goals[goal].defaultRate }))
    setPlan(null)
  }

  function calculate() {
    if (!ready) return
    const planInputs = { sex: inputs.sex as Sex, birthYear, heightCm, weightKg, activityLevel: inputs.activityLevel, goal: inputs.goal, weeklyRateKg: inputs.weeklyRateKg }
    setPlan(energyPlan(planInputs))
    const computed = computeTargets(planInputs)
    setTargets({
      targetKcal: String(computed.kcal),
      targetProteinG: String(computed.proteinG),
      targetCarbsG: String(computed.carbsG),
      targetFatG: String(computed.fatG),
      targetFiberG: String(computed.fiberG),
      targetSodiumMg: String(computed.sodiumMg),
    })
  }

  async function save() {
    const goalChanged = goalWeight !== profile.goalWeightKg || inputs.goal !== profile.goal || profile.goalStartWeightKg == null
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
        goalWeightKg: goalWeight,
        weeklyRateKg: inputs.goal === 'maintain' ? 0 : inputs.weeklyRateKg,
        goalStartWeightKg: goalWeight == null ? null : goalChanged ? weightKg || null : profile.goalStartWeightKg,
        goalStartDate: goalWeight == null ? null : goalChanged ? today() : profile.goalStartDate,
        ...parsed,
      },
      profile.userId,
    )
    toast.success(t('profile.targets.saved'))
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{t('profile.targets.title')}</h2>
      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('profile.targets.sex')}>
            <NativeSelect value={inputs.sex} onChange={(e) => setInputs((s) => ({ ...s, sex: e.target.value as Sex }))}>
              <option value="">{t('profile.targets.choose')}</option>
              <option value="male">{t('profile.targets.male')}</option>
              <option value="female">{t('profile.targets.female')}</option>
            </NativeSelect>
          </Field>
          <Field label={t('profile.targets.birthYear')}>
            <Input inputMode="numeric" value={inputs.birthYear} onChange={(e) => setInputs((s) => ({ ...s, birthYear: e.target.value }))} className="h-10" />
          </Field>
          <Field label={t('profile.targets.height')}>
            <Input inputMode="decimal" value={inputs.heightCm} onChange={(e) => setInputs((s) => ({ ...s, heightCm: e.target.value }))} className="h-10" />
          </Field>
          <Field label={t('profile.targets.weight')}>
            <Input inputMode="decimal" value={inputs.weightKg} onChange={(e) => setInputs((s) => ({ ...s, weightKg: e.target.value }))} className="h-10" />
          </Field>
        </div>
        <Field label={t('profile.targets.activity')}>
          <NativeSelect value={inputs.activityLevel} onChange={(e) => setInputs((s) => ({ ...s, activityLevel: e.target.value as ActivityLevel }))}>
            {Object.entries(activityLevels).map(([key, level]) => (
              <option key={key} value={key}>
                {level.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('profile.targets.goal')}>
          <div className="grid h-10 grid-cols-3 overflow-hidden rounded-lg border">
            {Object.entries(goals).map(([key, goal]) => (
              <button
                key={key}
                type="button"
                onClick={() => chooseGoal(key as Goal)}
                className={cn('text-xs font-medium', inputs.goal === key ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}
              >
                {goal.label}
              </button>
            ))}
          </div>
        </Field>
        {inputs.goal !== 'maintain' && (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3">
            <Field label={t('profile.targets.goalWeight')}>
              <Input
                inputMode="decimal"
                value={inputs.goalWeightKg}
                onChange={(e) => setInputs((s) => ({ ...s, goalWeightKg: e.target.value }))}
                placeholder={t('profile.targets.optional')}
                className="h-10"
              />
            </Field>
            <div className="space-y-1.5">
              <span className="block text-sm font-medium">{t('profile.targets.weeklyRate')}</span>
              <div className="grid h-10 overflow-hidden rounded-lg border" style={{ gridTemplateColumns: `repeat(${goals[inputs.goal].rates.length}, minmax(0, 1fr))` }}>
                {goals[inputs.goal].rates.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => {
                      setInputs((s) => ({ ...s, weeklyRateKg: rate }))
                      setPlan(null)
                    }}
                    className={cn('text-xs font-medium tabular-nums', inputs.weeklyRateKg === rate ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}
                  >
                    {decimal(rate)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {wrongDirection && (
          <p className="text-xs text-destructive">
            {inputs.goal === 'lose' ? t('profile.targets.loseWrongDirection') : t('profile.targets.gainWrongDirection')}
          </p>
        )}
        <Button variant="secondary" className="h-10 w-full" disabled={!ready} onClick={calculate}>
          <Calculator className="size-4" /> {t('profile.targets.calculate')}
        </Button>
        {plan ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed">
            {t('profile.targets.planEnergy', { bmr: kcal(plan.bmr), tdee: kcal(plan.tdee) })}{' '}
            {plan.rate > 0 ? (
              <Trans
                i18nKey="profile.targets.planChange"
                values={{ change: `${plan.dailyChange < 0 ? '−' : '+'}${kcal(Math.abs(plan.dailyChange))}`, rate: decimal(plan.rate), target: kcal(plan.kcal) }}
                components={{ strong: <strong /> }}
              />
            ) : (
              <Trans i18nKey="profile.targets.planMaintain" values={{ target: kcal(plan.kcal) }} components={{ strong: <strong /> }} />
            )}
            {plan.limitedByBmr && ` ${t('profile.targets.planLimitedByBmr')}`}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{t('profile.targets.formula')}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4">
        {targetFields.map((field) => (
          <Field key={field.key} label={t(field.label)}>
            <div className="relative">
              <Input
                inputMode="decimal"
                value={targets[field.key]}
                onChange={(e) => setTargets((s) => ({ ...s, [field.key]: e.target.value }))}
                className="h-10 pr-12 tabular-nums"
                placeholder="—"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{field.unit}</span>
            </div>
          </Field>
        ))}
        <Button className="col-span-2 h-11" onClick={() => void save()}>
          {t('profile.targets.save')}
        </Button>
      </div>
    </section>
  )
}

function PreferencesSection({ profile }: { profile: UserProfile }) {
  const { t } = useTranslation()
  const foods = useFoodsById()
  const recipes = useRecipesById()
  const [picking, setPicking] = useState<'exclude' | 'like' | null>(null)

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{t('profile.preferences.title')}</h2>
      <p className="-mt-2 text-sm text-muted-foreground">{t('profile.preferences.intro')}</p>

      <div className="space-y-2 rounded-2xl border bg-card p-4">
        <h3 className="text-sm font-semibold">{t('profile.preferences.excludedCategories')}</h3>
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
                {categoryLabel(code)}
              </button>
            )
          })}
        </div>
      </div>

      <ChipList
        title={t('profile.preferences.excludedFoods')}
        items={profile.excludedFoodIds.map((id) => ({ id, label: foodName(foods.get(id)) ?? t('fallback.deletedFood') }))}
        onRemove={(id) => void toggleInProfile(profile, 'excludedFoodIds', id)}
        onAdd={() => setPicking('exclude')}
      />
      <ChipList
        title={t('profile.preferences.excludedRecipes')}
        items={profile.excludedRecipeIds.map((id) => ({ id, label: recipes.get(id)?.name ?? t('fallback.deletedRecipe') }))}
        onRemove={(id) => void toggleInProfile(profile, 'excludedRecipeIds', id)}
        hint={t('profile.preferences.excludedRecipesHint')}
      />
      <ChipList
        title={t('profile.preferences.liked')}
        icon={<Heart className="size-4 fill-fat text-fat" />}
        items={profile.likedFoodIds.map((id) => ({ id, label: foodName(foods.get(id)) ?? t('fallback.deletedFood') }))}
        onRemove={(id) => void toggleInProfile(profile, 'likedFoodIds', id)}
        onAdd={() => setPicking('like')}
        hint={t('profile.preferences.likedHint')}
      />

      <ItemPicker
        open={picking !== null}
        onOpenChange={(open) => !open && setPicking(null)}
        title={picking === 'exclude' ? t('profile.preferences.excludeFood') : t('profile.preferences.liked')}
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
  const { t } = useTranslation()
  return (
    <div className="space-y-2 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="flex-1 text-sm font-semibold">{title}</h3>
        {onAdd && (
          <Button variant="ghost" size="sm" onClick={onAdd}>
            <Plus className="size-4" /> {t('common.add')}
          </Button>
        )}
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item.id} className="flex items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-3 text-xs">
              {item.label}
              <button type="button" aria-label={t('profile.preferences.remove', { name: item.label })} className="rounded-full p-0.5 hover:bg-background" onClick={() => onRemove(item.id)}>
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{hint ?? t('profile.preferences.empty')}</p>
      )}
    </div>
  )
}

function AppSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pending = useOutboxCount()
  const { running, lastError, rejected } = useSyncState()
  const ai = useAiStatus()
  const lastSync = useLiveQuery(() => getMeta('lastSyncAt'))
  const standalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches

  async function signOut() {
    if (pending > 0 && !navigator.onLine) {
      toast.error(t('profile.app.unsentChanges', { count: pending }))
      return
    }
    await logout()
    await navigate({ to: '/login' })
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t('profile.app.title')}</h2>
      <div className="divide-y rounded-2xl border bg-card text-sm">
        <Row label={t('common.language')}>
          <LanguageSwitch className="h-8 w-44" />
        </Row>
        <Row label={t('profile.app.sync')}>
          <span className="text-right text-muted-foreground">
            {running ? t('profile.app.syncing') : lastSync ? new Intl.DateTimeFormat(locale(), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(lastSync)) : t('profile.app.neverSynced')}
            {pending > 0 && <span className="block text-kcal">{t('sync.pending', { pending })}</span>}
            {lastError && <span className="block text-destructive">{lastError}</span>}
            {rejected > 0 && <span className="block text-destructive">{t('profile.app.rejected', { rejected })}</span>}
          </span>
          <Button variant="ghost" size="icon-sm" aria-label={t('profile.app.syncNow')} onClick={() => void syncNow()}>
            <RefreshCw className={cn('size-4', running && 'animate-spin')} />
          </Button>
        </Row>
        <Row label={t('profile.app.ai')}>
          <span className="text-muted-foreground">{!ai.online ? t('profile.app.aiOffline') : ai.configured ? t('profile.app.aiReady') : t('profile.app.aiKeyMissing')}</span>
        </Row>
        {!standalone && (
          <div className="flex gap-3 p-4">
            <Smartphone className="size-5 shrink-0 text-primary" />
            <p className="text-muted-foreground">{t('profile.app.install')}</p>
          </div>
        )}
      </div>
      <Button variant="outline" className="h-11 w-full" onClick={() => void signOut()}>
        <LogOut className="size-4" /> {t('profile.app.signOut')}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        <Link to="/" className="underline-offset-4 hover:underline">
          MacroMate
        </Link>{' '}
        · {t('profile.app.dataNote')}
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
