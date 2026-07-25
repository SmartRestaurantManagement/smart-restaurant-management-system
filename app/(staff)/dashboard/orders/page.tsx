import { EmptyState } from "@/components/staff/empty-state";

export default function OrdersPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
      <EmptyState message="No orders yet." />
    </div>
  );
}
