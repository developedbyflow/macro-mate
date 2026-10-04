import { Link } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMe } from '@/hooks/use-data'
import { sideTabs } from './nav-tabs'
import { SyncIndicator } from './sync-indicator'

const linkClass =
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-primary'

export function SideNav() {
  const { t } = useTranslation()
  const me = useMe()
  const name = me?.displayName || t('common.profile')
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border/70 bg-sidebar lg:flex">
      <Link to="/" className="flex h-14 items-center gap-2.5 px-5">
        <img src="/logo.svg" alt="" className="size-7" />
        <span className="text-base font-semibold">MacroMate</span>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-1">
          {sideTabs.map(({ to, label, icon: Icon, exact }) => (
            <li key={to}>
              <Link to={to} activeOptions={{ exact }} className={linkClass}>
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          ))}
          {me?.isAdmin && (
            <li>
              <Link to="/admin" className={linkClass}>
                <ShieldCheck className="size-5" />
                {t('nav.admin')}
              </Link>
            </li>
          )}
        </ul>
      </nav>
      <div className="flex items-center gap-1 border-t border-border/70 p-3">
        <Link to="/profile" className={`${linkClass} flex-1`}>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary uppercase">{name.slice(0, 1)}</span>
          <span className="min-w-0 truncate">{name}</span>
        </Link>
        <SyncIndicator />
      </div>
    </aside>
  )
}
