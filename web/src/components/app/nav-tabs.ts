import { Apple, CalendarRange, ChefHat, ShoppingBasket, Sun } from 'lucide-react'

export const navTabs = [
  { to: '/', label: 'Azi', icon: Sun, exact: true },
  { to: '/plans', label: 'Planuri', icon: CalendarRange, exact: false },
  { to: '/recipes', label: 'Rețete', icon: ChefHat, exact: false },
  { to: '/foods', label: 'Alimente', icon: Apple, exact: false },
  { to: '/shopping', label: 'Cumpărături', icon: ShoppingBasket, exact: false },
] as const
