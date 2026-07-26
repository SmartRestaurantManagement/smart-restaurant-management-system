import { CartProvider } from '@/lib/cart/cart-context'
import { CustomerHeader } from '@/components/customer/customer-header'

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-neutral-50/40">
        <CustomerHeader />
        {children}
      </div>
    </CartProvider>
  )
}