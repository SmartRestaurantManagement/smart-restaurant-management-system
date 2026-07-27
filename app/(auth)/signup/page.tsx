'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAuthErrorMessage } from '@/lib/auth/get-auth-error-message'

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

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })

    setLoading(false)

    if (error) {
      setError(getAuthErrorMessage(error))
      return
    }

    router.push(`/verify-otp?email=${encodeURIComponent(email)}`)
  }

  return (
    <div className="max-w-sm mx-auto mt-20 space-y-6">
      <form onSubmit={handleSignup} className="space-y-4">
        <h1 className="text-2xl font-bold">Sign up</h1>
        <p className="text-sm text-neutral-500">
          Enter your email and we&apos;ll send you a one-time code to sign in - no password needed.
        </p>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded px-3 py-2"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button disabled={loading} className="w-full bg-black text-white rounded px-3 py-2 font-semibold">
          {loading ? 'Sending code...' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
