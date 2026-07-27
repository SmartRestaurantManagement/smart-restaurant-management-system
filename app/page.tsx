import Link from "next/link";
import { ColorBends } from "@/components/ui/color-bends";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-charcoal text-charcoal-foreground">
      <div className="absolute inset-0">
        <ColorBends
          colors={["#C1633F", "#D97706", "#52633F", "#8C4A2F"]}
          rotation={90}
          speed={0.15}
          autoRotate={0}
          scale={1.4}
          frequency={0.9}
          warpStrength={0.9}
          mouseInfluence={0.5}
          parallax={0.35}
          noise={0.08}
          iterations={1}
          intensity={0.85}
          bandWidth={5}
          transparent
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-charcoal/60 via-charcoal/25 to-charcoal/85" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.5),transparent_65%)]" />

      {/* pointer-events-none so mouse movement still reaches the ColorBends
          canvas underneath for its parallax effect; the two links opt back
          in with pointer-events-auto so they stay clickable. */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center pointer-events-none">
        <span className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-amber-300/80">
          Smart Restaurant Platform
        </span>
        <h1 className="text-6xl sm:text-7xl md:text-8xl font-extrabold tracking-tight text-terracotta-foreground">
          Kaizen
        </h1>
        <p className="mt-6 max-w-xl text-base sm:text-lg text-charcoal-foreground/80">
          One platform where your tables, kitchen, and guests move in perfect sync.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/signup"
            className="pointer-events-auto rounded-full bg-terracotta px-8 py-3 text-sm font-bold text-terracotta-foreground shadow-lg shadow-terracotta/20 transition-all hover:bg-terracotta/90"
          >
            Sign Up
          </Link>
          <Link
            href="/menu"
            className="pointer-events-auto text-sm font-medium text-charcoal-foreground/70 underline underline-offset-4 transition-colors hover:text-charcoal-foreground"
          >
            Browse the menu instead
          </Link>
        </div>
      </div>
    </main>
  );
}
