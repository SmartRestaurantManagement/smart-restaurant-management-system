import { getMenu } from "@/lib/menu/get-menu";
import { HomeClient, type Special, type CategoryTile } from "@/components/customer/home-client";

const SPECIAL_NAMES = ["Butter Chicken", "Mutton Rogan Josh", "Vegetable Biryani", "Rasmalai"];

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default async function LandingPage() {
  const categories = await getMenu();
  const allItems = categories.flatMap((c) => c.menu_items.filter((i) => i.is_available));

  const specials: Special[] = SPECIAL_NAMES.map((name, i) => {
    const item = allItems.find((it) => it.name === name);
    return {
      num: String(i + 1).padStart(2, "0"),
      name,
      desc: item?.description ?? "",
      url: item?.image_url ?? "",
    };
  }).filter((s) => s.url);

  const categoryTiles: CategoryTile[] = categories
    .filter((c) => c.menu_items.some((i) => i.is_available && i.image_url))
    .map((c) => {
      const firstItem = c.menu_items.find((i) => i.is_available && i.image_url);
      return {
        name: c.name.toUpperCase(),
        href: `/menu#${slugify(c.name)}`,
        url: firstItem?.image_url ?? "",
      };
    });

  const heroImages = [
    allItems.find((i) => i.name === "Butter Chicken")?.image_url,
    allItems.find((i) => i.name === "Vegetable Biryani")?.image_url,
  ].filter((u): u is string => !!u);

  return (
    <HomeClient
      specials={specials}
      categoryTiles={categoryTiles}
      heroImages={heroImages.length ? heroImages : specials.map((s) => s.url)}
    />
  );
}
