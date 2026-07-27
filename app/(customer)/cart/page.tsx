'use client'

import { useCart } from '@/lib/cart/cart-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { getTopPairing } from '@/lib/pairing/get-pairing'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTableSession } from '@/lib/cart/table-session'
import { ShieldAlert, AlertTriangle, Plus, Minus, Trash2, ShoppingBag, Sparkles, Check, CheckSquare } from 'lucide-react'

// Deterministic rule-based allergen matching
const ALLERGENS = ["Dairy", "Gluten", "Peanuts", "Soy"] as const;
type Allergen = typeof ALLERGENS[number];

const ALLERGEN_RULES: Record<string, string[]> = {
  Dairy: ["paneer", "butter", "ice cream", "cream", "milk", "cheese", "yogurt", "ice cream mix"],
  Gluten: ["butter naan flour", "flour", "wheat", "bread", "naan", "dough", "tomato soup mix"], // assuming soup mix contains gluten
  Peanuts: ["peanut", "groundnut", "peanut butter"],
  Soy: ["soy", "tofu", "soya"],
};

function PairingSuggestion({ menuItemId }: { menuItemId: string }) {
  const [pairing, setPairing] = useState<{ paired_name: string } | null>(null)

  useEffect(() => {
    getTopPairing(menuItemId).then(setPairing)
  }, [menuItemId])

  if (!pairing) return null

  return (
    <p className="text-xxs text-neutral-400 mt-1.5">
      Goes well with: <span className="font-medium text-neutral-500">{pairing.paired_name}</span>
    </p>
  )
}

