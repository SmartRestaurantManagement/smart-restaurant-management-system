"use client";

import Link from "next/link";
import { Coffee, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AddToCartButton } from "./add-to-cart-button";

export type Special = { num: string; name: string; desc: string; url: string };
export type CategoryTile = { name: string; href: string; url: string };

type Props = {
  specials: Special[];
  categoryTiles: CategoryTile[];
  heroImages: string[];
  featuredItem?: { id: string; name: string; price: number } | null;
  featuredOffer?: { discount_pct: number } | null;
};

const TICKER = [
  "100% FRESH INGREDIENTS",
  "MADE TO ORDER",
  "GROUP ORDERING MADE SIMPLE",
  "LIVE ORDER TRACKING",
  "HYGIENICALLY PREPARED",
  "OPEN DAILY 12PM – 11PM",
];

function Reveal({
  children,
  delayMs = 0,
  className = "",
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity .8s ease ${delayMs}ms, transform .8s ease ${delayMs}ms`,
      }}
    >
      {children}
    </div>
  );
}

const NAV_LINKS = [
  { href: "/menu", label: "MENU" },
  { href: "#specials", label: "SPECIALS" },
];

export function HomeClient({ specials, categoryTiles, heroImages, featuredItem, featuredOffer }: Props) {
  const heroPhoto = heroImages[0];

  return (
    <div className="font-[family-name:var(--font-marketing)] bg-cream min-h-screen overflow-x-hidden">
      {/* Sidebar nav (desktop) */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-60 bg-charcoal text-cream px-7 py-10 justify-between z-50">
        <div>
          <div className="flex flex-col items-center text-center gap-2.5 mb-14">
            <div className="w-14 h-14 rounded-full border border-cream/25 flex items-center justify-center">
              <Coffee className="h-5 w-5 text-hero-highlight" />
            </div>
            <span className="font-display text-lg tracking-[0.08em]">KAIZEN</span>
            <span className="text-[9px] tracking-[0.22em] text-cream/45">SLOW FOOD &middot; EST. 2026</span>
          </div>
          <nav className="flex flex-col items-center gap-6">
            {NAV_LINKS.map((link) =>
              link.href.startsWith("#") ? (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-xs font-semibold tracking-[0.12em] text-cream/75 hover:text-hero-highlight transition-colors"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-xs font-semibold tracking-[0.12em] text-cream/75 hover:text-hero-highlight transition-colors"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
        </div>
        <div className="flex flex-col items-center gap-3 w-full">
          <Link
            href="/signup"
            className="w-full text-center border border-cream/30 hover:border-hero-highlight hover:text-hero-highlight text-cream text-xs font-semibold tracking-[0.1em] px-4 py-3 rounded-sm transition-colors"
          >
            SIGN UP TO ORDER
          </Link>
          <div className="text-[11px] text-cream/45 text-center leading-relaxed mt-3">
            Open daily
            <br />
            12pm &ndash; 11pm
          </div>
        </div>
      </aside>

      <div className="md:pl-60">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-5 py-4 bg-charcoal text-cream sticky top-0 z-50 gap-2">
          <span className="font-display text-lg tracking-[0.06em] shrink-0">KAIZEN</span>
          <div className="flex items-center gap-2">
            <Link href="/signup" className="border border-cream/30 text-cream text-xs font-semibold px-3 py-2 rounded-sm">
              SIGN UP
            </Link>
          </div>
        </div>

        {/* Split hero */}
        <section className="relative grid md:grid-cols-2 h-[70vh] min-h-[520px] md:h-screen md:min-h-[640px]">
          <div className="relative h-full">
            {heroPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroPhoto} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="relative h-full flex items-center bg-maroon overflow-hidden">
            {heroPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroPhoto} alt="" className="absolute inset-0 w-full h-full object-cover opacity-[0.12]" />
            )}
            <div
              className="relative z-10 px-8 md:px-14 py-12 text-cream"
              style={{ animation: "kz-float-up .8s .1s both" }}
            >
              <span className="text-xs font-semibold tracking-[0.22em] text-hero-highlight">KAIZEN &mdash;</span>
              <h1 className="font-display leading-[1.05] mt-4" style={{ fontSize: "clamp(36px,5vw,64px)" }}>
                Welcome to
                <br />
                our kitchen
              </h1>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-cream/80">
                Deliberate recipes, honest ingredients, and a kitchen that never rushes a good thing.
              </p>
              <div className="mt-8 flex flex-col gap-1">
                <span className="text-xs font-semibold tracking-[0.14em] text-cream/60">WE ARE OPEN 7 DAYS A WEEK</span>
                <span className="font-display text-2xl text-hero-highlight">12PM &ndash; 11PM</span>
              </div>
              <Link
                href="/menu"
                className="inline-block mt-8 bg-cream hover:bg-cream-strip text-cream-foreground font-semibold text-xs tracking-[0.1em] px-7 py-3.5 rounded-sm transition-colors"
              >
                VIEW FULL MENU
              </Link>
            </div>
          </div>
        </section>

      {/* Floating Smart Offer Notification */}
      {featuredItem && featuredOffer && (
        <div className="max-w-[1200px] mx-auto px-6 md:px-12 pt-8">
          <div className="bg-gradient-to-r from-red-950/80 via-amber-950/40 to-charcoal border border-red-900/40 text-white rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
                <Sparkles className="h-6 w-6 text-amber-400 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] bg-red-900/50 text-red-300 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest border border-red-500/20">
                  Flash Smart Offer
                </span>
                <h4 className="font-extrabold text-lg mt-1.5 text-white">
                  Save {Math.round(featuredOffer.discount_pct)}% on {featuredItem.name}!
                </h4>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-between md:justify-end relative z-10">
              <div className="text-right">
                <span className="line-through text-xs text-white/40">₹{featuredItem.price}</span>
                <p className="font-bold text-lg text-amber-400">
                  ₹{Math.round(featuredItem.price * (1 - featuredOffer.discount_pct / 100))}
                </p>
              </div>
              <AddToCartButton
                menuItemId={featuredItem.id}
                name={featuredItem.name}
                price={featuredItem.price * (1 - featuredOffer.discount_pct / 100)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Best Picks */}
      {specials.length > 0 && (
        <section id="specials" className="max-w-[1200px] mx-auto px-6 md:px-12 pt-24 md:pt-32 pb-20 md:pb-24">
          <Reveal className="flex justify-between items-end flex-wrap gap-4 mb-12">
            <div>
              <div className="text-xs font-semibold tracking-[0.16em] text-maroon mb-2.5">HANDPICKED</div>
              <h2 className="font-display tracking-[0.01em] text-cream-foreground" style={{ fontSize: "clamp(32px,4.5vw,60px)" }}>
                OUR BEST PICKS
              </h2>
            </div>
            <Link href="/menu" className="text-sm font-semibold border-b border-maroon pb-0.5 text-maroon hover:text-maroon-hover">
              SEE FULL MENU &rarr;
            </Link>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {specials.map((d, i) => (
              <Reveal key={d.name} delayMs={i * 100}>
                <div className="relative aspect-[3/4] rounded overflow-hidden bg-[#e2d9cb] group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.url}
                    alt={d.name}
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]"
                  />
                  <div className="absolute top-3 left-3 bg-maroon text-maroon-foreground text-[11px] font-semibold tracking-[0.08em] px-2.5 py-1 rounded-sm">
                    {d.num}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="font-display text-[19px] text-cream-foreground tracking-[0.01em]">{d.name}</div>
                  <div className="text-[13px] leading-relaxed text-cream-foreground/60 mt-1.5">{d.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Browse by Category */}
      {categoryTiles.length > 0 && (
        <section className="max-w-[1200px] mx-auto px-6 md:px-12 pb-24 md:pb-28">
          <Reveal className="mb-11">
            <div className="text-xs font-semibold tracking-[0.16em] text-maroon mb-2.5">THE MENU</div>
            <h2 className="font-display text-cream-foreground" style={{ fontSize: "clamp(32px,4.5vw,60px)" }}>
              BROWSE BY CATEGORY
            </h2>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {categoryTiles.map((c, i) => (
              <Reveal key={c.name} delayMs={i * 80}>
                <Link href={c.href} className="block relative aspect-[3/4] rounded overflow-hidden group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.url}
                    alt={c.name}
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.08]"
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(180deg, rgba(20,14,10,0) 40%, rgba(20,14,10,.75) 100%)" }}
                  />
                  <div className="absolute bottom-4 left-4 right-4 text-cream font-display text-lg tracking-[0.02em]">
                    {c.name}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-black/10 px-6 md:px-12 pt-14 pb-8">
        <div className="max-w-[1200px] mx-auto flex justify-between flex-wrap gap-10">
          <div>
            <div className="font-display text-2xl tracking-[0.06em] text-cream-foreground mb-2.5">KAIZEN</div>
            <div className="text-[13px] text-cream-foreground/55 max-w-[220px] leading-relaxed">
              Slow food, quietly excellent. Made fresh, served with care.
            </div>
          </div>
          <div className="flex gap-16 flex-wrap">
            <div>
              <div className="text-[11px] font-semibold tracking-[0.12em] text-cream-foreground mb-3.5">EXPLORE</div>
              <div className="flex flex-col gap-2.5 text-[13px]">
                <Link href="/menu" className="text-cream-foreground/65 hover:text-maroon transition-colors">
                  Full Menu
                </Link>
                <Link href="/signup" className="text-cream-foreground/65 hover:text-maroon transition-colors">
                  Sign Up
                </Link>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-[0.12em] text-cream-foreground mb-3.5">FOLLOW</div>
              <div className="flex flex-col gap-2.5 text-[13px]">
                <a href="#" className="text-cream-foreground/65 hover:text-maroon transition-colors">
                  Instagram
                </a>
                <a href="#" className="text-cream-foreground/65 hover:text-maroon transition-colors">
                  Facebook
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-[1200px] mx-auto mt-11 pt-5 border-t border-black/10 text-xs text-cream-foreground/45">
          &copy; 2026 Kaizen Restaurant. All rights reserved.
        </div>
      </footer>
      </div>
    </div>
  );
}
