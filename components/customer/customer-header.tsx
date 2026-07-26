'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useCart } from '@/lib/cart/cart-context'
import { useTableSession } from '@/lib/cart/table-session'
import { createClient } from '@/lib/supabase/client'
import { ShoppingBag, Clock, History, LogOut, Coffee } from 'lucide-react'

export function CustomerHeader() {
  const { items } = useCart()
  const { tableNumber, sessionId, endSession } = useTableSession()
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const itemCount = items.reduce((sum, i) => sum + i.qty, 0)

  useEffect(() => {
    // Try to find the latest active order ID from local storage
    const stored = localStorage.getItem('kaizen_latest_order_id')
    if (stored) {
      setActiveOrderId(stored)
    }

    // Also listen to events or changes
    const interval = setInterval(() => {
      const stored = localStorage.getItem('kaizen_latest_order_id')
      if (stored !== activeOrderId) {
        setActiveOrderId(stored)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [activeOrderId])

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
        </div>
      </div>
    </header>
  )
}
