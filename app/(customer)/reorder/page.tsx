'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { History, ArrowRight, RefreshCw, ShoppingBag, Sparkles, Clock } from 'lucide-react'
import type { Database } from '@/types/database'

type OrderRow = Database['public']['Tables']['orders']['Row']
type OrderItemWithDetails = Database['public']['Tables']['order_items']['Row'] & {
  menu_items: { name: string; price: number } | null
}

interface PastOrder {
  id: string
  created_at: string
  status: string
  items: OrderItemWithDetails[]
  total: number
}

export default function ReorderPage() {
  const router = useRouter()
  const supabase = createClient()

  const [orders, setOrders] = useState<PastOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPastOrders() {
      setLoading(true)
      setError('')

      // 1. Gather order IDs from local storage
      const localIdsRaw = localStorage.getItem('kaizen_past_order_ids') || '[]'
      const latestId = localStorage.getItem('kaizen_latest_order_id')
      let localIds: string[] = JSON.parse(localIdsRaw)
      if (latestId && !localIds.includes(latestId)) {
        localIds = [latestId, ...localIds]
        localStorage.setItem('kaizen_past_order_ids', JSON.stringify(localIds))
      }

      // 2. Query orders from database (both matching local storage list and logged-in user)
      const { data: { user } } = await supabase.auth.getUser()
      
      let query = supabase
        .from('orders')
        .select('*, order_items(*, menu_items(name, price))')
        .order('created_at', { ascending: false })

      if (user) {
        // If user is logged in, query their orders or orders in local storage
        if (localIds.length > 0) {
          query = query.or(`customer_id.eq.${user.id},id.in.(${localIds.map(id => `"${id}"`).join(',')})`)
        } else {
          query = query.eq('customer_id', user.id)
        }
      } else {
        // Guest customer: query only local storage orders
        if (localIds.length > 0) {
          query = query.in('id', localIds)
        } else {
          setOrders([])
          setLoading(false)
          return
        }
      }

      const { data, error: queryError } = await query

      if (queryError) {
        setError(queryError.message)
        setLoading(false)
        return
      }

      if (data) {
        const formatted: PastOrder[] = data.map((o: any) => {
          const itemsList = (o.order_items || []) as OrderItemWithDetails[]
          const totalAmt = itemsList.reduce((sum, item) => sum + item.price_at_order * item.qty, 0)
          return {
            id: o.id,
            created_at: o.created_at,
            status: o.status,
            items: itemsList,
            total: totalAmt,
          }
        })
        setOrders(formatted)
      }
      setLoading(false)
    }

    loadPastOrders()
  }, [supabase])

  // One-tap repeat order action
  const handleRepeatOrder = async (pastOrder: PastOrder) => {
    setReorderingId(pastOrder.id)
    setError('')

    try {
      const { data: restaurant, error: restError } = await supabase
        .from('restaurants')
        .select('id')
        .limit(1)
        .single()

      if (restError || !restaurant) {
        setError('Could not resolve restaurant details.')
        setReorderingId(null)
        return
      }

      // Check current seated table number in local storage to see if we can maintain same table context
      const tableId = localStorage.getItem('kaizen_table_id') || null
      const sessionId = localStorage.getItem('kaizen_session_id') || crypto.randomUUID()

      // 1. Create a new order header
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurant.id,
          status: 'pending' as const,
          table_id: tableId,
          session_id: sessionId,
        })
        .select()
        .single()

      if (orderError || !newOrder) {
        setError(orderError?.message || 'Failed to place order header.')
        setReorderingId(null)
        return
      }

      // 2. Insert items exactly as they were in the past order
      const newItems = pastOrder.items.map((item) => ({
        restaurant_id: restaurant.id,
        order_id: newOrder.id,
        menu_item_id: item.menu_item_id,
        qty: item.qty,
        price_at_order: item.price_at_order, // using original price or lookup current price
        customization_notes: item.customization_notes || null,
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(newItems)

      if (itemsError) {
        setError(itemsError.message)
        setReorderingId(null)
        return
      }

      // Save order in history cache
      localStorage.setItem('kaizen_latest_order_id', newOrder.id)
      const rawLocal = localStorage.getItem('kaizen_past_order_ids') || '[]'
      const ids: string[] = JSON.parse(rawLocal)
      if (!ids.includes(newOrder.id)) {
        localStorage.setItem('kaizen_past_order_ids', JSON.stringify([newOrder.id, ...ids]))
      }

      // Redirect to tracking page
      router.push(`/order/${newOrder.id}`)
    } catch (e) {
      setError('An unexpected error occurred during reordering.')
      setReorderingId(null)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6 py-8">
      <div>
        <span className="text-xxs font-bold text-amber-800 uppercase tracking-widest block">One-Tap Ordering</span>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-800 mt-1 flex items-center gap-2">
          <History className="h-6 w-6 text-amber-600 animate-spin-slow" />
          Reorder Past Favorites
        </h1>
        <p className="text-xs text-neutral-500">
          Access your recent order history and repeat them in one click, including customization notes.
        </p>
      </div>

      {error && <p className="text-red-600 text-xs font-semibold">{error}</p>}

      {loading ? (
        <div className="text-center text-sm text-neutral-500 py-10">
          Loading past orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-neutral-200 rounded-3xl space-y-3">
          <ShoppingBag className="h-8 w-8 text-neutral-400 mx-auto" />
          <p className="text-sm text-neutral-500">No past order history found on this browser yet.</p>
          <Button onClick={() => router.push('/menu')} className="bg-neutral-900 text-white rounded-xl text-xs font-semibold">
            Make your first order
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((pastOrder) => {
            const isReordering = reorderingId === pastOrder.id
            const dateStr = new Date(pastOrder.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
            
            return (
              <Card key={pastOrder.id} className="border border-neutral-200/80 shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardHeader className="bg-neutral-50/50 p-4 border-b border-neutral-100 flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xxs text-neutral-400 block font-semibold">{dateStr}</span>
                    <span className="text-xs font-bold text-neutral-800">Order ID: #{pastOrder.id.slice(0, 8)}</span>
                  </div>
                  <Badge variant="outline" className="text-xxs border-neutral-300 font-medium">
                    Total: ₹{pastOrder.total}
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Order Items */}
                  <div className="space-y-2">
                    {pastOrder.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-xs text-neutral-600">
                        <div>
                          <span>
                            {item.menu_items?.name} <strong className="text-neutral-800">× {item.qty}</strong>
                          </span>
                          {item.customization_notes && (
                            <span className="text-xxs text-amber-700 bg-amber-50 px-1 py-0.5 rounded block w-fit font-medium mt-0.5">
                              Note: {item.customization_notes}
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-neutral-800">₹{item.price_at_order * item.qty}</span>
                      </div>
                    ))}
                  </div>

                  {/* One-Tap Action */}
                  <Button
                    disabled={isReordering}
                    onClick={() => handleRepeatOrder(pastOrder)}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl py-3 flex items-center justify-center gap-2 text-xs shadow-sm transition-all active:scale-99"
                  >
                    {isReordering ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Reordering...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                        <span>Repeat Order in One Tap</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
