'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bell, Check, Clock, HelpCircle, PhoneCall, Sparkles, Receipt, Users } from 'lucide-react'
import type { Database } from '@/types/database'

type OrderStatus = Database['public']['Enums']['order_status']
type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  menu_items: { name: string } | null
}

type Props = {
  orderId: string
  initialStatus: OrderStatus
  initialItems: OrderItem[]
  restaurantId: string
  tableId: string | null
  sessionId: string
}

const STATUS_STEPS: { status: OrderStatus; label: string; desc: string }[] = [
  { status: 'pending', label: 'Order Sent', desc: 'Received by kitchen' },
  { status: 'confirmed', label: 'Confirmed', desc: 'Accepted by staff' },
  { status: 'preparing', label: 'Preparing', desc: 'Cooking in progress' },
  { status: 'ready', label: 'Ready', desc: 'Ready for pickup/serving' },
  { status: 'served', label: 'Served', desc: 'Delivered to your table' },
  { status: 'completed', label: 'Completed', desc: 'Bill paid and closed' },
]

const STATUS_TOASTS: Record<OrderStatus, string> = {
  pending: 'Order sent! Chefs are reviewing.',
  confirmed: 'Order confirmed! Kitchen is ready to prepare.',
  preparing: "Kitchen's started on it! Our chefs are preparing your dish.",
  ready: 'Your order is ready! A server will bring it shortly.',
  served: 'Order served! Enjoy your meal.',
  completed: 'Thank you for dining with us! Order completed.',
  cancelled: 'Your order was cancelled. Please see staff.',
}

