'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAuthErrorMessage } from '@/lib/auth/get-auth-error-message'
import { Coffee } from 'lucide-react'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, data: { full_name: name.trim() } },
    })

    setLoading(false)

    if (error) {
      setError(getAuthErrorMessage(error))
      return
    }

    router.push(`/verify-otp?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name.trim())}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4 font-[family-name:var(--font-marketing)]">
      <div className="w-full max-w-sm rounded-sm border border-black/10 bg-white shadow-sm overflow-hidden">
        <div className="text-center space-y-2 pt-10 px-7">
          <div className="mx-auto w-14 h-14 rounded-full bg-maroon/10 flex items-center justify-center">
            <Coffee className="h-6 w-6 text-maroon" />
          </div>
          <h1 className="font-display text-2xl tracking-[0.01em] text-cream-foreground">Sign up for Kaizen</h1>
          <p className="text-sm text-cream-foreground/60">
            Tell us who you are and we&apos;ll send a one-time code - no password needed.
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4 px-7 pb-10 pt-7">
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-maroon hover:bg-maroon-hover disabled:opacity-50 py-3.5 text-sm font-semibold tracking-[0.04em] text-maroon-foreground transition-colors cursor-pointer"
          >
            {loading ? 'Sending code...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
