'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCallerRestaurantId } from '@/lib/api/restaurant'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/staff/empty-state'
import { 
  Package, DollarSign, AlertTriangle, Layers, Edit, Plus, Check, RefreshCw 
} from 'lucide-react'

interface Ingredient {
  id: string
  name: string
  stock_qty: number
  low_stock_threshold: number
  unit_cost: number
}

interface MenuItemCost {
  menu_item_id: string
  menu_item_name: string
  price: number
  cost_per_portion: number
  margin_per_portion: number
}

interface RecipeItem {
  id: string
  menu_item_id: string
  ingredient_id: string
  qty_per_portion: number
  ingredient: { name: string; unit_cost: number } | null
}

export default function InventoryPage() {
  const supabase = createClient()
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  
  // Data lists
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [menuCosts, setMenuCosts] = useState<MenuItemCost[]>([])
  const [recipes, setRecipes] = useState<Record<string, RecipeItem[]>>({})
  
  // States
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'ingredients' | 'recipes'>('ingredients')
  const [actionLoading, setActionLoading] = useState(false)

  // Edit Ingredient State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStock, setEditStock] = useState('')
  const [editThreshold, setEditThreshold] = useState('')
  const [editCost, setEditCost] = useState('')

  // Add Ingredient State
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newStock, setNewStock] = useState('')
  const [newThreshold, setNewThreshold] = useState('')
  const [newCost, setNewCost] = useState('')

  const loadData = useCallback(async (rid: string) => {
    setError(null)
    
    // 1. Fetch Ingredients
    const { data: ingData, error: ingError } = await supabase
      .from('ingredients')
      .select('*')
      .eq('restaurant_id', rid)
      .order('name')

    if (ingError) {
      setError(ingError.message)
      return
    }
    setIngredients((ingData as any[]) || [])

    // 2. Fetch Menu Item Cost/Margins
    const { data: costData, error: costError } = await supabase
      .from('menu_item_costs' as any)
      .select('*')
      .eq('restaurant_id', rid)

    if (!costError && costData) {
      setMenuCosts(costData as unknown as MenuItemCost[])
    }

    // 3. Fetch Recipe details (menu_item_ingredients)
    const { data: recData, error: recError } = await supabase
      .from('menu_item_ingredients')
      .select('*, ingredient:ingredients(name, unit_cost)')
      .eq('restaurant_id', rid)

    if (!recError && recData) {
      const grouped: Record<string, RecipeItem[]> = {}
      for (const row of recData) {
        const item = row as unknown as RecipeItem
        const list = grouped[item.menu_item_id] || []
        list.push(item)
        grouped[item.menu_item_id] = list
      }
      setRecipes(grouped)
    }
  }, [supabase])

  useEffect(() => {
    (async () => {
      setLoading(true)
      // Resolve restaurant id
      let rid = await getCallerRestaurantId(supabase)
      if (!rid) {
        // query first restaurant as fallback
        const { data } = await supabase.from('restaurants').select('id').limit(1).single()
        rid = data?.id || null
      }

      if (!rid) {
        setError("Could not resolve restaurant. Please run a Database Reset.")
        setLoading(false)
        return
      }

      setRestaurantId(rid)
      await loadData(rid)
      setLoading(false)
    })()
  }, [supabase, loadData])

  // Update Ingredient Stock / thresholds / unit cost
  const handleSaveIngredient = async (id: string) => {
    if (!restaurantId) return
    setActionLoading(true)
    
    const { error: updateError } = await supabase
      .from('ingredients')
      .update({
        stock_qty: Number(editStock),
        low_stock_threshold: Number(editThreshold),
        unit_cost: Number(editCost),
      })
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setEditingId(null)
      await loadData(restaurantId) // reloads and automatically syncs Auto-86 items
    }
    setActionLoading(false)
  }

  // Create Ingredient
  const handleAddIngredient = async () => {
    if (!restaurantId || !newName.trim()) return
    setActionLoading(true)
    setError(null)

    const { error: insertError } = await supabase
      .from('ingredients')
      .insert({
        restaurant_id: restaurantId,
        name: newName.trim(),
        stock_qty: Number(newStock) || 0,
        low_stock_threshold: Number(newThreshold) || 0,
        unit_cost: Number(newCost) || 0,
      })

    if (insertError) {
      setError(insertError.message)
    } else {
      setNewName('')
      setNewStock('')
      setNewThreshold('')
      setNewCost('')
      setShowAddForm(false)
      await loadData(restaurantId)
    }
    setActionLoading(false)
  }

  const handleEditClick = (ing: Ingredient) => {
    setEditingId(ing.id)
    setEditStock(ing.stock_qty.toString())
    setEditThreshold(ing.low_stock_threshold.toString())
    setEditCost(ing.unit_cost.toString())
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-800">Inventory & Recipe Engineering</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Manage ingredient stock, view recipes cost margins, and trigger live stock availability (Auto-86).
          </p>
        </div>

        <div className="flex gap-2">
          {/* Tab buttons */}
          <button
            onClick={() => setActiveTab('ingredients')}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
              activeTab === 'ingredients'
                ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            Ingredients Catalog
          </button>
          <button
            onClick={() => setActiveTab('recipes')}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
              activeTab === 'recipes'
                ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            Recipe Costs & Margins
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive bg-red-50 border border-red-100 rounded-xl p-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-amber-600" />
          <span>Loading inventory assets...</span>
        </p>
      ) : activeTab === 'ingredients' ? (
        /* Ingredients Tab */
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-1.5">
              <Package className="h-4 w-4 text-neutral-500" />
              Ingredient Ingredients Catalog
            </h3>
            <Button
              size="sm"
              onClick={() => setShowAddForm(prev => !prev)}
              className="bg-neutral-900 text-white text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Ingredient
            </Button>
          </div>

          {/* Add Ingredient Form */}
          {showAddForm && (
            <Card className="border border-amber-200 bg-amber-50/20 rounded-2xl shadow-sm overflow-hidden animate-slide-in">
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xxs font-bold text-neutral-500 uppercase">Ingredient Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Flour, Tomato"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-neutral-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold text-neutral-500 uppercase">Stock Qty</label>
                  <input
                    type="number"
                    placeholder="50"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-neutral-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold text-neutral-500 uppercase">Low Stock Limit</label>
                  <input
                    type="number"
                    placeholder="5"
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-neutral-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold text-neutral-500 uppercase">Unit Cost (₹)</label>
                  <input
                    type="number"
                    placeholder="10.00"
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-neutral-800"
                  />
                </div>
                <div className="flex gap-2 sm:col-span-5 justify-end mt-2 border-t border-neutral-100 pt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAddForm(false)}
                    className="text-neutral-500 hover:bg-neutral-100 font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={actionLoading || !newName.trim()}
                    onClick={handleAddIngredient}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                  >
                    {actionLoading ? "Adding..." : "Add Ingredient"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {ingredients.length === 0 ? (
            <EmptyState message="No ingredients in catalog. Perform a Database Reset to load baseline mock data." />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {ingredients.map((ing) => {
                const isLowStock = ing.stock_qty <= ing.low_stock_threshold
                const isEditing = editingId === ing.id

                return (
                  <Card 
                    key={ing.id} 
                    className={`border transition-all duration-300 rounded-2xl ${
                      isLowStock ? 'border-red-200 bg-red-50/10' : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Name / Threshold indicator */}
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-800">{ing.name}</span>
                          {isLowStock && (
                            <Badge variant="destructive" className="rounded-md font-semibold text-xxs px-2 py-0.5 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Low Stock Alert
                            </Badge>
                          )}
                        </div>
                        <p className="text-xxs text-neutral-400">
                          Low Stock Threshold: {ing.low_stock_threshold} portions · Cost per unit: ₹{ing.unit_cost}
                        </p>
                      </div>

                      {/* Edit Fields or Stats values */}
                      {isEditing ? (
                        <div className="grid grid-cols-3 gap-2 shrink-0 items-end max-w-sm w-full">
                          <div className="space-y-0.5">
                            <span className="text-xxs font-bold text-neutral-400 uppercase">Stock Qty</span>
                            <input
                              type="number"
                              value={editStock}
                              onChange={(e) => setEditStock(e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-xxs font-bold text-neutral-400 uppercase">Alert Lvl</span>
                            <input
                              type="number"
                              value={editThreshold}
                              onChange={(e) => setEditThreshold(e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-xxs font-bold text-neutral-400 uppercase">Unit Cost</span>
                            <input
                              type="number"
                              value={editCost}
                              onChange={(e) => setEditCost(e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-6 text-right shrink-0">
                          <div>
                            <span className="text-xxs text-neutral-400 uppercase font-bold block">Current Stock</span>
                            <span className={`text-base font-extrabold ${isLowStock ? 'text-red-600' : 'text-neutral-900'}`}>
                              {ing.stock_qty} units
                            </span>
                          </div>
                          <div className="hidden sm:block">
                            <span className="text-xxs text-neutral-400 uppercase font-bold block">Total Asset Value</span>
                            <span className="text-base font-extrabold text-neutral-900">
                              ₹{Math.round(ing.stock_qty * ing.unit_cost * 100) / 100}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="shrink-0 flex items-center justify-end border-t sm:border-t-0 border-neutral-100 pt-3 sm:pt-0">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingId(null)}
                              className="text-neutral-500 hover:bg-neutral-100 font-semibold"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              disabled={actionLoading}
                              onClick={() => handleSaveIngredient(ing.id)}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Save
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditClick(ing)}
                            className="text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950 rounded-xl"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Recipes & Cost margins Tab */
        <div className="space-y-6">
          <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-neutral-500" />
            Dish Costing & Margins Analysis
          </h3>

          {menuCosts.length === 0 ? (
            <EmptyState message="No recipes configured in catalog." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {menuCosts.map((dish) => {
                const dishRecipe = recipes[dish.menu_item_id] || []
                
                return (
                  <Card key={dish.menu_item_id} className="border border-neutral-200 bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="bg-neutral-50/50 p-4 border-b border-neutral-100 flex flex-row items-center justify-between">
                      <div className="space-y-0.5">
                        <CardTitle className="text-sm font-bold text-neutral-800">{dish.menu_item_name}</CardTitle>
                        <span className="text-xxs text-neutral-400 block">Catalog Price: ₹{dish.price}</span>
                      </div>
                      <Badge className="bg-emerald-600 text-white border-0 font-medium">
                        Margin: {Math.round((dish.margin_per_portion / dish.price) * 100)}%
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      {/* Recipe Composition */}
                      <div className="space-y-2">
                        <span className="text-xxs font-bold text-neutral-400 uppercase tracking-widest block">Recipe Ingredients</span>
                        {dishRecipe.length === 0 ? (
                          <p className="text-xxs text-neutral-400 italic">No recipe elements mapped. Stock level is not tracked.</p>
                        ) : (
                          <div className="space-y-1.5 divide-y divide-neutral-100">
                            {dishRecipe.map((rec) => (
                              <div key={rec.id} className="text-xxs text-neutral-600 flex justify-between items-center py-1.5">
                                <span>{rec.ingredient?.name}</span>
                                <span className="font-medium text-neutral-800">
                                  {rec.qty_per_portion} portions × ₹{rec.ingredient?.unit_cost || 0}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Margin Details breakdown */}
                      <div className="border-t border-neutral-100 pt-3 flex justify-between items-center text-xs">
                        <div className="flex gap-4">
                          <div>
                            <span className="text-xxs text-neutral-400 block font-semibold uppercase">Cost / portion</span>
                            <span className="font-extrabold text-neutral-900">₹{dish.cost_per_portion}</span>
                          </div>
                          <div>
                            <span className="text-xxs text-neutral-400 block font-semibold uppercase">Profit / portion</span>
                            <span className="font-extrabold text-emerald-700">₹{dish.margin_per_portion}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
