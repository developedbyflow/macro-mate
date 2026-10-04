import { Link, useRouter } from '@tanstack/react-router'
import { ChevronLeft, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { SyncIndicator } from './sync-indicator'

type Props = {
  title: ReactNode
  subtitle?: ReactNode
  back?: boolean
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, back, actions }: Props) {
  const router = useRouter()
  const { t } = useTranslation()
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-3 lg:mx-0 lg:max-w-none lg:px-7">
        {back && (
          <Button variant="ghost" size="icon" aria-label={t('common.back')} onClick={() => router.history.back()}>
            <ChevronLeft className="size-5" />
          </Button>
        )}
        <div className="min-w-0 flex-1 px-1">
          <h1 className="truncate text-lg leading-tight font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
        {!back && (
          <div className="flex items-center gap-2 lg:hidden">
            <SyncIndicator />
            <Button variant="ghost" size="icon" aria-label={t('common.profile')} render={<Link to="/profile" />}>
              <UserRound className="size-5" />
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