export default function CartPage() {
  const { items, updateQty, updateNotes, removeItem, total, clearCart } = useCart()
  const { tableNumber, tableId, sessionId } = useTableSession()
  const router = useRouter()
  const supabase = createClient()

  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')
  const [selectedAllergens, setSelectedAllergens] = useState<Allergen[]>([])
  
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Fetch user auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [supabase])
  
  // Allergen safety check state
  const [allergenConflict, setAllergenConflict] = useState<{
    blocked: boolean;
    itemName: string;
    allergen: string;
    explanation: string;
    substitute: string;
  } | null>(null)
  const [checkingAllergens, setCheckingAllergens] = useState(false)

  // Trigger allergen check when cart items or selected allergens change
  useEffect(() => {
    if (selectedAllergens.length === 0 || items.length === 0) {
      setAllergenConflict(null);
      return;
    }

    async function runSafetyCheck() {
      setCheckingAllergens(true);
      setError('');
      
      // 1. Fetch ingredients for all items in the cart to check against rules deterministically
      const itemIds = items.map(i => i.menuItemId);
      
      const { data: recipeData, error: recipeError } = await supabase
        .from('menu_item_ingredients')
        .select('menu_item_id, ingredients(name)')
        .in('menu_item_id', itemIds);

      if (recipeError || !recipeData) {
        console.error("Allergen safety check failed to fetch recipes:", recipeError);
        setCheckingAllergens(false);
        return;
      }

      // Group ingredients by menu_item_id
      const itemIngredients = new Map<string, string[]>();
      for (const row of recipeData) {
        const list = itemIngredients.get(row.menu_item_id) || [];
        const ingName = (row.ingredients as any)?.name || '';
        if (ingName) list.push(ingName.toLowerCase());
        itemIngredients.set(row.menu_item_id, list);
      }

      // 2. Perform deterministic safety crosscheck
      for (const cartItem of items) {
        const ingredients = itemIngredients.get(cartItem.menuItemId) || [];
        
        // Add item name keywords as search targets too (e.g. "Butter Naan" matches dairy/gluten rules even if recipe missing)
        const itemWords = cartItem.name.toLowerCase();
        
        for (const allergen of selectedAllergens) {
          const triggers = ALLERGEN_RULES[allergen] || [];
          const hasConflict = ingredients.some(ing => triggers.some(t => ing.includes(t))) || 
                              triggers.some(t => itemWords.includes(t));

          if (hasConflict) {
            // Found a deterministic match! Call Gemini API for explanation and safe substitute suggestions
            try {
              const res = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'allergen_explain',
                  item_name: cartItem.name,
                  allergens: [allergen],
                  ingredients: ingredients.length > 0 ? ingredients : [cartItem.name],
                }),
              });

              if (res.ok) {
                const aiResponse = await res.json();
                setAllergenConflict({
                  blocked: true,
                  itemName: cartItem.name,
                  allergen: allergen,
                  explanation: aiResponse.explanation,
                  substitute: aiResponse.substitute,
                });
                setCheckingAllergens(false);
                return;
              }
            } catch (aiErr) {
              console.warn("AI allergen explanation failed, using deterministic fallbacks:", aiErr);
            }

            // Fallback if AI endpoint fails or is unconfigured
            setAllergenConflict({
              blocked: true,
              itemName: cartItem.name,
              allergen: allergen,
              explanation: `Blocked: "${cartItem.name}" contains ingredients associated with ${allergen}.`,
              substitute: allergen === "Dairy" 
                ? "Try customization notes to request dairy-free oil, or choose Mango Lassi instead."
                : "Choose another naturally gluten-free starter or dessert from our catalog.",
            });
            setCheckingAllergens(false);
            return;
          }
        }
      }
      
      setAllergenConflict(null);
      setCheckingAllergens(false);
    };

    runSafetyCheck();
  }, [items, selectedAllergens, supabase]);

  const handleToggleAllergen = (allergen: Allergen) => {
    setSelectedAllergens(prev => 
      prev.includes(allergen) ? prev.filter(a => a !== allergen) : [...prev, allergen]
    );
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) return
    if (allergenConflict?.blocked) {
      setError('Please resolve allergen conflicts before checkout.');
      return;
    }
    setPlacing(true)
    setError('')

    // Get active restaurant_id
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id')
      .limit(1)
      .single()

    if (restaurantError || !restaurant) {
      setError('Could not find restaurant. Please check your setup.')
      setPlacing(false)
      return
    }

    // 1. Create order header
    // Associate with table_id & session_id if dine-in table session is active
    const orderPayload = {
      restaurant_id: restaurant.id,
      status: 'pending' as const,
      table_id: tableId || null,
      session_id: sessionId || crypto.randomUUID(), // session_id is required
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select()
      .single()

    if (orderError || !order) {
      setError(orderError?.message || 'Failed to place order.')
      setPlacing(false)
      return
    }

    // 2. Create order items list
    const orderItems = items.map((item) => ({
      restaurant_id: restaurant.id,
      order_id: order.id,
      menu_item_id: item.menuItemId,
      qty: item.qty,
      price_at_order: item.price,
      customization_notes: item.notes || null,
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      setError(itemsError.message)
      setPlacing(false)
      return
    }

    // 3. Clear cart, save order ID, and redirect to tracking screen
    localStorage.setItem('kaizen_latest_order_id', order.id)
    clearCart()
    router.push(`/order/${order.id}`)
  }

  if (!authLoading && !user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="bg-neutral-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-neutral-400">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-neutral-800">Sign Up Required</h3>
          <p className="text-sm text-neutral-500">Please sign up with your email to review your cart and place order.</p>
        </div>
        <Button onClick={() => router.push('/signup')} className="bg-neutral-900 text-white rounded-xl">
          Sign Up
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="bg-neutral-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-neutral-400">
          <ShoppingBag className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-neutral-800">Your Cart is Empty</h3>
          <p className="text-sm text-neutral-500">Go back to the menu and select delicious items to order.</p>
        </div>
        <Button onClick={() => router.push('/menu')} className="bg-neutral-900 text-white rounded-xl">
          Browse Menu
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 py-8">
      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-800">
        Checkout Review
      </h1>

      {/* Table Session Details */}
      {tableNumber && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm text-emerald-800 flex items-center justify-between">
          <div>
            <span>Seated Table: <strong className="font-semibold text-emerald-950">Table {tableNumber}</strong></span>
            <p className="text-xxs text-emerald-700/80 mt-0.5">Order will be delivered straight to your table.</p>
          </div>
          <Badge className="bg-emerald-600 text-white font-medium border-0">
            Dine-In Activated
          </Badge>
        </div>
      )}

      {/* Allergen Selection Panel */}
      <Card className="border border-neutral-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-neutral-50/50 p-5">
          <CardTitle className="text-sm font-bold text-neutral-800 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            Do you have any food allergies?
          </CardTitle>
          <p className="text-xs text-neutral-500 mt-0.5">
            Select your allergies. We will check every ingredient of the dishes in your cart live.
          </p>
        </CardHeader>
        <CardContent className="p-5 flex flex-wrap gap-2">
          {ALLERGENS.map((allergen) => {
            const isSelected = selectedAllergens.includes(allergen);
            return (
              <button
                key={allergen}
                onClick={() => handleToggleAllergen(allergen)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                    : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                {isSelected ? <Check className="h-3 w-5" /> : <div className="h-3 w-3 border border-neutral-300 rounded-sm" />}
                <span>{allergen} Allergy</span>
              </button>
            )
          })}
        </CardContent>
      </Card>

      {/* Allergen Conflict Alert Box */}
      {allergenConflict && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 text-red-900 rounded-2xl p-5 space-y-3 animate-shake">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-red-950 text-sm">
                Safety Warning: Allergen Conflict Detected
              </h4>
              <p className="text-xs text-red-900/90 font-medium">
                {allergenConflict.explanation}
              </p>
            </div>
          </div>
          <div className="bg-white/60 rounded-xl p-3 border border-red-100 flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <span className="text-xxs font-bold text-amber-800 uppercase tracking-widest block">AI Recommendation</span>
              <p className="text-xs text-neutral-800 font-medium mt-0.5">
                {allergenConflict.substitute}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cart Items List */}
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.menuItemId} className="border border-neutral-200/80 shadow-sm rounded-2xl overflow-hidden bg-white">
            <CardContent className="p-4 flex justify-between items-center gap-4">
              <div className="space-y-1.5 flex-1 min-w-0">
                <span className="font-bold text-sm text-neutral-800 block truncate">{item.name}</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 rounded-lg"
                    onClick={() => updateQty(item.menuItemId, item.qty - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-semibold w-6 text-center text-neutral-800">{item.qty}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 rounded-lg"
                    onClick={() => updateQty(item.menuItemId, item.qty + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <button
                    onClick={() => removeItem(item.menuItemId)}
                    className="text-red-500 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors ml-4"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Customization notes (e.g. less spicy, no cheese)"
                  value={item.notes}
                  onChange={(e) => updateNotes(item.menuItemId, e.target.value)}
                  className="w-full bg-neutral-50/50 border border-neutral-200/60 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-neutral-700 mt-2 block"
                />
                <PairingSuggestion menuItemId={item.menuItemId} />
              </div>

              <div className="text-right shrink-0">
                <span className="text-base font-extrabold text-neutral-900">₹{item.price * item.qty}</span>
                <p className="text-xxs text-neutral-400">₹{item.price} each</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bill calculation & Placement */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="space-y-2 text-sm text-neutral-600 border-b border-neutral-100 pb-3">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>₹{total}</span>
          </div>
          <div className="flex justify-between">
            <span>Taxes & Service (5%)</span>
            <span>₹{Math.round(total * 0.05)}</span>
          </div>
        </div>

        <div className="flex justify-between items-baseline">
          <span className="font-extrabold text-neutral-800">Total Price</span>
          <span className="text-xl font-extrabold text-neutral-900">₹{total + Math.round(total * 0.05)}</span>
        </div>

        {error && <p className="text-red-600 text-xs font-semibold">{error}</p>}

        <Button 
          disabled={placing || checkingAllergens || allergenConflict?.blocked} 
          onClick={handlePlaceOrder}
          className="w-full bg-neutral-900 text-white font-bold rounded-2xl py-3 shadow-md transition-all active:scale-99"
        >
          {checkingAllergens 
            ? 'Safety checking...' 
            : placing 
              ? 'Sending ticket to kitchen...' 
              : allergenConflict?.blocked
                ? 'Check safety warning'
                : 'Confirm & Place Order'}
        </Button>
      </div>
    </div>
  )
}