import { EmptyState } from "@/components/staff/empty-state";

export default function InventoryPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
      <EmptyState message="No inventory items yet." />
    </div>
  );
}
