'use client'

import { useState } from 'react'
import { ShieldAlert, Play, Loader2, CheckCircle2, AlertTriangle, FileX, Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'

interface ScanResult {
  path: string
  threat: string
  severity: 'high' | 'medium' | 'low'
}

interface ScanState {
  status: 'idle' | 'scanning' | 'done'
  scannedFiles: number
  threats: ScanResult[]
  startedAt?: Date
  completedAt?: Date
}

export default function ScannerPage() {
  const [scan, setScan] = useState<ScanState>({ status: 'idle', scannedFiles: 0, threats: [] })
  const [scanPath, setScanPath] = useState('/var/www')

  const startScan = () => {
    setScan({ status: 'scanning', scannedFiles: 0, threats: [], startedAt: new Date() })

    // Simulate progressive scan
    let count = 0
    const interval = setInterval(() => {
      count += Math.floor(Math.random() * 150) + 50
      setScan((prev) => ({ ...prev, scannedFiles: count }))
    }, 300)

    setTimeout(() => {
      clearInterval(interval)
      const mockThreats: ScanResult[] = Math.random() > 0.6 ? [
        { path: '/var/www/site/wp-content/uploads/shell.php', threat: 'PHP.Webshell.Generic', severity: 'high' },
        { path: '/var/www/site/tmp/malware.php', threat: 'PHP.Malware.Obfuscated', severity: 'medium' },
      ] : []
      setScan({ status: 'done', scannedFiles: count, threats: mockThreats, startedAt: scan.startedAt, completedAt: new Date() })
    }, 4000)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/security" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Security</Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-bold">Malware Scanner</h1>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">ClamAV Scanner</h3>
        <div className="flex items-center gap-3">
          <input
            value={scanPath}
            onChange={(e) => setScanPath(e.target.value)}
            placeholder="/var/www"
            className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={startScan}
            disabled={scan.status === 'scanning'}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {scan.status === 'scanning' ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Scanning...</>
            ) : (
              <><Play className="w-4 h-4" />Start Scan</>
            )}
          </button>
        </div>
      </div>

      {scan.status !== 'idle' && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {scan.status === 'scanning' ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              ) : scan.threats.length === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-destructive" />
              )}
              <span className="font-medium">
                {scan.status === 'scanning' ? 'Scanning in progress...' :
                  scan.threats.length === 0 ? 'Scan complete — no threats found' :
                  `Scan complete — ${scan.threats.length} threat${scan.threats.length > 1 ? 's' : ''} found`}
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <FileX className="w-3.5 h-3.5" />{scan.scannedFiles.toLocaleString()} files
            </div>
          </div>

          {scan.status === 'scanning' && (
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          )}

          {scan.completedAt && scan.startedAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              Completed in {((scan.completedAt.getTime() - scan.startedAt.getTime()) / 1000).toFixed(1)}s
            </div>
          )}
        </div>
      )}

      {scan.threats.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-destructive/20">
            <h3 className="font-semibold text-destructive">Threats Detected</h3>
          </div>
          <div className="divide-y divide-destructive/10">
            {scan.threats.map((t, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <div className="font-mono text-xs font-medium">{t.path}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.threat}</div>
                </div>
                <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize font-medium', t.severity === 'high' ? 'bg-destructive/10 text-destructive' : t.severity === 'medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground')}>
                  {t.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {scan.status === 'done' && scan.threats.length === 0 && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-6 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="font-medium text-green-600">Clean scan — no malware detected</p>
          <p className="text-xs text-muted-foreground mt-1">{scan.scannedFiles.toLocaleString()} files scanned</p>
        </div>
      )}
    </div>
  )
}
