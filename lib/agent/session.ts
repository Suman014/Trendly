/**
 * In-memory session store for the Trendly Support Agent.
 *
 * LIMITATION: Not multi-instance safe. In production, replace with Redis or
 * a similar shared store. For this demo, a single server process is fine.
 */

import { EligibilityResult } from "./eligibility";

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolCallTrace {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface SessionData {
  /** Full conversation history in OpenAI message format */
  history: Message[];
  /** Set of order IDs that have been verified this session */
  verifiedOrders: Set<string>;
  /** The customer ID confirmed this session (only one customer per session) */
  verifiedCustomerId: string | null;
  /** Human-readable name for the UI verification bar */
  verifiedCustomerName: string | null;
  /**
   * Last eligibility result — used as a guard before allowing
   * initiate_return / initiate_exchange to proceed.
   * Reset after each return/exchange is initiated.
   */
  lastEligibilityResult: (EligibilityResult & { order_id: string; sku: string }) | null;
  /**
   * Per-item exchange count. Key: `${order_id}:${sku}`.
   * One exchange per item; second exchange requires human approval (§4.4).
   */
  exchangeCount: Map<string, number>;
  createdAt: number;
  lastActiveAt: number;
}

const sessions = new Map<string, SessionData>();

/** Session TTL: 2 hours of inactivity */
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

function createSession(): SessionData {
  return {
    history: [],
    verifiedOrders: new Set(),
    verifiedCustomerId: null,
    verifiedCustomerName: null,
    lastEligibilityResult: null,
    exchangeCount: new Map(),
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };
}

export function getSession(sessionId: string): SessionData {
  let session = sessions.get(sessionId);
  if (!session) {
    session = createSession();
    sessions.set(sessionId, session);
  }
  session.lastActiveAt = Date.now();
  return session;
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/** Periodically purge stale sessions (call on startup or via setInterval) */
export function purgeStaleSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActiveAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}
