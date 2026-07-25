"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/tables", label: "Tables" },
  { href: "/dashboard/inventory", label: "Inventory" },
  { href: "/dashboard/staff", label: "Staff" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/service-requests", label: "Service Requests" },
  { href: "/dashboard/analytics", label: "Analytics" },
] as const;

export function StaffSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-screen w-56 shrink-0 flex-col gap-1 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
      <span className="mb-2 px-2 text-xs font-medium tracking-wide text-sidebar-foreground/60 uppercase">
        Dashboard
      </span>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-2 py-1.5 text-sm transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
