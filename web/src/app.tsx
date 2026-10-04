import { RouterProvider } from '@tanstack/react-router'
import { useEffect, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'

export function App({ router }: { router: ComponentProps<typeof RouterProvider>['router'] }) {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage

  useEffect(() => {
    if (language) document.documentElement.lang = language
  }, [language])

  return <RouterProvider key={language} router={router} />
}
