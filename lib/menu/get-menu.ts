import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type MenuItem = Database['public']['Tables']['menu_items']['Row']
type MenuCategory = Database['public']['Tables']['menu_categories']['Row']

export type CategoryWithItems = MenuCategory & {
  menu_items: MenuItem[]
}

export async function getMenu(): Promise<CategoryWithItems[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('menu_categories')
    .select(`
      *,
      menu_items (*)
    `)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Failed to fetch menu:', error.message)
    return []
  }

  return data as CategoryWithItems[]
}