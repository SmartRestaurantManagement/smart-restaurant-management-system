import { EmptyState } from "@/components/staff/empty-state";

export default function CustomersPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
      <EmptyState message="No customers yet." />
    </div>
  );
}
