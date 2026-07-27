import { getMenu } from '@/lib/menu/get-menu'
import { ClientMenu } from '@/components/customer/client-menu'
import { MenuItemPairing } from '@/components/customer/menu-item-pairing'

export const dynamic = 'force-dynamic'

export default async function MenuPage() {
  const categories = await getMenu()

  if (categories.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground bg-white border border-dashed border-neutral-200 max-w-lg mx-auto rounded-3xl mt-12 space-y-2">
        <h3 className="font-bold text-neutral-800 text-lg">Menu empty or loading</h3>
        <p className="text-sm">No menu items available right now. Please trigger a Database Reset on the staff dashboard or check back shortly.</p>
      </div>
    )
  }

  return (
    <div className="bg-neutral-50/20 min-h-screen">
      {/* Hero section */}
      <div className="bg-gradient-to-br from-charcoal via-neutral-900 to-terracotta/30 text-charcoal-foreground py-12 px-4 shadow-sm">
        <div className="max-w-5xl mx-auto space-y-2">
          <span className="text-amber-500 font-bold text-xs uppercase tracking-widest">
            Welcome to Kaizen Dine-In
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Delicious food, calibrated live.
          </h1>
          <p className="text-sm md:text-base text-neutral-300 max-w-xl font-normal">
            Browse our menu, see live portion availability, and order with customizations sent directly to our kitchen.
          </p>
        </div>
      </div>

      <ClientMenu initialCategories={categories} />
    </div>
  )
}