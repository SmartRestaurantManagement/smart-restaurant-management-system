import { createClient } from '@/lib/supabase/server'
import { ClientOrderTracking } from '@/components/customer/client-order-tracking'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function OrderTrackingPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  // 1. Fetch order details
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', params.id)
    .single()

  if (orderError || !order) {
    notFound()
  }

  // 2. Fetch order items
  const { data: items } = await supabase
    .from('order_items')
    .select('*, menu_items(name)')
    .eq('order_id', params.id)

  const typedItems = (items || []) as any[]

  return (
    <div className="bg-neutral-50/20 min-h-screen">
      <ClientOrderTracking
        orderId={order.id}
        initialStatus={order.status}
        initialItems={typedItems}
        restaurantId={order.restaurant_id}
        tableId={order.table_id}
        sessionId={order.session_id}
      />
    </div>
  )
}