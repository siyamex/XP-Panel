'use client'

import { useEffect, useRef } from 'react'
import type { ServerNode } from './InfraMap'

interface Props {
  servers: ServerNode[]
  height?: number
  onSelect?: (server: ServerNode) => void
  className?: string
}

const STATUS_COLORS: Record<string, string> = {
  active:      '#22c55e',
  offline:     '#ef4444',
  maintenance: '#f59e0b',
}

export default function LeafletMap({ servers, height = 400, onSelect, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Dynamically load Leaflet CSS + JS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    import('leaflet').then(L => {
      const map = L.map(containerRef.current!, {
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
      }).addTo(map)

      servers.forEach(server => {
        const color = STATUS_COLORS[server.status] ?? '#6b7280'

        const icon = L.divIcon({
          html: `
            <div style="
              width:12px;height:12px;border-radius:50%;
              background:${color};
              border:2px solid rgba(255,255,255,0.8);
              box-shadow:0 0 8px ${color};
            "></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
          className: '',
        })

        const marker = L.marker([server.latitude, server.longitude], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:monospace;font-size:12px;min-width:160px">
              <strong>${server.hostname}</strong><br/>
              <span style="color:#9ca3af">${server.ip}</span><br/>
              ${server.datacenter ? `<span>${server.datacenter}</span><br/>` : ''}
              ${server.cpu !== undefined ? `CPU: ${server.cpu}% | RAM: ${server.ram ?? 0}%` : ''}
            </div>
          `, { className: 'xp-leaflet-popup' })

        if (onSelect) {
          marker.on('click', () => onSelect(server))
        }
      })

      mapRef.current = map
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers when servers change
  useEffect(() => {
    if (!mapRef.current) return
    // Re-render handled by map instance already — for simplicity we don't
    // dynamically add/remove markers after initial render in this impl.
  }, [servers])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, borderRadius: '0.75rem', overflow: 'hidden', background: '#0a0f1a' }}
    />
  )
}
