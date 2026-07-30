'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAuthErrorMessage } from '@/lib/auth/get-auth-error-message'
import { Mail, PartyPopper } from 'lucide-react'

function VerifyOtpForm() {
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [welcomeName, setWelcomeName] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const name = searchParams.get('name') || ''
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

    if (name) {
      setWelcomeName(name)
      setTimeout(() => router.push('/menu'), 1800)
    } else {
      router.push('/menu')
    }
  }

  if (welcomeName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-4 font-[family-name:var(--font-marketing)]">
        <div className="w-full max-w-sm rounded-sm border border-black/10 bg-white shadow-sm px-7 py-12 text-center space-y-3 animate-in fade-in zoom-in-95 duration-300">
          <div className="mx-auto w-14 h-14 rounded-full bg-maroon/10 flex items-center justify-center">
            <PartyPopper className="h-6 w-6 text-maroon" />
          </div>
          <h1 className="font-display text-2xl tracking-[0.01em] text-cream-foreground">
            Hey {welcomeName}, welcome to Kaizen!
          </h1>
          <p className="text-sm text-cream-foreground/60">Taking you to the menu...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4 font-[family-name:var(--font-marketing)]">
      <div className="w-full max-w-sm rounded-sm border border-black/10 bg-white shadow-sm overflow-hidden">
        <div className="text-center space-y-2 pt-10 px-7">
          <div className="mx-auto w-14 h-14 rounded-full bg-maroon/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-maroon" />
          </div>
          <h1 className="font-display text-2xl tracking-[0.01em] text-cream-foreground">Verify your email</h1>
          <p className="text-sm text-cream-foreground/60">
            Code sent to <span className="font-semibold text-cream-foreground">{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4 px-7 pb-10 pt-7">
          <input
            type="text"
            placeholder="6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
            required
            className="w-full rounded-sm border border-black/15 px-4 py-3 text-center text-lg tracking-[0.4em] text-cream-foreground transition-all focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/20"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-maroon hover:bg-maroon-hover disabled:opacity-50 py-3.5 text-sm font-semibold tracking-[0.04em] text-maroon-foreground transition-colors cursor-pointer"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-cream text-sm text-cream-foreground/60 font-[family-name:var(--font-marketing)]">
          Loading...
        </div>
      }
    >
      <VerifyOtpForm />
    </Suspense>
  )
}
