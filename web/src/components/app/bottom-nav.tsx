import { Link } from '@tanstack/react-router'
import { navTabs } from './nav-tabs'

export function BottomNav() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-md lg:hidden">
      <ul className="mx-auto grid h-16 max-w-2xl grid-cols-5">
        {navTabs.map(({ to, label, icon: Icon, exact }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact }}
              className="group flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors data-[status=active]:text-primary"
            >
              <span className="flex h-7 w-12 items-center justify-center rounded-full transition-colors group-data-[status=active]:bg-accent">
                <Icon className="size-5" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
