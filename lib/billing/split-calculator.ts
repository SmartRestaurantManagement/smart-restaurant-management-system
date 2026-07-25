import type { Database } from "@/types/database";

type OrderItemForSplit = Pick<
  Database["public"]["Tables"]["order_items"]["Row"],
  "id" | "price_at_order" | "qty"
>;

/** participantId -> order_item ids they're responsible for (shared items list the same id under multiple participants). */
export type ParticipantAssignments = Record<string, string[]>;

/**
 * Splits `total` evenly across `headcount` participants, distributing the
 * leftover cent(s) to the first participants so the shares always sum back
 * to exactly `total` (plain float division would lose or gain a cent).
 */
export function splitEven(total: number, headcount: number): number[] {
  if (!Number.isInteger(headcount) || headcount <= 0) {
    throw new Error("headcount must be a positive integer");
  }

  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / headcount);
  const remainderCents = totalCents - baseCents * headcount;

  return Array.from(
    { length: headcount },
    (_, i) => (baseCents + (i < remainderCents ? 1 : 0)) / 100
  );
}

/**
 * Splits order items by who ordered what. An item claimed by more than one
 * participant (a shared dish) has its cost divided evenly among them. An
 * item claimed by no one is excluded from every participant's share - the
 * caller is responsible for making sure all items are assigned if the
 * shares need to sum to the full bill total.
 */
export function splitByItem(
  orderItems: OrderItemForSplit[],
  participantAssignments: ParticipantAssignments
): Record<string, number> {
  const claimantsByItemId = new Map<string, string[]>();
  for (const [participantId, itemIds] of Object.entries(participantAssignments)) {
    for (const itemId of itemIds) {
      const claimants = claimantsByItemId.get(itemId) ?? [];
      claimants.push(participantId);
      claimantsByItemId.set(itemId, claimants);
    }
  }

  const sharesCents = new Map<string, number>(
    Object.keys(participantAssignments).map((id) => [id, 0])
  );

  for (const item of orderItems) {
    const claimants = claimantsByItemId.get(item.id);
    if (!claimants || claimants.length === 0) continue;

    const itemTotalCents = Math.round(item.price_at_order * item.qty * 100);
    const baseCents = Math.floor(itemTotalCents / claimants.length);
    const remainderCents = itemTotalCents - baseCents * claimants.length;

    claimants.forEach((participantId, i) => {
      const current = sharesCents.get(participantId) ?? 0;
      sharesCents.set(
        participantId,
        current + baseCents + (i < remainderCents ? 1 : 0)
      );
    });
  }

  return Object.fromEntries(
    Array.from(sharesCents, ([participantId, cents]) => [participantId, cents / 100])
  );
}
