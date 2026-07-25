'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

export type CartItem = {
  menuItemId: string
  name: string
  price: number
  qty: number
  notes: string
}

type CartContextType = {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'qty' | 'notes'>) => void
  updateQty: (menuItemId: string, qty: number) => void
  updateNotes: (menuItemId: string, notes: string) => void
  removeItem: (menuItemId: string) => void
  clearCart: () => void
  total: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  const addItem: CartContextType['addItem'] = (item) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.menuItemId)
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item.menuItemId ? { ...i, qty: i.qty + 1 } : i
        )
      }
      return [...prev, { ...item, qty: 1, notes: '' }]
    })
  }

  const updateQty = (menuItemId: string, qty: number) => {
    if (qty <= 0) {
      removeItem(menuItemId)
      return
    }
    setItems((prev) =>
      prev.map((i) => (i.menuItemId === menuItemId ? { ...i, qty } : i))
    )
  }

  const updateNotes = (menuItemId: string, notes: string) => {
    setItems((prev) =>
      prev.map((i) => (i.menuItemId === menuItemId ? { ...i, notes } : i))
    )
  }

  const removeItem = (menuItemId: string) => {
    setItems((prev) => prev.filter((i) => i.menuItemId !== menuItemId))
  }

  const clearCart = () => setItems([])

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0)

  return (
    <CartContext.Provider
      value={{ items, addItem, updateQty, updateNotes, removeItem, clearCart, total }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}