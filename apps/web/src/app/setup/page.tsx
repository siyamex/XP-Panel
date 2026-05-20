'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Server, Shield, Bell, ChevronRight, ChevronLeft, Loader2, Rocket } from 'lucide-react'
import { authApi } from '@/lib/api/auth.api'
import { useAuthStore } from '@/lib/stores/auth.store'
import { toast } from 'sonner'

const STEPS = [
  { id: 'account', title: 'Create Account', icon: Shield },
  { id: 'server', title: 'Add Server', icon: Server },
  { id: 'notifications', title: 'Notifications', icon: Bell },
  { id: 'done', title: 'All Set!', icon: Rocket },
]

export default function SetupWizardPage() {
  const router = useRouter()
  const { setTokens } = useAuthStore()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  const [account, setAccount] = useState({
    orgName: '', orgSlug: '', email: '', username: '', password: '', confirmPassword: ''
  })
  const [server, setServer] = useState({
    hostname: '', ip: '', skip: false
  })
  const [notif, setNotif] = useState({
    email: true, slack: false, slackUrl: '', telegram: false, telegramId: ''
  })

  const handleAccountSubmit = async () => {
    if (!account.orgName || !account.email || !account.password) {
      toast.error('Please fill in all required fields')
      return
    }
    if (account.password !== account.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const result = await authApi.register({
        orgName: account.orgName,
        orgSlug: account.orgSlug || account.orgName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        email: account.email,
        username: account.username || account.email.split('@')[0],
        password: account.password,
      })
      if (result.data) {
        setTokens(result.data.accessToken, result.data.refreshToken)
      }
      setStep(1)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Registration failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleNotifSave = async () => {
    // Save preferences via notification service (best effort)
    try {
      const { default: apiClient } = await import('@/lib/api/client')
      await apiClient.put('/notifications/preferences', {
        email_enabled: notif.email,
        slack_enabled: notif.slack,
        slack_webhook: notif.slackUrl,
        telegram_chat_id: notif.telegramId,
        alerts_enabled: true,
        backups_enabled: true,
        security_enabled: true,
        billing_enabled: true,
      })
    } catch {}
    setStep(3)
  }

  const progress = ((step) / (STEPS.length - 1)) * 100

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-2xl font-bold">
            <Rocket className="h-6 w-6 text-primary" />
            XP-Panel Setup
          </div>
          <p className="text-muted-foreground text-sm">Let&apos;s get your panel configured in a few steps</p>
        </div>

        {/* Progress */}
        <div className="space-y-3">
          <div className="flex justify-between">
            {STEPS.map((s, i) => (
              <div key={s.id} className={`flex flex-col items-center gap-1 ${i <= step ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-colors ${i < step ? 'bg-primary border-primary text-primary-foreground' : i === step ? 'border-primary' : 'border-muted'}`}>
                  {i < step ? <CheckCircle2 className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </div>
                <span className="text-xs font-medium hidden sm:block">{s.title}</span>
              </div>
            ))}
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
          </div>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-card border rounded-2xl p-8 shadow-sm space-y-5"
          >
            {step === 0 && (
              <>
                <div>
                  <h2 className="text-xl font-semibold">Create your account</h2>
                  <p className="text-sm text-muted-foreground mt-1">Set up your organization and admin credentials</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-sm font-medium">Organization Name *</label>
                    <input value={account.orgName} onChange={e => setAccount(a => ({ ...a, orgName: e.target.value }))}
                      placeholder="Acme Corp" className="w-full border border-input rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Email *</label>
                    <input type="email" value={account.email} onChange={e => setAccount(a => ({ ...a, email: e.target.value }))}
                      placeholder="admin@example.com" className="w-full border border-input rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Username</label>
                    <input value={account.username} onChange={e => setAccount(a => ({ ...a, username: e.target.value }))}
                      placeholder="admin" className="w-full border border-input rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Password *</label>
                    <input type="password" value={account.password} onChange={e => setAccount(a => ({ ...a, password: e.target.value }))}
                      placeholder="••••••••" className="w-full border border-input rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Confirm Password *</label>
                    <input type="password" value={account.confirmPassword} onChange={e => setAccount(a => ({ ...a, confirmPassword: e.target.value }))}
                      placeholder="••••••••" className="w-full border border-input rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>
                <button onClick={handleAccountSubmit} disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                  Create Account
                </button>
              </>
            )}

            {step === 1 && (
              <>
                <div>
                  <h2 className="text-xl font-semibold">Add your first server</h2>
                  <p className="text-sm text-muted-foreground mt-1">Connect a server to start managing your hosting</p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Server Hostname</label>
                    <input value={server.hostname} onChange={e => setServer(s => ({ ...s, hostname: e.target.value }))}
                      placeholder="server1.example.com" className="w-full border border-input rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">IP Address</label>
                    <input value={server.ip} onChange={e => setServer(s => ({ ...s, ip: e.target.value }))}
                      placeholder="203.0.113.1" className="w-full border border-input rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    After setup, install the XP-Panel agent on your server:<br />
                    <code className="text-xs font-mono bg-background border rounded px-1.5 py-0.5 mt-1 inline-block">
                      curl -fsSL https://install.xp-panel.io/agent | bash
                    </code>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(0)} className="flex items-center gap-1 px-4 py-2.5 border rounded-lg text-sm hover:bg-muted transition-colors">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button onClick={() => setStep(2)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
                    Continue <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <button onClick={() => setStep(2)} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Skip for now
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <h2 className="text-xl font-semibold">Set up notifications</h2>
                  <p className="text-sm text-muted-foreground mt-1">Get alerted when something needs your attention</p>
                </div>
                <div className="space-y-3">
                  {[
                    { key: 'email' as const, label: 'Email notifications', desc: 'Receive alerts via email' },
                    { key: 'slack' as const, label: 'Slack alerts', desc: 'Post alerts to a Slack channel' },
                    { key: 'telegram' as const, label: 'Telegram alerts', desc: 'Send alerts via Telegram bot' },
                  ].map(ch => (
                    <div key={ch.key} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium">{ch.label}</p>
                        <p className="text-xs text-muted-foreground">{ch.desc}</p>
                      </div>
                      <button onClick={() => setNotif(n => ({ ...n, [ch.key]: !n[ch.key] }))}
                        className={`h-5 w-9 rounded-full transition-colors relative ${notif[ch.key] ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                        <div className={`h-3.5 w-3.5 rounded-full bg-white shadow absolute top-0.5 transition-all ${notif[ch.key] ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  ))}
                  {notif.slack && (
                    <input value={notif.slackUrl} onChange={e => setNotif(n => ({ ...n, slackUrl: e.target.value }))}
                      placeholder="https://hooks.slack.com/services/..."
                      className="w-full border border-input rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  )}
                  {notif.telegram && (
                    <input value={notif.telegramId} onChange={e => setNotif(n => ({ ...n, telegramId: e.target.value }))}
                      placeholder="Telegram Chat ID (e.g. -100123456789)"
                      className="w-full border border-input rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex items-center gap-1 px-4 py-2.5 border rounded-lg text-sm hover:bg-muted transition-colors">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button onClick={handleNotifSave}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
                    Save & Continue <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            {step === 3 && (
              <div className="text-center py-4 space-y-5">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">You&apos;re all set!</h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your XP-Panel is configured and ready to use. Head to the dashboard to start managing your infrastructure.
                  </p>
                </div>
                <button onClick={() => router.push('/dashboard')}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors text-base">
                  <Rocket className="h-4 w-4" />
                  Go to Dashboard
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
