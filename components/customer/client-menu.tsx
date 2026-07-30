'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/lib/cart/cart-context'
import { useTableSession } from '@/lib/cart/table-session'
import { AddToCartButton } from '@/components/customer/add-to-cart-button'
import { Bell, MapPin, Sparkles, X } from 'lucide-react'
import type { Database } from '@/types/database'
import type { CategoryWithItems, MenuItemWithIngredients } from '@/lib/menu/get-menu'

type MenuItem = Database['public']['Tables']['menu_items']['Row']
type TableRow = Database['public']['Tables']['tables']['Row']
type OfferRow = Database['public']['Tables']['offers']['Row']

type Props = {
  initialCategories: CategoryWithItems[]
}

const CATEGORY_BLURBS: Record<string, string> = {
  Starters: 'Small plates to kickstart the meal, crafted to perfection.',
  Mains: 'Hearty plates built on slow-cooked bases and traditional spice.',
  Breads: 'Soft, warm and fresh, baked to complement every plate.',
  Beverages: 'Refreshing drinks to cool you down and lift your mood.',
  Desserts: 'End the meal on a sweet note, made fresh in-house daily.',
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function isSoldOut(item: MenuItem) {
  return item.is_available === false || (item.remaining_stock !== null && item.remaining_stock <= 0)
}

export function ClientMenu({ initialCategories }: Props) {
  const { tableNumber, tableId, sessionId, startSession, endSession } = useTableSession()
  const [categories, setCategories] = useState(initialCategories)
  const [tables, setTables] = useState<TableRow[]>([])
  const [activeOffers, setActiveOffers] = useState<OfferRow[]>([])
  const [selectedTable, setSelectedTable] = useState('')
  const [tableModalOpen, setTableModalOpen] = useState(false)
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [serviceLoading, setServiceLoading] = useState(false)
  const [serviceMessage, setServiceMessage] = useState('')
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState<string>(initialCategories[0]?.id ?? '')

  const supabase = useMemo(() => createClient(), [])

  // Auth state - table session only makes sense while signed in.
  useEffect(() => {
    async function checkUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)
      if (!currentUser) endSession()
    }
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) endSession()
    })

    return () => subscription.unsubscribe()
  }, [supabase, endSession])

  // Dine-in table list
  useEffect(() => {
    supabase
      .from('tables')
      .select('*')
      .order('table_number')
      .then(({ data }) => {
        if (data) setTables(data)
      })
  }, [supabase])

  // Active offers
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

  // Realtime: menu_items, offers, tables
  useEffect(() => {
    const channel = supabase
      .channel('menu-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        (payload) => {
          const updated = payload.new as MenuItem
          setCategories((prev) =>
            prev.map((cat) => ({
              ...cat,
              menu_items: cat.menu_items.map((item) =>
                item.id === updated.id ? { ...item, ...updated } : item
              ),
            }))
          )
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, () => {
        supabase
          .from('offers')
          .select('*')
          .eq('active', true)
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
          .then(({ data }) => {
            if (data) setActiveOffers(data)
          })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTables((prev) => {
            const exists = prev.some((t) => t.id === (payload.new as TableRow).id)
            if (exists) return prev
            return [...prev, payload.new as TableRow].sort((a, b) => a.table_number - b.table_number)
          })
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as TableRow
          setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
        } else if (payload.eventType === 'DELETE') {
          const deleted = payload.old as { id: string }
          setTables((prev) => prev.filter((t) => t.id !== deleted.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // Scroll-spy for the sticky category pill bar
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveCategoryId(entry.target.id)
        })
      },
      { rootMargin: '-140px 0px -70% 0px' }
    )
    document.querySelectorAll('section[data-menu-category]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [categories])

  const handleSelectTable = async (tId: string) => {
    const table = tables.find((t) => t.id === tId)
    if (!table) return

    try {
      if (tableId && tableId !== tId) {
        await supabase.from('tables').update({ status: 'free' }).eq('id', tableId)
      }
      await supabase.from('tables').update({ status: 'occupied' }).eq('id', tId)
    } catch (err) {
      console.error('Failed to update table status:', err)
    }

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
      localStorage.setItem('kaizen_latest_order_id', activeOrders[0].id)
    }

    startSession(table.table_number, table.id, finalSessionId)
    setTableModalOpen(false)
  }

  const getItemOffer = (itemId: string) => activeOffers.find((o) => o.menu_item_id === itemId && o.active)

  const handleCallService = async (type: 'water' | 'server' | 'bill') => {
    if (!tableId) return
    setServiceLoading(true)
    setServiceMessage('')
    try {
      const res = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId, type }),
      })
      const body = await res.json()
      if (res.ok) {
        setServiceMessage(`Request for ${type === 'bill' ? 'the bill' : type} sent successfully!`)
        setTimeout(() => {
          setServiceModalOpen(false)
          setServiceMessage('')
        }, 2000)
      } else {
        setServiceMessage(body.error || 'Failed to submit request.')
      }
    } catch {
      setServiceMessage('Network error. Please try again.')
    } finally {
      setServiceLoading(false)
    }
  }

  const featuredOffer = activeOffers.length > 0 ? activeOffers[0] : null
  const featuredItem = featuredOffer
    ? categories.flatMap((c) => c.menu_items).find((item) => item.id === featuredOffer.menu_item_id)
    : null

  const nonEmptyCategories = categories.filter((c) => c.menu_items.some((i) => i.is_available))

  return (
    <div className="font-[family-name:var(--font-marketing)] bg-cream min-h-screen">
      {/* Sticky category pill bar */}
      <div className="sticky top-0 z-40 bg-cream/97 backdrop-blur-sm border-b border-black/10">
        <div className="max-w-[1200px] mx-auto px-6 md:px-12 py-4 flex gap-2.5 overflow-x-auto">
          {nonEmptyCategories.map((cat) => {
            const isActive = activeCategoryId === cat.id
            return (
              <a
                key={cat.id}
                href={`#${slugify(cat.name)}`}
                className="shrink-0 text-xs font-semibold tracking-[0.08em] px-4.5 py-2.5 rounded-full transition-all duration-200"
                style={{
                  background: isActive ? 'var(--maroon)' : 'transparent',
                  color: isActive ? 'var(--maroon-foreground)' : 'var(--cream-foreground)',
                  border: isActive ? '1px solid var(--maroon)' : '1px solid rgba(32,26,22,.2)',
                }}
              >
                {cat.name.toUpperCase()}
              </a>
            )
          })}
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 md:px-12 pt-8 space-y-5">
        {/* Table session prompt / indicator */}
        {!user ? (
          <div className="bg-white border border-maroon/20 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <h3 className="font-semibold text-cream-foreground flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-maroon" />
                Dining with us?
              </h3>
              <p className="text-xs text-cream-foreground/60 max-w-xl">
                Sign up with your email to select a table and send orders straight to the kitchen.
              </p>
            </div>
            <Link href="/signup" className="shrink-0">
              <span className="inline-block bg-maroon hover:bg-maroon-hover text-maroon-foreground font-semibold text-xs tracking-[0.06em] px-5 py-2.5 rounded-sm transition-colors cursor-pointer">
                SIGN UP TO ORDER
              </span>
            </Link>
          </div>
        ) : !tableNumber ? (
          <div className="bg-white border border-maroon/20 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <h3 className="font-semibold text-cream-foreground flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-maroon" />
                Seated at a table?
              </h3>
              <p className="text-xs text-cream-foreground/60 max-w-xl">
                Select your table to enable live ordering and split the bill with your group.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="bg-white border border-black/15 rounded-sm px-3 py-2 text-xs text-cream-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-maroon"
              >
                <option value="">Choose Table...</option>
                {tables
                  .filter((t) => t.status === 'free')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.table_number}
                    </option>
                  ))}
              </select>
              <button
                disabled={!selectedTable}
                onClick={() => handleSelectTable(selectedTable)}
                className="bg-maroon hover:bg-maroon-hover disabled:opacity-40 text-maroon-foreground font-semibold text-xs px-5 py-2 rounded-sm transition-colors cursor-pointer"
              >
                Join Session
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between bg-white rounded-2xl px-6 py-3.5 border border-black/10 text-xs shadow-sm">
            <div className="flex items-center gap-2 text-cream-foreground font-semibold">
              <MapPin className="h-4 w-4 text-maroon" />
              <span>
                Seated at <strong className="text-maroon">Table {tableNumber}</strong>
              </span>
            </div>
            <div className="flex gap-4 items-center">
              {sessionId && (
                <span className="text-[10px] text-cream-foreground/45 hidden sm:inline font-mono">
                  SESSION {sessionId.slice(0, 8).toUpperCase()}
                </span>
              )}
              <button
                onClick={() => setServiceModalOpen(true)}
                className="text-maroon hover:text-maroon-hover font-bold underline text-xs flex items-center gap-1 cursor-pointer"
              >
                <Bell className="h-3 w-3" />
                Call Service
              </button>
              <span className="text-black/20 font-bold">|</span>
              <button
                onClick={() => setTableModalOpen(true)}
                className="text-maroon hover:text-maroon-hover font-bold underline text-xs cursor-pointer"
              >
                Switch Table
              </button>
            </div>
          </div>
        )}

        {/* Floating smart offer banner */}
        {featuredItem && featuredOffer && (
          <div className="bg-white border border-maroon/20 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-maroon/10 p-3 rounded-xl">
                <Sparkles className="h-5 w-5 text-maroon" />
              </div>
              <div>
                <span className="text-[10px] bg-maroon/10 text-maroon px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest">
                  Limited Offer
                </span>
                <h4 className="font-bold text-sm mt-1.5 text-cream-foreground">
                  Save {Math.round(Number(featuredOffer.discount_pct))}% on {featuredItem.name}!
                </h4>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-between md:justify-end">
              <div className="text-right">
                <span className="line-through text-xs text-cream-foreground/40">₹{featuredItem.price}</span>
                <p className="font-bold text-lg text-maroon">
                  ₹{Math.round(Number(featuredItem.price) * (1 - Number(featuredOffer.discount_pct) / 100))}
                </p>
              </div>
              <AddToCartButton
                menuItemId={featuredItem.id}
                name={featuredItem.name}
                price={Number(featuredItem.price) * (1 - Number(featuredOffer.discount_pct) / 100)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Category sections */}
      {nonEmptyCategories.map((category) => {
        // Items retired from the public menu (is_available=false, no explicit
        // sort_order) would otherwise sort first and become the "hero" -
        // exclude them here rather than in the query, so a stock-out
        // (remaining_stock<=0, is_available still true) still shows with its
        // sold-out badge in place.
        const items = category.menu_items.filter((i) => i.is_available)
        const categoryPhoto = items[0]?.image_url
        const sortOrders = items.map((i) => i.sort_order).filter((n) => n > 0)
        const tag =
          sortOrders.length > 0
            ? `${String(Math.min(...sortOrders)).padStart(2, '0')} — ${String(Math.max(...sortOrders)).padStart(2, '0')}`
            : ''

        return (
          <section
            key={category.id}
            id={slugify(category.name)}
            data-menu-category
            className="max-w-[1200px] mx-auto px-6 md:px-12 py-16 md:py-24 border-b border-black/10"
            style={{ scrollMarginTop: '130px' }}
          >
            <div className="flex justify-between items-end flex-wrap gap-4 mb-10">
              <div>
                {tag && <div className="text-xs font-semibold tracking-[0.16em] text-maroon mb-2.5">{tag}</div>}
                <h2 className="font-display text-cream-foreground" style={{ fontSize: 'clamp(32px,5.5vw,64px)' }}>
                  {category.name.toUpperCase()}
                </h2>
                {CATEGORY_BLURBS[category.name] && (
                  <p className="max-w-[420px] mt-3 text-sm leading-relaxed text-cream-foreground/60">
                    {CATEGORY_BLURBS[category.name]}
                  </p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-[1.15fr_1fr] gap-8 md:gap-12 items-start">
              <div className="relative rounded overflow-hidden aspect-[4/3] bg-[#e2d9cb]">
                {categoryPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={categoryPhoto} alt={category.name} className="w-full h-full object-cover" />
                )}
              </div>
              <div>
                {items.map((item) => (
                  <MenuRow key={item.id} item={item} offer={getItemOffer(item.id)} />
                ))}
              </div>
            </div>
          </section>
        )
      })}

      {/* Switch Table Modal */}
      {tableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-cream border border-black/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-cream-foreground">Switch Table Session</h3>
              <p className="text-xs text-cream-foreground/60 leading-relaxed">
                Select your new table number below. This moves you to that table's shared group session.
              </p>
            </div>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full bg-white border border-black/15 rounded-sm px-4 py-2.5 text-xs text-cream-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-maroon"
            >
              <option value="">Choose Table...</option>
              {tables
                .filter((t) => t.status === 'free')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    Table {t.table_number}
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setTableModalOpen(false)}
                className="text-cream-foreground/60 hover:text-cream-foreground font-semibold text-xs px-4 py-2 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!selectedTable}
                onClick={() => handleSelectTable(selectedTable)}
                className="bg-maroon hover:bg-maroon-hover disabled:opacity-40 text-maroon-foreground font-semibold text-xs px-4 py-2 rounded-sm cursor-pointer"
              >
                Confirm Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Call Modal */}
      {serviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-cream border border-black/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-black/10">
              <h3 className="text-base font-bold text-cream-foreground flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-maroon" />
                Call for Table Service
              </h3>
              <button onClick={() => setServiceModalOpen(false)} className="text-cream-foreground/50 hover:text-cream-foreground cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-cream-foreground/60 leading-relaxed">
              Choose the type of service request you would like to send. Staff will be alerted immediately.
            </p>
            <div className="grid grid-cols-1 gap-2.5 pt-2">
              {(
                [
                  { type: 'water' as const, emoji: '💧', label: 'Request Drinking Water' },
                  { type: 'server' as const, emoji: '🔔', label: 'Call a Server' },
                  { type: 'bill' as const, emoji: '🧾', label: 'Request the Bill' },
                ]
              ).map((opt) => (
                <button
                  key={opt.type}
                  disabled={serviceLoading}
                  onClick={() => handleCallService(opt.type)}
                  className="w-full bg-white border border-black/10 hover:border-maroon/30 text-cream-foreground font-semibold rounded-sm py-3 flex items-center gap-3 px-4 cursor-pointer transition-colors"
                >
                  <span>{opt.emoji}</span>
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
            {serviceMessage && (
              <div className="bg-maroon/10 border border-maroon/20 text-maroon text-xs p-3 rounded-sm text-center font-semibold">
                {serviceMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MenuRow({ item, offer }: { item: MenuItemWithIngredients; offer: OfferRow | undefined }) {
  const soldOut = isSoldOut(item)
  const finalPrice = offer ? Number(item.price) * (1 - Number(offer.discount_pct) / 100) : Number(item.price)

  return (
    <div className={`flex gap-3.5 items-center py-3 border-b border-black/10 ${soldOut ? 'opacity-50' : ''}`}>
      <div className="w-14 h-14 shrink-0 rounded-sm overflow-hidden bg-[#e2d9cb]">
        {item.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        )}
      </div>
      <div className="flex-none font-display text-xs text-maroon w-5">
        {String(item.sort_order).padStart(2, '0')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display text-sm text-cream-foreground tracking-[0.01em] truncate">{item.name}</div>
        {item.description && (
          <div className="text-xs leading-snug text-cream-foreground/55 mt-0.5">{item.description}</div>
        )}
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-xs font-bold text-cream-foreground">₹{finalPrice}</span>
          {offer && <span className="text-[10px] line-through text-cream-foreground/40">₹{item.price}</span>}
          {soldOut && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-cream-foreground/50">Sold Out</span>
          )}
        </div>
      </div>
      <div className="shrink-0">
        <AddToCartButton menuItemId={item.id} name={item.name} price={finalPrice} disabled={soldOut} />
      </div>
    </div>
  )
}
