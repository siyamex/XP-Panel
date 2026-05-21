import { useEffect, useRef, useCallback, useState } from 'react'

type WSStatus = 'connecting' | 'open' | 'closed' | 'error'

interface UseWebSocketOptions<T> {
  url: string
  onMessage: (data: T) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (e: Event) => void
  reconnectDelay?: number   // ms, default 3000
  maxReconnects?: number    // 0 = unlimited
  enabled?: boolean
}

interface UseWebSocketReturn {
  status: WSStatus
  send: (data: string | object) => void
  disconnect: () => void
  reconnectCount: number
}

export function useWebSocket<T = unknown>({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnectDelay = 3000,
  maxReconnects = 0,
  enabled = true,
}: UseWebSocketOptions<T>): UseWebSocketReturn {
  const [status, setStatus] = useState<WSStatus>('connecting')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectsRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountedRef = useRef(false)

  const connect = useCallback(() => {
    if (!enabled || unmountedRef.current) return

    setStatus('connecting')
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (unmountedRef.current) return
      reconnectsRef.current = 0
      setStatus('open')
      onOpen?.()
    }

    ws.onmessage = (e) => {
      if (unmountedRef.current) return
      try {
        const data = JSON.parse(e.data) as T
        onMessage(data)
      } catch {
        // raw string message
        onMessage(e.data as unknown as T)
      }
    }

    ws.onerror = (e) => {
      if (unmountedRef.current) return
      setStatus('error')
      onError?.(e)
    }

    ws.onclose = () => {
      if (unmountedRef.current) return
      setStatus('closed')
      onClose?.()

      const shouldReconnect = maxReconnects === 0 || reconnectsRef.current < maxReconnects
      if (shouldReconnect) {
        reconnectsRef.current++
        timerRef.current = setTimeout(connect, reconnectDelay)
      }
    }
  }, [url, enabled, onMessage, onOpen, onClose, onError, reconnectDelay, maxReconnects])

  useEffect(() => {
    unmountedRef.current = false
    if (enabled) connect()
    return () => {
      unmountedRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [connect, enabled])

  const send = useCallback((data: string | object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data))
    }
  }, [])

  const disconnect = useCallback(() => {
    unmountedRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    wsRef.current?.close()
    setStatus('closed')
  }, [])

  return { status, send, disconnect, reconnectCount: reconnectsRef.current }
}
