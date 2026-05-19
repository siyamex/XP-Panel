'use client'

import { useEffect, useRef, useState } from 'react'
import { Shield, Globe, AlertTriangle, Zap, Activity } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

interface ThreatEvent {
  id: string
  src_lat: number
  src_lng: number
  dst_lat: number
  dst_lng: number
  src_country: string
  dst_country: string
  src_ip: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: Date
}

interface Arc {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  progress: number
  color: string
  severity: string
}

const SEVERITY_COLORS = {
  low:      '#3b82f6',
  medium:   '#f59e0b',
  high:     '#ef4444',
  critical: '#dc2626',
}

const THREAT_TYPES = ['brute_force', 'port_scan', 'sql_injection', 'ddos', 'malware', 'phishing', 'xss']

const COUNTRY_COORDS: Record<string, [number, number]> = {
  'CN': [35.86, 104.19], 'US': [37.09, -95.71], 'RU': [61.52, 105.31],
  'BR': [-14.23, -51.92], 'DE': [51.16, 10.45], 'IN': [20.59, 78.96],
  'KR': [35.90, 127.76], 'FR': [46.22, 2.21], 'GB': [55.37, -3.43],
  'NL': [52.13, 5.29], 'UA': [48.37, 31.16], 'IR': [32.42, 53.68],
  'JP': [36.20, 138.25], 'AU': [-25.27, 133.77], 'CA': [56.13, -106.34],
  'SG': [1.35, 103.81], 'TR': [38.96, 35.24], 'PL': [51.91, 19.14],
  'VN': [14.05, 108.27], 'ID': [-0.78, 113.92],
}

const COUNTRY_NAMES: Record<string, string> = {
  CN: 'China', US: 'United States', RU: 'Russia', BR: 'Brazil',
  DE: 'Germany', IN: 'India', KR: 'South Korea', FR: 'France',
  GB: 'United Kingdom', NL: 'Netherlands', UA: 'Ukraine', IR: 'Iran',
  JP: 'Japan', AU: 'Australia', CA: 'Canada', SG: 'Singapore',
}

