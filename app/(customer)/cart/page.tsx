'use client'

import { useCart } from '@/lib/cart/cart-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function CartPage() {
  const { items, updateQty, updateNotes, removeItem, total, clearCart } = useCart()
  const router = useRouter()
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')

  const handlePlaceOrder = async () => {
    if (items.length === 0) return
    setPlacing(true)
    setError('')

    const supabase = createClient()

    // Get the restaurant_id — hardcoded for now since we only have one demo restaurant
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id')
      .limit(1)
      .single()

    if (restaurantError || !restaurant) {
      setError('Could not find restaurant. Please try again.')
      setPlacing(false)
      return
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({ restaurant_id: restaurant.id, status: 'pending' })
      .select()
      .single()

    if (orderError || !order) {
      setError(orderError?.message || 'Failed to place order.')
      setPlacing(false)
      return
    }

    const orderItems = items.map((item) => ({
      restaurant_id: restaurant.id,
      order_id: order.id,
      menu_item_id: item.menuItemId,
      qty: item.qty,
      price_at_order: item.price,
      customization_notes: item.notes || null,
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      setError(itemsError.message)
      setPlacing(false)
      return
    }

    clearCart()
    router.push(`/order/${order.id}`)
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-muted-foreground">
        Your cart is empty.
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Your Cart</h1>

      {items.map((item) => (
        <Card key={item.menuItemId}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">{item.name}</span>
              <span>₹{item.price * item.qty}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateQty(item.menuItemId, item.qty - 1)}
              >
                −
              </Button>
              <span>{item.qty}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateQty(item.menuItemId, item.qty + 1)}
              >
                +
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-red-500"
                onClick={() => removeItem(item.menuItemId)}
              >
                Remove
              </Button>
            </div>

            <input
              type="text"
              placeholder="Add a note (e.g. less spicy)"
              value={item.notes}
              onChange={(e) => updateNotes(item.menuItemId, e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-between items-center pt-4 border-t">
        <span className="font-semibold text-lg">Total: ₹{total}</span>
        <Button onClick={handlePlaceOrder} disabled={placing}>
          {placing ? 'Placing order...' : 'Place Order'}
        </Button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  )
}