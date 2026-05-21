'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

export interface ServerNode {
  id: string
  hostname: string
  ip: string
  latitude: number
  longitude: number
  status: 'active' | 'offline' | 'maintenance'
  datacenter?: string
  cpu?: number
  ram?: number
}

interface InfraMapProps {
  servers: ServerNode[]
  className?: string
  height?: number
  onSelect?: (server: ServerNode) => void
}

// Leaflet cannot run server-side — dynamic import with SSR disabled
const LeafletMap = dynamic(() => import('./_LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-muted/30 rounded-xl border border-border"
         style={{ height: 400 }}>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
})

export function InfraMap(props: InfraMapProps) {
  return <LeafletMap {...props} />
}
