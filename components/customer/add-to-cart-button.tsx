'use client'

import { useCart } from '@/lib/cart/cart-context'
import { Button } from '@/components/ui/button'

type Props = {
  menuItemId: string
  name: string
  price: number
  disabled?: boolean
}

export function AddToCartButton({ menuItemId, name, price, disabled }: Props) {
  const { addItem } = useCart()

  return (
    <Button
      size="sm"
      disabled={disabled}
      onClick={() => addItem({ menuItemId, name, price })}
    >
      {disabled ? 'Unavailable' : 'Add to Cart'}
    </Button>
  )
}