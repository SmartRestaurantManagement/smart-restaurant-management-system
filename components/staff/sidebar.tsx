"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { LogOut, Coffee, ShoppingBag, Menu, X, ShieldAlert } from "lucide-react";
import type { User } from "@supabase/supabase-js";

const NAV_ITEMS = [
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/tables", label: "Tables" },
  { href: "/dashboard/inventory", label: "Inventory" },
  { href: "/dashboard/staff", label: "Staff" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/service-requests", label: "Service Requests" },
  { href: "/dashboard/analytics", label: "Analytics" },
] as const;

interface UserProfile {
  id: string
  full_name: string | null
  role: 'customer' | 'staff' | 'admin'
}

export function StaffSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    async function loadUserAndProfile() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      if (currentUser) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .maybeSingle();
        setProfile(prof as UserProfile | null);
      }
    }
    loadUserAndProfile();
  }, [supabase]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('kaizen_')) {
        localStorage.removeItem(key)
      }
    });
    await supabase.auth.signOut();
    router.push("/signup");
    router.refresh();
  };

  const navContent = (
    <div className="flex h-full flex-col justify-between p-4 text-sidebar-foreground">
      <div className="space-y-4">
        {/* Brand/Portal header */}
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-2">
            <Coffee className="h-5 w-5 text-amber-600 animate-pulse" />
            <span className="font-extrabold text-base tracking-tight text-neutral-800">KAIZEN STAFF</span>
          </div>
          <button 
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1 text-neutral-500 hover:text-neutral-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sidebar Nav Links */}
        <div className="flex flex-col gap-1">
          <span className="mb-2 px-2 text-xxs font-bold tracking-wider text-sidebar-foreground/60 uppercase">
            Menu Navigation
          </span>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200",
                  isActive
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom Profile / Swapper Block */}
      <div className="border-t border-neutral-100 pt-4 space-y-2.5">
        {/* User Card */}
        {profile && (
          <div className="flex items-center gap-2.5 px-2">
            <div className="bg-amber-100 text-amber-800 font-extrabold text-xs h-8 w-8 rounded-full flex items-center justify-center border border-amber-200 shadow-sm shrink-0">
              {profile.full_name?.charAt(0).toUpperCase() || "S"}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-neutral-800 block truncate">{profile.full_name || "Staff Member"}</span>
              <span className="text-xxs text-neutral-400 capitalize block font-medium">Role: {profile.role}</span>
            </div>
          </div>
        )}

        {/* Switch Portal & Switch Role buttons */}
        <div className="flex flex-col gap-1.5 pt-1">
          <Link
            href="/menu"
            className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 px-3 py-2 text-xxs font-extrabold text-neutral-700 transition-colors shadow-xxs"
          >
            <ShoppingBag className="h-3.5 w-3.5 text-neutral-500" />
            <span>Customer Menu</span>
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl hover:bg-red-50 hover:text-red-700 px-3 py-2 text-xxs font-extrabold text-neutral-600 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5 text-neutral-500 hover:text-red-600" />
            <span>Sign Out Session</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        {navContent}
      </aside>

      {/* Mobile Top Navbar (visible on mobile only) */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Coffee className="h-5 w-5 text-amber-600 animate-pulse" />
          <span className="font-extrabold text-sm tracking-tight text-neutral-800">KAIZEN STAFF</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile Slide-out Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex flex-col w-4/5 max-w-xs bg-sidebar h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
