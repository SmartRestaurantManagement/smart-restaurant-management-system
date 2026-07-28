import { getMenu } from '@/lib/menu/get-menu'
import { ClientMenu } from '@/components/customer/client-menu'
import { MenuItemPairing } from '@/components/customer/menu-item-pairing'

export const dynamic = 'force-dynamic'

export default async function MenuPage() {
  const categories = await getMenu()

  if (categories.length === 0) {
    return (
      <div className="p-12 text-center text-neutral-400 bg-charcoal border border-dashed border-neutral-800 max-w-lg mx-auto rounded-3xl mt-12 space-y-2">
        <h3 className="font-extrabold text-white text-lg">Menu empty or loading</h3>
        <p className="text-xs">No menu items available right now. Please trigger a Database Reset on the staff dashboard or check back shortly.</p>
      </div>
    )
  }

  return (
    <div className="bg-neutral-950 min-h-screen">
      {/* Hero section */}
      <div className="bg-gradient-to-b from-charcoal via-neutral-950 to-neutral-950 text-charcoal-foreground py-16 px-4 border-b border-neutral-900 relative overflow-hidden">
        {/* Glowing backdrop */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-64 bg-gradient-to-b from-amber-500/5 to-transparent blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto space-y-3 text-center relative z-10">
          <span className="text-amber-500 font-extrabold text-xs uppercase tracking-[0.3em]">
            Kaizen Culinary Experience
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Delicious food, calibrated live.
          </h1>
          <p className="text-xs md:text-sm text-neutral-400 max-w-xl mx-auto leading-relaxed">
            Browse our signature menu, see live portion availability derived from real-time stock, and customize your orders directly to our kitchen.
          </p>
        </div>
      </div>

      <ClientMenu initialCategories={categories} />
    </div>
  )
}