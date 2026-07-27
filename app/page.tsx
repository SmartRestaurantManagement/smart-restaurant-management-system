import Link from "next/link";
import { Strands } from "@/components/ui/strands";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-charcoal text-charcoal-foreground">
      <div className="absolute inset-0">
        <Strands
          colors={["#C1633F", "#D97706", "#52633F", "#8C4A2F"]}
          count={4}
          speed={0.4}
          amplitude={1}
          waviness={1}
          thickness={0.8}
          glow={2.4}
          taper={2.5}
          spread={1.1}
          intensity={0.55}
          saturation={1.2}
          opacity={0.9}
          scale={1.6}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-charcoal/50 via-charcoal/10 to-charcoal/80" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
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
            className="rounded-full bg-terracotta px-8 py-3 text-sm font-bold text-terracotta-foreground shadow-lg shadow-terracotta/20 transition-all hover:bg-terracotta/90"
          >
            Sign Up
          </Link>
          <Link
            href="/menu"
            className="text-sm font-medium text-charcoal-foreground/70 underline underline-offset-4 transition-colors hover:text-charcoal-foreground"
          >
            Browse the menu instead
          </Link>
        </div>
      </div>
    </main>
  );
}
