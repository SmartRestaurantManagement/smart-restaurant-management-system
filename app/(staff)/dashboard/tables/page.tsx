"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/staff/empty-state";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

type TableStatus = Database["public"]["Enums"]["table_status"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];

// Must match the table_status enum in supabase/migrations.
const TABLE_STATUSES: TableStatus[] = ["free", "occupied", "reserved"];

function getStatusClasses(status: TableStatus) {
  switch (status) {
    case "occupied":
      return {
        card: "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20",
        badge: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border border-red-200/50 dark:border-red-800/30",
        dot: "bg-red-500 animate-pulse",
      };
    case "reserved":
      return {
        card: "border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20",
        badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/30",
        dot: "bg-amber-500",
      };
    case "free":
    default:
      return {
        card: "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-950/20",
        badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/30",
        dot: "bg-emerald-500",
      };
  }
}

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

    // Subscribe to real-time table updates on the dashboard
    const supabase = createClient();
    const channel = supabase
      .channel("tables-realtime-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tables" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setTables((prev) => {
              const exists = prev.some((t) => t.id === (payload.new as TableRow).id);
              if (exists) return prev;
              return [...prev, payload.new as TableRow].sort((a, b) => a.table_number - b.table_number);
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as TableRow;
            setTables((prev) =>
              prev.map((t) => (t.id === updated.id ? updated : t))
            );
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string };
            setTables((prev) => prev.filter((t) => t.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
          {tables.map((table) => {
            const classes = getStatusClasses(table.status);
            return (
              <li
                key={table.id}
                className={`flex flex-col gap-2 rounded-lg border p-4 transition-colors duration-200 ${classes.card}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Table {table.table_number}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${classes.dot}`} />
                </div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${classes.badge}`}>
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
