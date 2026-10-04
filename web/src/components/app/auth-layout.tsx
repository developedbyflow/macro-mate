import type { ReactNode } from 'react'
import { LanguageSwitch } from './language-switch'

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src="/pwa-192x192.png" alt="" className="size-16 rounded-2xl shadow-sm" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {children}
        <LanguageSwitch className="mx-auto mt-6 h-8 w-44" />
      </div>
    </main>
  )
}
