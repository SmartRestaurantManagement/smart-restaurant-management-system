import type { ReactNode } from "react";
import { StaffSidebar } from "@/components/staff/sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <StaffSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
