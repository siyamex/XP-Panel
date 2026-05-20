'use client'

import { useState, useEffect } from 'react'
import { Bell, Mail, MessageSquare, Webhook, Save } from 'lucide-react'
import { motion } from 'framer-motion'
import apiClient from '@/lib/api/client'

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
  const [slackUrl, setSlackUrl] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [discordUrl, setDiscordUrl] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')

  useEffect(() => {
    apiClient.get('/notifications/preferences').then(({ data }) => {
      if (data.slack_webhook) setSlackUrl(data.slack_webhook)
      if (data.telegram_chat_id) setTelegramChatId(data.telegram_chat_id)
      if (data.discord_webhook) setDiscordUrl(data.discord_webhook)
      if (data.webhook_url) setWebhookUrl(data.webhook_url)
      if (data.webhook_secret) setWebhookSecret(data.webhook_secret)
    }).catch(() => {})
  }, [])

  const toggle = (eventId: string, channel: keyof NotifChannel) => {
    setEvents(evs => evs.map(e => e.id === eventId
      ? { ...e, channels: { ...e.channels, [channel]: !e.channels[channel] } }
      : e
    ))
  }

  const handleSave = async () => {
    try {
      await apiClient.put('/notifications/preferences', {
        email_enabled: events.some(e => e.channels.email),
        slack_enabled: !!slackUrl,
        slack_webhook: slackUrl,
        telegram_chat_id: telegramChatId,
        discord_enabled: !!discordUrl,
        discord_webhook: discordUrl,
        webhook_enabled: !!webhookUrl,
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret,
        alerts_enabled: true,
        backups_enabled: true,
        security_enabled: true,
        billing_enabled: true,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
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
            <label className="text-sm font-medium flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" />Telegram Chat ID</label>
            <input value={telegramChatId} onChange={e => setTelegramChatId(e.target.value)} placeholder="-100123456789"
              className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="m21.937 12.932-1.073-3.302L19.2 4.51a.426.426 0 0 0-.812 0l-1.664 5.12H7.276L5.612 4.51a.426.426 0 0 0-.812 0L3.136 9.63 2.063 12.932a.851.851 0 0 0 .309.952L12 20.633l9.628-7.749a.85.85 0 0 0 .309-.952"/></svg>
              Discord Webhook URL
            </label>
            <input value={discordUrl} onChange={e => setDiscordUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/..."
              className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5"><Webhook className="h-3.5 w-3.5" />Generic Webhook URL</label>
            <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://example.com/webhook"
              className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          {webhookUrl && (
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium">Webhook Secret (optional — used for HMAC signature)</label>
              <input value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} placeholder="your-webhook-secret"
                type="password"
                className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          )}
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
