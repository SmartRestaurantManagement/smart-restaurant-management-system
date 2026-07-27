import type { ReactNode } from "react";
import { StaffSidebar } from "@/components/staff/sidebar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signup");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
    redirect("/menu");
  }

  return (
    <div className="flex min-h-screen">
      <StaffSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
