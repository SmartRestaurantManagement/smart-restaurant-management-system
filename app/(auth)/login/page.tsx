'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getAuthErrorMessage } from '@/lib/auth/get-auth-error-message'

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

    let loginEmail = email.trim()
    let loginPassword = password

    const expectedAdminUser = process.env.NEXT_PUBLIC_DASHBOARD_ADMIN_USER || 'admin'
    const expectedAdminPass = process.env.NEXT_PUBLIC_DASHBOARD_ADMIN_PASS || 'admin123'
    const expectedStaffUser = process.env.NEXT_PUBLIC_DASHBOARD_STAFF_USER || 'staff'
    const expectedStaffPass = process.env.NEXT_PUBLIC_DASHBOARD_STAFF_PASS || 'staff123'

    if (loginEmail === expectedAdminUser && loginPassword === expectedAdminPass) {
      loginEmail = 'ananya.rao@kaizen.demo'
      loginPassword = 'KaizenDemo123!'
    } else if (loginEmail === expectedStaffUser && loginPassword === expectedStaffPass) {
      loginEmail = 'vikram.singh@kaizen.demo'
      loginPassword = 'KaizenDemo123!'
    }

    const { data, error } = await supabase.auth.signInWithPassword({ 
      email: loginEmail, 
      password: loginPassword 
    })

    if (error) {
      setLoading(false)
      setError(getAuthErrorMessage(error))
      return
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      setLoading(false)

      if (profile && (profile.role === 'staff' || profile.role === 'admin')) {
        router.push('/dashboard/orders')
      } else {
        router.push('/menu')
      }
    } else {
      setLoading(false)
      router.push('/menu')
    }
    router.refresh()
  }

  return (
    <div className="max-w-sm mx-auto mt-20 space-y-6">
      <form onSubmit={handleLogin} className="space-y-4">
        <h1 className="text-2xl font-bold">Log in</h1>
        <input
          type="text"
          placeholder="Email or Username"
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