function latLngToXY(lat: number, lng: number, w: number, h: number): [number, number] {
  const x = ((lng + 180) / 360) * w
  const y = ((90 - lat) / 180) * h
  return [x, y]
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateThreat(): ThreatEvent {
  const srcCountries = ['CN', 'RU', 'IR', 'KR', 'IN', 'BR', 'UA', 'TR', 'VN', 'ID']
  const dstCountries = ['US', 'DE', 'GB', 'FR', 'NL', 'AU', 'CA', 'JP', 'SG']
  const src = randomChoice(srcCountries)
  const dst = randomChoice(dstCountries)
  const severities: ThreatEvent['severity'][] = ['low', 'low', 'medium', 'medium', 'high', 'critical']
  const [slat, slng] = COUNTRY_COORDS[src] ?? [0, 0]
  const [dlat, dlng] = COUNTRY_COORDS[dst] ?? [0, 0]
  return {
    id: Math.random().toString(36).slice(2),
    src_lat: slat + (Math.random() - 0.5) * 8,
    src_lng: slng + (Math.random() - 0.5) * 8,
    dst_lat: dlat + (Math.random() - 0.5) * 4,
    dst_lng: dlng + (Math.random() - 0.5) * 4,
    src_country: src,
    dst_country: dst,
    src_ip: `${Math.floor(Math.random() * 200 + 1)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
    type: randomChoice(THREAT_TYPES),
    severity: randomChoice(severities),
    timestamp: new Date(),
  }
}

export default function GeoMapPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const arcsRef = useRef<Arc[]>([])
  const animFrameRef = useRef<number>(0)
  const [threats, setThreats] = useState<ThreatEvent[]>([])
  const [stats, setStats] = useState({ total: 0, critical: 0, blocked: 0, countries: 0 })
  const [isLive, setIsLive] = useState(true)

  // Draw world map background
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const drawFrame = () => {
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      // Background
      ctx.fillStyle = '#0a0f1a'
      ctx.fillRect(0, 0, w, h)

      // Grid lines
      ctx.strokeStyle = 'rgba(59,130,246,0.08)'
      ctx.lineWidth = 0.5
      for (let lat = -80; lat <= 80; lat += 20) {
        const [, y] = latLngToXY(lat, 0, w, h)
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }
      for (let lng = -180; lng <= 180; lng += 30) {
        const [x] = latLngToXY(0, lng, w, h)
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }

      // Server dot (destination — center of map)
      const [mx, my] = latLngToXY(40, -75, w, h)
      ctx.beginPath()
      ctx.arc(mx, my, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#22c55e'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(mx, my, 10, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(34,197,94,0.4)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Draw arcs
      arcsRef.current = arcsRef.current
        .map((arc) => ({ ...arc, progress: arc.progress + 0.015 }))
        .filter((arc) => arc.progress <= 1.2)

      for (const arc of arcsRef.current) {
        const t = Math.min(arc.progress, 1)
        const cx = (arc.x1 + arc.x2) / 2
        const cy = Math.min(arc.y1, arc.y2) - Math.abs(arc.x2 - arc.x1) * 0.3

        // Draw arc path up to current progress
        ctx.beginPath()
        ctx.strokeStyle = arc.color
        ctx.lineWidth = arc.severity === 'critical' ? 1.5 : 1
        ctx.globalAlpha = Math.max(0, 1 - (arc.progress - 0.8) * 5)
        ctx.setLineDash([4, 3])

        const steps = Math.floor(t * 40)
        for (let i = 0; i <= steps; i++) {
          const tt = i / 40
          const bx = (1 - tt) ** 2 * arc.x1 + 2 * (1 - tt) * tt * cx + tt ** 2 * arc.x2
          const by = (1 - tt) ** 2 * arc.y1 + 2 * (1 - tt) * tt * cy + tt ** 2 * arc.y2
          if (i === 0) ctx.moveTo(bx, by)
          else ctx.lineTo(bx, by)
        }
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1

        // Moving dot on arc
        if (t < 1) {
          const bx = (1 - t) ** 2 * arc.x1 + 2 * (1 - t) * t * cx + t ** 2 * arc.x2
          const by = (1 - t) ** 2 * arc.y1 + 2 * (1 - t) * t * cy + t ** 2 * arc.y2
          ctx.beginPath()
          ctx.arc(bx, by, arc.severity === 'critical' ? 3.5 : 2.5, 0, Math.PI * 2)
          ctx.fillStyle = arc.color
          ctx.fill()
        }

        // Impact flash at destination
        if (arc.progress > 0.95) {
          const flash = (arc.progress - 0.95) * 20
          ctx.beginPath()
          ctx.arc(arc.x2, arc.y2, flash * 8, 0, Math.PI * 2)
          ctx.strokeStyle = arc.color
          ctx.lineWidth = 1
          ctx.globalAlpha = Math.max(0, 1 - flash)
          ctx.stroke()
          ctx.globalAlpha = 1
        }

        // Source dot
        ctx.beginPath()
        ctx.arc(arc.x1, arc.y1, 2, 0, Math.PI * 2)
        ctx.fillStyle = arc.color
        ctx.fill()
      }

      animFrameRef.current = requestAnimationFrame(drawFrame)
    }
    drawFrame()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  // Generate live threats
  useEffect(() => {
    if (!isLive) return
    const interval = setInterval(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const w = canvas.width
      const h = canvas.height
      const count = Math.floor(Math.random() * 3) + 1
      const newThreats: ThreatEvent[] = []

      for (let i = 0; i < count; i++) {
        const threat = generateThreat()
        newThreats.push(threat)
        const [x1, y1] = latLngToXY(threat.src_lat, threat.src_lng, w, h)
        const [x2, y2] = latLngToXY(threat.dst_lat, threat.dst_lng, w, h)
        arcsRef.current.push({
          id: threat.id,
          x1, y1, x2, y2,
          progress: 0,
          color: SEVERITY_COLORS[threat.severity],
          severity: threat.severity,
        })
      }

      setThreats((prev) => [...newThreats, ...prev].slice(0, 50))
      setStats((prev) => ({
        total: prev.total + newThreats.length,
        critical: prev.critical + newThreats.filter((t) => t.severity === 'critical').length,
        blocked: prev.blocked + newThreats.length,
        countries: Math.min(prev.countries + (Math.random() > 0.7 ? 1 : 0), 47),
      }))
    }, 1200)

    return () => clearInterval(interval)
  }, [isLive])

  const topCountries = Object.entries(
    threats.reduce<Record<string, number>>((acc, t) => {
      acc[t.src_country] = (acc[t.src_country] ?? 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-[#0a0f1a]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-blue-900/30 bg-black/40">
        <div className="flex items-center gap-3">
          <Link href="/monitoring" className="text-sm text-blue-400/70 hover:text-blue-400 transition-colors">Monitoring</Link>
          <span className="text-blue-900">/</span>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            <h1 className="text-sm font-semibold text-white">Threat Intelligence Map</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsLive(!isLive)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors', isLive ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-muted/20 text-muted-foreground border border-border')}>
            <span className={cn('w-1.5 h-1.5 rounded-full', isLive ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground')} />
            {isLive ? 'Live' : 'Paused'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 px-6 py-2 border-b border-blue-900/20 bg-black/20">
        {[
          { icon: Activity, label: 'Total Threats', value: stats.total.toLocaleString(), color: 'text-blue-400' },
          { icon: AlertTriangle, label: 'Critical', value: stats.critical.toLocaleString(), color: 'text-red-400' },
          { icon: Shield, label: 'Blocked', value: stats.blocked.toLocaleString(), color: 'text-green-400' },
          { icon: Globe, label: 'Source Countries', value: stats.countries.toString(), color: 'text-amber-400' },
          { icon: Zap, label: 'Attack Rate', value: isLive ? `${(Math.random() * 3 + 1).toFixed(1)}/s` : '0/s', color: 'text-purple-400' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon className={cn('w-3.5 h-3.5', color)} />
            <span className="text-xs text-blue-300/50">{label}:</span>
            <span className={cn('text-xs font-bold font-mono', color)}>{value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <canvas ref={canvasRef} className="w-full h-full" />

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-black/70 border border-blue-900/30 rounded-lg p-3 backdrop-blur-sm">
            <div className="text-xs text-blue-300/60 mb-2 font-medium">SEVERITY</div>
            {Object.entries(SEVERITY_COLORS).map(([sev, color]) => (
              <div key={sev} className="flex items-center gap-2 text-xs capitalize text-blue-200/80 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                {sev}
              </div>
            ))}
          </div>

          {/* Live indicator */}
          {isLive && (
            <div className="absolute top-4 right-4 flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-md px-2 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE FEED
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="w-72 border-l border-blue-900/30 bg-black/40 flex flex-col overflow-hidden">
          {/* Top countries */}
          <div className="p-4 border-b border-blue-900/20">
            <h3 className="text-xs font-semibold text-blue-300/60 uppercase tracking-wider mb-3">Top Attack Origins</h3>
            <div className="space-y-2">
              {topCountries.map(([code, count], i) => {
                const maxCount = topCountries[0]?.[1] ?? 1
                return (
                  <div key={code}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-blue-200/80">{i + 1}. {COUNTRY_NAMES[code] ?? code}</span>
                      <span className="text-blue-400 font-mono">{count}</span>
                    </div>
                    <div className="h-1 bg-blue-900/30 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${(count / maxCount) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
              {topCountries.length === 0 && (
                <div className="text-xs text-blue-300/30">Waiting for threats...</div>
              )}
            </div>
          </div>

          {/* Live feed */}
          <div className="flex-1 overflow-hidden">
            <div className="px-4 py-2 border-b border-blue-900/20">
              <h3 className="text-xs font-semibold text-blue-300/60 uppercase tracking-wider">Live Feed</h3>
            </div>
            <div className="overflow-y-auto h-full pb-4">
              {threats.slice(0, 30).map((t) => (
                <div key={t.id} className="flex items-start gap-2 px-4 py-2 border-b border-blue-900/10 hover:bg-blue-900/10 transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: SEVERITY_COLORS[t.severity] }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-blue-200/80 capitalize">{t.type.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-blue-300/40">{t.src_country}→{t.dst_country}</span>
                    </div>
                    <div className="text-xs text-blue-300/40 font-mono mt-0.5">{t.src_ip}</div>
                  </div>
                </div>
              ))}
              {threats.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-blue-300/30 text-xs">
                  <Globe className="w-8 h-8 mb-2 opacity-20" />
                  Scanning for threats...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
