'use client'

import { useState } from 'react'
import { KeyRound, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { authApi } from '@/lib/api/auth.api'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch {
      toast.error('Failed to send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary">
            <KeyRound className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Reset password</h1>
          <p className="text-sm text-muted-foreground">
            {sent
              ? "Check your inbox for a reset link"
              : "Enter your email and we'll send a reset link"}
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-6 text-center space-y-3">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
            <p className="text-sm">
              We sent a password reset link to <strong>{email}</strong>.
              Check your spam folder if you don't see it.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setSent(false); setEmail('') }}
            >
              Send to a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !email}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
            </Button>
          </form>
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
