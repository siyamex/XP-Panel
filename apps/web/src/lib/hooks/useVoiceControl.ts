'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface VoiceCommand {
  pattern: RegExp
  action: (match: RegExpMatchArray) => void
  description: string
}

interface UseVoiceControlOptions {
  onTranscript?: (text: string) => void
  onCommand?: (command: string) => void
}

export function useVoiceControl(options: UseVoiceControlOptions = {}) {
  const router = useRouter()
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const commands: VoiceCommand[] = [
    { pattern: /go to dashboard/i, action: () => router.push('/dashboard'), description: 'Navigate to Dashboard' },
    { pattern: /go to domains/i, action: () => router.push('/domains'), description: 'Navigate to Domains' },
    { pattern: /go to dns/i, action: () => router.push('/dns'), description: 'Navigate to DNS' },
    { pattern: /go to email/i, action: () => router.push('/email'), description: 'Navigate to Email' },
    { pattern: /go to files/i, action: () => router.push('/files'), description: 'Navigate to Files' },
    { pattern: /go to databases/i, action: () => router.push('/databases'), description: 'Navigate to Databases' },
    { pattern: /go to backups/i, action: () => router.push('/backups'), description: 'Navigate to Backups' },
    { pattern: /go to monitoring/i, action: () => router.push('/monitoring'), description: 'Navigate to Monitoring' },
    { pattern: /go to security/i, action: () => router.push('/security'), description: 'Navigate to Security' },
    { pattern: /go to docker/i, action: () => router.push('/docker'), description: 'Navigate to Docker' },
    { pattern: /go to billing/i, action: () => router.push('/billing'), description: 'Navigate to Billing' },
    { pattern: /go to ai|open assistant/i, action: () => router.push('/ai'), description: 'Open AI Assistant' },
    { pattern: /go to marketplace/i, action: () => router.push('/marketplace'), description: 'Navigate to Marketplace' },
    { pattern: /go to settings/i, action: () => router.push('/settings'), description: 'Navigate to Settings' },
    { pattern: /open threat map|go to geomap/i, action: () => router.push('/monitoring/geomap'), description: 'Open Threat Map' },
    { pattern: /open pipelines|go to devops/i, action: () => router.push('/devops'), description: 'Navigate to DevOps' },
  ]

  useEffect(() => {
    const supported = typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    setIsSupported(supported)
  }, [])

  const processTranscript = useCallback((text: string) => {
    setTranscript(text)
    options.onTranscript?.(text)

    for (const cmd of commands) {
      const match = text.match(cmd.pattern)
      if (match) {
        options.onCommand?.(text)
        cmd.action(match)
        return
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, options])

  const startListening = useCallback(() => {
    if (!isSupported) { setError('Speech recognition not supported'); return }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognitionAPI()
    recognitionRef.current = recognition

    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => { setIsListening(true); setError(null); setTranscript('') }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = (e) => { setError(e.error); setIsListening(false) }
    recognition.onresult = (e) => {
      const last = e.results[e.results.length - 1]
      const text = last[0].transcript
      setTranscript(text)
      if (last.isFinal) processTranscript(text)
    }

    recognition.start()
  }, [isSupported, processTranscript])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const toggle = useCallback(() => {
    isListening ? stopListening() : startListening()
  }, [isListening, startListening, stopListening])

  return { isListening, isSupported, transcript, error, startListening, stopListening, toggle, commands }
}
