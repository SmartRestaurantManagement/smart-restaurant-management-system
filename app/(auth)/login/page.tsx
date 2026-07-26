'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/menu')
    router.refresh()
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="max-w-sm mx-auto mt-20 space-y-6">
      <form onSubmit={handleLogin} className="space-y-4">
        <h1 className="text-2xl font-bold">Log in</h1>
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
          className="w-full border rounded px-3 py-2"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button disabled={loading} className="w-full bg-black text-white rounded px-3 py-2 font-semibold">
          {loading ? 'Logging in...' : 'Log in'}
        </button>
        <button type="button" onClick={handleGoogleLogin} className="w-full border rounded px-3 py-2 font-medium">
          Continue with Google
        </button>
      </form>
      <p className="text-sm text-neutral-500 text-center">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-black font-semibold underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}