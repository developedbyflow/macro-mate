import { Apple, CalendarRange, ChartLine, ChefHat, ShoppingBasket, Sun } from 'lucide-react'

export const navTabs = [
  { to: '/', label: 'Azi', icon: Sun, exact: true },
  { to: '/plans', label: 'Planuri', icon: CalendarRange, exact: false },
  { to: '/recipes', label: 'Rețete', icon: ChefHat, exact: false },
  { to: '/foods', label: 'Alimente', icon: Apple, exact: false },
  { to: '/shopping', label: 'Cumpărături', icon: ShoppingBasket, exact: false },
] as const

export const sideTabs = [navTabs[0], { to: '/progress', label: 'Progres', icon: ChartLine, exact: false }, ...navTabs.slice(1)] as const
