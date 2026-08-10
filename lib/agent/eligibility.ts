/**
 * Deterministic eligibility engine — NO LLM involvement.
 *
 * This is the core orchestration safety net: the LLM calls check_eligibility,
 * reads the structured result, and narrates it in plain language.
 * It never computes eligibility itself, eliminating policy hallucinations.
 *
 * Rules run in this strict priority order (first match wins):
 *  1. Cancelled order → refuse (§2.6)
 *  2. Lost in transit / no tracking movement 10+ days → escalate (§1.6)
 *  3. Non-returnable category → refuse (§2.3)
 *  4. Delivery date + 30 days < today → refuse, window expired (§2.1)
 *  5. final_sale = true → exchange_only (§2.4)
 *  6. Footwear category → return (eligible) + ₹300 no-box note (§2.5)
 *  7. Default → eligible for return
 */

import ordersData from "../data/orders.json";

/** All categories that are absolutely non-returnable under §2.3 */
const NON_RETURNABLE_CATEGORIES = new Set([
  "innerwear",
  "socks",
  "jewellery",
  "beauty",
  "fragrance",
  "beauty/fragrance",
  "face masks",
  "face_masks",
  "gift cards",
  "gift_cards",
]);

export type EligibilityAction = "return" | "exchange_only" | "escalate" | "refuse";

export interface EligibilityResult {
  eligible: boolean;
  action: EligibilityAction;
  reason_code: string;
  human_readable_reason: string;
  policy_section: string;
  /** Extra notes appended to the LLM's narration (e.g. the ₹300 footwear box note) */
  notes?: string;
}

interface OrderItem {
  sku: string;
  name: string;
  category: string;
  size: string;
  qty: number;
  price: number;
  final_sale: boolean;
  shipped?: boolean;
  backorder_eta?: string;
}

interface Order {
  order_id: string;
  customer_id: string;
  status: string;
  placed_at: string;
  delivered_at: string | null;
  expected_delivery: string | null;
  carrier: string | null;
  tracking_number: string | null;
  payment_method: string;
  shipping_city: string;
  items: OrderItem[];
  total: number;
  cancelled_at?: string;
  refund_status?: string;
}

function getOrder(orderId: string): Order | null {
  return (ordersData.orders as Order[]).find((o) => o.order_id === orderId) ?? null;
}

function getItem(order: Order, sku: string): OrderItem | null {
  return order.items.find((i) => i.sku === sku) ?? null;
}

/**
 * Check if an order has shown no tracking movement for 10+ consecutive days.
 * In a real system this would check carrier API logs. Here we use the
 * expected_delivery date as a proxy: if it's 10+ days past expected and
 * still not delivered, treat as potential lost parcel.
 */
function isTrackingStale(order: Order): boolean {
  if (!order.expected_delivery) return false;
  const expectedMs = new Date(order.expected_delivery).getTime();
  const nowMs = Date.now();
  const daysSinceExpected = (nowMs - expectedMs) / (1000 * 60 * 60 * 24);
  return daysSinceExpected >= 10;
}

export function checkEligibility(orderId: string, sku: string): EligibilityResult {
  const order = getOrder(orderId);

  // --- Order-level checks ---
  if (!order) {
    return {
      eligible: false,
      action: "refuse",
      reason_code: "ORDER_NOT_FOUND",
      human_readable_reason: "No order with this ID was found in our system.",
      policy_section: "N/A",
    };
  }

  // Rule 1: Cancelled order (§2.6)
  if (order.status === "cancelled") {
    return {
      eligible: false,
      action: "refuse",
      reason_code: "ORDER_CANCELLED",
      human_readable_reason:
        "This order was cancelled. Returns cannot be raised against a cancelled order — the cancellation refund has already been processed.",
      policy_section: "§2.6",
    };
  }

  // Rule 2: Lost in transit or stale tracking (§1.6)
  if (order.status === "lost_in_transit" || isTrackingStale(order)) {
    return {
      eligible: false,
      action: "escalate",
      reason_code: "LOST_IN_TRANSIT",
      human_readable_reason:
        "This parcel appears to be lost in transit. This is treated as a lost-parcel claim — not a standard return — and must be handled by a human support agent. Resolution (free replacement or full refund) happens within 5 business days.",
      policy_section: "§1.6",
    };
  }

  // --- Item-level checks ---
  const item = getItem(order, sku);
  if (!item) {
    return {
      eligible: false,
      action: "refuse",
      reason_code: "SKU_NOT_IN_ORDER",
      human_readable_reason: `The item with SKU ${sku} is not part of order ${orderId}.`,
      policy_section: "N/A",
    };
  }

  // Rule 3: Non-returnable category (§2.3)
  const categoryNorm = item.category.toLowerCase().trim();
  if (NON_RETURNABLE_CATEGORIES.has(categoryNorm)) {
    return {
      eligible: false,
      action: "refuse",
      reason_code: "NON_RETURNABLE_CATEGORY",
      human_readable_reason: `"${item.name}" is in the ${item.category} category, which cannot be returned or exchanged for hygiene and safety reasons — regardless of when it was delivered.`,
      policy_section: "§2.3",
    };
  }

  // Rule 4: 30-day window (§2.1) — only applies to delivered orders
  if (order.delivered_at) {
    const deliveredMs = new Date(order.delivered_at).getTime();
    const windowDeadline = new Date(deliveredMs + 30 * 24 * 60 * 60 * 1000);
    const today = new Date();
    if (today > windowDeadline) {
      const deadlineStr = windowDeadline.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      return {
        eligible: false,
        action: "refuse",
        reason_code: "WINDOW_EXPIRED",
        human_readable_reason: `The 30-day return window for this order closed on ${deadlineStr}. Return requests after this date are not eligible under any circumstance.`,
        policy_section: "§2.1",
      };
    }
  }

  // Rule 5: Final sale — exchange only (§2.4)
  if (item.final_sale) {
    return {
      eligible: true,
      action: "exchange_only",
      reason_code: "FINAL_SALE",
      human_readable_reason: `"${item.name}" was purchased as a final sale item. Size exchanges are available (same 30-day window applies), but no refund or store credit can be issued.`,
      policy_section: "§2.4",
    };
  }

  // Rule 6: Footwear — eligible with box condition note (§2.5)
  if (categoryNorm === "footwear") {
    return {
      eligible: true,
      action: "return",
      reason_code: "ELIGIBLE_FOOTWEAR",
      human_readable_reason: `"${item.name}" is eligible for return within the 30-day window.`,
      policy_section: "§2.5",
      notes:
        "Please note: footwear must be returned in its original shoe box. Returns without the box incur a ₹300 deduction from the refund.",
    };
  }

  // Rule 7: Default — eligible for full return
  return {
    eligible: true,
    action: "return",
    reason_code: "ELIGIBLE",
    human_readable_reason: `"${item.name}" is eligible for return. It's within the 30-day window, in a returnable category, and not marked as final sale.`,
    policy_section: "§2.1",
  };
}
