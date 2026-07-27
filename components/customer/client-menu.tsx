'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MenuItemPairing } from '@/components/customer/menu-item-pairing'
import { useCart } from '@/lib/cart/cart-context'
import { useTableSession } from '@/lib/cart/table-session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AddToCartButton } from '@/components/customer/add-to-cart-button'
import { Sparkles, MapPin, AlertCircle, RefreshCw, Layers } from 'lucide-react'
import type { Database } from '@/types/database'
import type { CategoryWithItems } from '@/lib/menu/get-menu'

type MenuItem = Database['public']['Tables']['menu_items']['Row']
type TableRow = Database['public']['Tables']['tables']['Row']
type OfferRow = Database['public']['Tables']['offers']['Row']

type Props = {
  initialCategories: CategoryWithItems[]
}

export function ClientMenu({ initialCategories }: Props) {
  const { tableNumber, tableId, sessionId, startSession, endSession } = useTableSession()
  const { addItem } = useCart()
  const [categories, setCategories] = useState(initialCategories)
  const [tables, setTables] = useState<TableRow[]>([])
  const [activeOffers, setActiveOffers] = useState<OfferRow[]>([])
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [tableModalOpen, setTableModalOpen] = useState(false)
  
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  // Fetch user auth state and clear table session if logged out
  useEffect(() => {
    async function checkUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)
      if (!currentUser) {
        endSession()
      }
      setAuthLoading(false)
    }
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        endSession()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, endSession])

  // Load tables for the dine-in selector
  useEffect(() => {
    async function loadTables() {
      const { data } = await supabase.from('tables').select('*').order('table_number')
      if (data) setTables(data)
    }
    loadTables()
  }, [supabase])

  // Load active offers
  useEffect(() => {
    async function loadOffers() {
      const { data } = await supabase
        .from('offers')
        .select('*')
        .eq('active', true)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      if (data) setActiveOffers(data)
    }
    loadOffers()
  }, [supabase, categories])

  // Subscribe to real-time menu_items, offers, and tables changes
  useEffect(() => {
    const menuChannel = supabase
      .channel('menu-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        (payload) => {
          const updatedItem = payload.new as MenuItem
          setCategories((prev) =>
            prev.map((cat) => ({
              ...cat,
              menu_items: cat.menu_items.map((item) =>
                item.id === updatedItem.id ? { ...item, ...updatedItem } : item
              ),
            }))
          )
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'offers' },
        (payload) => {
          // Reload offers on any change
          supabase
            .from('offers')
            .select('*')
            .eq('active', true)
            .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
            .then(({ data }) => {
              if (data) setActiveOffers(data)
            })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTables((prev) => {
              const exists = prev.some((t) => t.id === (payload.new as TableRow).id)
              if (exists) return prev
              return [...prev, payload.new as TableRow].sort((a, b) => a.table_number - b.table_number)
            })
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as TableRow
            setTables((prev) =>
              prev.map((t) => (t.id === updated.id ? updated : t))
            )
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setTables((prev) => prev.filter((t) => t.id !== deleted.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(menuChannel)
    }
  }, [supabase])

  // Handle table selection and order session joining
  const handleSelectTable = async (tId: string) => {
    const table = tables.find((t) => t.id === tId)
    if (!table) return

    try {
      // If already seated at a different table, free the old table
      if (tableId && tableId !== tId) {
        await supabase
          .from('tables')
          .update({ status: 'free' })
          .eq('id', tableId)
      }

      // Mark the selected table as occupied
      await supabase
        .from('tables')
        .update({ status: 'occupied' })
        .eq('id', tId)
    } catch (err) {
      console.error('Failed to update table status:', err)
    }

    // 1. Check if there's already an active order for this table to join
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, session_id')
      .eq('table_id', table.id)
      .in('status', ['pending', 'confirmed'])
      .order('created_at', { ascending: false })
      .limit(1)

    let finalSessionId = crypto.randomUUID()
    if (activeOrders && activeOrders.length > 0) {
      finalSessionId = activeOrders[0].session_id
      // Store the order ID so we track it
      localStorage.setItem('kaizen_latest_order_id', activeOrders[0].id)
    }

    startSession(table.table_number, table.id, finalSessionId)
    setTableModalOpen(false)
  }

  // Helper to get active discount for an item
  const getItemOffer = (itemId: string) => {
    return activeOffers.find((o) => o.menu_item_id === itemId && o.active)
  }

  // Floating Smart Offer Banner
  const featuredOffer = activeOffers.length > 0 ? activeOffers[0] : null
  const featuredItem = featuredOffer
    ? categories
        .flatMap((c) => c.menu_items)
        .find((item) => item.id === featuredOffer.menu_item_id)
    : null

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Table Session Prompt / Indicator */}
      {!user ? (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="space-y-1">
            <h3 className="font-semibold text-amber-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 animate-pulse" />
              Dining with us?
            </h3>
            <p className="text-sm text-amber-800/80">
              Please sign up with your email to select a table, claim offers, and place orders.
            </p>
          </div>
          <Link href="/signup">
            <Button className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm">
              Sign Up to Order
            </Button>
          </Link>
        </div>
      ) : !tableNumber ? (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="space-y-1">
            <h3 className="font-semibold text-amber-900 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-600 animate-bounce" />
              Dining in? Select your Table
            </h3>
            <p className="text-sm text-amber-800/80">
              Select your table number to enable group ordering and split the bill with friends.
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
            >
              <option value="">Choose Table...</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.table_number} ({t.status})
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!selectedTable}
              onClick={() => handleSelectTable(selectedTable)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm"
            >
              Join Table
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between bg-neutral-100/80 rounded-2xl px-6 py-3 border border-neutral-200 text-sm">
          <div className="flex items-center gap-2 text-neutral-700 font-medium">
            <MapPin className="h-4 w-4 text-amber-600" />
            <span>Seated at <strong className="text-amber-800 font-semibold">Table {tableNumber}</strong></span>
          </div>
          <div className="flex gap-4 items-center">
            {sessionId && (
              <span className="text-xs text-neutral-500 hidden sm:inline">
                Session ID: {sessionId.slice(0, 8)}...
              </span>
            )}
            <button
              onClick={() => setTableModalOpen(true)}
              className="text-amber-700 hover:text-amber-800 font-medium underline text-xs"
            >
              Change Table
            </button>
          </div>
        </div>
      )}

      {/* Floating Smart Offer Notification */}
      {featuredItem && featuredOffer && (
        <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md animate-pulse-subtle">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <Sparkles className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                Limited Smart Offer
              </span>
              <h4 className="font-semibold text-lg mt-1">
                Save {Math.round(Number(featuredOffer.discount_pct))}% on {featuredItem.name}!
              </h4>
              <p className="text-xs text-white/90">
                Automatically generated discount to prevent kitchen overstock. Grab it before it sells out!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="line-through text-xs text-white/70">₹{featuredItem.price}</span>
              <p className="font-bold text-lg">₹{Math.round(Number(featuredItem.price) * (1 - Number(featuredOffer.discount_pct) / 100))}</p>
            </div>
            <Button
              onClick={() => {
                if (!user) {
                  router.push('/signup')
                  return
                }
                addItem({
                  menuItemId: featuredItem.id,
                  name: featuredItem.name,
                  price: Number(featuredItem.price) * (1 - Number(featuredOffer.discount_pct) / 100)
                })
              }}
              className="bg-white text-orange-600 hover:bg-orange-50 font-bold shadow-md rounded-xl px-4 py-2"
            >
              {user ? 'Claim Offer' : 'Login to Claim'}
            </Button>
          </div>
        </div>
      )}

      {/* Menu Categories & Items */}
      <div className="space-y-12">
        {categories.map((category) => (
          <section key={category.id} className="space-y-6">
            <div className="flex items-center gap-3 border-b border-neutral-100 pb-3">
              <h2 className="text-2xl font-bold tracking-tight text-neutral-800">{category.name}</h2>
              <Badge variant="secondary" className="rounded-md font-medium text-xs">
                {category.menu_items.length} items
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.menu_items.map((item) => {
                const isSoldOut =
                  item.is_available === false ||
                  (item.remaining_stock !== null && item.remaining_stock <= 0)

                const offer = getItemOffer(item.id)
                const finalPrice = offer
                  ? Number(item.price) * (1 - Number(offer.discount_pct) / 100)
                  : Number(item.price)

                return (
                  <Card 
                    key={item.id} 
                    className={`relative overflow-hidden transition-all duration-300 border border-neutral-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                      isSoldOut ? 'opacity-50 select-none bg-neutral-50/50' : 'bg-white'
                    }`}
                  >
                    {offer && !isSoldOut && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-red-500 to-orange-500 text-white text-xxs font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1 shadow-sm">
                        <Sparkles className="h-3 w-3" />
                        <span>{Math.round(Number(offer.discount_pct))}% OFF</span>
                      </div>
                    )}
                    <CardHeader className="p-5 pb-2">
                      <CardTitle className="text-base font-bold text-neutral-800 pr-16 truncate">
                        {item.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        {isSoldOut ? (
                          <Badge variant="destructive" className="rounded-md font-semibold text-xxs px-2 py-0.5">
                            Not Available
                          </Badge>
                        ) : (
                          <Badge 
                            variant="secondary" 
                            className="rounded-md font-semibold text-xxs px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200/60 font-medium"
                          >
                            Available
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-5 pt-0 space-y-4">
                      {item.description && (
                        <p className="text-xs text-neutral-500 line-clamp-2 h-8">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-baseline justify-between pt-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-extrabold text-neutral-900">
                            ₹{finalPrice}
                          </span>
                          {offer && (
                            <span className="text-xs text-neutral-400 line-through">
                              ₹{item.price}
                            </span>
                          )}
                        </div>
                        <AddToCartButton
                          menuItemId={item.id}
                          name={item.name}
                          price={finalPrice}
                          disabled={isSoldOut}
                        />
                      </div>
                      <MenuItemPairing menuItemId={item.id} />
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Change Table Modal (simple overlay) */}
      {tableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-neutral-100 space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-neutral-800">Switch Table Session</h3>
              <p className="text-xs text-neutral-500">
                Select your new table number below. This will move you to the new table's shared session.
              </p>
            </div>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
            >
              <option value="">Choose Table...</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.table_number} ({t.status})
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTableModalOpen(false)}
                className="text-neutral-500 hover:bg-neutral-100 font-medium"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!selectedTable}
                onClick={() => handleSelectTable(selectedTable)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
              >
                Confirm Switch
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
