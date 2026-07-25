import { CartProvider } from '@/lib/cart/cart-context'
import { CartIndicator } from '@/components/customer/cart-indicator'

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <CartProvider>
      <header className="border-b px-4 py-3 flex justify-between items-center">
        <span className="font-semibold">Kaizen</span>
        <CartIndicator />
      </header>
      {children}
    </CartProvider>
  )
}