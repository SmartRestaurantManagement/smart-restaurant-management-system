import { EmptyState } from "@/components/staff/empty-state";

export default function TablesPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Tables</h1>
      <EmptyState message="No tables configured yet." />
    </div>
  );
}
