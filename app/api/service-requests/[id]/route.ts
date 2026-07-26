import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCallerRestaurantId } from "@/lib/api/restaurant";
import type { Database } from "@/types/database";

type ServiceRequestStatus = Database["public"]["Enums"]["service_request_status"];

const SERVICE_REQUEST_STATUSES: ServiceRequestStatus[] = ["pending", "in_progress", "resolved", "cancelled"];

function isServiceRequestStatus(value: string): value is ServiceRequestStatus {
  return (SERVICE_REQUEST_STATUSES as string[]).includes(value);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const restaurantId = await getCallerRestaurantId(supabase);
  if (!restaurantId) {
    return NextResponse.json(
      { error: "Could not resolve the caller's restaurant" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { status } = body as Record<string, unknown>;

  if (typeof status !== "string" || !isServiceRequestStatus(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${SERVICE_REQUEST_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const updateFields: Record<string, any> = { status };
  if (status === "resolved") {
    updateFields.resolved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("service_requests")
    .update(updateFields as any)
    .eq("id", params.id)
    .eq("restaurant_id", restaurantId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Service request not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
