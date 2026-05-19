'use client'

import { useState } from 'react'
import { Shield, Smartphone, Key, Monitor, Trash2, QrCode, CheckCircle2, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'

const MOCK_SESSIONS = [
  { id: '1', device: 'Chrome on macOS', ip: '192.168.1.100', location: 'New York, US', last_active: new Date(Date.now() - 60000), current: true },
  { id: '2', device: 'Firefox on Windows', ip: '203.0.113.45', location: 'London, UK', last_active: new Date(Date.now() - 3600000 * 2), current: false },
  { id: '3', device: 'Safari on iPhone', ip: '198.51.100.22', location: 'Tokyo, JP', last_active: new Date(Date.now() - 3600000 * 24), current: false },
]

export default function SecurityPage() {
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [showMfaSetup, setShowMfaSetup] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [sessions, setSessions] = useState(MOCK_SESSIONS)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' })
  const [passwordSaved, setPasswordSaved] = useState(false)

  const handleEnableMfa = () => {
    if (mfaCode.length === 6) {
      setMfaEnabled(true)
      setShowMfaSetup(false)
      setMfaCode('')
    }
  }

  const handleChangePassword = () => {
    if (passwords.new && passwords.new === passwords.confirm) {
      setPasswordSaved(true)
      setShowPasswordForm(false)
      setPasswords({ current: '', new: '', confirm: '' })
      setTimeout(() => setPasswordSaved(false), 3000)
    }
  }

  const revokeSession = (id: string) => setSessions(s => s.filter(x => x.id !== id))

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage authentication, MFA, and active sessions</p>
      </div>

      {/* Password */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Key className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Password</p>
              <p className="text-xs text-muted-foreground">Last changed 30 days ago</p>
            </div>
          </div>
          <button onClick={() => setShowPasswordForm(!showPasswordForm)} className="text-sm text-primary hover:underline">
            {showPasswordForm ? 'Cancel' : 'Change'}
          </button>
        </div>

        <AnimatePresence>
          {showPasswordForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="pt-2 space-y-3 border-t">
                {['current', 'new', 'confirm'].map((field) => (
                  <div key={field} className="space-y-1">
                    <label className="text-xs font-medium capitalize">{field.replace('_', ' ')} Password</label>
                    <input type="password" value={passwords[field as keyof typeof passwords]}
                      onChange={e => setPasswords(p => ({ ...p, [field]: e.target.value }))}
                      className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                ))}
                <button onClick={handleChangePassword} className="h-9 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
                  Update Password
                </button>
                {passwordSaved && <span className="text-sm text-green-500 ml-3">Password updated!</span>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* MFA */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${mfaEnabled ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
              <Smartphone className={`h-4 w-4 ${mfaEnabled ? 'text-green-500' : 'text-amber-500'}`} />
            </div>
            <div>
              <p className="font-medium text-sm">Two-Factor Authentication</p>
              <p className="text-xs text-muted-foreground">{mfaEnabled ? 'Enabled via authenticator app' : 'Add an extra layer of security'}</p>
            </div>
          </div>
          {mfaEnabled
            ? <span className="flex items-center gap-1 text-xs text-green-500 font-medium"><CheckCircle2 className="h-3.5 w-3.5" />Active</span>
            : <button onClick={() => setShowMfaSetup(true)} className="text-sm text-primary hover:underline">Enable</button>
          }
        </div>

        {!mfaEnabled && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">Your account is not protected with two-factor authentication. We strongly recommend enabling it.</p>
          </div>
        )}
      </div>

      {/* MFA Setup Modal */}
      <AnimatePresence>
        {showMfaSetup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowMfaSetup(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-card border rounded-xl p-6 w-full max-w-sm space-y-5">
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <QrCode className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Setup Authenticator</h3>
                <p className="text-xs text-muted-foreground">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
              </div>

              {/* Fake QR code */}
              <div className="flex items-center justify-center">
                <div className="h-40 w-40 bg-white p-2 rounded-lg">
                  <div className="grid grid-cols-5 gap-0.5 h-full">
                    {Array.from({ length: 25 }, (_, i) => (
                      <div key={i} className={`rounded-sm ${Math.random() > 0.4 ? 'bg-black' : 'bg-white'}`} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Enter 6-digit code to confirm</label>
                <input value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000" className="w-full h-10 px-3 rounded-md border bg-background text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowMfaSetup(false)} className="flex-1 h-9 border rounded-md text-sm hover:bg-muted transition-colors">Cancel</button>
                <button onClick={handleEnableMfa} disabled={mfaCode.length !== 6}
                  className="flex-1 h-9 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  Verify & Enable
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Passkeys */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Passkeys</p>
              <p className="text-xs text-muted-foreground">Sign in with biometrics or hardware security key</p>
            </div>
          </div>
          <button className="text-sm text-primary hover:underline">Add Passkey</button>
        </div>
        <p className="text-xs text-muted-foreground">No passkeys registered yet. Add a passkey to enable passwordless sign-in.</p>
      </div>

      {/* Active Sessions */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-foreground/5 flex items-center justify-center">
              <Monitor className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm">Active Sessions</p>
              <p className="text-xs text-muted-foreground">{sessions.length} active session{sessions.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={() => setSessions(s => s.filter(x => x.current))} className="text-xs text-destructive hover:underline">Revoke all others</button>
        </div>

        <div className="space-y-3">
          {sessions.map(session => (
            <div key={session.id} className="flex items-center justify-between py-3 border-t">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{session.device}</span>
                  {session.current && <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded font-medium">Current</span>}
                </div>
                <p className="text-xs text-muted-foreground">{session.ip} · {session.location} · {format(session.last_active, 'MMM d, HH:mm')}</p>
              </div>
              {!session.current && (
                <button onClick={() => revokeSession(session.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
