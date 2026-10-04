import { Apple, CalendarRange, ChartLine, ChefHat, ShoppingBasket, Sun } from 'lucide-react'
import i18n from '@/i18n'

function tab<T extends string>(to: T, key: 'today' | 'progress' | 'plans' | 'recipes' | 'foods' | 'shopping', icon: typeof Sun, exact: boolean) {
  return {
    to,
    icon,
    exact,
    get label() {
      return i18n.t(`nav.${key}`)
    },
  }
}

export const navTabs = [
  tab('/', 'today', Sun, true),
  tab('/plans', 'plans', CalendarRange, false),
  tab('/recipes', 'recipes', ChefHat, false),
  tab('/foods', 'foods', Apple, false),
  tab('/shopping', 'shopping', ShoppingBasket, false),
] as const

export const sideTabs = [navTabs[0], tab('/progress', 'progress', ChartLine, false), ...navTabs.slice(1)] as const
