'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push(`/verify-otp?email=${encodeURIComponent(email)}`)
  }

  return (
    <div className="max-w-sm mx-auto mt-20 space-y-6">
      <form onSubmit={handleSignup} className="space-y-4">
        <h1 className="text-2xl font-bold">Create account</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded px-3 py-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border rounded px-3 py-2"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button disabled={loading} className="w-full bg-black text-white rounded px-3 py-2 font-semibold">
          {loading ? 'Signing up...' : 'Sign up'}
        </button>
      </form>
      <p className="text-sm text-neutral-500 text-center">
        Already have an account?{' '}
        <Link href="/login" className="text-black font-semibold underline">
          Log in
        </Link>
      </p>
    </div>
  )
}