import { EmptyState } from "@/components/staff/empty-state";

export default function DashboardOverviewPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <EmptyState message="Select a section from the sidebar to get started." />
    </div>
  );
}
