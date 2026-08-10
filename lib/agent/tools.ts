/**
 * Tool schemas (JSON Schema) passed to the LLM for function calling.
 * These are the contracts between the LLM and the deterministic tool handlers.
 */

export const tools = [
  {
    type: "function" as const,
    function: {
      name: "verify_customer",
      description:
        "Verify that an order belongs to the customer who is chatting. Must be called before any order data is shared. Requires the order ID and either the email address or phone number on file for that order. Returns a boolean result — NEVER returns other customers' data.",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "The order ID to verify, e.g. TR-4530",
          },
          contact: {
            type: "string",
            description:
              "The email address or phone number the customer provides. Must match what's on file for this order.",
          },
        },
        required: ["order_id", "contact"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_order",
      description:
        "Return the full details of an order: status, carrier, tracking number, expected delivery, items (name, size, qty, price), and total. ONLY works if verify_customer was already called successfully for this order in the current session.",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "The order ID to retrieve, e.g. TR-4530",
          },
        },
        required: ["order_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_orders_for_customer",
      description:
        "Return a summary list of all orders for a verified customer. Use this when the customer asks about 'my orders' without specifying an order ID, after they've been verified.",
      parameters: {
        type: "object",
        properties: {
          customer_id: {
            type: "string",
            description: "The customer ID (e.g. C-100), retrieved from a prior verify_customer call.",
          },
        },
        required: ["customer_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "check_eligibility",
      description:
        "Deterministically check whether an item in an order is eligible for return or exchange. This is a pure function — no LLM judgment involved. You MUST call this before ever calling initiate_return or initiate_exchange. The result tells you exactly what action is allowed and why, citing the policy section.",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "The order ID, e.g. TR-4530",
          },
          sku: {
            type: "string",
            description: "The SKU of the specific item to check, e.g. TR-KRT-033",
          },
        },
        required: ["order_id", "sku"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "initiate_return",
      description:
        "Initiate a return for an eligible item. Can ONLY be called after check_eligibility returned eligible=true with action='return' in the same conversation chain, AND after the customer has explicitly confirmed they want to proceed. Creates a return record and calculates the refund timeline based on the payment method.",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "The order ID",
          },
          sku: {
            type: "string",
            description: "The SKU of the item being returned",
          },
          reason: {
            type: "string",
            description: "Reason for return as stated by the customer (e.g. 'wrong size', 'changed mind', 'quality issue')",
          },
        },
        required: ["order_id", "sku", "reason"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "initiate_exchange",
      description:
        "Initiate a size exchange for an eligible item. Can ONLY be called after check_eligibility returned eligible=true with action='return' or 'exchange_only' in the same conversation chain, AND after the customer has explicitly confirmed they want to proceed. Only size exchanges are supported — not colour or style changes.",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "The order ID",
          },
          sku: {
            type: "string",
            description: "The SKU of the item being exchanged",
          },
          new_size: {
            type: "string",
            description: "The new size the customer wants (e.g. 'L', 'XL', '43')",
          },
        },
        required: ["order_id", "sku", "new_size"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "escalate_to_human",
      description:
        "Escalate a conversation to a human support agent and generate a ticket. Use this for: lost-in-transit parcels, damaged or wrong item claims, a second exchange request on the same item, COD refund bank detail collection, anything the policy doesn't cover, and repeated customer frustration. The summary should be detailed enough for a human agent to act in under 10 seconds.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description:
              "A concise but complete summary: who the customer is, what order and item are involved, what the issue is, what was already told to the customer, and what's needed next.",
          },
          reason_code: {
            type: "string",
            enum: [
              "LOST_IN_TRANSIT",
              "DAMAGED_ITEM",
              "WRONG_ITEM",
              "SECOND_EXCHANGE",
              "COD_BANK_DETAILS",
              "POLICY_NOT_COVERED",
              "CUSTOMER_FRUSTRATION",
              "OTHER",
            ],
            description: "Categorisation of why this is being escalated",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Priority level: high for lost/damaged/wrong items, medium for policy gaps, low for general questions",
          },
        },
        required: ["summary", "reason_code", "priority"],
        additionalProperties: false,
      },
    },
  },
];
