/**
 * Tool handler implementations — fully deterministic, no LLM.
 *
 * Each handler:
 *   1. Receives parsed arguments from the LLM tool call
 *   2. Executes deterministic logic against orders.json / session state
 *   3. Returns a structured result the LLM uses to formulate its response
 *
 * Verification gating: get_order, check_eligibility, initiate_return,
 * and initiate_exchange all check session.verifiedOrders before proceeding.
 *
 * Action guard: initiate_return and initiate_exchange check
 * session.lastEligibilityResult to ensure check_eligibility was called first.
 */

import { v4 as uuidv4 } from "uuid";
import { SessionData } from "./session";
import { checkEligibility, EligibilityResult } from "./eligibility";
import ordersData from "../data/orders.json";

// ---- Types ----

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

interface Customer {
  customer_id: string;
  name: string;
  email: string;
  phone: string;
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

// ---- Helper functions ----

function findOrder(orderId: string): Order | null {
  return (ordersData.orders as Order[]).find((o) => o.order_id === orderId) ?? null;
}

function findCustomer(customerId: string): Customer | null {
  return (ordersData.customers as Customer[]).find((c) => c.customer_id === customerId) ?? null;
}

function normalizeContact(contact: string): string {
  // Strip spaces and dashes for loose phone matching
  return contact.toLowerCase().replace(/[\s\-]/g, "");
}

/**
 * Compute refund timeline string based on payment method (§3.1).
 * Returned to the LLM to include in its explanation.
 */
function refundTimeline(paymentMethod: string): string {
  const pm = paymentMethod.toLowerCase();
  if (pm.includes("credit") || pm.includes("debit")) {
    return "5–7 business days back to the original card";
  }
  if (pm.includes("upi")) {
    return "3–5 business days back to the original UPI ID";
  }
  if (pm.includes("cash_on_delivery") || pm.includes("cod")) {
    return "7–10 business days via bank transfer or store credit (a human agent will collect bank details securely)";
  }
  if (pm.includes("store_credit")) {
    return "immediately as store credit";
  }
  return "5–7 business days";
}

// ---- Tool handlers ----

export async function handleVerifyCustomer(
  args: { order_id: string; contact: string },
  session: SessionData
): Promise<Record<string, unknown>> {
  const order = findOrder(args.order_id);
  if (!order) {
    return {
      verified: false,
      error: "ORDER_NOT_FOUND",
      message: "No order with that ID was found.",
    };
  }

  const customer = findCustomer(order.customer_id);
  if (!customer) {
    return {
      verified: false,
      error: "CUSTOMER_NOT_FOUND",
      message: "Customer record not found.",
    };
  }

  const provided = normalizeContact(args.contact);
  const emailNorm = normalizeContact(customer.email);
  const phoneNorm = normalizeContact(customer.phone);

  if (provided !== emailNorm && provided !== phoneNorm) {
    // Do NOT hint at what the correct value is — just say verification failed
    return {
      verified: false,
      error: "VERIFICATION_FAILED",
      message:
        "The contact information provided does not match our records for this order. Please double-check and try again.",
    };
  }

  // Enforce single-customer sessions: if a different customer was already
  // verified this session, refuse to cross-verify.
  if (
    session.verifiedCustomerId !== null &&
    session.verifiedCustomerId !== customer.customer_id
  ) {
    return {
      verified: false,
      error: "CROSS_CUSTOMER_ATTEMPT",
      message:
        "This session is already verified for a different customer. Please start a new chat to access a different account.",
    };
  }

  // Mark this order as verified in the session
  session.verifiedOrders.add(args.order_id);
  session.verifiedCustomerId = customer.customer_id;
  session.verifiedCustomerName = customer.name;

  return {
    verified: true,
    customer_id: customer.customer_id,
    customer_name: customer.name,
    message: `Identity verified. Welcome, ${customer.name}.`,
  };
}

export async function handleGetOrder(
  args: { order_id: string },
  session: SessionData
): Promise<Record<string, unknown>> {
  // Verification gate
  if (!session.verifiedOrders.has(args.order_id)) {
    return {
      error: "NOT_VERIFIED",
      message:
        "I need to verify this is your order before I can share its details. Could you please provide your order ID along with the email address or phone number on your account?",
    };
  }

  const order = findOrder(args.order_id);
  if (!order) {
    return { error: "ORDER_NOT_FOUND", message: "Order not found." };
  }

  // Return full order — private fields stripped
  return {
    order_id: order.order_id,
    status: order.status,
    placed_at: order.placed_at,
    delivered_at: order.delivered_at,
    expected_delivery: order.expected_delivery,
    carrier: order.carrier,
    tracking_number: order.tracking_number,
    payment_method: order.payment_method,
    shipping_city: order.shipping_city,
    items: order.items,
    total: order.total,
    cancelled_at: order.cancelled_at,
    refund_status: order.refund_status,
  };
}

export async function handleListOrdersForCustomer(
  args: { customer_id: string },
  session: SessionData
): Promise<Record<string, unknown>> {
  // Must be the same customer verified this session
  if (session.verifiedCustomerId !== args.customer_id) {
    return {
      error: "NOT_VERIFIED",
      message: "I can only list orders for the verified customer in this session.",
    };
  }

  const orders = (ordersData.orders as Order[]).filter(
    (o) => o.customer_id === args.customer_id
  );

  const summaries = orders.map((o) => ({
    order_id: o.order_id,
    status: o.status,
    placed_at: o.placed_at,
    expected_delivery: o.expected_delivery,
    delivered_at: o.delivered_at,
    total: o.total,
    item_count: o.items.length,
    items: o.items.map((i) => ({ name: i.name, sku: i.sku, size: i.size })),
  }));

  return { orders: summaries, count: summaries.length };
}

export async function handleCheckEligibility(
  args: { order_id: string; sku: string },
  session: SessionData
): Promise<Record<string, unknown>> {
  // Verification gate
  if (!session.verifiedOrders.has(args.order_id)) {
    return {
      error: "NOT_VERIFIED",
      message:
        "I need to verify your identity before I can check return eligibility for this order.",
    };
  }

  const result: EligibilityResult = checkEligibility(args.order_id, args.sku);

  // Store for the action-guard — initiate_return/exchange check this
  session.lastEligibilityResult = {
    eligible: result.eligible,
    action: result.action,
    reason_code: result.reason_code,
    human_readable_reason: result.human_readable_reason,
    policy_section: result.policy_section,
    notes: result.notes,
    order_id: args.order_id,
    sku: args.sku,
  };

  // Cast to satisfy the generic Record return type
  return result as unknown as Record<string, unknown>;
}

export async function handleInitiateReturn(
  args: { order_id: string; sku: string; reason: string },
  session: SessionData
): Promise<Record<string, unknown>> {
  // Verification gate
  if (!session.verifiedOrders.has(args.order_id)) {
    return {
      error: "NOT_VERIFIED",
      message: "Cannot initiate return: order not verified in this session.",
    };
  }

  // Action guard: check_eligibility must have been called and passed for this exact order+sku
  const lastElig = session.lastEligibilityResult;
  if (
    !lastElig ||
    lastElig.order_id !== args.order_id ||
    lastElig.sku !== args.sku ||
    !lastElig.eligible ||
    lastElig.action !== "return"
  ) {
    return {
      error: "ELIGIBILITY_NOT_CONFIRMED",
      message:
        "check_eligibility must be called first and confirm action='return' before initiating a return.",
    };
  }

  const order = findOrder(args.order_id);
  if (!order) {
    return { error: "ORDER_NOT_FOUND" };
  }

  const returnId = `RET-${uuidv4().substring(0, 8).toUpperCase()}`;
  const timeline = refundTimeline(order.payment_method);

  // Clear eligibility result to prevent re-use
  session.lastEligibilityResult = null;

  return {
    success: true,
    return_id: returnId,
    order_id: args.order_id,
    sku: args.sku,
    reason: args.reason,
    status: "pending_pickup",
    message: `Return ${returnId} has been raised. Free reverse pickup will be arranged — the carrier will attempt pickup up to 2 times. Once the item is received and inspected (2–3 business days), your refund will be processed: ${timeline}.`,
    refund_timeline: timeline,
    next_steps: [
      "Keep the item packed in original tags and packaging",
      "A pickup window will be shared via SMS/email within 24 hours",
      "Track this return with ID: " + returnId,
    ],
  };
}

export async function handleInitiateExchange(
  args: { order_id: string; sku: string; new_size: string },
  session: SessionData
): Promise<Record<string, unknown>> {
  // Verification gate
  if (!session.verifiedOrders.has(args.order_id)) {
    return {
      error: "NOT_VERIFIED",
      message: "Cannot initiate exchange: order not verified in this session.",
    };
  }

  // Action guard
  const lastElig = session.lastEligibilityResult;
  if (
    !lastElig ||
    lastElig.order_id !== args.order_id ||
    lastElig.sku !== args.sku ||
    !lastElig.eligible ||
    (lastElig.action !== "return" && lastElig.action !== "exchange_only")
  ) {
    return {
      error: "ELIGIBILITY_NOT_CONFIRMED",
      message:
        "check_eligibility must be called first and confirm eligible=true before initiating an exchange.",
    };
  }

  // One-exchange-per-item limit (§4.4)
  const exchangeKey = `${args.order_id}:${args.sku}`;
  const currentCount = session.exchangeCount.get(exchangeKey) ?? 0;
  if (currentCount >= 1) {
    return {
      error: "EXCHANGE_LIMIT_REACHED",
      requires_escalation: true,
      message:
        "A second exchange on the same item requires human approval (§4.4). I'll escalate this to a support agent.",
    };
  }

  const order = findOrder(args.order_id);
  if (!order) {
    return { error: "ORDER_NOT_FOUND" };
  }

  const exchangeId = `EXC-${uuidv4().substring(0, 8).toUpperCase()}`;
  session.exchangeCount.set(exchangeKey, currentCount + 1);

  // Clear eligibility result
  session.lastEligibilityResult = null;

  return {
    success: true,
    exchange_id: exchangeId,
    order_id: args.order_id,
    sku: args.sku,
    new_size: args.new_size,
    status: "pending_pickup",
    message: `Exchange ${exchangeId} has been raised for size ${args.new_size}. Note: only size exchanges are supported (§4.1). If the requested size is unavailable, this will automatically convert to a refund. Free reverse pickup will be arranged within 24 hours.`,
    note: "Per §4.4, this item has now used its one allowed exchange. Any further exchange requests will require human approval.",
    next_steps: [
      "Keep the item packed with original tags",
      "Pickup window will be shared via SMS/email within 24 hours",
      "Track this exchange with ID: " + exchangeId,
    ],
  };
}

export async function handleEscalateToHuman(
  args: { summary: string; reason_code: string; priority: string },
  session: SessionData
): Promise<Record<string, unknown>> {
  const ticketId = `TKT-${uuidv4().substring(0, 6).toUpperCase()}`;
  const now = new Date().toISOString();

  return {
    success: true,
    ticket_id: ticketId,
    created_at: now,
    priority: args.priority,
    reason_code: args.reason_code,
    customer_id: session.verifiedCustomerId,
    customer_name: session.verifiedCustomerName,
    summary: args.summary,
    status: "open",
    next_steps:
      args.reason_code === "COD_BANK_DETAILS"
        ? "A human agent will reach out via a secure link to collect bank details within 1 business day."
        : args.priority === "high"
        ? "A human agent will review this within 2–4 business hours. You'll receive an email update."
        : "A human agent will review this within 1 business day. You'll receive an email update.",
    support_hours: "9:00 AM – 9:00 PM IST, 7 days a week",
  };
}

// ---- Dispatcher ----

export async function dispatchTool(
  toolName: string,
  args: Record<string, unknown>,
  session: SessionData
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case "verify_customer":
      return handleVerifyCustomer(args as { order_id: string; contact: string }, session);
    case "get_order":
      return handleGetOrder(args as { order_id: string }, session);
    case "list_orders_for_customer":
      return handleListOrdersForCustomer(args as { customer_id: string }, session);
    case "check_eligibility":
      return handleCheckEligibility(args as { order_id: string; sku: string }, session);
    case "initiate_return":
      return handleInitiateReturn(
        args as { order_id: string; sku: string; reason: string },
        session
      );
    case "initiate_exchange":
      return handleInitiateExchange(
        args as { order_id: string; sku: string; new_size: string },
        session
      );
    case "escalate_to_human":
      return handleEscalateToHuman(
        args as { summary: string; reason_code: string; priority: string },
        session
      );
    default:
      return { error: "UNKNOWN_TOOL", tool_name: toolName };
  }
}
