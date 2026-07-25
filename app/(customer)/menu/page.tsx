import { getMenu } from '@/lib/menu/get-menu'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AddToCartButton } from '@/components/customer/add-to-cart-button'

export default async function MenuPage() {
  const categories = await getMenu()

  if (categories.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No menu items available right now. Please check back shortly.
      </div>
    )
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Our Menu</h1>

      {categories.map((category) => (
        <section key={category.id} className="mb-10">
          <h2 className="text-xl font-semibold mb-4">{category.name}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {category.menu_items.map((item) => {
              const isSoldOut =
                item.is_available === false ||
                (item.remaining_stock !== null && item.remaining_stock <= 0)

              return (
                <Card key={item.id} className={isSoldOut ? 'opacity-60' : ''}>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    {isSoldOut ? (
                      <Badge variant="destructive">Sold Out</Badge>
                    ) : item.remaining_stock !== null ? (
                      <Badge variant="secondary">
                        Only {item.remaining_stock} left
                      </Badge>
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {item.description}
                      </p>
                    )}
                    <p className="font-semibold">₹{item.price}</p>

                    <div className="mt-3">
                    <AddToCartButton
                      menuItemId={item.id}
                      name={item.name}
                      price={item.price}
                      disabled={isSoldOut}
                    />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}