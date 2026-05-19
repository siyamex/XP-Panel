'use client'

import { useState } from 'react'
import { Bell, Mail, MessageSquare, Webhook, Save } from 'lucide-react'
import { motion } from 'framer-motion'

interface NotifChannel { email: boolean; slack: boolean; telegram: boolean; discord: boolean; webhook: boolean }
interface NotifEvent { id: string; label: string; description: string; channels: NotifChannel }

const DEFAULT_EVENTS: NotifEvent[] = [
  { id: 'server_down', label: 'Server Down', description: 'Alert when a server becomes unreachable', channels: { email: true, slack: true, telegram: false, discord: false, webhook: true } },
  { id: 'cpu_high', label: 'High CPU Usage', description: 'CPU exceeds 90% for more than 5 minutes', channels: { email: true, slack: false, telegram: false, discord: false, webhook: false } },
  { id: 'disk_full', label: 'Disk Space Critical', description: 'Disk usage above 85%', channels: { email: true, slack: true, telegram: true, discord: false, webhook: false } },
  { id: 'ssl_expiry', label: 'SSL Certificate Expiring', description: '14 days before SSL certificate expires', channels: { email: true, slack: false, telegram: false, discord: false, webhook: false } },
  { id: 'backup_failed', label: 'Backup Failed', description: 'A scheduled backup job failed', channels: { email: true, slack: true, telegram: false, discord: false, webhook: true } },
  { id: 'login_failed', label: 'Failed Login Attempts', description: '5+ consecutive failed logins', channels: { email: true, slack: false, telegram: false, discord: false, webhook: false } },
  { id: 'domain_added', label: 'Domain Added', description: 'A new domain is added to your account', channels: { email: false, slack: false, telegram: false, discord: false, webhook: false } },
  { id: 'invoice_paid', label: 'Invoice Paid', description: 'Payment confirmed for an invoice', channels: { email: true, slack: false, telegram: false, discord: false, webhook: false } },
]

const CHANNELS = [
  { id: 'email' as const, label: 'Email', icon: Mail },
  { id: 'slack' as const, label: 'Slack', icon: MessageSquare },
  { id: 'telegram' as const, label: 'Telegram', icon: Bell },
  { id: 'discord' as const, label: 'Discord', icon: MessageSquare },
  { id: 'webhook' as const, label: 'Webhook', icon: Webhook },
]

export default function NotificationsPage() {
  const [events, setEvents] = useState(DEFAULT_EVENTS)
  const [saved, setSaved] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [slackUrl, setSlackUrl] = useState('')

  const toggle = (eventId: string, channel: keyof NotifChannel) => {
    setEvents(evs => evs.map(e => e.id === eventId
      ? { ...e, channels: { ...e.channels, [channel]: !e.channels[channel] } }
      : e
    ))
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground text-sm mt-1">Choose which events trigger alerts and via which channels</p>
      </div>

      {/* Channel config */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Channel Configuration</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" />Slack Webhook URL</label>
            <input value={slackUrl} onChange={e => setSlackUrl(e.target.value)} placeholder="https://hooks.slack.com/services/..."
              className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5"><Webhook className="h-3.5 w-3.5" />Generic Webhook URL</label>
            <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://example.com/webhook"
              className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
      </div>

      {/* Events table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground w-64">Event</th>
                {CHANNELS.map(ch => (
                  <th key={ch.id} className="text-center py-3 px-3 font-medium text-muted-foreground w-20">
                    <div className="flex flex-col items-center gap-1">
                      <ch.icon className="h-3.5 w-3.5" />
                      <span className="text-xs">{ch.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map(event => (
                <tr key={event.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-medium">{event.label}</p>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                  </td>
                  {CHANNELS.map(ch => (
                    <td key={ch.id} className="py-3 px-3 text-center">
                      <button
                        onClick={() => toggle(event.id, ch.id)}
                        className={`h-5 w-9 rounded-full transition-colors relative ${event.channels[ch.id] ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                      >
                        <div className={`h-3.5 w-3.5 rounded-full bg-white shadow absolute top-0.5 transition-all ${event.channels[ch.id] ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="flex items-center gap-2 h-9 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <Save className="h-4 w-4" />Save Preferences
        </button>
        {saved && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-green-500 font-medium">
            Preferences saved!
          </motion.span>
        )}
      </div>
    </div>
  )
}
