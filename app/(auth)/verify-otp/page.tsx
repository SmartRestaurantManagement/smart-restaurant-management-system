'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAuthErrorMessage } from '@/lib/auth/get-auth-error-message'

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
      type: 'signup',
    })
    setLoading(false)
    if (error) {
      setError(getAuthErrorMessage(error))
      return
    }
    router.push('/menu')
  }

  return (
    <form onSubmit={handleVerify} className="max-w-sm mx-auto mt-20 space-y-4">
      <h1 className="text-2xl font-semibold">Verify your email</h1>
      <p className="text-sm text-gray-500">Code sent to {email}</p>
      <input
        type="text"
        placeholder="6-digit code"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        maxLength={6}
        required
        className="w-full border rounded px-3 py-2 tracking-widest text-center"
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button disabled={loading} className="w-full bg-black text-white rounded px-3 py-2">
        {loading ? 'Verifying...' : 'Verify'}
      </button>
    </form>
  )
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="max-w-sm mx-auto mt-20 text-center text-gray-500">Loading...</div>}>
      <VerifyOtpForm />
    </Suspense>
  )
}