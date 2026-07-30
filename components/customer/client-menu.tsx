'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
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
import { Sparkles, MapPin, AlertCircle, RefreshCw, Search, Utensils, MessageSquare, Flame, Check, ArrowUpDown, ChevronDown, ChevronUp, Bell, Bot, X, PhoneCall } from 'lucide-react'
import type { Database } from '@/types/database'
import type { CategoryWithItems } from '@/lib/menu/get-menu'

const INGREDIENT_NUTRITION: Record<string, { caloriesPerKg: number; proteinPerKg: number }> = {
  'chicken': { caloriesPerKg: 1650, proteinPerKg: 310 },
  'mutton': { caloriesPerKg: 2940, proteinPerKg: 250 },
  'paneer': { caloriesPerKg: 3600, proteinPerKg: 180 },
  'butter': { caloriesPerKg: 7170, proteinPerKg: 8 },
  'naan dough': { caloriesPerKg: 2750, proteinPerKg: 80 },
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
  'ice cream mix': { caloriesPerKg: 2000, proteinPerKg: 40 }
}

function calculateNutrition(item: any) {
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
    protein: Math.round(protein)
  }
}

function isItemNonVeg(item: any, categoryName?: string) {
  const name = item.name.toLowerCase()
  const desc = (item.description || '').toLowerCase()
  const cat = (categoryName || '').toLowerCase()
  
  if (name.includes('chicken') || name.includes('mutton') || name.includes('fish') || name.includes('egg') || name.includes('rogan josh') || name.includes('wings') || name.includes('curry') && !name.includes('veg')) {
    return true
  }
  if (desc.includes('chicken') || desc.includes('mutton') || desc.includes('fish') || desc.includes('egg') || desc.includes('rogan josh')) {
    return true
  }
  if (cat.includes('non-veg') || cat.includes('non veg')) {
    return true
  }
  if (item.menu_item_ingredients) {
    for (const mii of item.menu_item_ingredients) {
      const ingName = mii.ingredients?.name?.toLowerCase() || ''
      if (ingName.includes('chicken') || ingName.includes('mutton') || ingName.includes('fish') || ingName.includes('egg')) {
        return true
      }
    }
  }
  return false
}

const POPULARITY_SCORES: Record<string, number> = {
  'Butter Chicken': 98,
  'Dal Makhani': 92,
  'Paneer Tikka': 88,
  'Vegetable Biryani': 85,
  'Garlic Naan': 84,
  'Palak Paneer': 80,
  'Mutton Rogan Josh': 78,
  'Mango Lassi': 75,
  'Veg Spring Rolls': 72,
  'Chicken 65': 70,
  'Hara Bhara Kebab': 68,
  'Chilli Paneer': 65,
  'Tandoori Chicken Wings': 62,
  'Chana Masala': 60,
  'Chicken Curry': 58,
  'Butter Naan': 55,
  'Paneer Butter Masala': 54,
  'Veg Pulao': 50,
  'Masala Chai': 48,
  'Tandoori Roti': 45,
  'Missi Roti': 42,
  'Kulcha': 40,
  'Cold Coffee': 38,
  'Fresh Lime Soda': 35,
  'Filter Coffee': 32,
  'Gulab Jamun': 30,
  'Rasmalai': 28,
  'Vanilla Ice Cream': 25,
  'Kulfi': 22,
  'Chocolate Brownie': 20
}

type MenuItem = Database['public']['Tables']['menu_items']['Row']
type TableRow = Database['public']['Tables']['tables']['Row']
type OfferRow = Database['public']['Tables']['offers']['Row']

type Props = {
  initialCategories: CategoryWithItems[]
}

