'use client'

import { useCart } from '@/lib/cart/cart-context'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useMemo } from 'react'

type Props = {
  menuItemId: string
  name: string
  price: number
  disabled?: boolean
}

export function AddToCartButton({ menuItemId, name, price, disabled }: Props) {
  const { addItem } = useCart()
  const [user, setUser] = useState<any>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => setUser(currentUser))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  if (!user) {
    return (
      <Button size="sm" disabled className="opacity-60 cursor-not-allowed">
        Sign Up to Order
      </Button>
    )
  }

  return (
    <Button
      size="sm"
      disabled={disabled}
      onClick={() => addItem({ menuItemId, name, price })}
      className="bg-terracotta text-terracotta-foreground hover:bg-terracotta/90"
    >
      {disabled ? 'Unavailable' : 'Add to Cart'}
    </Button>
  )
}