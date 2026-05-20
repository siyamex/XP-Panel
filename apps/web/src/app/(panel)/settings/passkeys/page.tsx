'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, Trash2, Shield, CheckCircle2 } from 'lucide-react'
import { passkeyApi, type Passkey } from '@/lib/api/passkey.api'
import { toast } from 'sonner'

export default function PasskeysPage() {
  const qc = useQueryClient()
  const [registering, setRegistering] = useState(false)
  const [deviceName, setDeviceName] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['passkeys'],
    queryFn: () => passkeyApi.list().then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => passkeyApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['passkeys'] }); toast.success('Passkey removed') },
    onError: () => toast.error('Failed to remove passkey'),
  })

  const registerPasskey = async () => {
    if (!window.PublicKeyCredential) {
      toast.error('Your browser does not support WebAuthn passkeys')
      return
    }
    setRegistering(true)
    try {
      // 1. Get challenge from server
      const { data: options } = await passkeyApi.beginRegistration()

      // 2. Decode challenge
      const challengeBuffer = base64UrlToBuffer(options.challenge as string)
      const userIdBuffer = base64UrlToBuffer(options.user?.id as string ?? '')

      // 3. Call WebAuthn API
      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: challengeBuffer,
          user: {
            ...(options.user as PublicKeyCredentialUserEntity),
            id: userIdBuffer,
          },
          pubKeyCredParams: (options.pubKeyCredParams as Array<{ type: PublicKeyCredentialType; alg: number }>),
        } as PublicKeyCredentialCreationOptions,
      }) as PublicKeyCredential | null

      if (!credential) {
        toast.error('Registration cancelled')
        return
      }

      const response = credential.response as AuthenticatorAttestationResponse

      // 4. Send to server
      await passkeyApi.finishRegistration({
        id: credential.id,
        rawId: bufferToBase64Url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToBase64Url(response.clientDataJSON),
          attestationObject: bufferToBase64Url(response.attestationObject),
        },
      }, deviceName || undefined)

      qc.invalidateQueries({ queryKey: ['passkeys'] })
      toast.success('Passkey registered successfully!')
      setDeviceName('')
    } catch (err) {
      if ((err as Error).name === 'NotAllowedError') {
        toast.error('Registration was cancelled or timed out')
      } else {
        toast.error('Registration failed: ' + (err as Error).message)
      }
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Passkeys</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Passwordless sign-in using biometrics or a security key (WebAuthn)
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Stronger than passwords</p>
          <p className="text-muted-foreground mt-0.5">
            Passkeys use public-key cryptography tied to your device. They&apos;re phishing-resistant and
            don&apos;t require you to remember anything.
          </p>
        </div>
      </div>

      {/* Register new */}
      <div className="bg-card border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-sm">Register a New Passkey</h2>
        <div className="flex gap-2">
          <input
            value={deviceName}
            onChange={e => setDeviceName(e.target.value)}
            placeholder="Device name (optional, e.g. MacBook Touch ID)"
            className="flex-1 border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={registerPasskey}
            disabled={registering}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {registering ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {registering ? 'Registering...' : 'Register Passkey'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          You&apos;ll be prompted by your browser or OS to use Face ID, Touch ID, Windows Hello, or a hardware security key.
        </p>
      </div>

      {/* Existing passkeys */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b">
          <span className="font-semibold text-sm">Registered Passkeys ({data?.total ?? 0})</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !data?.passkeys.length ? (
          <div className="p-8 text-center">
            <KeyRound className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No passkeys registered yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {data.passkeys.map((k: Passkey) => (
              <div key={k.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <KeyRound className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{k.device_name || 'Unnamed device'}</p>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Registered {new Date(k.created_at).toLocaleDateString()} · Used {k.sign_count} times
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(k.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Remove passkey"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── WebAuthn Helpers ─────────────────────────────────────────────────────────
function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(base64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
