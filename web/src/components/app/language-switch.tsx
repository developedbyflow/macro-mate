import { useTranslation } from 'react-i18next'
import { languageNames, languages, setLanguage } from '@/i18n'
import { cn } from '@/lib/utils'

export function LanguageSwitch({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const active = i18n.resolvedLanguage

  return (
    <div role="radiogroup" aria-label={t('common.language')} className={cn('grid h-10 grid-cols-2 overflow-hidden rounded-lg border', className)}>
      {languages.map((language) => (
        <button
          key={language}
          type="button"
          role="radio"
          aria-checked={active === language}
          onClick={() => void setLanguage(language)}
          className={cn('text-sm font-medium transition-colors', active === language ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}
        >
          {languageNames[language]}
        </button>
      ))}
    </div>
  )
}
