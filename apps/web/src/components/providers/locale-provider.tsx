'use client'

import { useEffect } from 'react'
import { useUIStore } from '@/lib/stores/ui.store'

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useUIStore(s => s.locale)

  useEffect(() => {
    const html = document.documentElement
    html.lang = locale
    html.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }, [locale])

  return <>{children}</>
}
