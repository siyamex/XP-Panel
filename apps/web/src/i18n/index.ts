import en from './en.json'
import ar from './ar.json'

export type Locale = 'en' | 'ar'
export type Messages = typeof en

const messages: Record<Locale, Messages> = { en, ar }

export function getMessages(locale: Locale): Messages {
  return messages[locale] ?? messages.en
}

// Simple translation hook
import { useCallback } from 'react'

export function useTranslations(locale: Locale = 'en') {
  const msgs = getMessages(locale)

  const t = useCallback((key: string, params?: Record<string, string>): string => {
    const parts = key.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let val: any = msgs
    for (const part of parts) {
      val = val?.[part]
    }
    if (typeof val !== 'string') return key
    if (params) {
      return Object.entries(params).reduce((s, [k, v]) => s.replace(`{${k}}`, v), val)
    }
    return val
  }, [msgs])

  return t
}