// Unsplash high-resolution food image mapping
const MENU_ITEM_IMAGES: Record<string, string> = {
  'Veg Spring Rolls': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTt9ORmklQl-wh0tmdI6XVQXbtA2ue4btYEa_E3s9whCg&s=10',
  'Chicken 65': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSCLCMBqpPbGixWKafeh4aLsKpnUUGImPgc4YpeLwtTog&s=10',
  'Hara Bhara Kebab': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSsBjLq7sL3t7_Z12idGo__NEa1zqgT3k_8e7vILFwHCA&s=10',
  'Chilli Paneer': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQF35xzcNnYZIE7ELQ1vic2vZmC-B2iC4IR47bf14hgLA&s=10',
  'Tandoori Chicken Wings': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSlTVM2KVbvhmJ7rkiiA7jzJ88cURDHa2-D1-geHmiJsA&s=10',
  'Dal Makhani': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRHZxn29aO0wzymxTAkUK71oFRJkLKQrMPGRM21enWDz5o_qumBA--y6AgF&s=10',
  'Chana Masala': 'https://upbeetanisha.com/wp-content/uploads/2021/04/DSC_4106.jpg',
  'Butter Chicken': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS2nuZYPAkTOOAV8ohyrZiRGS2V8h2DNZphYWSElrmBKQ&s=10',
  'Chicken Curry': 'https://www.whiskaffair.com/wp-content/uploads/2021/06/Desi-Chicken-Curry-2-3-500x500.jpg',
  'Palak Paneer': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRkhcmAe6uPBhw6VFe8_-o2O0v36aZ7Lmi4w6HBRu1W6LkR5TRCTvWYRmc&s=10',
  'Mutton Rogan Josh': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQLT8egGdRcHP-OcGa9vPAr91EVFu3Srj9sSFb9WexrRw&s=10',
  'Vegetable Biryani': 'https://sandhyahariharan.co.uk/wp-content/uploads/2015/12/vegetable-biryani-1-of-3.jpg',
  'Garlic Naan': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQgTFFSlntD3Io1a-5nc751z_-JjIQ83U_uKMghQGlmjg&s=10',
  'Tandoori Roti': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSQPF27U23et4Y8ciimeadUscCZv4naZoDuKgNFCcb7jQ&s=10',
  'Missi Roti': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTh431mBOVQp3_295BSl5niI601H4Ldlo847fLlPQypkQ&s=10',
  'Kulcha': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR32LyKLL4Oq1gGxttWYJmgbYbfFLNTI-DZMQda_eSG1Q&s=10',
  'Mango Lassi': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcToLkdnH6SrrupKDAwmPhnE11FT77ZYUOkvNIY7_xy6Dw&s=10',
  'Cold Coffee': 'https://frostingandfettuccine.com/wp-content/uploads/2022/12/Caramel-Iced-Coffee-6.jpg',
  'Fresh Lime Soda': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTS76bcLeBBi9BIjEPh1tIpOQnLDutvIfmz3Du_WEnq8Q&s=10',
  'Filter Coffee': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_c5Yr-LRGqcwRxBCFdbWF0DzbPW-rSAikv7ieVCUV-A&s=10',
  'Gulab Jamun': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTnlJfTLnQCTShE2Gbq3xUuvIQINU0QIMXWNzOa5l62Ow&s=10',
  'Rasmalai': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRd4xpFfwabDNCsZgUBIU-X18OVg32fOsqfmCf-06fkWA&s=10',
  'Vanilla Ice Cream': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR2UfxUx8XVzR8jrWaiemqLu6Jv-x1KkM0WuUotTezUbw&s=10',
  'Kulfi': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSmolP6gdoC2es4xPWxhk2PVyboFqlXRFJPlJbuOoInWQ&s=10',
  'Chocolate Brownie': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQiyq-DtSzF8cNFsiXUBTAeeOQUI6o1H28il768qzvAog&s=10',
  
  // Custom user additions
  'Paneer Tikka': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRvfcDBtM9Er6x178d1uWQs_eyuNEBPCQd2V_rHcjufoEHe-00-rcShpGA&s=10',
  'Butter Naan': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSk1XSSHiILCkinShRHGf1gbVJy10a0n6jWpgDnoyCXwg&s=10',
  'Paneer Butter Masala': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQwRO9423culvRaDaBBr4Rf0SOpclL3L0s94fC8C-_X5g&s=10',
  'Pulao': 'https://c.ndtvimg.com/2023-01/bcdjpkg_pulao_625x300_31_January_23.jpg',
  'Masala Chai': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRtWJiUPsW15LBE3sP0M1TCL0U7KmvynXyvwXZ1B7tz3g&s=10',
}

const FALLBACK_FOOD_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'

