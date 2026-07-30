'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAuthErrorMessage } from '@/lib/auth/get-auth-error-message'
import { Button } from '@/components/ui/button'
import { Coffee } from 'lucide-react'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const redirectTo = `${window.location.origin}/auth/confirm`
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { 
        shouldCreateUser: true,
        emailRedirectTo: redirectTo,
      },
    })

    setLoading(false)

    if (error) {
      setError(getAuthErrorMessage(error))
      return
    }

    router.push(`/verify-otp?email=${encodeURIComponent(email)}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 via-white to-amber-50/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white shadow-lg shadow-terracotta/5 overflow-hidden">
        <div className="text-center space-y-2 pt-8 px-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-terracotta/10 flex items-center justify-center">
            <Coffee className="h-6 w-6 text-terracotta" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-800">Log in or Sign up</h1>
          <p className="text-sm text-neutral-500">
            Enter your email and we&apos;ll send you a one-time code to access your account.
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4 px-6 pb-8 pt-6">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-800 transition-all focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/25"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-terracotta py-5 text-sm font-bold text-terracotta-foreground hover:bg-terracotta/90"
          >
            {loading ? 'Sending code...' : 'Continue'}
          </Button>
        </form>
      </div>
    </div>
  )
}
