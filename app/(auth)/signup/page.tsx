'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAuthErrorMessage } from '@/lib/auth/get-auth-error-message'
import { Coffee } from 'lucide-react'
import { FcGoogle } from 'react-icons/fc'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const message = params.get('message')
    if (params.get('error') === 'verification-failed' && message) {
      setError(message)
    }
  }, [])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const redirectTo = `${window.location.origin}/auth/confirm`

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: {
          full_name: name.trim(),
        },
        emailRedirectTo: redirectTo,
      },
    })

    setLoading(false)

    if (error) {
      setError(getAuthErrorMessage(error))
      return
    }

    router.push(
      `/verify-otp?email=${encodeURIComponent(email)}&name=${encodeURIComponent(
        name.trim()
      )}`
    )
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/confirm`,
      },
    })

    if (error) {
      setLoading(false)
      setError(error.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4 font-[family-name:var(--font-marketing)]">
      <div className="w-full max-w-sm rounded-sm border border-black/10 bg-white shadow-sm overflow-hidden">
        <div className="text-center space-y-2 pt-10 px-7">
          <div className="mx-auto w-14 h-14 rounded-full bg-maroon/10 flex items-center justify-center">
            <Coffee className="h-6 w-6 text-maroon" />
          </div>

          <h1 className="font-display text-2xl tracking-[0.01em] text-cream-foreground">
            Sign up for Kaizen
          </h1>

          <p className="text-sm text-cream-foreground/60">
            Tell us who you are and we'll send a one-time code — or continue
            instantly with Google.
          </p>
        </div>

        <form
          onSubmit={handleSignup}
          className="space-y-4 px-7 pb-10 pt-7"
        >
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-sm border border-black/15 px-4 py-3 text-sm text-cream-foreground transition-all focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/20"
          />

          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-sm border border-black/15 px-4 py-3 text-sm text-cream-foreground transition-all focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/20"
          />

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-maroon hover:bg-maroon-hover disabled:opacity-50 py-3.5 text-sm font-semibold tracking-[0.04em] text-maroon-foreground transition-colors cursor-pointer"
          >
            {loading ? 'Sending code...' : 'Continue'}
          </button>

          <div className="flex items-center py-2">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-4 text-xs text-gray-500 uppercase">
              OR
            </span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full rounded-sm border border-gray-300 bg-white hover:bg-gray-50 py-3.5 text-sm font-medium flex items-center justify-center gap-3 transition-colors"
          >
            <FcGoogle size={22} />
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  )
}