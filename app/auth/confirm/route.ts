import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/menu'

  let failureMessage = 'No verification code or token was provided.'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
    failureMessage = error.message
  } else if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
    failureMessage = error.message
  }

  console.error('[auth/confirm] verification failed:', failureMessage)

  // Redirect to signup page with error query parameter if verification fails
  const failureUrl = new URL('/signup', request.url)
  failureUrl.searchParams.set('error', 'verification-failed')
  failureUrl.searchParams.set('message', failureMessage)
  return NextResponse.redirect(failureUrl)
}
