'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
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
  const { items } = useCart()
  const { tableNumber, sessionId, endSession } = useTableSession()
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  
  // Auth state
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [switchingRole, setSwitchingRole] = useState(false)

  const router = useRouter()
  const supabase = createClient()

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

  // Demo Switch Role function
  const handleDemoSwitchRole = async () => {
    if (!user || !profile) return
    setSwitchingRole(true)

    const nextRole = profile.role === 'customer' ? 'staff' : 'customer'
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: nextRole })
        .eq('id', user.id)

      if (error) throw error

      // Optimistically update role
      setProfile(prev => prev ? { ...prev, role: nextRole as UserProfile['role'] } : null)

      if (nextRole === 'staff') {
        router.push('/dashboard/orders')
      } else {
        router.push('/menu')
      }
      router.refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "An error occurred"
      console.error("Failed to switch demo role:", e)
      alert(`Role switch error: ${msg}`)
    } finally {
      setSwitchingRole(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/menu')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/menu" className="flex items-center gap-2 text-xl font-bold tracking-tight text-primary hover:opacity-90 transition-opacity">
          <Coffee className="h-5 w-5 text-amber-600 animate-pulse" />
          <span>KAIZEN</span>
          <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-normal uppercase tracking-wider scale-90">
            Living OS
          </span>
        </Link>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-4">
          {/* Table Session Indicator */}
          {tableNumber ? (
            <div className="hidden sm:flex items-center gap-2 bg-amber-50 text-amber-800 text-xs px-3 py-1.5 rounded-full border border-amber-200">
              <span className="font-semibold">Table {tableNumber}</span>
              {sessionId && (
                <Link href={`/group/${sessionId}`} className="underline hover:text-amber-900 ml-1 font-medium">
                  Group Cart
                </Link>
              )}
              <button 
                onClick={() => {
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
              {/* Show Portal Link if Staff/Admin */}
              {profile && (profile.role === 'staff' || profile.role === 'admin') && (
                <Link 
                  href="/dashboard/orders" 
                  className="hidden md:flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>Dashboard</span>
                </Link>
              )}

              {/* Demo Role Switcher Button */}
              {profile && (
                <button
                  onClick={handleDemoSwitchRole}
                  disabled={switchingRole}
                  className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xxs font-extrabold px-2.5 py-1.5 rounded-xl border border-amber-200 transition-colors cursor-pointer"
                  title={`Switch to ${profile.role === 'customer' ? 'Staff' : 'Customer'} Mode`}
                >
                  <ArrowLeftRight className="h-3 w-3" />
                  <span>{switchingRole ? 'Switching...' : profile.role === 'customer' ? 'Demo: Become Staff' : 'Demo: Become Customer'}</span>
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
              <Link 
                href="/dashboard/orders" 
                className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Dashboard Portal</span>
              </Link>
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
    </header>
  )
}
