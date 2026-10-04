import Dexie, { type EntityTable } from 'dexie'
import type {
  DayPlan,
  Food,
  JournalEntry,
  MealPlan,
  MeResponse,
  PantryItem,
  Recipe,
  RecipeVariant,
  ShoppingList,
  SyncUser,
  TableName,
  UserProfile,
  WeightEntry,
} from '@/api/types'

export type OutboxEntry = {
  seq?: number
  table: TableName
  op: 'upsert' | 'delete'
  rowId: string
  data?: unknown
  createdAt: string
}

export type LocalPhoto = {
  id: string
  blob: Blob
  uploaded: 0 | 1
}

export type MetaEntry =
  | { key: 'cursor'; value: number }
  | { key: 'me'; value: MeResponse }
  | { key: 'lastSyncAt'; value: string }
  | { key: 'recentFoods'; value: string[] }
  | { key: 'kitchenId'; value: string }

export class MacroMateDb extends Dexie {
  foods!: EntityTable<Food, 'id'>
  recipes!: EntityTable<Recipe, 'id'>
  recipeVariants!: EntityTable<RecipeVariant, 'id'>
  mealPlans!: EntityTable<MealPlan, 'id'>
  shoppingLists!: EntityTable<ShoppingList, 'id'>
  pantryItems!: EntityTable<PantryItem, 'id'>
  dayPlans!: EntityTable<DayPlan, 'id'>
  journalEntries!: EntityTable<JournalEntry, 'id'>
  userProfiles!: EntityTable<UserProfile, 'id'>
  weightEntries!: EntityTable<WeightEntry, 'id'>
  users!: EntityTable<SyncUser, 'id'>
  outbox!: EntityTable<OutboxEntry, 'seq'>
  photos!: EntityTable<LocalPhoto, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor() {
    super('macromate')
    this.version(1).stores({
      foods: 'id, name, category, barcode',
      recipes: 'id, name',
      recipeVariants: 'id, recipeId',
      mealPlans: 'id, name',
      shoppingLists: 'id',
      dayPlans: 'id, date',
      journalEntries: 'id, date',
      userProfiles: 'id, userId',
      users: 'id',
      outbox: '++seq, [table+rowId]',
      photos: 'id, uploaded',
      meta: 'key',
    })
    this.version(2).stores({
      weightEntries: 'id, date',
    })
    this.version(3).stores({
      pantryItems: 'id, foodId',
    })
  }
}

export const db = new MacroMateDb()

export const syncedTables: TableName[] = [
  'foods',
  'recipes',
  'recipeVariants',
  'mealPlans',
  'shoppingLists',
  'pantryItems',
  'dayPlans',
  'journalEntries',
  'userProfiles',
  'weightEntries',
]

export const personalTables: TableName[] = ['dayPlans', 'journalEntries', 'userProfiles', 'weightEntries']

export const kitchenTables: TableName[] = ['recipes', 'recipeVariants', 'mealPlans', 'shoppingLists', 'pantryItems']

export async function getMeta<K extends MetaEntry['key']>(key: K) {
  const entry = await db.meta.get(key)
  return entry?.value as Extract<MetaEntry, { key: K }>['value'] | undefined
}

export async function setMeta<E extends MetaEntry>(entry: E) {
  await db.meta.put(entry)
}

export async function resetKitchenData(kitchenId: string) {
  const tables = [...kitchenTables, 'foods'] as const
  await db.transaction('rw', [...tables.map((t) => db.table(t)), db.meta], async () => {
    await Promise.all(tables.map((t) => db.table(t).clear()))
    await setMeta({ key: 'cursor', value: 0 })
    await setMeta({ key: 'kitchenId', value: kitchenId })
  })
}

export async function clearLocalData() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
}
