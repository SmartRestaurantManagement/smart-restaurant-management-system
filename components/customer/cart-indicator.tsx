'use client'

import Link from 'next/link'
import { useCart } from '@/lib/cart/cart-context'

export function CartIndicator() {
  const { items } = useCart()
  const count = items.reduce((sum, i) => sum + i.qty, 0)

  return (
    <Link href="/cart" className="text-sm font-medium">
      Cart {count > 0 ? `(${count})` : ''}
    </Link>
  )
}