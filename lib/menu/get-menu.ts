import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

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

export async function getMenu(): Promise<CategoryWithItems[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
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