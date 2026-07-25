"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/staff/empty-state";
import type { Database } from "@/types/database";

type TableStatus = Database["public"]["Enums"]["table_status"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];

// Must match the table_status enum in supabase/migrations.
const TABLE_STATUSES: TableStatus[] = ["free", "occupied", "reserved"];

export default function TablesPage() {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadTables() {
    const res = await fetch("/api/tables");
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Failed to load tables");
      return;
    }
    setTables(body as TableRow[]);
    setError(null);
  }

  useEffect(() => {
    (async () => {
      await loadTables();
      setLoading(false);
    })();
  }, []);

  async function handleStatusChange(table: TableRow, status: TableStatus) {
    setUpdatingId(table.id);
    try {
      const res = await fetch(`/api/tables/${table.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to update table status");
        return;
      }
      setTables((prev) => prev.map((t) => (t.id === table.id ? (body as TableRow) : t)));
      setError(null);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Tables</h1>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading tables...</p>
      ) : tables.length === 0 ? (
        <EmptyState message="No tables configured yet." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {tables.map((table) => (
            <li
              key={table.id}
              className="flex flex-col gap-2 rounded-lg border border-border p-4"
            >
              <span className="text-sm font-medium">Table {table.table_number}</span>
              <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                {table.status}
              </span>
              <select
                value={table.status}
                disabled={updatingId === table.id}
                onChange={(e) =>
                  handleStatusChange(table, e.target.value as TableStatus)
                }
                className="rounded-md border border-border bg-background px-2 py-1 text-sm capitalize"
              >
                {TABLE_STATUSES.map((status) => (
                  <option key={status} value={status} className="capitalize">
                    {status}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
