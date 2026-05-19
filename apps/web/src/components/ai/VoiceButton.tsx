'use client'

import { useState } from 'react'
import { Mic, MicOff, X, HelpCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVoiceControl } from '@/lib/hooks/useVoiceControl'
import { cn } from '@/lib/utils/cn'

export function VoiceButton() {
  const [showHelp, setShowHelp] = useState(false)
  const [lastCommand, setLastCommand] = useState<string | null>(null)

  const { isListening, isSupported, transcript, error, toggle, commands } = useVoiceControl({
    onCommand: (cmd) => { setLastCommand(cmd); setTimeout(() => setLastCommand(null), 3000) },
  })

  if (!isSupported) return null

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {/* Toast feedback */}
        <AnimatePresence>
          {(transcript || lastCommand || error) && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={cn(
                'max-w-xs rounded-lg px-4 py-2 text-sm shadow-lg',
                error
                  ? 'bg-destructive text-destructive-foreground'
                  : lastCommand
                  ? 'bg-green-500 text-white'
                  : 'bg-card border text-foreground'
              )}
            >
              {error ? `Error: ${error}` : lastCommand ? `Command: "${lastCommand}"` : transcript || '…'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Help panel */}
        <AnimatePresence>
          {showHelp && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-card border rounded-xl shadow-xl p-4 w-64"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm">Voice Commands</span>
                <button onClick={() => setShowHelp(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {commands.slice(0, 10).map((cmd, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Mic className="h-3 w-3 shrink-0 text-primary" />
                    {cmd.description}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => setShowHelp(!showHelp)}
            className="h-10 w-10 rounded-full bg-muted border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-md"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <HelpCircle className="h-4 w-4" />
          </motion.button>

          <motion.button
            onClick={toggle}
            className={cn(
              'h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-colors',
              isListening
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={isListening ? { boxShadow: ['0 0 0 0px rgba(239,68,68,0.4)', '0 0 0 16px rgba(239,68,68,0)', '0 0 0 0px rgba(239,68,68,0)'] } : {}}
            transition={isListening ? { duration: 1.5, repeat: Infinity } : {}}
          >
            {isListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </motion.button>
        </div>
      </div>
    </>
  )
}
