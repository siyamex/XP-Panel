import { useEffect } from 'react'
import { useUIStore } from '@/lib/stores/ui.store'

/**
 * Registers the global ⌘K / Ctrl+K shortcut and exposes open/close/toggle.
 * Mount this once at the root layout — it registers the keyboard listener.
 */
export function useCommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setCommandPaletteOpen])

  return {
    open: commandPaletteOpen,
    setOpen: setCommandPaletteOpen,
    toggle: () => setCommandPaletteOpen(!commandPaletteOpen),
  }
}
