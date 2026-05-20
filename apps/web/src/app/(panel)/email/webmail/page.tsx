'use client'

import { useState } from 'react'
import { Mail, ExternalLink, Globe } from 'lucide-react'

const WEBMAIL_CLIENTS = [
  {
    id: 'roundcube',
    name: 'Roundcube',
    desc: 'Feature-rich webmail with modern UI',
    url: process.env.NEXT_PUBLIC_ROUNDCUBE_URL ?? '/webmail',
    color: 'text-blue-500',
  },
  {
    id: 'rainloop',
    name: 'RainLoop',
    desc: 'Fast, lightweight webmail client',
    url: process.env.NEXT_PUBLIC_RAINLOOP_URL ?? '/rainloop',
    color: 'text-purple-500',
  },
  {
    id: 'snappymail',
    name: 'SnappyMail',
    desc: 'Modern fork of RainLoop',
    url: process.env.NEXT_PUBLIC_SNAPPYMAIL_URL ?? '/snappymail',
    color: 'text-green-500',
  },
]

export default function WebmailPage() {
  const [active, setActive] = useState<string | null>(null)
  const activeClient = WEBMAIL_CLIENTS.find(c => c.id === active)

  if (active && activeClient) {
    return (
      <div className="flex flex-col h-[calc(100vh-5rem)]">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h1 className="font-semibold">{activeClient.name}</h1>
          </div>
          <div className="flex gap-2">
            <a href={activeClient.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />Open in new tab
            </a>
            <button onClick={() => setActive(null)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted transition-colors">
              ← Back
            </button>
          </div>
        </div>
        <iframe
          src={activeClient.url}
          className="flex-1 rounded-xl border border-border w-full"
          title={activeClient.name}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Webmail</h1>
        <p className="text-muted-foreground text-sm mt-1">Access your email from the browser</p>
      </div>

      <div className="grid gap-4">
        {WEBMAIL_CLIENTS.map(client => (
          <div key={client.id} className="bg-card border rounded-xl p-5 flex items-center justify-between hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Globe className={`h-5 w-5 ${client.color}`} />
              </div>
              <div>
                <h2 className="font-semibold text-sm">{client.name}</h2>
                <p className="text-xs text-muted-foreground">{client.desc}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setActive(client.id)}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                Open
              </button>
              <a href={client.url} target="_blank" rel="noopener noreferrer"
                className="p-1.5 text-muted-foreground border rounded-lg hover:bg-muted transition-colors">
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-muted/50 border rounded-xl p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-sm">Configuration</p>
        <p>Set webmail URLs via environment variables:</p>
        <pre className="mt-2 font-mono">
{`NEXT_PUBLIC_ROUNDCUBE_URL=https://mail.example.com/roundcube
NEXT_PUBLIC_RAINLOOP_URL=https://mail.example.com/rainloop
NEXT_PUBLIC_SNAPPYMAIL_URL=https://mail.example.com/snappymail`}
        </pre>
      </div>
    </div>
  )
}
