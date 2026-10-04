export const categories = {
  vegetables: 'legume',
  starchy_vegetables: 'legume cu amidon',
  fruits: 'fructe',
  berries: 'fructe de pădure',
  poultry: 'carne albă',
  red_meat: 'carne roșie',
  cured_meats: 'mezeluri',
  fish_seafood: 'pește și fructe de mare',
  eggs: 'ouă',
  dairy: 'lactate',
  cheese: 'brânzeturi',
  grains_pasta: 'cereale și paste',
  bread_bakery: 'pâine și panificație',
  legumes: 'leguminoase',
  nuts_seeds: 'nuci și semințe',
  oils_fats: 'uleiuri și grăsimi',
  sauces_condiments: 'sosuri și condimente',
  sweets: 'dulciuri',
  drinks: 'băuturi',
} as const

export type CategoryCode = keyof typeof categories

export const categoryCodes = Object.keys(categories) as CategoryCode[]

export function categoryLabel(code: string) {
  return categories[code as CategoryCode] ?? code
}
