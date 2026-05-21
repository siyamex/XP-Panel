'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { KeyRound, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { authApi } from '@/lib/api/auth.api'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase',     ok: /[A-Z]/.test(password) },
    { label: 'Lowercase',     ok: /[a-z]/.test(password) },
    { label: 'Number',        ok: /\d/.test(password) },
    { label: 'Symbol',        ok: /[^A-Za-z0-9]/.test(password) },
  ]
  const score = checks.filter(c => c.ok).length
  const colors = ['bg-red-500', 'bg-red-400', 'bg-amber-400', 'bg-yellow-400', 'bg-green-500']
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {colors.map((c, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? c : 'bg-muted'}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map(({ label, ok }) => (
          <span key={label} className={`text-xs ${ok ? 'text-green-500' : 'text-muted-foreground'}`}>
            {ok ? '✓' : '○'} {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const isValid = password.length >= 8 && password === confirm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || !token) return
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
      setTimeout(() => router.replace('/login'), 3000)
    } catch {
      toast.error('Reset link is invalid or expired. Request a new one.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">Invalid reset link.</p>
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Request a new one
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary">
            <KeyRound className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Set new password</h1>
          <p className="text-sm text-muted-foreground">Choose a strong password for your account</p>
        </div>

        {done ? (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-6 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
            <p className="text-sm font-medium">Password updated!</p>
            <p className="text-xs text-muted-foreground">Redirecting to login…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoFocus
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && <PasswordStrength password={password} />}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className={confirm && confirm !== password ? 'border-red-500' : ''}
              />
              {confirm && confirm !== password && (
                <p className="text-xs text-red-500">Passwords don't match</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading || !isValid}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
