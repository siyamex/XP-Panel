'use client'

import { useEffect, useRef, useState } from 'react'
import { Terminal as TerminalIcon, X, Maximize2, Minimize2 } from 'lucide-react'

export default function TerminalPage() {
  const termRef = useRef<HTMLDivElement>(null)
  const [connected, setConnected] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [form, setForm] = useState({ host: '', port: '22', user: 'root', authMethod: 'password', password: '' })
  const wsRef = useRef<WebSocket | null>(null)
  const xtermRef = useRef<unknown>(null)

  useEffect(() => {
    return () => { wsRef.current?.close() }
  }, [])

  const connect = async () => {
    if (!form.host) return

    // Dynamically import xterm to avoid SSR issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { Terminal } = await import('@xterm/xterm' as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { FitAddon } = await import('@xterm/addon-fit' as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await import('@xterm/xterm/css/xterm.css' as any)

    if (!termRef.current) return

    const term = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
      },
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      fontSize: 14,
      cursorBlink: true,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(termRef.current)
    fitAddon.fit()
    xtermRef.current = term

    const params = new URLSearchParams({
      host: form.host,
      port: form.port,
      user: form.user,
      auth: form.authMethod,
      ...(form.authMethod === 'password' ? { password: form.password } : {}),
    })

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/v1/terminal?${params}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      term.writeln('\r\n\x1b[32mConnecting to ' + form.host + '...\x1b[0m')
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'output') {
          term.write(msg.data)
        } else if (msg.type === 'error') {
          term.writeln('\r\n\x1b[31m' + msg.data + '\x1b[0m')
          setConnected(false)
        }
      } catch {
        term.write(e.data)
      }
    }

    ws.onclose = () => {
      term.writeln('\r\n\x1b[33mConnection closed.\x1b[0m')
      setConnected(false)
    }

    ws.onerror = () => {
      term.writeln('\r\n\x1b[31mConnection error.\x1b[0m')
      setConnected(false)
    }

    term.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
    })

    // Resize observer
    const ro = new ResizeObserver(() => fitAddon.fit())
    if (termRef.current) ro.observe(termRef.current)
  }

  const disconnect = () => {
    wsRef.current?.close()
    setConnected(false)
  }

  return (
    <div className={`space-y-4 ${fullscreen ? 'fixed inset-0 z-50 bg-background p-4' : 'max-w-5xl'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-5 w-5" />
          <h1 className="text-2xl font-bold tracking-tight">SSH Terminal</h1>
          {connected && <span className="flex items-center gap-1 text-xs text-green-500"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Connected</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFullscreen(f => !f)} className="text-muted-foreground hover:text-foreground transition-colors">
            {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
          {connected && (
            <button onClick={disconnect} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-destructive/50 text-destructive rounded-lg hover:bg-destructive/10">
              <X className="h-3.5 w-3.5" />Disconnect
            </button>
          )}
        </div>
      </div>

      {!connected && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-sm">Connection Settings</h2>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Host / IP</label>
              <input value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && connect()}
                placeholder="192.168.1.100" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Port</label>
              <input value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))}
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Username</label>
              <input value={form.user} onChange={e => setForm(f => ({ ...f, user: e.target.value }))}
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="text-xs font-medium text-muted-foreground">Auth Method</label>
            <div className="flex gap-3">
              {(['password', 'key'] as const).map(m => (
                <label key={m} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" value={m} checked={form.authMethod === m} onChange={() => setForm(f => ({ ...f, authMethod: m }))} />
                  <span className="capitalize">{m}</span>
                </label>
              ))}
            </div>
          </div>
          {form.authMethod === 'password' && (
            <div className="max-w-sm">
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && connect()}
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          )}
          <button onClick={connect} disabled={!form.host}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
            <TerminalIcon className="h-4 w-4" />Connect
          </button>
        </div>
      )}

      <div
        ref={termRef}
        className={`rounded-xl overflow-hidden border border-[#30363d] bg-[#0d1117] ${connected ? 'block' : 'hidden'}`}
        style={{ height: fullscreen ? 'calc(100vh - 160px)' : '500px' }}
      />
    </div>
  )
}
