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

  // Sort and Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [vegFilter, setVegFilter] = useState<'all' | 'veg' | 'non-veg'>('all')
  const [maxPrice, setMaxPrice] = useState<number | ''>('')
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'popularity'>('default')

  // AI Assistant states
  const [aiOpen, setAiOpen] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMessages, setAiMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; suggestions?: Array<{ name: string; reason: string }> }>>([
    { sender: 'ai', text: "Hello! I'm Ask Kaizen, your dietary assistant. Describe what you're craving or any dietary restrictions (Jain, Vegan, Gluten-Free, High-Protein, etc.), and I'll find the perfect dishes for you!" }
  ])

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

  const handleAiSubmit = async (queryText: string) => {
    if (aiLoading) return
    setAiLoading(true)
    setAiQuery('')
    
    // Add user message
    setAiMessages((prev) => [...prev, { sender: 'user', text: queryText }])

    try {
      const res = await fetch('/api/ai/dietary-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText })
      })
      const data = await res.json()
      if (res.ok) {
        setAiMessages((prev) => [
          ...prev, 
          { 
            sender: 'ai', 
            text: data.explanation || "I found some recommendations for you:", 
            suggestions: data.suggestions 
          }
        ])
      } else {
        setAiMessages((prev) => [...prev, { sender: 'ai', text: data.error || "Something went wrong while processing your request. Please try again." }])
      }
    } catch {
      setAiMessages((prev) => [...prev, { sender: 'ai', text: "Network error. Please try again." }])
    } finally {
      setAiLoading(false)
    }
  }

  // Filter and sort categories based on search query, veg toggle, price, and sort type
  const filteredCategories = useMemo(() => {
    return categories.map((cat) => {
      // 1. Filter items
      let items = cat.menu_items.filter((item) => {
        if (!item.is_available) return false

        // Search match
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase()
          const nameMatch = item.name.toLowerCase().includes(query)
          const descMatch = item.description?.toLowerCase().includes(query) || false
          if (!nameMatch && !descMatch) return false
        }

        // Veg check
        const isItemVeg = isVeg(item.name)
        if (vegFilter === 'veg' && !isItemVeg) return false
        if (vegFilter === 'non-veg' && isItemVeg) return false

        // Price check
        if (maxPrice !== '') {
          const finalPrice = getItemOffer(item.id)
            ? Number(item.price) * (1 - Number(getItemOffer(item.id)!.discount_pct) / 100)
            : Number(item.price)
          if (finalPrice > maxPrice) return false
        }

        return true
      })

      // 2. Sort items
      items = [...items].sort((a, b) => {
        const getFinalPrice = (x: MenuItemWithIngredients) => {
          const offer = getItemOffer(x.id)
          return offer ? Number(x.price) * (1 - Number(offer.discount_pct) / 100) : Number(x.price)
        }

        if (sortBy === 'price-asc') {
          return getFinalPrice(a) - getFinalPrice(b)
        }
        if (sortBy === 'price-desc') {
          return getFinalPrice(b) - getFinalPrice(a)
        }
        if (sortBy === 'popularity') {
          return getPopularityScore(b.name) - getPopularityScore(a.name)
        }
        return a.sort_order - b.sort_order
      })

      return {
        ...cat,
        menu_items: items,
      }
    }).filter((cat) => cat.menu_items.length > 0)
  }, [categories, searchQuery, vegFilter, maxPrice, sortBy, activeOffers])

  const nonEmptyCategories = filteredCategories

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
            <div className="flex items-center gap-4 shrink-0 flex-wrap">
              <button
                onClick={() => {
                  setServiceMessage('Please select your table first to call service.')
                  setServiceModalOpen(true)
                }}
                className="text-maroon hover:text-maroon-hover font-bold underline text-xs flex items-center gap-1 cursor-pointer mr-2"
              >
                <Bell className="h-3.5 w-3.5" />
                Call Service
              </button>
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

        {/* Sort & Filter Bar */}
        <div className="bg-white border border-black/10 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full lg:max-w-xs">
              <input
                type="text"
                placeholder="Search dishes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-cream/35 border border-black/15 rounded-xl px-4 py-2.5 text-xs text-cream-foreground placeholder-cream-foreground/40 focus:outline-none focus:ring-1 focus:ring-maroon focus:border-maroon transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  className="absolute right-3 top-3 text-cream-foreground/45 hover:text-cream-foreground text-xs cursor-pointer font-bold"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Price Limit Filter */}
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <span className="text-xs font-bold text-cream-foreground/60 whitespace-nowrap">Max Price:</span>
              <input
                type="number"
                placeholder="₹ Any"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-20 bg-cream/35 border border-black/15 rounded-xl px-3 py-2 text-xs text-cream-foreground placeholder-cream-foreground/40 focus:outline-none focus:ring-1 focus:ring-maroon text-center font-bold"
              />
              {maxPrice !== '' && (
                <button 
                  onClick={() => setMaxPrice('')} 
                  className="text-xs text-maroon hover:underline font-bold cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Veg / Non-Veg Toggle (Green / Red style toggle) */}
            <div className="flex items-center gap-1 bg-cream/35 border border-black/10 rounded-xl p-1 shrink-0 w-full lg:w-auto justify-between lg:justify-start">
              <span className="text-xs font-bold text-cream-foreground/60 mr-2 lg:hidden">Diet:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setVegFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
                    vegFilter === 'all'
                      ? 'bg-white text-cream-foreground shadow-sm border border-black/5'
                      : 'text-cream-foreground/50 hover:text-cream-foreground'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setVegFilter('veg')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer flex items-center gap-1 ${
                    vegFilter === 'veg'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-emerald-600/80 hover:text-emerald-600'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Veg
                </button>
                <button
                  onClick={() => setVegFilter('non-veg')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer flex items-center gap-1 ${
                    vegFilter === 'non-veg'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-rose-600/80 hover:text-rose-600'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  Non-Veg
                </button>
              </div>
            </div>

            {/* Sort Select */}
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <span className="text-xs font-bold text-cream-foreground/60 whitespace-nowrap">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-cream/35 border border-black/15 rounded-xl px-3 py-2 text-xs text-cream-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-maroon cursor-pointer w-full lg:w-auto"
              >
                <option value="default">Default Sort</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="popularity">Most Ordered</option>
              </select>
            </div>
          </div>
        </div>

        {/* Floating Smart Offer Notification */}
        {featuredItem && featuredOffer && (
          <div className="bg-gradient-to-r from-red-950/80 via-amber-950/40 to-charcoal border border-red-900/40 text-white rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl relative overflow-hidden mb-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
                <Sparkles className="h-6 w-6 text-amber-400 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] bg-red-900/50 text-red-300 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest border border-red-500/20">
                  Flash Smart Offer
                </span>
                <h4 className="font-extrabold text-lg mt-1.5 text-white">
                  Save {Math.round(Number(featuredOffer.discount_pct))}% on {featuredItem.name}!
                </h4>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-between md:justify-end relative z-10">
              <div className="text-right">
                <span className="line-through text-xs text-white/40">₹{featuredItem.price}</span>
                <p className="font-bold text-lg text-amber-400">
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

      {/* Floating AI Dietary Assistant Chat Button */}
      {user && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => setAiOpen(!aiOpen)}
            className="bg-maroon text-white hover:bg-maroon-hover px-5 py-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 flex items-center justify-center gap-2 cursor-pointer border border-maroon/20 group relative font-semibold text-xs tracking-wider"
            title="Ask Kaizen"
          >
            <Sparkles className="h-5 w-5 animate-pulse text-white shrink-0" />
            <span className="text-white font-semibold text-xs tracking-wider uppercase">Ask Kaizen</span>
            <span className="absolute -top-1 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white animate-ping" />
            <span className="absolute -top-1 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white" />
          </button>
        </div>
      )}

      {/* AI Dietary Assistant Chat Window */}
      {aiOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-full max-w-[360px] bg-cream border border-black/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300 font-[family-name:var(--font-marketing)]">
          {/* Header */}
          <div className="bg-maroon p-4 text-maroon-foreground flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="bg-white/10 p-1.5 rounded-lg">
                <Sparkles className="h-4 w-4 text-maroon-foreground animate-spin-slow" />
              </div>
              <div>
                <h3 className="font-bold text-xs">Ask Kaizen</h3>
                <span className="text-[9px] opacity-75 font-semibold">Llama 3.3 & Gemini</span>
              </div>
            </div>
            <button
              onClick={() => setAiOpen(false)}
              className="text-maroon-foreground/70 hover:text-maroon-foreground cursor-pointer text-sm font-bold"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[300px] bg-cream/40">
            {aiMessages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-maroon text-maroon-foreground rounded-tr-none'
                      : 'bg-white text-cream-foreground border border-black/10 rounded-tl-none shadow-sm'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Suggestions layout inside message */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="w-full mt-2 space-y-2">
                    <span className="text-[10px] text-cream-foreground/50 font-bold uppercase tracking-wider pl-1">
                      Recommended Dishes:
                    </span>
                    {msg.suggestions.map((sug, sIdx) => (
                      <div
                        key={sIdx}
                        className="bg-white border border-black/10 rounded-xl p-3 shadow-sm hover:border-maroon/30 transition-all flex justify-between items-center gap-2"
                      >
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-cream-foreground truncate">{sug.name}</h4>
                          <p className="text-[10px] text-cream-foreground/60 leading-snug mt-0.5">{sug.reason}</p>
                        </div>
                        <button
                          onClick={() => {
                            const nameSlug = sug.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                            const el = document.getElementById(nameSlug)
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              el.classList.add('bg-maroon/5')
                              setTimeout(() => el.classList.remove('bg-maroon/5'), 2000)
                            } else {
                              setSearchQuery(sug.name)
                            }
                          }}
                          className="shrink-0 text-[10px] text-maroon font-bold hover:underline cursor-pointer"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {aiLoading && (
              <div className="flex items-center gap-1.5 pl-2 py-1">
                <span className="h-1.5 w-1.5 bg-maroon rounded-full animate-bounce" />
                <span className="h-1.5 w-1.5 bg-maroon rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 bg-maroon rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          <div className="px-4 py-2 border-t border-black/5 flex gap-1.5 overflow-x-auto bg-cream/10 shrink-0">
            {['Vegan under ₹200', 'High-Protein Mains', 'Jain Starter'].map((txt) => (
              <button
                key={txt}
                onClick={() => handleAiSubmit(txt)}
                className="shrink-0 bg-white hover:bg-cream border border-black/10 text-[10px] font-bold text-cream-foreground px-2.5 py-1.5 rounded-full shadow-sm transition-all cursor-pointer"
              >
                {txt}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!aiQuery.trim()) return
              handleAiSubmit(aiQuery)
            }}
            className="p-3 border-t border-black/10 bg-white flex gap-2"
          >
            <input
              type="text"
              placeholder="Ask for high-protein, Jain..."
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              className="flex-1 bg-cream/30 border border-black/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-maroon text-cream-foreground placeholder-cream-foreground/40"
              disabled={aiLoading}
            />
            <button
              type="submit"
              disabled={aiLoading || !aiQuery.trim()}
              className="bg-maroon disabled:opacity-50 text-maroon-foreground hover:bg-maroon-hover px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Ask
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// HELPERS & CONSTANTS
// ============================================================================

const INGREDIENT_NUTRITION: Record<string, { caloriesPerKg: number; proteinPerKg: number }> = {
  'chicken': { caloriesPerKg: 1650, proteinPerKg: 310 },
  'mutton': { caloriesPerKg: 2940, proteinPerKg: 250 },
  'paneer': { caloriesPerKg: 3600, proteinPerKg: 180 },
  'butter': { caloriesPerKg: 7170, proteinPerKg: 8 },
  'rice': { caloriesPerKg: 3600, proteinPerKg: 70 },
  'tomato': { caloriesPerKg: 180, proteinPerKg: 9 },
  'onion': { caloriesPerKg: 400, proteinPerKg: 11 },
  'ginger-garlic paste': { caloriesPerKg: 800, proteinPerKg: 20 },
  'yogurt': { caloriesPerKg: 630, proteinPerKg: 35 },
  'fresh cream': { caloriesPerKg: 3400, proteinPerKg: 20 },
  'chickpeas': { caloriesPerKg: 3640, proteinPerKg: 190 },
  'potato': { caloriesPerKg: 770, proteinPerKg: 20 },
  'cauliflower': { caloriesPerKg: 250, proteinPerKg: 19 },
  'spinach': { caloriesPerKg: 230, proteinPerKg: 29 },
  'green peas': { caloriesPerKg: 810, proteinPerKg: 54 },
  'red lentils': { caloriesPerKg: 3500, proteinPerKg: 240 },
  'black lentils': { caloriesPerKg: 3400, proteinPerKg: 250 },
  'ghee': { caloriesPerKg: 9000, proteinPerKg: 0 },
  'sugar': { caloriesPerKg: 3870, proteinPerKg: 0 },
  'milk': { caloriesPerKg: 600, proteinPerKg: 32 },
  'tea leaves': { caloriesPerKg: 0, proteinPerKg: 0 },
  'coffee powder': { caloriesPerKg: 0, proteinPerKg: 0 },
  'mint leaves': { caloriesPerKg: 440, proteinPerKg: 30 },
  'coriander leaves': { caloriesPerKg: 230, proteinPerKg: 21 },
  'lemon': { caloriesPerKg: 300, proteinPerKg: 11 },
  'semolina': { caloriesPerKg: 3600, proteinPerKg: 120 },
  'mango pulp': { caloriesPerKg: 600, proteinPerKg: 5 },
  'cashew nuts': { caloriesPerKg: 5530, proteinPerKg: 180 },
  'chocolate sauce': { caloriesPerKg: 3400, proteinPerKg: 30 },
  'vanilla essence': { caloriesPerKg: 2500, proteinPerKg: 0 },
  'khoya': { caloriesPerKg: 3800, proteinPerKg: 150 },
  'ice cream mix': { caloriesPerKg: 2000, proteinPerKg: 40 },
  'butter naan flour': { caloriesPerKg: 2750, proteinPerKg: 80 },
  'tomato soup mix': { caloriesPerKg: 2000, proteinPerKg: 40 }
}

function calculateNutrition(item: MenuItemWithIngredients) {
  let calories = 0
  let protein = 0
  if (item.menu_item_ingredients && item.menu_item_ingredients.length > 0) {
    for (const mii of item.menu_item_ingredients) {
      const ingName = mii.ingredients?.name?.toLowerCase() || ''
      const qty = Number(mii.qty_per_portion) || 0
      const nut = INGREDIENT_NUTRITION[ingName]
      if (nut) {
        calories += qty * nut.caloriesPerKg
        protein += qty * nut.proteinPerKg
      }
    }
  }

  if (calories === 0) {
    const name = item.name.toLowerCase()
    if (name.includes('chicken') || name.includes('mutton')) {
      calories = 380
      protein = 28
    } else if (name.includes('paneer')) {
      calories = 340
      protein = 16
    } else if (name.includes('dal') || name.includes('chana') || name.includes('biryani')) {
      calories = 290
      protein = 12
    } else if (name.includes('naan') || name.includes('roti') || name.includes('kulcha')) {
      calories = 210
      protein = 5
    } else if (name.includes('lassi') || name.includes('coffee') || name.includes('soda')) {
      calories = 180
      protein = 3
    } else {
      calories = 150
      protein = 4
    }
  }

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
  }
}

function isVeg(name: string): boolean {
  const nameLower = name.toLowerCase()
  return !(
    nameLower.includes('chicken') ||
    nameLower.includes('mutton') ||
    nameLower.includes('fish') ||
    nameLower.includes('egg') ||
    nameLower.includes('wing') ||
    nameLower.includes('kebab') && !nameLower.includes('hara bhara')
  )
}

function getPopularityScore(name: string): number {
  const nameLower = name.toLowerCase()
  if (nameLower.includes('butter chicken')) return 95
  if (nameLower.includes('65')) return 90
  if (nameLower.includes('palak paneer')) return 85
  if (nameLower.includes('dal makhani')) return 80
  if (nameLower.includes('garlic naan')) return 75
  if (nameLower.includes('lassi')) return 70
  if (nameLower.includes('rogan josh')) return 65
  if (nameLower.includes('biryani')) return 60
  if (nameLower.includes('spring roll')) return 55
  if (nameLower.includes('hara bhara')) return 50
  if (nameLower.includes('chilli paneer')) return 45
  if (nameLower.includes('wings')) return 40
  if (nameLower.includes('roti')) return 35
  if (nameLower.includes('kulcha')) return 30
  if (nameLower.includes('gulab jamun')) return 25
  if (nameLower.includes('rasmalai')) return 20
  if (nameLower.includes('kulfi')) return 15
  if (nameLower.includes('brownie')) return 10
  return 5
}

function MenuRow({ 
  item, 
  offer
}: { 
  item: MenuItemWithIngredients; 
  offer: OfferRow | undefined;
}) {
  const soldOut = isSoldOut(item)
  const finalPrice = offer ? Number(item.price) * (1 - Number(offer.discount_pct) / 100) : Number(item.price)
  const { calories, protein } = calculateNutrition(item)
  const isItemVeg = isVeg(item.name)

  return (
    <div 
      id={item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')} 
      className={`flex gap-3.5 items-center py-3 border-b border-black/10 transition-colors duration-500 rounded px-2 -mx-2 ${soldOut ? 'opacity-50' : ''}`}
    >
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
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="font-display text-sm text-cream-foreground tracking-[0.01em] truncate">{item.name}</div>
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0 border ${
            isItemVeg 
              ? 'border-emerald-600/30 bg-emerald-50 text-emerald-700' 
              : 'border-rose-600/30 bg-rose-50 text-rose-700'
          }`}>
            {isItemVeg ? 'VEG🟢' : 'NON-VEG🔴'}
          </span>
        </div>
        {item.description && (
          <div className="text-xs leading-snug text-cream-foreground/55 mt-0.5">{item.description}</div>
        )}

        {/* Nutritional Info Displayed Unconditionally */}
        <div className="text-[10px] text-cream-foreground/50 mt-1 font-semibold flex gap-2 items-center">
          <span>🔥 {calories} kcal</span>
          <span className="opacity-30">|</span>
          <span>💪 {protein}g protein</span>
        </div>

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
