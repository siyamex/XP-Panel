'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shield, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { authApi } from '@/lib/api/auth.api'
import { useAuthStore } from '@/lib/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export default function TwoFactorPage() {
  const router = useRouter()
  const params = useSearchParams()
  const sessionId = params.get('session')
  const { setUser, setTokens } = useAuthStore()

  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [useBackup, setUseBackup] = useState(false)
  const [backupCode, setBackupCode] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { inputRefs.current[0]?.focus() }, [])

  const code = digits.join('')

  const handleDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const next = [...digits]
    next[index] = value
    setDigits(next)
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
    if (next.every(d => d !== '')) submit(next.join(''))
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setDigits(text.split(''))
      submit(text)
    }
  }

  async function submit(otp: string) {
    if (!sessionId) { toast.error('Session expired — please log in again'); return }
    setLoading(true)
    try {
      const res = await authApi.verifyMFA({ mfa_session_id: sessionId, code: otp })
      setUser(res.user)
      setTokens(res.access_token, res.refresh_token)
      router.replace('/dashboard')
    } catch {
      toast.error('Invalid code. Try again.')
      setDigits(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  async function submitBackup() {
    if (!sessionId) { toast.error('Session expired'); return }
    setLoading(true)
    try {
      const res = await authApi.verifyMFA({ mfa_session_id: sessionId, code: backupCode, backup: true })
      setUser(res.user)
      setTokens(res.access_token, res.refresh_token)
      router.replace('/dashboard')
    } catch {
      toast.error('Invalid backup code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Two-factor auth</h1>
          <p className="text-sm text-muted-foreground">
            {useBackup ? 'Enter a backup recovery code' : 'Enter the 6-digit code from your authenticator app'}
          </p>
        </div>

        {!useBackup ? (
          <div className="space-y-6">
            {/* OTP input grid */}
            <div className="flex gap-3 justify-center" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleDigit(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-bold border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  disabled={loading}
                />
              ))}
            </div>

            {loading && (
              <div className="flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            <div className="text-center space-y-2">
              <button
                onClick={() => setUseBackup(true)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Use a backup code instead
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="xxxxxxxx-xxxx"
              value={backupCode}
              onChange={e => setBackupCode(e.target.value)}
              className="w-full px-3 py-2.5 border border-input rounded-lg bg-background text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button className="w-full" onClick={submitBackup} disabled={loading || !backupCode}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify backup code'}
            </Button>
            <button
              onClick={() => setUseBackup(false)}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to authenticator code
            </button>
          </div>
        )}

        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to login
        </Link>
      </div>
    </div>
  )
}
