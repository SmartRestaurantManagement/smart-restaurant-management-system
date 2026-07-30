import { getMenu } from '@/lib/menu/get-menu'
import { ClientMenu } from '@/components/customer/client-menu'

export const dynamic = 'force-dynamic'

export default async function MenuPage() {
  const categories = await getMenu()

  if (categories.length === 0) {
    return (
      <div className="p-12 text-center text-cream-foreground/60 bg-cream border border-dashed border-black/15 max-w-lg mx-auto rounded-3xl mt-12 space-y-2">
        <h3 className="font-bold text-cream-foreground text-lg">Menu empty or loading</h3>
        <p className="text-xs">No menu items available right now. Please trigger a Database Reset on the staff dashboard or check back shortly.</p>
      </div>
    )
  }

  return (
    <div className="bg-cream min-h-screen font-[family-name:var(--font-marketing)]">
      <header className="max-w-[1200px] mx-auto px-6 md:px-12 pt-16 pb-8">
        <div className="text-xs font-semibold tracking-[0.16em] text-maroon mb-2.5">THE FULL SPREAD</div>
        <h1 className="font-display text-cream-foreground leading-[0.95]" style={{ fontSize: 'clamp(44px,7vw,88px)' }}>
          OUR MENU
        </h1>
        <p className="max-w-[480px] mt-5 text-sm leading-relaxed text-cream-foreground/60">
          {categories.reduce((n, c) => n + c.menu_items.filter((i) => i.is_available).length, 0)} dishes, {categories.filter((c) => c.menu_items.some((i) => i.is_available)).length} sections, one kitchen that treats every plate the same way &mdash; carefully.
        </p>
      </header>

      <ClientMenu initialCategories={categories} />
    </div>
  )
}