export function ClientOrderTracking({
  orderId,
  initialStatus,
  initialItems,
  restaurantId,
  tableId,
  sessionId,
}: Props) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus)
  const [eta, setEta] = useState<number>(20) // default fallback
  const [activeToast, setActiveToast] = useState<string | null>(null)
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [serviceLoading, setServiceLoading] = useState(false)
  const [serviceMessage, setServiceMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const total = initialItems.reduce((sum, item) => sum + item.price_at_order * item.qty, 0)

  // 1. Subscribe to order status changes
  useEffect(() => {
    const channel = supabase
      .channel(`order-tracking-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const newStatus = (payload.new as any).status as OrderStatus
          setStatus(newStatus)
          
          // Fire toast alert
          const message = STATUS_TOASTS[newStatus] || `Order status updated to: ${newStatus}`
          setActiveToast(message)
          setTimeout(() => setActiveToast(null), 5000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId, supabase])

  // 2. Fetch and poll self-calibrating ETA
  useEffect(() => {
    async function fetchEta() {
      try {
        const res = await fetch(`/api/orders/eta?restaurant_id=${restaurantId}`)
        if (res.ok) {
          const data = await res.json()
          setEta(data.etaMinutes)
        }
      } catch (err) {
        console.warn('Failed to fetch self-calibrated ETA:', err)
      }
    }

    fetchEta()
    const interval = setInterval(fetchEta, 15000) // update every 15s

    return () => clearInterval(interval)
  }, [restaurantId])

  // Handle service request submission
  const handleCallService = async (type: 'water' | 'server' | 'bill') => {
    if (!tableId) {
      setServiceMessage('Service calls are only available for dine-in guests.')
      return
    }

    setServiceLoading(true)
    setServiceMessage('')

    try {
      const res = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId, type }),
      })

      if (res.ok) {
        setServiceMessage(`Request for ${type === 'bill' ? 'the bill' : type} sent successfully! Staff notified.`)
        setTimeout(() => {
          setServiceModalOpen(false)
          setServiceMessage('')
        }, 3000)
      } else {
        const body = await res.json()
        setServiceMessage(body.error || 'Failed to submit request.')
      }
    } catch (e) {
      setServiceMessage('Network error. Please try again.')
    } finally {
      setServiceLoading(false)
    }
  }

  // Get index of current status
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.status === status)

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6 py-8 relative">
      {/* Toast Alert Banner */}
      {activeToast && (
        <div className="fixed top-20 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gradient-to-r from-neutral-900 to-amber-950 text-white rounded-2xl p-4 shadow-xl border border-amber-900/40 z-50 flex items-center gap-3 animate-slide-in">
          <Bell className="h-5 w-5 text-amber-500 animate-bounce shrink-0" />
          <div className="text-xs">
            <span className="font-bold block uppercase tracking-wider text-amber-500">Order Update</span>
            <p className="font-medium mt-0.5">{activeToast}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Order Tracking</h1>
          <p className="text-xs text-neutral-500">Order #{orderId.slice(0, 8)}</p>
        </div>
        <Badge className="bg-amber-600 text-white font-medium capitalize border-0">
          {status}
        </Badge>
      </div>

      {/* Dynamic Wait Time & Stepper */}
      <Card className="border border-neutral-200 shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardHeader className="bg-neutral-50/50 p-5 border-b border-neutral-100 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <span className="text-xxs font-bold text-amber-800 uppercase tracking-widest block">Live Wait-Time Calibration</span>
            <p className="text-lg font-extrabold text-neutral-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600 animate-pulse-slow" />
              <span>~{eta} Minutes</span>
            </p>
          </div>
          <Badge variant="outline" className="text-xxs border-neutral-300 font-semibold flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-600 animate-pulse" />
            <span>Load Aware</span>
          </Badge>
        </CardHeader>
        <CardContent className="p-5 py-8">
          {/* Vertical Stepper */}
          <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200">
            {STATUS_STEPS.map((step, idx) => {
              const isPast = idx < currentStepIndex
              const isActive = idx === currentStepIndex
              
              return (
                <div key={step.status} className="relative flex gap-4 text-sm">
                  {/* Stepper Dot */}
                  <div
                    className={`absolute -left-6 z-10 flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-300 ${
                      isPast
                        ? 'bg-amber-600 border-amber-600 text-white'
                        : isActive
                          ? 'bg-white border-amber-600 text-amber-600 ring-4 ring-amber-100'
                          : 'bg-neutral-100 border-neutral-300 text-neutral-400'
                    }`}
                  >
                    {isPast ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <div className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-amber-600 animate-ping' : 'bg-neutral-400'}`} />
                    )}
                  </div>

                  {/* Stepper Content */}
                  <div className="space-y-0.5">
                    <h4
                      className={`font-bold ${
                        isActive ? 'text-amber-800 font-extrabold' : isPast ? 'text-neutral-700' : 'text-neutral-400'
                      }`}
                    >
                      {step.label}
                    </h4>
                    <p className={`text-xs ${isActive ? 'text-neutral-600 font-medium' : 'text-neutral-400'}`}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dine-In Services Card (Group Order Code & Service Button) */}
      <Card className="border border-neutral-200/80 shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardHeader className="p-5 pb-2">
          <CardTitle className="text-sm font-bold text-neutral-800 flex items-center gap-1.5">
            <Users className="h-4 w-4 text-neutral-500" />
            Dine-In Options
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-4">
          <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200/40 text-xs text-neutral-600 space-y-2">
            <span className="font-bold text-neutral-800">Dine-In Group Session:</span>
            <p>
              Share this table session URL with friends at your table. They can join, add to this order, and split the bill:
            </p>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/group/${sessionId}`}
                className="w-full bg-white border border-neutral-200 rounded px-2 py-1 select-all font-mono text-xxs text-neutral-800"
              />
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/group/${sessionId}`)
                  alert('Session URL copied to clipboard!')
                }}
                className="bg-neutral-200 hover:bg-neutral-300 text-neutral-800 border-0 text-xxs font-semibold px-2 py-1 rounded"
              >
                Copy
              </Button>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setServiceModalOpen(true)}
              className="flex-1 border-neutral-300 text-neutral-700 font-bold rounded-xl py-5"
            >
              <PhoneCall className="mr-2 h-4 w-4 text-amber-600" />
              Call for Service
            </Button>
            
            <Button
              onClick={() => router.push(`/group/${sessionId}`)}
              disabled={currentStepIndex < 3} // split bill enabled once order is ready, served, or completed
              className="flex-1 bg-neutral-900 text-white font-bold rounded-xl py-5"
            >
              <Receipt className="mr-2 h-4 w-4" />
              Split Bill
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Order Invoice Summary */}
      <Card className="border border-neutral-200/80 shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardHeader className="p-5 pb-2">
          <CardTitle className="text-sm font-bold text-neutral-800">Order Invoice Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-3">
          {initialItems.map((item) => (
            <div key={item.id} className="flex justify-between text-xs text-neutral-600">
              <div>
                <span className="font-semibold text-neutral-800">
                  {item.menu_items?.name} × {item.qty}
                </span>
                {item.customization_notes && (
                  <p className="text-xxs text-neutral-400 mt-0.5">
                    Note: {item.customization_notes}
                  </p>
                )}
              </div>
              <span className="font-bold text-neutral-800">₹{item.price_at_order * item.qty}</span>
            </div>
          ))}
          <div className="flex justify-between font-extrabold text-sm pt-3 border-t border-neutral-100 text-neutral-950">
            <span>Total amount</span>
            <span>₹{total}</span>
          </div>
        </CardContent>
      </Card>

      {/* Service Call Modal */}
      {serviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-neutral-100 space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-neutral-800 flex items-center gap-2">
                <PhoneCall className="h-5 w-5 text-amber-600" />
                Dine-In Assistance
              </h3>
              <p className="text-xs text-neutral-500">
                Choose a request category. A staff member will be sent to Table {tableId ? 'number ' : ''}shortly.
              </p>
            </div>
            
            <div className="flex flex-col gap-2">
              <button
                disabled={serviceLoading}
                onClick={() => handleCallService('water')}
                className="w-full text-left bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl p-3 text-xs font-semibold text-neutral-700 flex justify-between items-center"
              >
                <span>Need Water</span>
                <span className="text-xxs bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded font-normal">Fast SLA</span>
              </button>
              <button
                disabled={serviceLoading}
                onClick={() => handleCallService('server')}
                className="w-full text-left bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl p-3 text-xs font-semibold text-neutral-700 flex justify-between items-center"
              >
                <span>Call a Server</span>
                <span className="text-xxs bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded font-normal">Assistance</span>
              </button>
              <button
                disabled={serviceLoading}
                onClick={() => handleCallService('bill')}
                className="w-full text-left bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl p-3 text-xs font-semibold text-neutral-700 flex justify-between items-center"
              >
                <span>Request the Bill</span>
                <span className="text-xxs bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded font-normal">Checkout</span>
              </button>
            </div>

            {serviceMessage && (
              <p className="text-xxs text-amber-800 font-semibold bg-amber-50 border border-amber-100 rounded-lg p-2 text-center">
                {serviceMessage}
              </p>
            )}

            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setServiceModalOpen(false)
                  setServiceMessage('')
                }}
                className="text-neutral-500 hover:bg-neutral-100 font-medium"
              >
                Close Panel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
