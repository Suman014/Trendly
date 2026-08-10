/**
 * Agent loop — the core of the orchestration.
 *
 * Flow per request:
 *  1. Parse session cookie (or create new session)
 *  2. Append user message to session history
 *  3. Call LLM with system prompt + history + tool schemas
 *  4. If LLM returns tool_calls:
 *     a. Execute each tool via dispatchTool
 *     b. Append tool call + results to history
 *     c. Append tool calls to this-turn trace
 *     d. Loop back to step 3
 *  5. When LLM returns a text response, return it alongside the tool call trace
 *
 * The response includes:
 *  - message: the assistant's text response
 *  - toolCallTrace: the sequence of tool calls made this turn (for TracePanel)
 *  - sessionMeta: verification state for the top bar UI
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { getSession, purgeStaleSessions, ToolCallTrace, Message } from "@/lib/agent/session";
import { callLLM } from "@/lib/llm/client";
import { dispatchTool } from "@/lib/agent/toolHandlers";
import { buildSystemPrompt } from "@/lib/agent/systemPrompt";

/** Max tool call iterations per turn to prevent runaway loops */
const MAX_TOOL_ITERATIONS = 8;

export async function POST(req: NextRequest) {
  try {
    // Periodically clean up stale sessions
    purgeStaleSessions();

    // Session management via cookie
    const cookieStore = await cookies();
    let sessionId = cookieStore.get("trendly_session")?.value;
    const isNewSession = !sessionId;
    if (!sessionId) {
      sessionId = uuidv4();
    }

    const session = getSession(sessionId);
    const body = await req.json();
    const userMessage: string = body.message;

    if (!userMessage || typeof userMessage !== "string") {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    // Initialize history with system prompt on first turn
    if (session.history.length === 0) {
      session.history.push({
        role: "system",
        content: buildSystemPrompt(),
      });
    }

    // Append user message
    session.history.push({
      role: "user",
      content: userMessage,
    });

    // ---- Agent loop ----
    const toolCallTrace: ToolCallTrace[] = [];
    let iterations = 0;

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      const llmResponse = await callLLM(session.history);

      if (llmResponse.type === "text") {
        // Final answer — append to history and return
        const assistantMessage: Message = {
          role: "assistant",
          content: llmResponse.text ?? "",
        };
        session.history.push(assistantMessage);

        const response = NextResponse.json({
          message: llmResponse.text,
          toolCallTrace,
          sessionMeta: {
            verifiedCustomerId: session.verifiedCustomerId,
            verifiedCustomerName: session.verifiedCustomerName,
          },
        });

        // Set or refresh session cookie
        if (isNewSession) {
          response.cookies.set("trendly_session", sessionId, {
            httpOnly: true,
            sameSite: "lax",
            maxAge: 60 * 60 * 2, // 2 hours
            path: "/",
          });
        }

        return response;
      }

      // Tool calls to execute
      if (!llmResponse.tool_calls || llmResponse.tool_calls.length === 0) {
        break;
      }

      // Append the assistant's tool-call message to history
      session.history.push({
        role: "assistant",
        content: null,
        tool_calls: llmResponse.tool_calls,
      });

      // Execute each tool call
      for (const toolCall of llmResponse.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        const result = await dispatchTool(toolCall.function.name, args, session);

        // Append tool result to history
        session.history.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
          name: toolCall.function.name,
        });

        // Add to this-turn trace for the TracePanel
        toolCallTrace.push({
          id: toolCall.id,
          name: toolCall.function.name,
          args,
          result,
        });
      }
    }

    // Fallback if loop exhausted without a text response
    return NextResponse.json({
      message:
        "I'm sorry, I wasn't able to complete that request. Could you try rephrasing, or would you like me to connect you with a human agent?",
      toolCallTrace,
      sessionMeta: {
        verifiedCustomerId: session.verifiedCustomerId,
        verifiedCustomerName: session.verifiedCustomerName,
      },
    });
  } catch (error) {
    console.error("Agent loop error:", error);
    const message =
      error instanceof Error && error.message.includes("OPENROUTER_API_KEY")
        ? error.message
        : "Something went wrong on our end. Please try again in a moment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
