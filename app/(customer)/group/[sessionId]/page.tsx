'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { splitEven, splitByItem, type ParticipantAssignments } from '@/lib/billing/split-calculator'
import { Users, Receipt, QrCode, Clipboard, Share2, Sparkles, Check, CheckSquare } from 'lucide-react'
import type { Database } from '@/types/database'

type OrderRow = Database['public']['Tables']['orders']['Row']
type OrderItemRow = Database['public']['Tables']['order_items']['Row'] & {
  menu_items: { name: string } | null
}

export default function GroupSessionPage({
  params,
}: {
  params: { sessionId: string }
}) {
  const router = useRouter()
  const supabase = createClient()
  const sessionId = params.sessionId

  const [order, setOrder] = useState<OrderRow | null>(null)
  const [items, setItems] = useState<OrderItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Split calculation state
  const [splitMethod, setSplitMethod] = useState<'even' | 'by_item'>('even')
  const [headcount, setHeadcount] = useState(2)
  const [participants, setParticipants] = useState<string[]>(['You', 'Friend 1'])
  const [newParticipantName, setNewParticipantName] = useState('')
  const [assignments, setAssignments] = useState<ParticipantAssignments>({
    'You': [],
    'Friend 1': [],
  })
  
  // Selected payer for QR generation
  const [selectedPayer, setSelectedPayer] = useState<string>('You')
  const [payerAmount, setPayerAmount] = useState<number>(0)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')

  // Load the order and items for the session
  const loadSessionData = useCallback(async () => {
    // 1. Fetch order
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('session_id', sessionId)
      .limit(1)
      .maybeSingle()

    if (orderError) {
      setError(orderError.message)
      setLoading(false)
      return
    }

    if (!orderData) {
      setError('Active group table session not found.')
      setLoading(false)
      return
    }

    setOrder(orderData)

    // 2. Fetch items for this order
    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('*, menu_items(name)')
      .eq('order_id', orderData.id)

    if (itemsError) {
      setError(itemsError.message)
    } else {
      const orderItems = (itemsData || []) as OrderItemRow[]
      setItems(orderItems)
      
      // Auto-assign items to 'You' by default if assignments are empty
      setAssignments((prev) => {
        const updated = { ...prev }
        const itemIds = orderItems.map(i => i.id)
        if (updated['You'] && updated['You'].length === 0) {
          updated['You'] = itemIds
        }
        return updated
      })
    }

    setLoading(false)
  }, [sessionId, supabase])

  useEffect(() => {
    loadSessionData()
  }, [loadSessionData])

  // Subscribe to real-time additions/updates to order items
  useEffect(() => {
    if (!order) return

    const channel = supabase
      .channel(`group-order-items-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
          filter: `order_id=eq.${order.id}`,
        },
        () => {
          // Re-load items
          loadSessionData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [order, supabase, loadSessionData])

  // Compute splits whenever items, splitMethod, headcount, or assignments change
  const total = items.reduce((sum, i) => sum + i.price_at_order * i.qty, 0)

  useEffect(() => {
    if (splitMethod === 'even') {
      const shares = splitEven(total, headcount)
      // If headcount matches participants, map them, otherwise map indices
      const payAmt = shares[participants.indexOf(selectedPayer)] || shares[0] || (total / headcount)
      setPayerAmount(Math.round(payAmt * 100) / 100)
    } else {
      // Split by item calculation
      const orderItemsForCalc = items.map(i => ({
        id: i.id,
        price_at_order: Number(i.price_at_order),
        qty: i.qty,
      }))
      const shares = splitByItem(orderItemsForCalc, assignments)
      const payAmt = shares[selectedPayer] || 0
      setPayerAmount(Math.round(payAmt * 100) / 100)
    }
  }, [items, splitMethod, headcount, participants, assignments, selectedPayer, total])

  // Generate UPI QR code url when payerAmount changes
  useEffect(() => {
    if (payerAmount <= 0) {
      setQrCodeUrl('')
      return
    }
    // Deep link structure: upi://pay?pa=address&pn=name&am=amount&cu=INR
    const upiLink = `upi://pay?pa=kaizenrestaurant@ybl&pn=Kaizen%20Restaurant&am=${payerAmount}&cu=INR&tn=Table%20Session%20Split`
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`
    setQrCodeUrl(qrApiUrl)
  }, [payerAmount])

  // Add participant
  const handleAddParticipant = () => {
    if (!newParticipantName.trim() || participants.includes(newParticipantName.trim())) return
    const name = newParticipantName.trim()
    setParticipants(prev => [...prev, name])
    setAssignments(prev => ({ ...prev, [name]: [] }))
    setNewParticipantName('')
    setHeadcount(prev => prev + 1)
  }

  // Toggle item assignment for a participant
  const handleToggleAssignment = (participant: string, itemId: string) => {
    setAssignments(prev => {
      const list = prev[participant] || []
      const updatedList = list.includes(itemId)
        ? list.filter(id => id !== itemId)
        : [...list, itemId]
      
      return {
        ...prev,
        [participant]: updatedList,
      }
    })
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    alert('Session URL copied! Send it to your friends to join table.')
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-20 text-center text-sm text-neutral-500">
        Connecting to table session...
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-4">
        <h3 className="text-lg font-bold text-neutral-800">Session Error</h3>
        <p className="text-sm text-neutral-500">{error || 'No active session found.'}</p>
        <Button onClick={() => router.push('/menu')} className="bg-terracotta text-terracotta-foreground hover:bg-terracotta/90 rounded-xl">
          Back to Menu
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xxs font-bold text-amber-800 uppercase tracking-widest block">Group Dine-In Session</span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-800 mt-1">
            Table {order.table_id ? 'Active Order' : 'Group Session'} Split
          </h1>
          <p className="text-xs text-neutral-500">Order ID: #{order.id.slice(0, 8)}</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleShare}
            className="border-neutral-300 text-neutral-700 font-semibold flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs"
          >
            <Share2 className="h-3.5 w-3.5 text-amber-600" />
            Share Table Link
          </Button>
          <Button
            size="sm"
            onClick={() => router.push('/menu')}
            className="bg-terracotta text-terracotta-foreground hover:bg-terracotta/90 font-semibold text-xs px-3 py-1.5 rounded-xl"
          >
            Add More Dishes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Ticket & Split Configuration */}
        <div className="md:col-span-2 space-y-6">
          {/* Consolidated Kitchen Ticket */}
          <Card className="border border-neutral-200 shadow-sm rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-neutral-50/50 p-4 border-b border-neutral-100 flex flex-row justify-between items-center">
              <CardTitle className="text-sm font-bold text-neutral-800 flex items-center gap-1.5">
                <Receipt className="h-4 w-4 text-neutral-500" />
                Consolidated Bill Items
              </CardTitle>
              <Badge className="bg-amber-600 text-white border-0 font-medium">
                Total: ₹{total}
              </Badge>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {items.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-4">No items added to this table order yet.</p>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {items.map((item) => (
                    <div key={item.id} className="py-3 flex justify-between items-start gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="font-bold text-neutral-800">{item.menu_items?.name}</span>
                        <span className="text-neutral-400 block">Qty: {item.qty} × ₹{item.price_at_order}</span>
                        {item.customization_notes && (
                          <span className="text-xxs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded block w-fit font-semibold">
                            Note: {item.customization_notes}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-neutral-900 text-sm">₹{item.price_at_order * item.qty}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Split Mode Selector */}
          <Card className="border border-neutral-200 shadow-sm rounded-2xl overflow-hidden bg-white">
            <CardHeader className="p-4 border-b border-neutral-100">
              <CardTitle className="text-sm font-bold text-neutral-800">Choose Split Method</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSplitMethod('even')}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    splitMethod === 'even'
                      ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-sm'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>Split Evenly</span>
                </button>
                <button
                  onClick={() => setSplitMethod('by_item')}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    splitMethod === 'by_item'
                      ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-sm'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <Receipt className="h-4 w-4" />
                  <span>Split by Item</span>
                </button>
              </div>

              {splitMethod === 'even' ? (
                /* Even Split Inputs */
                <div className="flex items-center justify-between bg-neutral-50 rounded-xl p-4 border border-neutral-200/40 text-xs">
                  <span className="font-semibold text-neutral-700">Number of Seated Headcount:</span>
                  <div className="flex items-center gap-3">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => setHeadcount(prev => Math.max(1, prev - 1))}
                    >
                      -
                    </Button>
                    <span className="font-bold text-sm text-neutral-800">{headcount}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => setHeadcount(prev => prev + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>
              ) : (
                /* Split by Item assignments matrix */
                <div className="space-y-4">
                  {/* Manage Participants list */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add friend's name..."
                      value={newParticipantName}
                      onChange={(e) => setNewParticipantName(e.target.value)}
                      className="flex-1 bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-neutral-800"
                    />
                    <Button
                      onClick={handleAddParticipant}
                      className="bg-terracotta text-terracotta-foreground hover:bg-terracotta/90 text-xs font-semibold px-4 py-2 rounded-xl shrink-0"
                    >
                      Add Friend
                    </Button>
                  </div>

                  {/* Matrix Checkboxes */}
                  <div className="overflow-x-auto border border-neutral-100 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-100">
                          <th className="p-3">Dish name</th>
                          {participants.map(p => (
                            <th key={p} className="p-3 text-center truncate max-w-28">{p}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {items.map(item => (
                          <tr key={item.id} className="hover:bg-neutral-50/50">
                            <td className="p-3 font-semibold text-neutral-800">{item.menu_items?.name}</td>
                            {participants.map(p => {
                              const isChecked = (assignments[p] || []).includes(item.id);
                              return (
                                <td key={p} className="p-3 text-center">
                                  <button
                                    onClick={() => handleToggleAssignment(p, item.id)}
                                    className={`mx-auto h-5 w-5 rounded border flex items-center justify-center transition-all ${
                                      isChecked
                                        ? 'bg-amber-500 border-amber-500 text-white'
                                        : 'bg-white border-neutral-300 text-transparent'
                                    }`}
                                  >
                                    <Check className="h-3 w-3" />
                                  </button>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Split breakdown & UPI Payment QR */}
        <div className="space-y-6">
          {/* Breakdown summary */}
          <Card className="border border-neutral-200 shadow-sm rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-neutral-50/50 p-4 border-b border-neutral-100">
              <CardTitle className="text-sm font-bold text-neutral-800">Split Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-3">
                {splitMethod === 'even' ? (
                  Array.from({ length: headcount }).map((_, i) => {
                    const shares = splitEven(total, headcount)
                    const pName = participants[i] || `Friend ${i + 1}`
                    const isPayer = pName === selectedPayer
                    
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          if (participants[i]) setSelectedPayer(participants[i])
                        }}
                        className={`w-full text-left p-3 rounded-xl border flex justify-between items-center transition-all ${
                          isPayer
                            ? 'bg-amber-50/60 border-amber-500 text-amber-900 shadow-sm font-bold'
                            : 'bg-white text-neutral-600 border-neutral-100 hover:bg-neutral-50'
                        }`}
                      >
                        <span className="text-xs">{pName}</span>
                        <span className="text-sm font-extrabold text-neutral-900">₹{shares[i] || (total / headcount)}</span>
                      </button>
                    )
                  })
                ) : (
                  participants.map((p) => {
                    const orderItemsForCalc = items.map(i => ({
                      id: i.id,
                      price_at_order: Number(i.price_at_order),
                      qty: i.qty,
                    }))
                    const shares = splitByItem(orderItemsForCalc, assignments)
                    const shareAmt = shares[p] || 0
                    const isPayer = p === selectedPayer

                    return (
                      <button
                        key={p}
                        onClick={() => setSelectedPayer(p)}
                        className={`w-full text-left p-3 rounded-xl border flex justify-between items-center transition-all ${
                          isPayer
                            ? 'bg-amber-50/60 border-amber-500 text-amber-900 shadow-sm font-bold'
                            : 'bg-white text-neutral-600 border-neutral-100 hover:bg-neutral-50'
                        }`}
                      >
                        <div className="text-xs">
                          <span>{p}</span>
                          <span className="text-xxs text-neutral-400 block">{(assignments[p] || []).length} items claimed</span>
                        </div>
                        <span className="text-sm font-extrabold text-neutral-900">₹{shareAmt}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* QR Code Renders */}
          {qrCodeUrl ? (
            <Card className="border border-neutral-200 shadow-sm rounded-2xl overflow-hidden bg-white text-center">
              <CardHeader className="bg-neutral-50/50 p-4 border-b border-neutral-100">
                <CardTitle className="text-sm font-bold text-neutral-800 flex items-center justify-center gap-1.5">
                  <QrCode className="h-4 w-4 text-amber-600 animate-pulse" />
                  UPI Payments Link
                </CardTitle>
                <p className="text-xxs text-neutral-400 mt-0.5">
                  Scan QR using any UPI app (GPay, PhonePe, Paytm) to pay for <strong className="text-neutral-700">{selectedPayer}</strong>
                </p>
              </CardHeader>
              <CardContent className="p-5 flex flex-col items-center justify-center gap-4">
                <div className="bg-white p-3 rounded-xl border border-neutral-100 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCodeUrl} alt="UPI Payment QR" className="mx-auto" />
                </div>
                <div className="space-y-1">
                  <span className="text-xxs text-neutral-400 uppercase tracking-widest font-bold">Amount to pay</span>
                  <p className="text-2xl font-extrabold text-neutral-950">₹{payerAmount}</p>
                </div>
                <Badge variant="secondary" className="bg-neutral-100 text-neutral-700 border-0 flex items-center gap-1 py-1 rounded text-xxs font-semibold">
                  <Sparkles className="h-3 w-3 text-amber-600 animate-pulse" />
                  <span>Kaizen OS - No Gateway Fee</span>
                </Badge>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
