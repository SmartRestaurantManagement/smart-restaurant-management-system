'use client'

import { useEffect, useState } from 'react'
import { getTopPairing } from '@/lib/pairing/get-pairing'

export function MenuItemPairing({ menuItemId }: { menuItemId: string }) {
  const [pairing, setPairing] = useState<{ paired_name: string } | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    getTopPairing(menuItemId).then((result) => {
      setPairing(result)
      setShown(true)
    })
  }, [menuItemId])

  if (!shown || !pairing) return null

  return (
    <p className="text-xs text-muted-foreground mt-1 animate-in fade-in duration-300">
      Goes well with: <span className="font-medium">{pairing.paired_name}</span>
    </p>
  )
}