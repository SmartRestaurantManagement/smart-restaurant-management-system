import { EmptyState } from "@/components/staff/empty-state";

export default function StaffPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
      <EmptyState message="No staff members yet." />
    </div>
  );
}
