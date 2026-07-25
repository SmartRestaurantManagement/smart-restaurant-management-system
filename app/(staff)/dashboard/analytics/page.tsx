import { EmptyState } from "@/components/staff/empty-state";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
      <EmptyState message="No analytics data yet." />
    </div>
  );
}
