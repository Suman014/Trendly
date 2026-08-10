/**
 * LLM client — OpenRouter (OpenAI-compatible API).
 *
 * Why OpenRouter?
 *  - Single API key, access to 100+ models
 *  - OpenAI-compatible format → native tool calling support
 *  - No per-model daily quota issues (pay-per-token or free tier models)
 *  - Fast inference via edge routing to the best available provider
 *
 * We use google/gemini-2.0-flash-exp:free for zero-cost with tool calling.
 * Fallback to meta-llama/llama-3.1-8b-instruct:free if needed.
 */

import { Message, ToolCall } from "../agent/session";
import { tools } from "../agent/tools";

export interface LLMResponse {
  type: "text" | "tool_calls";
  text?: string;
  tool_calls?: ToolCall[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.LLM_MODEL ?? "google/gemini-2.5-flash";

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to your .env.local file:\nOPENROUTER_API_KEY=your_key_here"
    );
  }
  return key;
}

export async function callLLM(messages: Message[], retries = 3): Promise<LLMResponse> {
  const apiKey = getApiKey();

  // Convert our internal Message format to OpenAI-compatible format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openaiMessages = messages.map((m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg: any = { role: m.role, content: m.content };
    if (m.tool_calls) msg.tool_calls = m.tool_calls;
    if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
    if (m.name) msg.name = m.name;
    return msg;
  });

  const body = {
    model: MODEL,
    messages: openaiMessages,
    tools: tools,
    tool_choice: "auto",
    temperature: 0.2,
    max_tokens: 800,
  };

  try {
    const response = await fetch(OPENROUTER_BASE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://trendly.app",
        "X-Title": "Trendly Support Agent",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const statusCode = response.status;

      // Rate limit — retry
      if (statusCode === 429 && retries > 0) {
        const waitMs = 5000;
        console.warn(`[LLM] Rate limit hit — waiting ${waitMs / 1000}s then retrying (${retries} left)`);
        await new Promise((r) => setTimeout(r, waitMs));
        return callLLM(messages, retries - 1);
      }

      throw new Error(`OpenRouter API error ${statusCode}: ${errorText.slice(0, 500)}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      return { type: "text", text: "" };
    }

    const message = choice.message;

    // Check for tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCalls: ToolCall[] = message.tool_calls.map((tc: { id: string; type: string; function: { name: string; arguments: string } }) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));
      return {
        type: "tool_calls",
        tool_calls: toolCalls,
        usage: data.usage
          ? {
              prompt_tokens: data.usage.prompt_tokens,
              completion_tokens: data.usage.completion_tokens,
            }
          : undefined,
      };
    }

    // Text response
    return {
      type: "text",
      text: message.content ?? "",
      usage: data.usage
        ? {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  } catch (err: unknown) {
    // Retry on network/rate limit errors
    const isRetryable =
      err instanceof Error &&
      (err.message.includes("429") ||
       err.message.includes("rate") ||
       err.message.includes("ECONNRESET") ||
       err.message.includes("fetch failed"));
    if (isRetryable && retries > 0) {
      const waitMs = 3000;
      console.warn(`[LLM] Error, retrying in ${waitMs / 1000}s (${retries} left): ${(err as Error).message.slice(0, 100)}`);
      await new Promise((r) => setTimeout(r, waitMs));
      return callLLM(messages, retries - 1);
    }
    throw err;
  }
}
