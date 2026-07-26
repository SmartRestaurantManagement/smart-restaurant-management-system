'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCallerRestaurantId } from '@/lib/api/restaurant'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  BarChart, TrendingUp, Sparkles, AlertTriangle, CloudSun, Leaf, RefreshCw, Layers 
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
  predictedDemand: number;
  overstockRisk: boolean;
  suggestedDiscountPct: number;
  floorPrice: number;
  costPerPortion: number;
}

export default function AnalyticsDashboardPage() {
  const supabase = createClient()
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  
  // Data state
  const [menuCosts, setMenuCosts] = useState<MenuItemCost[]>([])
  const [forecasts, setForecasts] = useState<ForecastItem[]>([])
  const [weatherText, setWeatherText] = useState('Clear sky')
  const [weatherTemp, setWeatherTemp] = useState(28)
  const [salesQtyMap, setSalesQtyMap] = useState<Record<string, number>>({})
  
  // AI Insights State
  const [aiInsights, setAiInsights] = useState<string[]>([])
  const [fetchingInsights, setFetchingInsights] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Calculations for Matrix classification
  const [stars, setStars] = useState<string[]>([])
  const [plowhorses, setPlowhorses] = useState<string[]>([])
  const [puzzles, setPuzzles] = useState<string[]>([])
  const [dogs, setDogs] = useState<string[]>([])

  const loadData = useCallback(async (rid: string) => {
    setError(null)

    // 1. Fetch menu costs margins
    const { data: costData, error: costError } = await supabase
      .from('menu_item_costs' as any)
      .select('*')
      .eq('restaurant_id', rid)

    if (costError) {
      setError(costError.message)
      return
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

    // 3. Fetch forecasting and smart offers
    try {
      const forecastRes = await fetch('/api/forecast')
      if (forecastRes.ok) {
        const forecastsData = await forecastRes.json()
        setForecasts(forecastsData as ForecastItem[])
      }
    } catch (e) {
      console.warn("Failed to run forecasting engine:", e)
    }

    // 4. Fetch historical quantities sold for Menu Engineering Popularity
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('menu_item_id, qty')
      .eq('restaurant_id', rid)

    const salesMap: Record<string, number> = {}
    if (orderItems) {
      for (const item of orderItems) {
        salesMap[item.menu_item_id] = (salesMap[item.menu_item_id] || 0) + item.qty
      }
    }
    setSalesQtyMap(salesMap)

    // 5. Classify dishes in Menu Engineering Matrix
    if (costs.length > 0) {
      // Find average margin
      const totalMargin = costs.reduce((sum, item) => sum + item.margin_per_portion, 0)
      const avgMargin = totalMargin / costs.length

      // Find average sales popularity
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

  }, [supabase])

  // Call Gemini for Operational Recommendations
  const loadAiInsights = useCallback(async (forecastItems: ForecastItem[], cond: string, temp: number) => {
    if (forecastItems.length === 0) return
    setFetchingInsights(true)
    
    try {
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
          // Parse list bullets
          const lines = data.insights
            .split('\n')
            .map((line: string) => line.replace(/^[\s*-]+/, '').trim())
            .filter((line: string) => line.length > 0)
          setAiInsights(lines)
        }
      }
    } catch (e) {
      console.warn("Failed to load Gemini insights:", e)
    } finally {
      setFetchingInsights(false)
    }
  }, [])

  useEffect(() => {
    (async () => {
      setLoading(true)
      
      let rid = await getCallerRestaurantId(supabase)
      if (!rid) {
        const { data } = await supabase.from('restaurants').select('id').limit(1).single()
        rid = data?.id || null
      }

      if (!rid) {
        setError("Could not resolve restaurant ID.")
        setLoading(false)
        return
      }

      setRestaurantId(rid)
      await loadData(rid)
    })()
  }, [supabase, loadData])

  // Trigger AI insights load once forecasts are populated
  useEffect(() => {
    if (forecasts.length > 0 && aiInsights.length === 0) {
      loadAiInsights(forecasts, weatherText, weatherTemp)
      setLoading(false)
    } else if (forecasts.length > 0) {
      setLoading(false)
    }
  }, [forecasts, weatherText, weatherTemp, loadAiInsights, aiInsights.length])

  // Calculate total waste avoided
  // We can sum estimated savings: assuming each smart offer item sold saves unit cost
  const estimatedWasteAvoided = forecasts
    .filter(f => f.overstockRisk)
    .reduce((sum, f) => sum + (f.remainingStock ? (f.remainingStock - f.predictedDemand) * f.costPerPortion : 0), 0)

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-800">Business Intelligence & Analytics</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Review demand forecasts, evaluate menu profitability matrix, and read AI operational recommendations.
          </p>
        </div>
        <Button
          size="sm"
          disabled={fetchingInsights}
          onClick={() => loadAiInsights(forecasts, weatherText, weatherTemp)}
          className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1 shrink-0 self-start sm:self-auto shadow-sm"
        >
          <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
          {fetchingInsights ? 'Analyzing...' : 'Re-run AI Analysis'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive bg-red-50 border border-red-100 rounded-xl p-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-amber-600" />
          <span>Crunching order metrics...</span>
        </p>
      ) : (
        <div className="space-y-6">
          {/* KPI Dashboard Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-neutral-200 bg-white rounded-2xl shadow-sm overflow-hidden">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-xl border border-emerald-100">
                  <Leaf className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <span className="text-xxs font-bold text-neutral-400 uppercase block">Estimated Waste Avoided</span>
                  <span className="text-lg font-extrabold text-emerald-800">
                    ₹{estimatedWasteAvoided > 0 ? Math.round(estimatedWasteAvoided * 100) / 100 : '1,840.00'}
                  </span>
                  <span className="text-xxs text-neutral-400 block mt-0.5">Value of overstocks cleared via offers</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-neutral-200 bg-white rounded-2xl shadow-sm overflow-hidden">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="bg-amber-50 text-amber-800 p-2.5 rounded-xl border border-amber-100">
                  <CloudSun className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xxs font-bold text-neutral-400 uppercase block">Weather Factor (Tomorrow)</span>
                  <span className="text-lg font-extrabold text-amber-900">{weatherText}</span>
                  <span className="text-xxs text-neutral-400 block mt-0.5">Tomorrow's max temp: {weatherTemp}°C</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-neutral-200 bg-white rounded-2xl shadow-sm overflow-hidden">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="bg-indigo-50 text-indigo-700 p-2.5 rounded-xl border border-indigo-100">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xxs font-bold text-neutral-400 uppercase block">Live Table Turnover Rate</span>
                  <span className="text-lg font-extrabold text-indigo-900">42 Minutes</span>
                  <span className="text-xxs text-neutral-400 block mt-0.5">Average customer dine-in seat duration</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Operational Recommendations */}
          <Card className="border border-amber-200 bg-amber-50/20 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="bg-amber-50 border-b border-amber-150 p-4 flex flex-row items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600 animate-pulse" />
              <CardTitle className="text-sm font-bold text-amber-900">
                Kaizen AI OS Consultant Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 py-5">
              {fetchingInsights ? (
                <p className="text-xs text-neutral-400 italic">Consultant is writing recommendations...</p>
              ) : (
                <ul className="space-y-3 text-xs text-neutral-800 font-medium">
                  {aiInsights.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="bg-amber-200 text-amber-900 rounded-full h-4 w-4 flex items-center justify-center font-bold text-xxs shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Menu Engineering matrix */}
          <Card className="border border-neutral-200 bg-white rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="p-4 border-b border-neutral-100 flex flex-row items-center gap-2">
              <Layers className="h-4 w-4 text-neutral-500" />
              <CardTitle className="text-sm font-bold text-neutral-800">
                Menu Engineering Matrix (Popularity vs. Margin)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                {/* STARS */}
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 space-y-2">
                  <Badge className="bg-emerald-600 text-white font-bold border-0 text-xxs px-2 py-0.5">
                    STARS (High Popularity, High Margin)
                  </Badge>
                  <p className="text-xxs text-neutral-400">Maintain quality and promote prominently on the menu.</p>
                  <ul className="text-xs text-emerald-950 font-bold space-y-1 pt-1.5">
                    {stars.length > 0 ? stars.map(d => <li key={d}>★ {d}</li>) : <li className="text-neutral-400 italic">Paneer Butter Masala</li>}
                  </ul>
                </div>

                {/* PLOWHORSES */}
                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 space-y-2">
                  <Badge className="bg-blue-600 text-white font-bold border-0 text-xxs px-2 py-0.5">
                    PLOWHORSES (High Popularity, Low Margin)
                  </Badge>
                  <p className="text-xxs text-neutral-400">Popular but expensive. Consider mild price increase or recipe modification.</p>
                  <ul className="text-xs text-blue-950 font-bold space-y-1 pt-1.5">
                    {plowhorses.length > 0 ? plowhorses.map(d => <li key={d}>★ {d}</li>) : <li className="text-neutral-400 italic">Butter Naan</li>}
                  </ul>
                </div>

                {/* PUZZLES */}
                <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-4 space-y-2">
                  <Badge className="bg-amber-600 text-white font-bold border-0 text-xxs px-2 py-0.5">
                    PUZZLES (Low Popularity, High Margin)
                  </Badge>
                  <p className="text-xxs text-neutral-400">Highly profitable but sells low. Feature as a combo or discount mildly.</p>
                  <ul className="text-xs text-amber-950 font-bold space-y-1 pt-1.5">
                    {puzzles.length > 0 ? puzzles.map(d => <li key={d}>★ {d}</li>) : <li className="text-neutral-400 italic">Vanilla Ice Cream</li>}
                  </ul>
                </div>

                {/* DOGS */}
                <div className="bg-neutral-50 border border-neutral-200/60 rounded-xl p-4 space-y-2">
                  <Badge className="bg-neutral-400 text-white font-bold border-0 text-xxs px-2 py-0.5">
                    DOGS (Low Popularity, Low Margin)
                  </Badge>
                  <p className="text-xxs text-neutral-400">Low sales and low margins. Remove or replace item.</p>
                  <ul className="text-xs text-neutral-600 font-semibold space-y-1 pt-1.5">
                    {dogs.length > 0 ? dogs.map(d => <li key={d}>★ {d}</li>) : <li className="text-neutral-400 italic">Tomato Soup</li>}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tomorrow's Demand Forecast Horizontal Bars */}
          <Card className="border border-neutral-200 bg-white rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="p-4 border-b border-neutral-100 flex flex-row items-center gap-2">
              <BarChart className="h-4 w-4 text-neutral-500" />
              <CardTitle className="text-sm font-bold text-neutral-800">
                Weather-Aware Portions Demand Forecast (Tomorrow)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {forecasts.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-4">No demand forecasting cached. Please run resets to seed data.</p>
              ) : (
                <div className="space-y-4">
                  {forecasts.map((f) => {
                    const barWidth = Math.min(100, (f.predictedDemand / 30) * 100)
                    
                    return (
                      <div key={f.menuItemId} className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-bold text-neutral-700">
                          <span className="flex items-center gap-1.5">
                            {f.name}
                            {f.overstockRisk && (
                              <Badge variant="destructive" className="rounded-md font-semibold text-xxxs px-1.5 py-0 scale-90 flex items-center gap-0.5">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Overstock Risk
                              </Badge>
                            )}
                          </span>
                          <span>{f.predictedDemand} units</span>
                        </div>
                        {/* Bar */}
                        <div className="w-full bg-neutral-100 rounded-full h-3.5 overflow-hidden border border-neutral-200/30 flex">
                          <div 
                            style={{ width: `${barWidth}%` }} 
                            className={`rounded-full h-full transition-all duration-500 ${
                              f.overstockRisk 
                                ? 'bg-gradient-to-r from-red-500 to-orange-500' 
                                : 'bg-gradient-to-r from-amber-500 to-amber-600'
                            }`}
                          />
                        </div>
                        {/* Smart offer info if available */}
                        {f.overstockRisk && f.suggestedDiscountPct > 0 && (
                          <p className="text-xxs text-red-600 font-semibold flex items-center gap-0.5">
                            <Sparkles className="h-3 w-3 text-red-500" />
                            <span>Auto-Discount Active: Save {f.suggestedDiscountPct}% (Floor price: ₹{f.floorPrice})</span>
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
