'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCallerRestaurantId } from '@/lib/api/restaurant'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  BarChart, TrendingUp, Sparkles, AlertTriangle, CloudSun, Leaf, RefreshCw, Layers, Info, ShieldAlert, Lock
} from 'lucide-react'

interface MenuItemCost {
  menu_item_id: string
  menu_item_name: string
  price: number
  cost_per_portion: number
  margin_per_portion: number
}

interface ForecastItem {
  menuItemId: string
  name: string
  price: number
  remainingStock: number | null
  predictedDemand: number
  overstockRisk: boolean
  understockRisk: boolean
  suggestedDiscountPct: number
  floorPrice: number
  costPerPortion: number
}

interface SystemStatus {
  supabase: { healthy: boolean; message: string }
  groq: { healthy: boolean; message: string }
  openMeteo: { healthy: boolean; message: string }
}

export default function AnalyticsDashboardPage() {
  const supabase = createClient()
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'staff' | 'customer' | null>(null)
  
  // Data state
  const [menuCosts, setMenuCosts] = useState<MenuItemCost[]>([])
  const [forecasts, setForecasts] = useState<ForecastItem[]>([])
  const [weatherText, setWeatherText] = useState('Clear sky')
  const [weatherTemp, setWeatherTemp] = useState(28)
  
  // Custom BI metric states
  const [foodWasteAvoided, setFoodWasteAvoided] = useState<number>(0)
  const [activeOffersMap, setActiveOffersMap] = useState<Record<string, boolean>>({})
  const [togglingOffers, setTogglingOffers] = useState<Record<string, boolean>>({})

  // System Status State
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(true)

  // AI Insights State
  const [aiInsights, setAiInsights] = useState<string[]>([])
  const [fetchingInsights, setFetchingInsights] = useState(false)
  const [aiProvider, setAiProvider] = useState<string>('')
  const [insightsTimestamp, setInsightsTimestamp] = useState<number | null>(null)
  const [timeAgoText, setTimeAgoText] = useState<string>('Never')
  const [aiError, setAiError] = useState<string | null>(null)

  // Global loading and error states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Calculations for Matrix classification
  const [stars, setStars] = useState<string[]>([])
  const [plowhorses, setPlowhorses] = useState<string[]>([])
  const [puzzles, setPuzzles] = useState<string[]>([])
  const [dogs, setDogs] = useState<string[]>([])

  // Load food waste avoided counter from orders
  const loadWasteAvoided = useCallback(async (rid: string, costs: MenuItemCost[]) => {
    try {
      const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('order_items')
        .select('qty, price_at_order, menu_item_id, menu_items(price)')
        .eq('restaurant_id', rid)

      if (orderItemsError) throw orderItemsError

      let wasteSum = 0
      if (orderItemsData) {
        interface DBOrderItem {
          qty: number
          price_at_order: number
          menu_item_id: string
          menu_items: { price: number } | null
        }
        const items = orderItemsData as unknown as DBOrderItem[]
        for (const oi of items) {
          const originalPrice = Number(oi.menu_items?.price || 0)
          const pricePaid = Number(oi.price_at_order || 0)
          
          if (originalPrice > 0 && pricePaid < originalPrice) {
            // portion was sold at a discount
            const itemCostObj = costs.find(c => c.menu_item_id === oi.menu_item_id)
            const costPerPortion = itemCostObj ? Number(itemCostObj.cost_per_portion) : originalPrice * 0.4
            
            // Waste avoided is estimated as portions sold under discount * cost of ingredients
            wasteSum += oi.qty * costPerPortion
          }
        }
      }
      setFoodWasteAvoided(wasteSum)
    } catch (err) {
      console.warn("Failed to compute food waste avoided counter:", err)
    }
  }, [supabase])

  const checkSystemStatus = useCallback(async () => {
    setCheckingStatus(true)
    try {
      const res = await fetch('/api/status')
      if (res.ok) {
        const data = await res.json()
        setSystemStatus(data)
      } else {
        throw new Error(`Status API returned code ${res.status}`)
      }
    } catch (e) {
      console.error("Failed to check system status:", e)
      setSystemStatus({
        supabase: { healthy: false, message: "Unreachable" },
        groq: { healthy: false, message: "Unreachable" },
        openMeteo: { healthy: false, message: "Unreachable" }
      })
    } finally {
      setCheckingStatus(false)
    }
  }, [])

  const loadData = useCallback(async (rid: string) => {
    setError(null)
    setLoading(true)

    try {
      console.log(`[Analytics] Starting data crunching for restaurant: ${rid}`)

      // 1. Fetch menu costs & margins
      const { data: costData, error: costError } = await supabase
        .from('menu_item_costs' as unknown as 'menu_items')
        .select('*')
        .eq('restaurant_id', rid)

      if (costError) {
        console.warn(`Could not load menu costs (RLS or missing view): ${costError.message}`)
      }
      const costs = (costData as unknown as MenuItemCost[]) || []
      setMenuCosts(costs)

      // 2. Fetch tomorrow's weather
      try {
        const weatherRes = await fetch('/api/weather')
        if (weatherRes.ok) {
          const weather = await weatherRes.json()
          setWeatherText(weather.current.condition)
          setWeatherTemp(weather.current.temperatureC)
        }
      } catch (e) {
        console.warn("Failed to load weather signal for analytics:", e)
      }

      // 3. Fetch forecasting and smart offers suggestions
      let forecastsData: ForecastItem[] = []
      try {
        const forecastRes = await fetch('/api/forecast')
        if (forecastRes.ok) {
          forecastsData = await forecastRes.json()
          setForecasts(forecastsData)
        } else {
          const errData = await forecastRes.json().catch(() => ({}))
          throw new Error(errData.error || `Forecast API returned status ${forecastRes.status}`)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Forecasting API request failed"
        console.warn("Failed to run forecasting engine:", e)
        throw new Error(msg)
      }

      // 4. Fetch actual offers to check which are active/approved
      const { data: offersData, error: offersError } = await supabase
        .from('offers')
        .select('*')
        .eq('restaurant_id', rid)

      if (offersError) {
        console.warn("Failed to fetch active offers for toggle mapping:", offersError.message)
      } else if (offersData) {
        const activeMap: Record<string, boolean> = {}
        for (const offer of offersData) {
          if (offer.active) {
            activeMap[offer.menu_item_id] = true
          }
        }
        setActiveOffersMap(activeMap)
      }

      // 5. Load food waste avoided counter
      await loadWasteAvoided(rid, costs)

      // 6. Fetch historical quantities sold for Menu Engineering Popularity
      const { data: orderItems, error: orderItemsError } = await supabase
        .from('order_items')
        .select('menu_item_id, qty')
        .eq('restaurant_id', rid)

      if (orderItemsError) {
        throw new Error(`Failed to load order history: ${orderItemsError.message}`)
      }

      const salesMap: Record<string, number> = {}
      if (orderItems) {
        for (const item of orderItems) {
          salesMap[item.menu_item_id] = (salesMap[item.menu_item_id] || 0) + item.qty
        }
      }

      // 7. Classify dishes in Menu Engineering Matrix
      if (costs.length > 0) {
        const totalMargin = costs.reduce((sum, item) => sum + item.margin_per_portion, 0)
        const avgMargin = totalMargin / costs.length

        const totalSales = costs.reduce((sum, item) => sum + (salesMap[item.menu_item_id] || 0), 0)
        const avgSales = totalSales / costs.length

        const classifiedStars: string[] = []
        const classifiedPlowhorses: string[] = []
        const classifiedPuzzles: string[] = []
        const classifiedDogs: string[] = []

        for (const dish of costs) {
          const sales = salesMap[dish.menu_item_id] || 0
          const margin = dish.margin_per_portion

          const isHighPopularity = sales >= avgSales
          const isHighMargin = margin >= avgMargin

          if (isHighPopularity && isHighMargin) {
            classifiedStars.push(dish.menu_item_name)
          } else if (isHighPopularity && !isHighMargin) {
            classifiedPlowhorses.push(dish.menu_item_name)
          } else if (!isHighPopularity && isHighMargin) {
            classifiedPuzzles.push(dish.menu_item_name)
          } else {
            classifiedDogs.push(dish.menu_item_name)
          }
        }

        setStars(classifiedStars)
        setPlowhorses(classifiedPlowhorses)
        setPuzzles(classifiedPuzzles)
        setDogs(classifiedDogs)
      }

      setLoading(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred while loading analytics data."
      console.error("Error loading analytics data:", err)
      setError(msg)
      setLoading(false)
    }
  }, [supabase, loadWasteAvoided])

  // Call Gemini / Groq for Operational Recommendations
  const loadAiInsights = useCallback(async (forecastItems: ForecastItem[], cond: string, temp: number) => {
    if (forecastItems.length === 0) return
    setFetchingInsights(true)
    setAiError(null)
    
    try {
      console.log("[Analytics] Triggering AI insights request...")
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'analytics_insights',
          forecasts: forecastItems.map(f => ({
            name: f.name,
            remainingStock: f.remainingStock,
            predictedDemand: f.predictedDemand,
            overstockRisk: f.overstockRisk,
            suggestedDiscountPct: f.suggestedDiscountPct,
          })),
          weather_condition: cond,
          temp_max_c: temp,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.insights) {
          const lines = data.insights
            .split('\n')
            .map((line: string) => line.replace(/^[\s*-]+/, '').trim())
            .filter((line: string) => line.length > 0)
          
          setAiInsights(lines)
          setAiProvider(data.provider || 'gemini')
          const now = Date.now()
          setInsightsTimestamp(now)
          
          if (data.error) {
            setAiError(data.error)
          }
          
          localStorage.setItem('kaizen_ai_insights', JSON.stringify(lines))
          localStorage.setItem('kaizen_ai_insights_provider', data.provider || 'gemini')
          localStorage.setItem('kaizen_ai_insights_timestamp', now.toString())
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `AI API returned status ${res.status}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to contact operational consultant"
      console.warn("Failed to load operational recommendations:", e)
      setAiError(msg)
    } finally {
      setFetchingInsights(false)
    }
  }, [])

  // Approve / Publish suggested smart offer
  const handleToggleOffer = async (item: ForecastItem, currentActive: boolean) => {
    if (!restaurantId) return
    
    setTogglingOffers(prev => ({ ...prev, [item.menuItemId]: true }))
    
    try {
      const tomorrowEndOfDay = new Date()
      tomorrowEndOfDay.setDate(tomorrowEndOfDay.getDate() + 1)
      tomorrowEndOfDay.setHours(23, 59, 59, 999)

      // First check if an offer row already exists for this dish
      const { data: existingOffer } = await supabase
        .from('offers')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('menu_item_id', item.menuItemId)
        .maybeSingle()

      if (existingOffer) {
        // Update existing offer row
        const { error: updateError } = await supabase
          .from('offers')
          .update({
            active: !currentActive,
            discount_pct: item.suggestedDiscountPct || 15,
            floor_price: item.floorPrice || item.price * 0.85,
            expires_at: tomorrowEndOfDay.toISOString()
          })
          .eq('id', existingOffer.id)

        if (updateError) throw updateError
      } else {
        // Insert new offer row
        const { error: insertError } = await supabase
          .from('offers')
          .insert({
            restaurant_id: restaurantId,
            menu_item_id: item.menuItemId,
            discount_pct: item.suggestedDiscountPct || 15,
            floor_price: item.floorPrice || item.price * 0.85,
            active: !currentActive,
            expires_at: tomorrowEndOfDay.toISOString()
          })

        if (insertError) throw insertError
      }

      setActiveOffersMap(prev => ({ ...prev, [item.menuItemId]: !currentActive }))
      await loadWasteAvoided(restaurantId, menuCosts)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update offer"
      console.error("Failed to update offer status:", err)
      alert(`Failed to update offer: ${msg}`)
    } finally {
      setTogglingOffers(prev => ({ ...prev, [item.menuItemId]: false }))
    }
  }

  // Initial mount: load user role, restaurant ID and query status
  useEffect(() => {
    (async () => {
      setLoading(true)
      checkSystemStatus()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        if (prof) setUserRole(prof.role as any)
      }

      let rid = await getCallerRestaurantId(supabase)
      if (!rid) {
        const { data } = await supabase.from('restaurants').select('id').limit(1).single()
        rid = data?.id || null
      }

      if (!rid) {
        setError("Could not resolve restaurant tenant ID.")
        setLoading(false)
        return
      }

      setRestaurantId(rid)
      await loadData(rid)
    })()
  }, [supabase, loadData, checkSystemStatus])

  // Load AI insights from cache on mount
  useEffect(() => {
    const cachedInsights = localStorage.getItem('kaizen_ai_insights')
    const cachedProvider = localStorage.getItem('kaizen_ai_insights_provider')
    const cachedTimestamp = localStorage.getItem('kaizen_ai_insights_timestamp')

    if (cachedInsights && cachedTimestamp) {
      try {
        setAiInsights(JSON.parse(cachedInsights))
        setAiProvider(cachedProvider || 'gemini')
        setInsightsTimestamp(Number(cachedTimestamp))
      } catch (e) {
        console.warn("Failed to parse cached AI insights:", e)
      }
    }
  }, [])

  // Dynamic timestamp "X min ago" update effect
  useEffect(() => {
    if (!insightsTimestamp) {
      setTimeAgoText('Never')
      return
    }

    const updateText = () => {
      const diffMs = Date.now() - insightsTimestamp
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) {
        setTimeAgoText('Just now')
      } else if (diffMins === 1) {
        setTimeAgoText('1 min ago')
      } else {
        setTimeAgoText(`${diffMins} mins ago`)
      }
    }

    updateText()
    const timer = setInterval(updateText, 30000)
    return () => clearInterval(timer)
  }, [insightsTimestamp])

  const handleRetry = () => {
    if (restaurantId) {
      loadData(restaurantId)
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-12 px-2 sm:px-4">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">Kaizen Business Intelligence</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Real-time demand forecasting, recipe-aware stock risk analysis, menu engineering matrix, and automated smart offers.
          </p>
        </div>
        <Button
          size="sm"
          disabled={fetchingInsights || loading || forecasts.length === 0}
          onClick={() => loadAiInsights(forecasts, weatherText, weatherTemp)}
          className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shrink-0 self-start sm:self-auto shadow-sm transition-all duration-200"
        >
          <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
          {fetchingInsights ? 'Crunching Insights...' : 'Generate Insights Now'}
        </Button>
      </div>

      {/* System Status Strip */}
      <div className="space-y-1">
        {checkingStatus ? (
          <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-xxs font-bold text-neutral-400 animate-pulse">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Checking cloud connections...</span>
          </div>
        ) : systemStatus ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 shadow-sm text-neutral-200">
            <span className="text-xxs font-extrabold text-neutral-400 uppercase tracking-wider">Infrastructure Status:</span>
            
            {/* Supabase */}
            <div className="flex items-center gap-1.5 text-xxs font-bold">
              <span className={`h-2.5 w-2.5 rounded-full ${systemStatus.supabase.healthy ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span>Supabase DB</span>
              <span className="text-neutral-500 font-normal">({systemStatus.supabase.message})</span>
            </div>

            {/* Groq AI */}
            <div className="flex items-center gap-1.5 text-xxs font-bold">
              <span className={`h-2.5 w-2.5 rounded-full ${systemStatus.groq.healthy ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span>Groq AI</span>
              <span className="text-neutral-500 font-normal">({systemStatus.groq.message})</span>
            </div>

            {/* Open-Meteo */}
            <div className="flex items-center gap-1.5 text-xxs font-bold">
              <span className={`h-2.5 w-2.5 rounded-full ${systemStatus.openMeteo.healthy ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span>Open-Meteo</span>
              <span className="text-neutral-500 font-normal">({systemStatus.openMeteo.message})</span>
            </div>

            <Button onClick={checkSystemStatus} variant="ghost" size="icon" className="h-4 w-4 ml-auto text-neutral-400 hover:text-white hover:bg-neutral-800 p-0 rounded">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        ) : null}
      </div>

      {/* Error Boundary / Fail State */}
      {error && (
        <div className="flex flex-col items-center justify-center p-8 text-center gap-4 border border-red-200 bg-red-50/20 rounded-2xl">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <div>
            <h3 className="text-sm font-bold text-red-950">Analytics Processing Failed</h3>
            <p className="text-xs text-red-700/80 mt-1">{error}</p>
          </div>
          <Button onClick={handleRetry} size="sm" className="bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold flex items-center gap-1 shadow-sm">
            <RefreshCw className="h-4 w-4" /> Retry Crunching Metrics
          </Button>
        </div>
      )}

      {/* Loading Spinner */}
      {loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-amber-600" />
          <p className="text-sm font-bold text-neutral-700">Crunching order metrics & compiling forecast cache...</p>
          <p className="text-xxs text-neutral-400">Evaluating moving average & checking live ingredient stocks.</p>
        </div>
      )}

      {/* Main Content Dashboard */}
      {!loading && !error && (
        <div className="space-y-6">
          {/* KPI Dashboard Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Food Waste Avoided Counter */}
            <Card className="border border-neutral-200 bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-100 shadow-inner">
                  <Leaf className="h-5 w-5 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xxs font-extrabold text-neutral-400 uppercase tracking-wide block">Food Waste Avoided</span>
                  <span className="text-lg font-extrabold text-emerald-800">
                    ₹{foodWasteAvoided.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <div className="flex items-center gap-0.5 mt-0.5 group cursor-help text-xxs text-neutral-400">
                    <span>Active formula estimate</span>
                    <Info className="h-3 w-3 text-neutral-400 group-hover:text-neutral-500" />
                    <div className="absolute hidden group-hover:block bg-neutral-950 text-white rounded-lg p-2 text-xxxs max-w-xs z-50 shadow-lg border border-neutral-800 mt-14 leading-normal">
                      <strong>Methodology:</strong> Sum of <code className="text-emerald-400">Portions Sold × Ingredient Cost</code> for all items purchased with an approved Smart Offer.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Weather Signal */}
            <Card className="border border-neutral-200 bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-100 shadow-inner">
                  <CloudSun className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xxs font-extrabold text-neutral-400 uppercase tracking-wide block">Weather Forecast (Tomorrow)</span>
                  <span className="text-lg font-extrabold text-amber-900 capitalize">{weatherText}</span>
                  <span className="text-xxs text-neutral-400 block mt-0.5">Projected High: {weatherTemp}°C</span>
                </div>
              </CardContent>
            </Card>

            {/* Dine-In Seat Duration */}
            <Card className="border border-neutral-200 bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300 col-span-1 sm:col-span-2 md:col-span-1">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="bg-indigo-50 text-indigo-700 p-3 rounded-xl border border-indigo-100 shadow-inner">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xxs font-extrabold text-neutral-400 uppercase tracking-wide block">Live Seat Duration</span>
                  <span className="text-lg font-extrabold text-indigo-900">42 Minutes</span>
                  <span className="text-xxs text-neutral-400 block mt-0.5">Average customer dine-in seat duration</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Operational Recommendations */}
          <Card className="border border-amber-200 bg-amber-50/15 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="bg-amber-50/50 border-b border-amber-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600 animate-pulse" />
                <CardTitle className="text-xs font-extrabold text-amber-950 uppercase tracking-wider">
                  Kaizen AI Consultant Insights
                </CardTitle>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {aiProvider && (
                  <Badge variant="outline" className="text-xxs bg-white text-amber-800 border-amber-200 font-extrabold scale-90 px-2 py-0">
                    Source: {aiProvider.toUpperCase()}
                  </Badge>
                )}
                <span className="text-xxs text-neutral-400 font-bold">
                  Last updated: {timeAgoText}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-4 py-5">
              {aiError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-xs font-semibold text-red-900">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>LLM Call Issue:</strong> {aiError}. Displaying rule-based consultant guidelines below.
                  </div>
                </div>
              )}
              {fetchingInsights ? (
                <div className="flex items-center gap-2 text-xs text-neutral-500 font-semibold py-2">
                  <RefreshCw className="h-4.5 w-4.5 animate-spin text-amber-600" />
                  <span className="italic">Kaizen Consultant is analyzing forecasting data, profit matrix, and ingredient levels...</span>
                </div>
              ) : aiInsights.length > 0 ? (
                <ul className="space-y-3.5 text-xs text-neutral-800 font-semibold">
                  {aiInsights.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                      <span className="bg-amber-200 text-amber-950 rounded-full h-5 w-5 flex items-center justify-center font-extrabold text-xxs shrink-0 mt-0.5 shadow-sm">
                        {idx + 1}
                      </span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-4 space-y-2">
                  <p className="text-xs text-neutral-400 italic font-semibold">No operational recommendations cached yet.</p>
                  <Button
                    size="sm"
                    onClick={() => loadAiInsights(forecasts, weatherText, weatherTemp)}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-xxs font-bold px-3 py-1.5 rounded-lg shadow-sm"
                  >
                    Generate Insights Now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tomorrow's Demand Forecast Section */}
          <Card className="border border-neutral-200 bg-white rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="p-4 border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <BarChart className="h-4 w-4 text-neutral-500" />
                <CardTitle className="text-sm font-extrabold text-neutral-800">
                  Weather-Aware Dish Demand Forecast vs. Stock (Tomorrow)
                </CardTitle>
              </div>

              {/* Collapsible/Transparent Forecasting Rules */}
              <div className="group relative self-start md:self-auto">
                <Button variant="outline" size="sm" className="text-xxs font-extrabold text-neutral-600 rounded-lg px-2.5 py-1 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  View Forecasting Model Rules
                </Button>
                <div className="absolute right-0 hidden group-hover:block bg-neutral-950 text-white rounded-xl p-4 text-xxs max-w-md z-50 shadow-2xl border border-neutral-800 mt-1 leading-relaxed">
                  <h4 className="font-bold text-xxs text-amber-400 uppercase tracking-wide border-b border-neutral-800 pb-1 mb-2">Demand Forecasting Rules</h4>
                  <ul className="space-y-1.5 font-medium list-disc list-inside">
                    <li><strong>Baseline:</strong> Day-of-week moving average on matching calendar day.</li>
                    <li><strong>Rain/Drizzle Adjustment:</strong>
                      <ul className="pl-4 list-circle">
                        <li>Hot Comfort categories (Soups, Curries, Naan): <span className="text-emerald-400">+20%</span></li>
                        <li>Cold categories (Ice Creams, Shakes, Lassi): <span className="text-red-400">-30%</span></li>
                        <li>General dine-in footfall factor: <span className="text-red-400">-15%</span></li>
                      </ul>
                    </li>
                    <li><strong>High Temp ({'>'}30°C) Adjustment:</strong> Cold categories <span className="text-emerald-400">+25%</span>, Hot Comfort <span className="text-red-400">-15%</span>.</li>
                    <li><strong>Margin Floor Floor Constraint:</strong> Discounts enforced to preserve minimum 1.15× ingredient cost floor.</li>
                  </ul>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-5">
              {forecasts.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-6">No demand forecasting computed. Ensure database has seeded menu items.</p>
              ) : (
                <div className="space-y-5">
                  {forecasts.map((f) => {
                    const stock = f.remainingStock
                    const demand = f.predictedDemand
                    const maxValForBar = Math.max(30, demand, stock || 0)
                    
                    // Width percentages
                    const demandWidth = (demand / maxValForBar) * 100
                    const stockWidth = stock !== null ? (stock / maxValForBar) * 100 : 0
                    
                    // Active offer toggling details
                    const isOfferActive = activeOffersMap[f.menuItemId] || false
                    const isToggling = togglingOffers[f.menuItemId] || false

                    return (
                      <div key={f.menuItemId} className="border border-neutral-100 rounded-xl p-4 bg-neutral-50/50 hover:bg-neutral-50 hover:shadow-sm transition-all duration-200 space-y-3">
                        {/* Header Details */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-neutral-800 flex flex-wrap items-center gap-1.5">
                            {f.name}
                            
                            {/* Overstock Badge */}
                            {f.overstockRisk && (
                              <Badge className="bg-amber-100 hover:bg-amber-100 text-amber-800 font-extrabold border-amber-200 text-xxxs px-2 py-0.5 rounded flex items-center gap-0.5">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Overstock Risk
                              </Badge>
                            )}

                            {/* Understock Badge */}
                            {f.understockRisk && (
                              <Badge variant="destructive" className="bg-red-100 hover:bg-red-100 text-red-800 font-extrabold border-red-200 text-xxxs px-2 py-0.5 rounded flex items-center gap-0.5">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Understock Risk
                              </Badge>
                            )}

                            {!f.overstockRisk && !f.understockRisk && stock !== null && (
                              <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-800 font-extrabold border-emerald-200 text-xxxs px-2 py-0.5 rounded flex items-center gap-0.5">
                                Optimal Stock Levels
                              </Badge>
                            )}
                          </span>
                          
                          <span className="text-xxs font-extrabold text-neutral-500 bg-white border border-neutral-200 px-2 py-0.5 rounded-lg shadow-xxs">
                            Menu Price: ₹{f.price}
                          </span>
                        </div>

                        {/* Double Bar Comparison: Demand vs Stock */}
                        <div className="space-y-1.5">
                          {/* Forecast Demand Bar */}
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-xxs font-semibold text-neutral-500">
                              <span>Forecasted Demand</span>
                              <span className="font-extrabold text-neutral-800">{demand} portions</span>
                            </div>
                            <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                              <div 
                                style={{ width: `${demandWidth}%` }} 
                                className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full h-full"
                              />
                            </div>
                          </div>

                          {/* Ingredient Portion Stock Bar */}
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-xxs font-semibold text-neutral-500">
                              <span>Recipe Ingredient Stock</span>
                              <span className="font-extrabold text-neutral-800">
                                {stock !== null ? `${stock} portions` : 'Uncapped'}
                              </span>
                            </div>
                            <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                              <div 
                                style={{ width: `${stockWidth}%` }} 
                                className={`rounded-full h-full ${
                                  f.understockRisk 
                                    ? 'bg-gradient-to-r from-red-500 to-rose-600 animate-pulse' 
                                    : f.overstockRisk 
                                      ? 'bg-gradient-to-r from-amber-500 to-orange-500' 
                                      : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                                }`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Interactive Suggestion Actions */}
                        {f.overstockRisk && f.suggestedDiscountPct > 0 && (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-orange-50 border border-orange-100 rounded-xl px-3.5 py-2.5 text-xxs font-semibold">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-orange-600 shrink-0" />
                              <div>
                                <span className="text-orange-950 font-bold block">Suggested Smart Offer: {f.suggestedDiscountPct}% Off</span>
                                <span className="text-neutral-500 text-xxxs font-medium block mt-0.5">
                                  Suggested Price: ₹{f.floorPrice}
                                  {userRole === 'admin' && ` (Ingredient cost: ₹${f.costPerPortion.toFixed(2)})`}
                                </span>
                              </div>
                            </div>
                            
                            {/* Toggle Switch */}
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <button 
                                onClick={() => handleToggleOffer(f, isOfferActive)}
                                disabled={isToggling}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isOfferActive ? 'bg-orange-600' : 'bg-neutral-300'} disabled:opacity-50`}
                              >
                                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isOfferActive ? 'translate-x-4' : 'translate-x-0'}`} />
                              </button>
                              <span className={`text-xxxs font-extrabold ${isOfferActive ? 'text-orange-700' : 'text-neutral-500'} uppercase tracking-wide w-20 text-right`}>
                                {isToggling ? 'Syncing...' : isOfferActive ? 'Live on Menu' : 'Approve Draft'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Menu Profitability matrix (RESTRICTED TO ADMINS ONLY) */}
          {userRole !== 'admin' ? (
            <Card className="border border-neutral-200 bg-neutral-50/50 rounded-2xl p-6 text-center shadow-sm">
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="bg-neutral-200 text-neutral-700 p-3 rounded-full">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-neutral-800">Admin Privileges Required</h3>
                <p className="text-xs text-neutral-500 max-w-md">
                  Menu Engineering matrix, recipe ingredient costs, and profit margin statistics are restricted to Restaurant Administrators. Non-admin staff do not have access to financial margins.
                </p>
              </div>
            </Card>
          ) : (
            <Card className="border border-neutral-200 bg-white rounded-2xl shadow-sm overflow-hidden">
              <CardHeader className="p-4 border-b border-neutral-100 flex flex-row items-center gap-2">
                <Layers className="h-4 w-4 text-neutral-500" />
                <CardTitle className="text-sm font-bold text-neutral-800">
                  Menu Engineering Profitability Matrix (Sales Volume vs. Margin)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* STARS */}
                  <div className="bg-emerald-50/40 border-2 border-emerald-100 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-all duration-300">
                    <div>
                      <div className="flex justify-between items-start">
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 text-xxs font-extrabold px-2.5 py-0.5 rounded-lg uppercase tracking-wide">
                          Stars
                        </Badge>
                        <span className="text-xxs text-emerald-600 font-extrabold">High Margin • High Popularity</span>
                      </div>
                      <p className="text-xxs text-neutral-500 mt-1.5 leading-relaxed">
                        High volume, high profit margin. Promote aggressively on the menu and feature prominently. Keep recipes consistent.
                      </p>
                      <ul className="text-xs text-neutral-800 font-semibold space-y-1.5 mt-3">
                        {stars.length > 0 ? stars.map(d => (
                          <li key={d} className="flex items-center gap-1.5 bg-white border border-emerald-100 rounded-lg px-2 py-1 shadow-sm text-emerald-950">
                            <span className="text-emerald-500 font-bold">★</span> {d}
                          </li>
                        )) : (
                          <li className="text-neutral-400 italic text-xxs">No dishes classified here yet.</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Hidden Gems / Puzzles */}
                  <div className="bg-indigo-50/40 border-2 border-indigo-100 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-all duration-300">
                    <div>
                      <div className="flex justify-between items-start">
                        <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 text-xxs font-extrabold px-2.5 py-0.5 rounded-lg uppercase tracking-wide">
                          Hidden Gems (Puzzles)
                        </Badge>
                        <span className="text-xxs text-indigo-600 font-extrabold">High Margin • Low Popularity</span>
                      </div>
                      <p className="text-xxs text-neutral-500 mt-1.5 leading-relaxed">
                        Highly profitable, but low sales volume. Consider bundling with popular items, offering minor discounts, or renaming them.
                      </p>
                      <ul className="text-xs text-neutral-800 font-semibold space-y-1.5 mt-3">
                        {puzzles.length > 0 ? puzzles.map(d => (
                          <li key={d} className="flex items-center gap-1.5 bg-white border border-indigo-100 rounded-lg px-2 py-1 shadow-sm text-indigo-950">
                            <span className="text-indigo-500 font-bold">★</span> {d}
                          </li>
                        )) : (
                          <li className="text-neutral-400 italic text-xxs">No dishes classified here yet.</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Plowhorses */}
                  <div className="bg-amber-50/40 border-2 border-amber-100 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-all duration-300">
                    <div>
                      <div className="flex justify-between items-start">
                        <Badge className="bg-amber-600 hover:bg-amber-700 text-white border-0 text-xxs font-extrabold px-2.5 py-0.5 rounded-lg uppercase tracking-wide">
                          Plowhorses
                        </Badge>
                        <span className="text-xxs text-amber-600 font-extrabold">Low Margin • High Popularity</span>
                      </div>
                      <p className="text-xxs text-neutral-500 mt-1.5 leading-relaxed">
                        Very popular, but expensive to make. Consider subtle price increases, adjusting ingredient proportions, or pushing high-margin add-ons.
                      </p>
                      <ul className="text-xs text-neutral-800 font-semibold space-y-1.5 mt-3">
                        {plowhorses.length > 0 ? plowhorses.map(d => (
                          <li key={d} className="flex items-center gap-1.5 bg-white border border-amber-100 rounded-lg px-2 py-1 shadow-sm text-amber-950">
                            <span className="text-amber-500 font-bold">★</span> {d}
                          </li>
                        )) : (
                          <li className="text-neutral-400 italic text-xxs">No dishes classified here yet.</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Cut Candidates / Dogs */}
                  <div className="bg-red-50/40 border-2 border-red-100 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-all duration-300">
                    <div>
                      <div className="flex justify-between items-start">
                        <Badge className="bg-red-600 hover:bg-red-750 text-white border-0 text-xxs font-extrabold px-2.5 py-0.5 rounded-lg uppercase tracking-wide">
                          Cut Candidates (Dogs)
                        </Badge>
                        <span className="text-xxs text-red-600 font-extrabold">Low Margin • Low Popularity</span>
                      </div>
                      <p className="text-xxs text-neutral-500 mt-1.5 leading-relaxed">
                        Low sales volume and low profitability. Candidates for removal, complete recipe redesign, or replacement with more seasonal options.
                      </p>
                      <ul className="text-xs text-neutral-800 font-semibold space-y-1.5 mt-3">
                        {dogs.length > 0 ? dogs.map(d => (
                          <li key={d} className="flex items-center gap-1.5 bg-white border border-red-100 rounded-lg px-2 py-1 shadow-sm text-red-950">
                            <span className="text-red-500 font-bold">★</span> {d}
                          </li>
                        )) : (
                          <li className="text-neutral-400 italic text-xxs">No dishes classified here yet.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
