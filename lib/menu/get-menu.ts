import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import type { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Avoid reading headers or cookies to make fetching static-friendly and cacheable
const publicSupabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

type MenuItem = Database['public']['Tables']['menu_items']['Row']
type MenuCategory = Database['public']['Tables']['menu_categories']['Row']
type MenuItemIngredient = Database['public']['Tables']['menu_item_ingredients']['Row']
type Ingredient = Database['public']['Tables']['ingredients']['Row']

export type MenuItemWithIngredients = MenuItem & {
  menu_item_ingredients: (MenuItemIngredient & {
    ingredients: Ingredient | null
  })[]
}

export type CategoryWithItems = MenuCategory & {
  menu_items: MenuItemWithIngredients[]
}

async function fetchMenuRaw(): Promise<CategoryWithItems[]> {
  const { data, error } = await publicSupabase
    .from('menu_categories')
    .select(`
      *,
      menu_items (
        *,
        menu_item_ingredients (
          *,
          ingredients (
            *
          )
        )
      )
    `)
    .order('sort_order', { ascending: true })
    .order('sort_order', { referencedTable: 'menu_items', ascending: true })

  if (error) {
    console.error('Failed to fetch menu:', error.message)
    return []
  }

  return data as any as CategoryWithItems[]
}

// Caches the menu structure for 10 seconds to drastically reduce database overhead and speed up page rendering
export const getMenu = unstable_cache(
  async () => {
    return fetchMenuRaw()
  },
  ['menu-categories-and-items-v1'],
  { revalidate: 10, tags: ['menu'] }
)