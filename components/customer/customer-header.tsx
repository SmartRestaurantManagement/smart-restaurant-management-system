'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { useCart } from '@/lib/cart/cart-context'
import { useTableSession } from '@/lib/cart/table-session'
import { createClient } from '@/lib/supabase/client'
import { ShoppingBag, Clock, History, LogOut, Coffee, LayoutDashboard, ArrowLeftRight, User } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface UserProfile {
  id: string
  full_name: string | null
  role: 'customer' | 'staff' | 'admin'
}

export function CustomerHeader() {
  const { items, clearCart } = useCart()
  const { tableNumber, tableId, sessionId, endSession } = useTableSession()
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  
  // Auth state
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  
  // Staff Modal state
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [staffUsername, setStaffUsername] = useState('')
  const [staffPassword, setStaffPassword] = useState('')
  const [staffError, setStaffError] = useState('')
  const [verifyingStaff, setVerifyingStaff] = useState(false)

  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const itemCount = items.reduce((sum, i) => sum + i.qty, 0)

  // Fetch user and profile details
  useEffect(() => {
    const fetchUserAndProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        setProfile(prof as UserProfile | null)
      } else {
        setProfile(null)
      }
    }

    fetchUserAndProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserAndProfile()
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  // Track latest active order
  useEffect(() => {
    const stored = localStorage.getItem('kaizen_latest_order_id')
    if (stored) {
      setActiveOrderId(stored)
    }

    const interval = setInterval(() => {
      const stored = localStorage.getItem('kaizen_latest_order_id')
      if (stored !== activeOrderId) {
        setActiveOrderId(stored)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [activeOrderId])

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifyingStaff(true)
    setStaffError('')

    const targetUsername = staffUsername.trim()
    const targetPassword = staffPassword

    // Configured static username and passwords
    const expectedAdminUser = process.env.NEXT_PUBLIC_DASHBOARD_ADMIN_USER || 'admin'
    const expectedAdminPass = process.env.NEXT_PUBLIC_DASHBOARD_ADMIN_PASS || 'admin123'
    const expectedStaffUser = process.env.NEXT_PUBLIC_DASHBOARD_STAFF_USER || 'staff'
    const expectedStaffPass = process.env.NEXT_PUBLIC_DASHBOARD_STAFF_PASS || 'staff123'

    let supabaseEmail = ''
    let supabasePassword = 'KaizenDemo123!'

    if (targetUsername === expectedAdminUser && targetPassword === expectedAdminPass) {
      supabaseEmail = 'ananya.rao@kaizen.demo'
    } else if (targetUsername === expectedStaffUser && targetPassword === expectedStaffPass) {
      supabaseEmail = 'vikram.singh@kaizen.demo'
    } else {
      setStaffError('Invalid username or password.')
      setVerifyingStaff(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: supabaseEmail,
        password: supabasePassword,
      })

      if (error) throw error

      if (data.user) {
        setShowStaffModal(false)
        setStaffUsername('')
        setStaffPassword('')
        router.push('/dashboard/orders')
        router.refresh()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred'
      setStaffError(msg)
    } finally {
      setVerifyingStaff(false)
    }
  }

  const handleLogout = async () => {
    if (tableId) {
      await supabase
        .from('tables')
        .update({ status: 'free' })
        .eq('id', tableId)
    }
    clearCart()
    endSession()
    
    // Completely clear all cached state starting with 'kaizen_'
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('kaizen_')) {
        localStorage.removeItem(key)
      }
    })

    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/menu" className="flex items-center gap-2 text-xl font-bold tracking-tight text-primary hover:opacity-90 transition-opacity">
          <Coffee className="h-5 w-5 text-amber-600 animate-pulse" />
          <span>KAIZEN</span>
        </Link>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-4">
          {/* Table Session Indicator */}
          {tableNumber && user ? (
            <div className="hidden sm:flex items-center gap-2 bg-amber-50 text-amber-800 text-xs px-3 py-1.5 rounded-full border border-amber-200">
              <span className="font-semibold">Table {tableNumber}</span>
              {sessionId && (
                <Link href={`/group/${sessionId}`} className="underline hover:text-amber-900 ml-1 font-medium">
                  Group Cart
                </Link>
              )}
              <button 
                onClick={async () => {
                  if (tableId) {
                    await supabase
                      .from('tables')
                      .update({ status: 'free' })
                      .eq('id', tableId)
                  }
                  endSession()
                  router.refresh()
                }} 
                title="Leave table"
                className="hover:text-red-600 ml-1 transition-colors"
              >
                <LogOut className="h-3 w-3" />
              </button>
            </div>
          ) : null}

          {/* Past Orders */}
          <Link 
            href="/reorder" 
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            title="Past Orders"
          >
            <History className="h-4 w-4" />
            <span className="hidden md:inline">Reorder</span>
          </Link>

          {/* Active Order Tracking Link */}
          {activeOrderId && (
            <Link 
              href={`/order/${activeOrderId}`}
              className="flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
              title="Track Active Order"
            >
              <Clock className="h-4 w-4 animate-spin-slow" />
              <span className="hidden md:inline">Track Order</span>
            </Link>
          )}

          {/* Cart Trigger */}
          <Link 
            href="/cart"
            className="relative flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-sm rounded-full px-4 py-2 text-sm font-medium"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Cart</span>
            {itemCount > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-600 text-white rounded-full text-xxs font-bold h-5 w-5 flex items-center justify-center border-2 border-background animate-bounce-short">
                {itemCount}
              </span>
            ) : null}
          </Link>

          {/* Divider */}
          <span className="h-6 w-px bg-neutral-200 hidden sm:inline" />

          {/* Profile, Dashboard & Role Switcher */}
          {user ? (
            <div className="flex items-center gap-3">
              {/* Show Dashboard Link if Staff/Admin */}
              {profile && (profile.role === 'staff' || profile.role === 'admin') ? (
                <Link 
                  href="/dashboard/orders" 
                  className="hidden md:flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>Dashboard</span>
                </Link>
              ) : (
                /* Show Staff Access login for customer users */
                <button
                  onClick={() => setShowStaffModal(true)}
                  className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xxs font-extrabold px-2.5 py-1.5 rounded-xl border border-amber-200 transition-colors cursor-pointer"
                  title="Staff & Admin Access"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>Staff Access</span>
                </button>
              )}

              {/* Logout Button */}
              <button 
                onClick={handleLogout} 
                title="Log Out"
                className="text-neutral-500 hover:text-neutral-900 transition-colors p-1"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowStaffModal(true)}
                className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Staff Access</span>
              </button>
              <Link 
                href="/login" 
                className="text-xs font-bold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <User className="h-3.5 w-3.5" />
                <span>Login Portal</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Staff Access Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-neutral-100 relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => {
                setShowStaffModal(false)
                setStaffError('')
                setStaffUsername('')
                setStaffPassword('')
              }}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 transition-colors text-lg font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-neutral-100"
            >
              ✕
            </button>
            <div className="space-y-4">
              <div className="text-center">
                <div className="mx-auto w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center mb-2">
                  <Coffee className="h-5 w-5 text-amber-600" />
                </div>
                <h2 className="text-base font-extrabold text-neutral-800">Staff & Admin Access</h2>
                <p className="text-xs text-neutral-500 mt-1">Provide credentials to enter the dashboard.</p>
              </div>

              <form onSubmit={handleStaffLogin} className="space-y-3">
                <div>
                  <label className="block text-xxs font-extrabold uppercase tracking-wider text-neutral-400 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. admin"
                    value={staffUsername}
                    onChange={(e) => setStaffUsername(e.target.value)}
                    className="w-full text-xs border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-neutral-800"
                  />
                </div>
                <div>
                  <label className="block text-xxs font-extrabold uppercase tracking-wider text-neutral-400 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    className="w-full text-xs border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-neutral-800"
                  />
                </div>

                {staffError && (
                  <p className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-xl px-3 py-2 font-medium">
                    {staffError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={verifyingStaff}
                  className="w-full bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl py-2.5 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {verifyingStaff ? 'Verifying...' : 'Access Dashboard'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
