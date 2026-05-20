'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth.store'
import { toast } from 'sonner'

export default function OAuthCallbackPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { setTokens } = useAuthStore()

  useEffect(() => {
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const error = params.get('error')

    if (error) {
      toast.error('OAuth login failed')
      router.replace('/login')
      return
    }

    if (accessToken && refreshToken) {
      setTokens(accessToken, refreshToken)
      toast.success('Signed in successfully')
      router.replace('/dashboard')
    } else {
      router.replace('/login')
    }
  }, [params, router, setTokens])

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  )
}
