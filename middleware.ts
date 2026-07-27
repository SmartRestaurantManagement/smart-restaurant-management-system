import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public authentication paths and static/API paths
  const publicPaths = ['/signup', '/verify-otp', '/auth/confirm']
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

  // /dashboard is gated by its own shared PIN (app/(staff)/dashboard/layout.tsx),
  // not Supabase Auth - staff never log in at all, so this middleware must not
  // require a Supabase session to reach it.
  const isPinGatedPath = pathname.startsWith('/dashboard')

  // The marketing/hero landing page is public - anonymous visitors need to
  // see it. Logged-in users are still bounced past it to their home page
  // below (isPublicPath || pathname === '/' branch).
  const isLandingPath = pathname === '/'

  // /menu must be browsable without an account - the landing page's
  // secondary "browse the menu" link, and the menu's own client-side
  // "sign up to order" prompts (client-menu.tsx, add-to-cart-button.tsx),
  // both depend on anonymous visitors actually being able to reach it.
  const isBrowsablePath = pathname.startsWith('/menu')

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 1. If not logged in and trying to access a protected page, redirect to /signup
  if (!user && !isPublicPath && !isPinGatedPath && !isLandingPath && !isBrowsablePath) {
    const url = request.nextUrl.clone()
    url.pathname = '/signup'
    return NextResponse.redirect(url)
  }

  // 2. If logged in:
  if (user) {
    // If they are on a public path (like /signup) or at the root "/", redirect them to their home page
    if (isPublicPath || pathname === '/') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      const url = request.nextUrl.clone()
      if (profile && (profile.role === 'staff' || profile.role === 'admin')) {
        url.pathname = '/dashboard/orders'
      } else {
        url.pathname = '/menu'
      }
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
