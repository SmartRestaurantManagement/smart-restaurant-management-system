'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAuthErrorMessage } from '@/lib/auth/get-auth-error-message'
import { Button } from '@/components/ui/button'
import { Mail } from 'lucide-react'

function VerifyOtpForm() {
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const supabase = createClient()

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })
    setLoading(false)
    if (error) {
      setError(getAuthErrorMessage(error))
      return
    }
    router.push('/menu')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 via-white to-amber-50/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white shadow-lg shadow-terracotta/5 overflow-hidden">
        <div className="text-center space-y-2 pt-8 px-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-terracotta/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-terracotta" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-800">Verify your email</h1>
          <p className="text-sm text-neutral-500">
            Code sent to <span className="font-semibold text-neutral-700">{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4 px-6 pb-8 pt-6">
          <input
            type="text"
            placeholder="6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
            required
            className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-center text-lg tracking-[0.4em] text-neutral-800 transition-all focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/25"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-terracotta py-5 text-sm font-bold text-terracotta-foreground hover:bg-terracotta/90"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 via-white to-amber-50/40 text-sm text-neutral-500">
          Loading...
        </div>
      }
    >
      <VerifyOtpForm />
    </Suspense>
  )
}
