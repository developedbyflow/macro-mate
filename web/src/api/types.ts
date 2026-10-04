import type { components } from './schema'

type Schemas = components['schemas']

export type Food = Schemas['Food']
export type Recipe = Schemas['Recipe']
export type RecipeVariant = Schemas['RecipeVariant']
export type VariantIngredient = Schemas['VariantIngredient']
export type MealPlan = Schemas['MealPlan']
export type Meal = Schemas['Meal']
export type MealItem = Schemas['MealItem']
export type ShoppingList = Schemas['ShoppingList']
export type ShoppingListPlan = Schemas['ShoppingListPlan']
export type DayPlan = Schemas['DayPlan']
export type JournalEntry = Schemas['JournalEntry']
export type UserProfile = Schemas['UserProfile']
export type WeightEntry = Schemas['WeightEntry']
export type PantryItem = Schemas['PantryItem']
export type KitchenInfo = Schemas['KitchenInfo']
export type InviteCreated = Schemas['InviteCreated']
export type InviteInfo = Schemas['InviteInfo']
export type LeaveResult = Schemas['LeaveResult']
export type SyncUser = Schemas['SyncUser']
export type SyncPullResponse = Schemas['SyncPullResponse']
export type SyncPushResponse = Schemas['SyncPushResponse']
export type MeResponse = Schemas['MeResponse']
export type BarcodeProduct = Schemas['BarcodeProduct']
export type NutritionValues = Schemas['NutritionValues']
export type FoodEnrichRequest = Schemas['FoodEnrichRequest']
export type FoodEnrichResponse = Schemas['FoodEnrichResponse']
export type MealScanResult = Schemas['MealScanResult']
export type RecipeGenerateRequest = Schemas['RecipeGenerateRequest']
export type RecipeDraft = Schemas['RecipeDraft']
export type AiStatus = Schemas['AiStatus']
export type AdminUser = Schemas['AdminUser']
export type FoodDemand = Schemas['FoodDemand']
export type OpenReport = Schemas['OpenReport']
export type PromotedFood = Schemas['PromotedFood']

export type SyncRow = Food | Recipe | RecipeVariant | MealPlan | ShoppingList | DayPlan | JournalEntry | UserProfile | WeightEntry | PantryItem

export type TableName =
  | 'foods'
  | 'recipes'
  | 'recipeVariants'
  | 'mealPlans'
  | 'shoppingLists'
  | 'pantryItems'
  | 'dayPlans'
  | 'journalEntries'
  | 'userProfiles'
  | 'weightEntries'

export type RowOf<T extends TableName> = {
  foods: Food
  recipes: Recipe
  recipeVariants: RecipeVariant
  mealPlans: MealPlan
  shoppingLists: ShoppingList
  pantryItems: PantryItem
  dayPlans: DayPlan
  journalEntries: JournalEntry
  userProfiles: UserProfile
  weightEntries: WeightEntry
}[T]
