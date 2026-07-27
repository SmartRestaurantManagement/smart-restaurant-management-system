import { createClient } from '@/lib/supabase/client'

export async function getTopPairing(menuItemId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .rpc('get_top_pairing', { p_item_id: menuItemId })

  if (error || !data || data.length === 0) return null
  return data[0] as { paired_item_id: string; paired_name: string; pair_count: number }
}