export function ClientMenu({ initialCategories }: Props) {
  const { tableNumber, tableId, sessionId, startSession, endSession } = useTableSession()
  const { addItem, items } = useCart()
  const [categories, setCategories] = useState(initialCategories)
  const [tables, setTables] = useState<TableRow[]>([])
  const [activeOffers, setActiveOffers] = useState<OfferRow[]>([])
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [tableModalOpen, setTableModalOpen] = useState(false)
  
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Custom Tabs State: 'menu' | 'reviews'
  const [activeTab, setActiveTab] = useState<'menu' | 'reviews'>('menu')
  // Search & Category Filters state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  
  // Sort and Filter States
  const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc' | 'popularity'>('default')
  const [highProteinOnly, setHighProteinOnly] = useState(false)
  const [dietaryType, setDietaryType] = useState<'all' | 'veg' | 'non-veg'>('all')
  const [expandedNutrition, setExpandedNutrition] = useState<Record<string, boolean>>({})

  // Call for service states
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [serviceLoading, setServiceLoading] = useState(false)
  const [serviceMessage, setServiceMessage] = useState('')

  // Smart Dietary Assistant states
  const [dietaryAssistantOpen, setDietaryAssistantOpen] = useState(false)
  const [dietaryQuery, setDietaryQuery] = useState('')
  const [dietaryMessages, setDietaryMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; suggestions?: Array<{ name: string; reason: string }> }>>([
    { sender: 'assistant', text: 'Hello! I am your Smart Dietary Assistant. Ask me anything like "something high-protein and Jain under ₹300" or "vegan and not too spicy" and I will find matching items from our live menu.' }
  ])
  const [dietaryLoading, setDietaryLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom of dietary chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [dietaryMessages, dietaryAssistantOpen])
  
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
      if (tableId && tableId !== tId) {
        await supabase
          .from('tables')
          .update({ status: 'free' })
          .eq('id', tableId)
      }

      await supabase
        .from('tables')
        .update({ status: 'occupied' })
        .eq('id', tId)
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

  // Computed filtered list of categories and items
  const filteredCategories = useMemo(() => {
    return categories.map((cat) => {
      // Filter items in this category
      let matchedItems = cat.menu_items.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
        if (!matchesSearch) return false

        // High protein filter
        if (highProteinOnly) {
          const nut = calculateNutrition(item)
          if (nut.protein < 20) return false
        }

        // Veg / Non-Veg filter
        const isNonVeg = isItemNonVeg(item, cat.name)
        if (dietaryType === 'veg' && isNonVeg) return false
        if (dietaryType === 'non-veg' && !isNonVeg) return false

        return true
      })

      // Sort items in this category
      matchedItems = [...matchedItems].sort((a, b) => {
        const offerA = getItemOffer(a.id)
        const priceA = offerA ? Number(a.price) * (1 - Number(offerA.discount_pct) / 100) : Number(a.price)

        const offerB = getItemOffer(b.id)
        const priceB = offerB ? Number(b.price) * (1 - Number(offerB.discount_pct) / 100) : Number(b.price)

        if (sortBy === 'price_asc') {
          return priceA - priceB
        } else if (sortBy === 'price_desc') {
          return priceB - priceA
        } else if (sortBy === 'popularity') {
          const popA = POPULARITY_SCORES[a.name] || 10
          const popB = POPULARITY_SCORES[b.name] || 10
          return popB - popA
        }
        return 0 // default
      })

      return {
        ...cat,
        menu_items: matchedItems
      }
    }).filter((cat) => {
      // Keep category if it matches the selectedCategory filter AND has items
      const matchesCategoryPill = selectedCategory === 'All' || cat.name === selectedCategory
      return matchesCategoryPill && cat.menu_items.length > 0
    })
  }, [categories, searchQuery, selectedCategory, sortBy, highProteinOnly, dietaryType, activeOffers])

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
    } catch (err) {
      setServiceMessage('Network error. Please try again.')
    } finally {
      setServiceLoading(false)
    }
  }

  const handleSendDietaryMessage = async () => {
    if (!dietaryQuery.trim()) return
    const text = dietaryQuery.trim()
    setDietaryQuery('')
    
    setDietaryMessages(prev => [...prev, { sender: 'user', text }])
    setDietaryLoading(true)

    try {
      const res = await fetch('/api/ai/dietary-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text })
      })
      const data = await res.json()
      if (res.ok) {
        setDietaryMessages(prev => [...prev, {
          sender: 'assistant',
          text: data.explanation,
          suggestions: data.suggestions
        }])
      } else {
        setDietaryMessages(prev => [...prev, {
          sender: 'assistant',
          text: data.error || 'I encountered an error trying to search the menu. Please try again.'
        }])
      }
    } catch (e) {
      setDietaryMessages(prev => [...prev, {
        sender: 'assistant',
        text: 'I could not connect to the assistant server. Please check your connection and try again.'
      }])
    } finally {
      setDietaryLoading(false)
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-10 text-charcoal-foreground">
      
      {/* Tab Switcher - Custom Kaizen Brand Menu */}
      <div className="flex justify-center border-b border-neutral-900 pb-px">
        <nav className="flex gap-2 sm:gap-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('menu')}
            className={`py-4 px-4 text-sm font-extrabold tracking-widest uppercase transition-all duration-300 relative cursor-pointer ${
              activeTab === 'menu'
                ? 'text-terracotta font-black border-b-2 border-terracotta'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <Utensils className="h-4 w-4" />
              Digital Menu
            </span>
          </button>

          <button
            onClick={() => setActiveTab('reviews')}
            className={`py-4 px-4 text-sm font-extrabold tracking-widest uppercase transition-all duration-300 relative cursor-pointer ${
              activeTab === 'reviews'
                ? 'text-terracotta font-black border-b-2 border-terracotta'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Guest Reviews
            </span>
          </button>
        </nav>
      </div>

      {/* RENDER TAB 1: DIGITAL MENU */}
      {activeTab === 'menu' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Table Session Prompt / Indicator */}
          {!user ? (
            <div className="bg-gradient-to-r from-neutral-900/90 to-charcoal/95 border border-amber-900/30 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="space-y-1 relative z-10">
                <h3 className="font-bold text-amber-400 flex items-center gap-2 text-base">
                  <AlertCircle className="h-4 w-4 text-amber-500 animate-pulse" />
                  Dining with us?
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed max-w-xl">
                  Please sign up with your email to select a table, claim exclusive smart offers, and send tickets directly to the kitchen.
                </p>
              </div>
              <Link href="/signup" className="relative z-10 shrink-0">
                <Button className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-amber-900/30 transition-all cursor-pointer">
                  Sign Up to Order
                </Button>
              </Link>
            </div>
          ) : !tableNumber ? (
            <div className="bg-gradient-to-r from-neutral-900/90 to-charcoal/95 border border-amber-900/30 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="space-y-1 relative z-10">
                <h3 className="font-bold text-amber-400 flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4 text-amber-500 animate-bounce" />
                  Seated at a Table?
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed max-w-xl">
                  Select your table number below to enable group ordering sessions, allowing you to split the bill with friends live.
                </p>
              </div>
              <div className="flex gap-2 relative z-10 shrink-0">
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="bg-black/60 border border-neutral-800 rounded-xl px-4 py-2 text-xs text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                >
                  <option value="" className="bg-charcoal text-neutral-400">Choose Table...</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id} className="bg-charcoal text-white">
                      Table {t.table_number} ({t.status})
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!selectedTable}
                  onClick={() => handleSelectTable(selectedTable)}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl px-5 py-2.5 transition-all shadow-md shadow-amber-900/20 cursor-pointer"
                >
                  Join Session
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between bg-neutral-900/80 rounded-2xl px-6 py-3.5 border border-neutral-800 text-xs shadow-md">
              <div className="flex items-center gap-2 text-neutral-300 font-semibold">
                <MapPin className="h-4 w-4 text-amber-500 animate-pulse" />
                <span>Seated at <strong className="text-amber-400 font-extrabold">Table {tableNumber}</strong></span>
              </div>
              <div className="flex gap-4 items-center">
                {sessionId && (
                  <span className="text-[10px] text-neutral-500 hidden sm:inline font-mono">
                    SESSION_ID: {sessionId.slice(0, 8).toUpperCase()}
                  </span>
                )}
                <button
                  onClick={() => setServiceModalOpen(true)}
                  className="text-emerald-500 hover:text-emerald-400 font-bold underline text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Bell className="h-3 w-3 animate-bounce" />
                  Call Service
                </button>
                <span className="text-neutral-700 font-bold">|</span>
                <button
                  onClick={() => setTableModalOpen(true)}
                  className="text-amber-500 hover:text-amber-400 font-bold underline text-xs cursor-pointer"
                >
                  Switch Table
                </button>
              </div>
            </div>
          )}

          {/* Floating Smart Offer Notification */}
          {featuredItem && featuredOffer && (
            <div className="bg-gradient-to-r from-red-950/80 via-amber-950/40 to-charcoal border border-red-900/40 text-white rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl relative overflow-hidden">
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
                  <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed max-w-md">
                    Live dynamic pricing adjustment to help kitchen operations balance ingredient inventory.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 relative z-10 w-full md:w-auto justify-between md:justify-end border-t border-neutral-800/80 md:border-t-0 pt-3 md:pt-0">
                <div className="text-right">
                  <span className="line-through text-xs text-neutral-500">₹{featuredItem.price}</span>
                  <p className="font-extrabold text-xl text-amber-400">₹{Math.round(Number(featuredItem.price) * (1 - Number(featuredOffer.discount_pct) / 100))}</p>
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
                  className="bg-terracotta hover:bg-terracotta/90 text-white font-extrabold shadow-lg rounded-xl px-5 py-3 text-xs cursor-pointer transition-all active:scale-98 border border-terracotta/20"
                >
                  {user ? 'Claim Offer' : 'Login to Claim'}
                </Button>
              </div>
            </div>
          )}

          {/* Filtering & Search Bar Panel */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-black/25 p-4 rounded-2xl border border-neutral-900">
            {/* Category selection pills */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {['All', ...categories.map(c => c.name)].map((catName) => (
                <button
                  key={catName}
                  onClick={() => setSelectedCategory(catName)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                    selectedCategory === catName
                      ? 'bg-terracotta text-white shadow-lg shadow-terracotta/20 border border-terracotta/20'
                      : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-850 border border-neutral-800/60'
                  }`}
                >
                  {catName}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search food items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
          </div>

          {/* Sorting & Advanced Filter Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-black/15 px-4 py-3 rounded-xl border border-neutral-900/60 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-neutral-450 font-bold flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-terracotta" />
                Sort by:
              </span>
              <div className="flex bg-black/40 border border-neutral-800 rounded-lg p-0.5">
                {(
                  [
                    { value: 'default', label: 'Default' },
                    { value: 'price_asc', label: 'Price: Low-High' },
                    { value: 'price_desc', label: 'Price: High-Low' },
                    { value: 'popularity', label: 'Popularity' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className={`px-2.5 py-1 rounded-md text-[9px] font-bold tracking-wide uppercase transition-all duration-200 cursor-pointer ${
                      sortBy === opt.value
                        ? 'bg-neutral-850 text-white font-extrabold shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Veg / Non-veg selector toggle */}
              <div className="flex bg-black/40 border border-neutral-800 rounded-lg p-0.5 mr-2">
                {(
                  [
                    { value: 'all', label: 'All' },
                    { value: 'veg', label: 'Veg' },
                    { value: 'non-veg', label: 'Non-Veg' },
                  ] as const
                ).map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setDietaryType(type.value)}
                    className={`px-3 py-1 rounded-md text-[9px] font-extrabold tracking-wide uppercase transition-all duration-200 cursor-pointer flex items-center gap-1 ${
                      dietaryType === type.value
                        ? type.value === 'veg'
                          ? 'bg-emerald-600/90 text-white shadow-sm'
                          : type.value === 'non-veg'
                            ? 'bg-red-900/95 text-white shadow-sm'
                            : 'bg-neutral-800 text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {type.value === 'veg' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 border border-emerald-500 block shrink-0" />
                    )}
                    {type.value === 'non-veg' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 border border-red-650 block shrink-0" />
                    )}
                    <span>{type.label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setHighProteinOnly(!highProteinOnly)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold tracking-wider uppercase border transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                  highProteinOnly
                    ? 'bg-amber-600/90 text-white border-amber-500 shadow-lg shadow-amber-900/10'
                    : 'bg-neutral-950/80 text-neutral-450 hover:bg-neutral-900 border-neutral-800'
                }`}
              >
                <Flame className={`h-3 w-3 ${highProteinOnly ? 'text-amber-300 animate-pulse' : 'text-neutral-500'}`} />
                <span>High Protein (>= 20g)</span>
              </button>
            </div>
          </div>

          {/* Menu Catalog Listing */}
          <div className="space-y-12">
            {filteredCategories.length === 0 ? (
              <div className="text-center py-16 bg-neutral-900/20 border border-dashed border-neutral-800 rounded-3xl max-w-lg mx-auto">
                <AlertCircle className="h-8 w-8 text-neutral-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-neutral-400">No dishes match your query</p>
                <button 
                  onClick={() => { setSearchQuery(''); setSelectedCategory('All') }}
                  className="text-xs text-terracotta hover:underline mt-2 font-bold cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              filteredCategories.map((category) => (
                <section key={category.id} className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex items-center gap-3 border-b border-neutral-800/60 pb-3">
                    <h2 className="text-xl font-extrabold tracking-wide text-neutral-100 uppercase">{category.name}</h2>
                    <Badge variant="secondary" className="rounded-lg font-bold text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-400">
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

                      // Fetch beautiful photo
                      const imageUrl = MENU_ITEM_IMAGES[item.name] || FALLBACK_FOOD_IMAGE

                      return (
                        <Card 
                          key={item.id} 
                          className={`relative overflow-hidden transition-all duration-500 border border-neutral-800/60 flex flex-col group shadow-xl ${
                            isSoldOut 
                              ? 'opacity-40 select-none bg-neutral-900/20' 
                              : 'bg-gradient-to-b from-neutral-950 to-charcoal/80 hover:border-terracotta/40 hover:-translate-y-1'
                          }`}
                        >
                          {/* Image Box */}
                          <div className="h-44 w-full overflow-hidden relative bg-neutral-900">
                            {/* Offer tag */}
                            {offer && !isSoldOut && (
                              <div className="absolute top-2 right-2 bg-gradient-to-l from-red-600 to-orange-500 text-white text-[9px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-md z-10 border border-red-500/20">
                                <Sparkles className="h-3 w-3 text-white animate-pulse" />
                                <span>{Math.round(Number(offer.discount_pct))}% OFF</span>
                              </div>
                            )}

                            {/* Main photo with zoom effect */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-105"
                            />
                            
                            {/* Ambient shadow gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-black/10" />
                          </div>

                          <CardHeader className="p-4 pb-2">
                            <div className="flex justify-between items-start gap-2">
                              <CardTitle className="text-base font-extrabold text-neutral-100 pr-1 line-clamp-1 group-hover:text-terracotta transition-colors">
                                {item.name}
                              </CardTitle>
                              
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setExpandedNutrition(prev => ({ ...prev, [item.id]: !prev[item.id] }))
                                }}
                                className="text-[9px] font-bold text-white hover:text-white bg-neutral-900 border border-neutral-850 px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                              >
                                <Flame className="h-2.5 w-2.5 text-amber-500" />
                                <span>Macros</span>
                                {expandedNutrition[item.id] ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                              </button>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-1">
                              {isSoldOut ? (
                                <Badge variant="destructive" className="rounded-md font-bold text-[9px] px-2 py-0.5 bg-red-950 text-red-400 border border-red-800/30">
                                  Not Available
                                </Badge>
                              ) : (
                                <Badge 
                                  variant="secondary" 
                                  className="rounded-md font-bold text-[9px] px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/30 font-medium"
                                >
                                  Available
                                </Badge>
                              )}

                              {item.remaining_stock !== null && item.remaining_stock > 0 && item.remaining_stock <= 10 && (
                                <span className="text-[10px] text-terracotta/90 font-bold animate-pulse">
                                  Only {item.remaining_stock} left!
                                </span>
                              )}
                            </div>
                          </CardHeader>
                          
                          <CardContent className="p-4 pt-0 space-y-4 flex-1 flex flex-col justify-between">
                            {expandedNutrition[item.id] && (() => {
                              const nut = calculateNutrition(item)
                              return (
                                <div className="bg-black/40 border border-neutral-850 p-2.5 rounded-xl space-y-1.5 text-xxs text-neutral-355 animate-in slide-in-from-top-2 duration-200">
                                  <div className="flex justify-between font-bold text-white border-b border-neutral-900/60 pb-1">
                                    <span>Portion Est. Nutrition</span>
                                    <span className="text-amber-500 font-extrabold">Kaizen Lab</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-center pt-0.5">
                                    <div className="bg-neutral-950/80 p-1.5 rounded-lg border border-neutral-900">
                                      <span className="text-neutral-350 block text-[10px] font-semibold">Calories</span>
                                      <strong className="text-white text-xs font-black">{nut.calories} kcal</strong>
                                    </div>
                                    <div className="bg-neutral-950/80 p-1.5 rounded-lg border border-neutral-900">
                                      <span className="text-neutral-350 block text-[10px] font-semibold">Protein</span>
                                      <strong className="text-white text-xs font-black">{nut.protein}g</strong>
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}

                            {item.description && (
                              <p className="text-xs text-neutral-400 line-clamp-2 h-8 leading-relaxed">
                                {item.description}
                              </p>
                            )}
                            
                            <div className="flex items-baseline justify-between pt-2 border-t border-neutral-900/50">
                              <div className="flex items-baseline gap-2">
                                <span className="text-lg font-extrabold text-white">
                                  ₹{finalPrice}
                                </span>
                                {offer && (
                                  <span className="text-xs text-neutral-500 line-through">
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
                            {items.some(i => i.menuItemId === item.id) && (
                              <div className="pt-2 border-t border-neutral-900/40">
                                <MenuItemPairing menuItemId={item.id} />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      )}



      {/* RENDER TAB 3: TESTIMONIALS (GUEST ACCLAIM) */}
      {activeTab === 'reviews' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Headline stats */}
          <div className="bg-gradient-to-r from-neutral-950 via-charcoal to-neutral-900 border border-neutral-800/80 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="space-y-2 text-center md:text-left relative z-10">
              <span className="text-amber-500 font-extrabold text-xs uppercase tracking-widest block">
                Verified Diner & Critic Reviews
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Guest Testimonials & Culinary Acclaim
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed max-w-lg">
                Real dining experience reports from Michelin guides, wine pairing experts, and valued regulars at Kaizen Modern Bistro.
              </p>
            </div>

            <div className="flex items-center gap-6 bg-black/40 border border-neutral-800 p-5 rounded-2xl shrink-0 relative z-10 w-full md:w-auto justify-around md:justify-end">
              <div className="text-center md:text-right">
                <span className="text-3xl font-extrabold text-amber-400">4.9</span>
                <div className="flex justify-center md:justify-end text-amber-500 text-xs mt-1">★★★★★</div>
                <span className="text-[10px] text-neutral-500 font-bold block mt-0.5">520+ Reviews</span>
              </div>
              <div className="h-10 w-px bg-neutral-800" />
              <div className="text-xs text-neutral-400 space-y-1">
                <div className="flex justify-between gap-4 font-semibold">
                  <span>Food Quality</span>
                  <span className="text-amber-400">4.9 / 5.0</span>
                </div>
                <div className="flex justify-between gap-4 font-semibold">
                  <span>Atmosphere</span>
                  <span className="text-amber-400">4.8 / 5.0</span>
                </div>
                <div className="flex justify-between gap-4 font-semibold font-medium text-neutral-500">
                  <span>Service Excellence</span>
                  <span className="text-amber-400">5.0 / 5.0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonial Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Critic Review 1 */}
            <div className="bg-gradient-to-b from-neutral-950 to-charcoal border border-neutral-850 p-6 rounded-3xl shadow-xl flex flex-col justify-between hover:border-amber-900/30 transition-all duration-300">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80" 
                      alt="Eleanor Vance" 
                      className="w-10 h-10 rounded-full object-cover border border-amber-900/40"
                    />
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                        Eleanor Vance
                        <Check className="h-3.5 w-3.5 text-emerald-400 bg-emerald-950/80 rounded-full p-0.5" />
                      </h4>
                      <p className="text-[10px] text-neutral-400 font-medium">Food & Wine Critic, NY Gastronomer</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-amber-500 text-xs">★★★★★</span>
                    <p className="text-[9px] text-neutral-500 font-bold block mt-0.5">July 18, 2026</p>
                  </div>
                </div>

                <span className="inline-block bg-amber-500/10 text-amber-400 text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  ★ Michelin Guide Press Contributor
                </span>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['5-Course Tasting Menu', 'Dal Makhani', 'Butter Chicken'].map(tag => (
                    <Badge key={tag} className="bg-neutral-900 hover:bg-neutral-900 border border-neutral-800 text-[9px] text-neutral-400 font-semibold">{tag}</Badge>
                  ))}
                </div>

                <p className="text-xs text-neutral-300 leading-relaxed italic pt-2">
                  "An absolute masterclass in traditional Indian flavor calibration. The Butter Chicken melted in mouth-watering butteriness, paired perfectly with their slow-cooked Dal Makhani. Kaizen remains our premier dining recommendation this year."
                </p>
              </div>

              <div className="border-t border-neutral-900/60 mt-5 pt-3 flex justify-between items-center text-[10px] text-neutral-500">
                <span>Was this review helpful?</span>
                <button className="text-amber-500/80 hover:text-amber-400 font-bold flex items-center gap-1">
                  👍 42 helpful
                </button>
              </div>
            </div>

            {/* Critic Review 2 */}
            <div className="bg-gradient-to-b from-neutral-950 to-charcoal border border-neutral-855 p-6 rounded-3xl shadow-xl flex flex-col justify-between hover:border-amber-900/30 transition-all duration-300">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" 
                      alt="Marcus Sterling" 
                      className="w-10 h-10 rounded-full object-cover border border-amber-900/40"
                    />
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                        Marcus Sterling
                        <Check className="h-3.5 w-3.5 text-emerald-400 bg-emerald-950/80 rounded-full p-0.5" />
                      </h4>
                      <p className="text-[10px] text-neutral-400 font-medium">Verified Premier Diner</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-amber-500 text-xs">★★★★★</span>
                    <p className="text-[9px] text-neutral-500 font-bold block mt-0.5">July 22, 2026</p>
                  </div>
                </div>

                <span className="inline-block bg-emerald-500/10 text-emerald-400 text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  ✓ Verified VIP Diner
                </span>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['Mutton Rogan Josh', 'Garlic Naan', 'Mango Lassi'].map(tag => (
                    <Badge key={tag} className="bg-neutral-900 hover:bg-neutral-900 border border-neutral-800 text-[9px] text-neutral-400 font-semibold">{tag}</Badge>
                  ))}
                </div>

                <p className="text-xs text-neutral-300 leading-relaxed italic pt-2">
                  "Celebrated our 10th anniversary at Table #4. The staff greeted us with a complimentary dessert. Slow-braised Mutton Rogan Josh was intensely flavorful, especially when paired with fresh hot Garlic Naan. Exceptional service!"
                </p>
              </div>

              <div className="border-t border-neutral-900/60 mt-5 pt-3 flex justify-between items-center text-[10px] text-neutral-500">
                <span>Was this review helpful?</span>
                <button className="text-amber-500/80 hover:text-amber-400 font-bold flex items-center gap-1">
                  👍 18 helpful
                </button>
              </div>
            </div>

            {/* Review 3 */}
            <div className="bg-gradient-to-b from-neutral-950 to-charcoal border border-neutral-850 p-6 rounded-3xl shadow-xl flex flex-col justify-between hover:border-amber-900/30 transition-all duration-300">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" 
                      alt="Anjali Sharma" 
                      className="w-10 h-10 rounded-full object-cover border border-amber-900/40"
                    />
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                        Anjali Sharma
                        <Check className="h-3.5 w-3.5 text-emerald-400 bg-emerald-950/80 rounded-full p-0.5" />
                      </h4>
                      <p className="text-[10px] text-neutral-400 font-medium">Local Guide (Level 8)</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-amber-500 text-xs">★★★★★</span>
                    <p className="text-[9px] text-neutral-500 font-bold block mt-0.5">June 30, 2026</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['Veg Spring Rolls', 'Chilli Paneer', 'Rasmalai'].map(tag => (
                    <Badge key={tag} className="bg-neutral-900 hover:bg-neutral-900 border border-neutral-800 text-[9px] text-neutral-400 font-semibold">{tag}</Badge>
                  ))}
                </div>

                <p className="text-xs text-neutral-300 leading-relaxed italic pt-2">
                  "If you are ordering starters, Chilli Paneer is a absolute must. Wok tossed to perfection with just the right amount of tang. For desserts, the Rasmalai is cold, creamy, and infused with real cardamom flavor."
                </p>
              </div>

              <div className="border-t border-neutral-900/60 mt-5 pt-3 flex justify-between items-center text-[10px] text-neutral-500">
                <span>Was this review helpful?</span>
                <button className="text-amber-500/80 hover:text-amber-400 font-bold flex items-center gap-1">
                  👍 29 helpful
                </button>
              </div>
            </div>

            {/* Review 4 */}
            <div className="bg-gradient-to-b from-neutral-950 to-charcoal border border-neutral-850 p-6 rounded-3xl shadow-xl flex flex-col justify-between hover:border-amber-900/30 transition-all duration-300">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80" 
                      alt="Dr. Rohan Mehta" 
                      className="w-10 h-10 rounded-full object-cover border border-amber-900/40"
                    />
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                        Dr. Rohan Mehta
                        <Check className="h-3.5 w-3.5 text-emerald-400 bg-emerald-950/80 rounded-full p-0.5" />
                      </h4>
                      <p className="text-[10px] text-neutral-400 font-medium">Regular Diner</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-amber-500 text-xs">★★★★☆</span>
                    <p className="text-[9px] text-neutral-500 font-bold block mt-0.5">July 05, 2026</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['Tandoori Chicken Wings', 'Vegetable Biryani', 'Kulfi'].map(tag => (
                    <Badge key={tag} className="bg-neutral-900 hover:bg-neutral-900 border border-neutral-800 text-[9px] text-neutral-400 font-semibold">{tag}</Badge>
                  ))}
                </div>

                <p className="text-xs text-neutral-300 leading-relaxed italic pt-2">
                  "Fantastic dining workflow! The table-session ordering is extremely fluid. We sat down, joined Table 7 on our phones, customized our spices, and orders were served within 10 minutes. A solid 4.5 stars."
                </p>
              </div>

              <div className="border-t border-neutral-900/60 mt-5 pt-3 flex justify-between items-center text-[10px] text-neutral-500">
                <span>Was this review helpful?</span>
                <button className="text-amber-500/80 hover:text-amber-400 font-bold flex items-center gap-1">
                  👍 12 helpful
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Change Table Modal (simple overlay) */}
      {tableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
          <div className="bg-charcoal border border-neutral-800 rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-white">Switch Table Session</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Select your new table number below. This will transition you to the new table's shared group order session.
              </p>
            </div>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full bg-black/60 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
            >
              <option value="" className="bg-charcoal text-neutral-400">Choose Table...</option>
              {tables.filter(t => t.status !== 'reserved').map((t) => (
                <option key={t.id} value={t.id} className="bg-charcoal text-white font-bold">
                  Table {t.table_number} ({t.status})
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTableModalOpen(false)}
                className="text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!selectedTable}
                onClick={() => handleSelectTable(selectedTable)}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl px-4 py-2 text-xs cursor-pointer"
              >
                Confirm Switch
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Service Call Modal */}
      {serviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
              <h3 className="text-base font-extrabold text-white flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-emerald-500 animate-bounce" />
                Call for Table Service
              </h3>
              <button onClick={() => setServiceModalOpen(false)} className="text-neutral-500 hover:text-white transition-colors cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="text-xs text-neutral-400 leading-relaxed">
              Choose the type of service request you would like to send. The staff will be alerted immediately.
            </p>
            
            <div className="grid grid-cols-1 gap-2.5 pt-2">
              <Button
                disabled={serviceLoading}
                onClick={() => handleCallService('water')}
                className="w-full bg-neutral-950 border border-neutral-800 hover:bg-neutral-850 hover:border-neutral-750 text-neutral-250 font-bold rounded-xl py-5 flex items-center justify-start gap-3 px-4 cursor-pointer"
              >
                <span>💧</span>
                <span className="text-xs">Request Drinking Water</span>
              </Button>
              <Button
                disabled={serviceLoading}
                onClick={() => handleCallService('server')}
                className="w-full bg-neutral-950 border border-neutral-800 hover:bg-neutral-850 hover:border-neutral-750 text-neutral-250 font-bold rounded-xl py-5 flex items-center justify-start gap-3 px-4 cursor-pointer"
              >
                <span>🔔</span>
                <span className="text-xs">Call a Server</span>
              </Button>
              <Button
                disabled={serviceLoading}
                onClick={() => handleCallService('bill')}
                className="w-full bg-neutral-950 border border-neutral-800 hover:bg-neutral-850 hover:border-neutral-750 text-neutral-250 font-bold rounded-xl py-5 flex items-center justify-start gap-3 px-4 cursor-pointer"
              >
                <span>🧾</span>
                <span className="text-xs">Request the Bill</span>
              </Button>
            </div>

            {serviceMessage && (
              <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-300 text-xxs p-3 rounded-xl text-center font-bold">
                {serviceMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Smart Dietary Assistant Bot */}
      <div className="fixed bottom-6 right-6 z-40">
        {!dietaryAssistantOpen ? (
          <button
            onClick={() => setDietaryAssistantOpen(true)}
            className="bg-terracotta hover:bg-terracotta/90 text-white rounded-full p-4 shadow-2xl flex items-center justify-center border border-terracotta/30 group hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
          >
            <Bot className="h-6 w-6 text-white group-hover:animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          </button>
        ) : (
          <div className="bg-neutral-950/95 border border-neutral-800 rounded-3xl w-80 sm:w-96 h-[460px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300 backdrop-blur-md">
            {/* Header */}
            <div className="bg-gradient-to-r from-neutral-900 via-charcoal to-neutral-950 px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-terracotta/15 p-1.5 rounded-lg border border-terracotta/25">
                  <Bot className="h-4.5 w-4.5 text-terracotta" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Dietary Assistant</h4>
                  <span className="text-[9px] text-emerald-400 font-extrabold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Kaizen AI Active
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setDietaryAssistantOpen(false)}
                className="text-neutral-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {dietaryMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-terracotta text-white rounded-tr-none'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-none space-y-2'
                  }`}>
                    <p className="whitespace-pre-wrap text-[11px]">{msg.text}</p>
                    
                    {/* Render recommendations suggestions if any */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="border-t border-neutral-850 pt-2 mt-2 space-y-2">
                        <span className="text-[9px] text-neutral-500 font-extrabold block uppercase tracking-wider">Suggested Dishes:</span>
                        {msg.suggestions.map((sug, sIdx) => (
                          <div 
                            key={sIdx}
                            className="bg-black/40 border border-neutral-850 p-2 rounded-xl flex items-center justify-between gap-2 hover:border-amber-900/30 transition-all cursor-pointer"
                            onClick={() => {
                              // Highlight item by putting name in search query
                              setSearchQuery(sug.name);
                              setDietaryAssistantOpen(false);
                            }}
                          >
                            <div className="text-left">
                              <strong className="text-amber-405 block text-xxs font-bold">{sug.name}</strong>
                              <span className="text-[10px] text-neutral-200 block mt-0.5 line-clamp-2">{sug.reason}</span>
                            </div>
                            <span className="text-[9px] bg-amber-600/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">View</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {dietaryLoading && (
                <div className="flex justify-start">
                  <div className="bg-neutral-900 border border-neutral-800 text-neutral-400 rounded-2xl rounded-tl-none px-4 py-2.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 bg-neutral-500 rounded-full animate-bounce" />
                    <span className="h-1.5 w-1.5 bg-neutral-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="h-1.5 w-1.5 bg-neutral-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-neutral-800 bg-neutral-950 flex gap-2">
              <input
                type="text"
                placeholder="Ask me: 'Jain under ₹300'..."
                value={dietaryQuery}
                onChange={(e) => setDietaryQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendDietaryMessage()}
                className="flex-1 bg-black/40 border border-neutral-800 rounded-xl px-3 py-2 text-xxs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
              <Button
                size="sm"
                onClick={handleSendDietaryMessage}
                disabled={dietaryLoading || !dietaryQuery.trim()}
                className="bg-terracotta hover:bg-terracotta/90 text-white font-bold rounded-xl px-3 text-xxs cursor-pointer"
              >
                Send
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
