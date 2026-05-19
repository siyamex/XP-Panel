'use client'

import { useState } from 'react'
import { Plus, Server, Globe, Cpu, MemoryStick, HardDrive, Activity, Wifi, WifiOff, AlertTriangle, RefreshCw, MoreHorizontal } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'

interface AdminServer {
  id: string
  hostname: string
  ip_address: string
  datacenter: string
  os_type: string
  os_version: string
  agent_version: string
  status: 'active' | 'maintenance' | 'offline' | 'error' | 'provisioning'
  cpu_percent: number
  ram_percent: number
  disk_percent: number
  domains: number
  uptime_days: number
  created_at: Date
}

const MOCK_SERVERS: AdminServer[] = [
  { id: '1', hostname: 'web01.us-east.xp', ip_address: '203.0.113.10', datacenter: 'US-East (NYC)', os_type: 'Ubuntu', os_version: '22.04 LTS', agent_version: '1.2.0', status: 'active', cpu_percent: 34, ram_percent: 62, disk_percent: 45, domains: 47, uptime_days: 127, created_at: new Date(Date.now() - 86400000 * 127) },
  { id: '2', hostname: 'web02.eu-west.xp', ip_address: '198.51.100.20', datacenter: 'EU-West (AMS)', os_type: 'Debian', os_version: '12 Bookworm', agent_version: '1.2.0', status: 'active', cpu_percent: 18, ram_percent: 41, disk_percent: 28, domains: 31, uptime_days: 89, created_at: new Date(Date.now() - 86400000 * 89) },
  { id: '3', hostname: 'web03.ap-sg.xp', ip_address: '192.0.2.30', datacenter: 'AP-SE (SGP)', os_type: 'Ubuntu', os_version: '24.04 LTS', agent_version: '1.1.5', status: 'active', cpu_percent: 71, ram_percent: 88, disk_percent: 55, domains: 23, uptime_days: 14, created_at: new Date(Date.now() - 86400000 * 14) },
  { id: '4', hostname: 'web04.us-west.xp', ip_address: '203.0.113.40', datacenter: 'US-West (LAX)', os_type: 'AlmaLinux', os_version: '9.3', agent_version: '1.2.0', status: 'maintenance', cpu_percent: 0, ram_percent: 0, disk_percent: 67, domains: 15, uptime_days: 0, created_at: new Date(Date.now() - 86400000 * 200) },
  { id: '5', hostname: 'db01.us-east.xp', ip_address: '203.0.113.50', datacenter: 'US-East (NYC)', os_type: 'Ubuntu', os_version: '22.04 LTS', agent_version: '1.2.0', status: 'offline', cpu_percent: 0, ram_percent: 0, disk_percent: 0, domains: 0, uptime_days: 0, created_at: new Date(Date.now() - 86400000 * 300) },
]

const STATUS_CONFIG = {
  active: { label: 'Active', icon: Wifi, color: 'text-green-500', bg: 'bg-green-500/10' },
  maintenance: { label: 'Maintenance', icon: RefreshCw, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  offline: { label: 'Offline', icon: WifiOff, color: 'text-muted-foreground', bg: 'bg-muted' },
  error: { label: 'Error', icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
  provisioning: { label: 'Provisioning', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10' },
}

function UsageBar({ value, label }: { value: number; label: string }) {
  const color = value > 80 ? 'bg-destructive' : value > 60 ? 'bg-amber-500' : 'bg-primary'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export default function AdminServersPage() {
  const [servers] = useState(MOCK_SERVERS)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const activeServers = servers.filter(s => s.status === 'active')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Servers</h1>
          <p className="text-muted-foreground text-sm mt-1">{servers.length} servers — {activeServers.length} active</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 h-9 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />Add Server
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Servers', value: servers.length },
          { label: 'Active', value: activeServers.length },
          { label: 'Total Domains', value: servers.reduce((a, s) => a + s.domains, 0) },
          { label: 'Avg CPU', value: `${Math.round(activeServers.reduce((a, s) => a + s.cpu_percent, 0) / (activeServers.length || 1))}%` },
        ].map(stat => (
          <div key={stat.label} className="bg-card border rounded-xl p-4">
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Server cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {servers.map(server => {
          const status = STATUS_CONFIG[server.status]
          const StatusIcon = status.icon
          return (
            <div key={server.id} className="bg-card border rounded-xl p-5 space-y-4 relative">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Server className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{server.hostname}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Globe className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-mono">{server.ip_address}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${status.bg}`}>
                    <StatusIcon className={`h-3 w-3 ${status.color}`} />
                    <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                  </div>
                  <button onClick={() => setOpenMenu(openMenu === server.id ? null : server.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  <AnimatePresence>
                    {openMenu === server.id && (
                      <motion.div initial={{ opacity: 0, scale: 0.95, y: -5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -5 }}
                        className="absolute right-5 top-14 z-10 bg-card border rounded-lg shadow-xl py-1 w-40">
                        {['SSH Terminal', 'View Logs', 'Reboot', 'Set Maintenance'].map(action => (
                          <button key={action} onClick={() => setOpenMenu(null)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${action === 'Reboot' ? 'text-amber-500' : ''}`}>
                            {action}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{server.datacenter}</span>
                <span>·</span>
                <span>{server.os_type} {server.os_version}</span>
                <span>·</span>
                <span>{server.domains} domains</span>
                {server.status === 'active' && <><span>·</span><span>Up {server.uptime_days}d</span></>}
              </div>

              {server.status === 'active' && (
                <div className="space-y-2.5">
                  <UsageBar value={server.cpu_percent} label="CPU" />
                  <UsageBar value={server.ram_percent} label="RAM" />
                  <UsageBar value={server.disk_percent} label="Disk" />
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                <span>Agent v{server.agent_version}</span>
                <span>Added {format(server.created_at, 'MMM d, yyyy')}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add server modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-card border rounded-xl p-6 w-full max-w-md space-y-5">
              <h3 className="font-semibold">Add Server</h3>
              <p className="text-sm text-muted-foreground">Run the install command on your server to register it with XP-Panel.</p>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Hostname</label>
                <input placeholder="web01.example.com" className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">IP Address</label>
                <input placeholder="192.0.2.1" className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Install Agent Command</p>
                <code className="text-xs font-mono break-all">curl -fsSL https://get.xp-panel.io/agent | bash -s -- --token=xp_agent_abc123</code>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowAdd(false)} className="flex-1 h-9 border rounded-md text-sm hover:bg-muted transition-colors">Cancel</button>
                <button onClick={() => setShowAdd(false)} className="flex-1 h-9 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">Generate Token</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
