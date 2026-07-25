import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { notFound } from 'next/navigation'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Order Received',
  confirmed: 'Confirmed',
  preparing: "Kitchen's Started",
  ready: 'Ready',
  served: 'Served',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export default async function OrderTrackingPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', params.id)
    .single()

  if (orderError || !order) {
    notFound()
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('*, menu_items(name)')
    .eq('order_id', params.id)

  const total = (items || []).reduce(
    (sum, item) => sum + item.price_at_order * item.qty,
    0
  )

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Order Status</h1>
        <p className="text-sm text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Status</CardTitle>
          <Badge>{STATUS_LABELS[order.status] || order.status}</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Estimated time: <span className="font-medium">~20 minutes</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            (Live ETA calibration coming soon)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(items || []).map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <div>
                <span>{item.menu_items?.name} × {item.qty}</span>
                {item.customization_notes && (
                  <p className="text-xs text-muted-foreground">
                    Note: {item.customization_notes}
                  </p>
                )}
              </div>
              <span>₹{item.price_at_order * item.qty}</span>
            </div>
          ))}
          <div className="flex justify-between font-semibold pt-2 border-t">
            <span>Total</span>
            <span>₹{total}</span>
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full" disabled>
        Call for Service (coming Day 2)
      </Button>
    </div>
  )
}