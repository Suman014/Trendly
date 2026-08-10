/**
 * Scenario runner — hits the local /api/chat endpoint and checks
 * that expected tool calls were made and expected keywords appear in responses.
 *
 * Usage: npx ts-node test/run-scenarios.ts
 * (Server must be running on localhost:3000)
 */

import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

interface Turn {
  user: string;
  expected_tool_calls?: string[];
  expected_keywords?: string[];
  expected_keywords_absent?: string[];
}

interface Scenario {
  id: string;
  description: string;
  turns: Turn[];
}

interface ToolCallTrace {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

interface ApiResponse {
  message: string;
  toolCallTrace: ToolCallTrace[];
  sessionMeta: { verifiedCustomerId: string | null; verifiedCustomerName: string | null };
}

// ---- Colour helpers ----
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function pass(msg: string) { console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function fail(msg: string) { console.log(`  ${RED}✗${RESET} ${msg}`); }
function info(msg: string) { console.log(`  ${YELLOW}→${RESET} ${msg}`); }

function containsKeyword(text: string, keyword: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

async function runScenario(scenario: Scenario): Promise<{ passed: number; failed: number }> {
  console.log(`\n${BOLD}${CYAN}[${scenario.id}]${RESET} ${scenario.description}`);

  // Each scenario gets a fresh session
  const sessionCookie: string[] = [];
  let passed = 0;
  let failed = 0;

  // Delay between turns to avoid burning TPM (configurable via TURN_DELAY_MS env)
  const turnDelayMs = parseInt(process.env.TURN_DELAY_MS ?? "2000", 10);

  for (let i = 0; i < scenario.turns.length; i++) {
    if (i > 0) {
      // Small delay between turns within a scenario
      await new Promise((r) => setTimeout(r, turnDelayMs));
    }

    const turn = scenario.turns[i];
    console.log(`\n  ${YELLOW}Turn ${i + 1}:${RESET} "${turn.user}"`);

    let response: ApiResponse;
    try {
      const cookieHeader = sessionCookie.join("; ");
      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        body: JSON.stringify({ message: turn.user }),
      });

      // Capture set-cookie for session continuity
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) {
        const match = setCookie.match(/trendly_session=([^;]+)/);
        if (match) {
          const idx = sessionCookie.findIndex((c) => c.startsWith("trendly_session="));
          if (idx >= 0) sessionCookie[idx] = `trendly_session=${match[1]}`;
          else sessionCookie.push(`trendly_session=${match[1]}`);
        }
      }

      response = await res.json() as ApiResponse;
    } catch (err) {
      fail(`Request failed: ${err}`);
      failed++;
      continue;
    }

    const responseText = response.message ?? "";
    const toolNames = (response.toolCallTrace ?? []).map((t) => t.name);

    info(`Response (first 120 chars): "${responseText.substring(0, 120).replace(/\n/g, " ")}..."`);
    info(`Tools called: [${toolNames.join(", ") || "none"}]`);

    // Check expected tool calls
    if (turn.expected_tool_calls && turn.expected_tool_calls.length > 0) {
      for (const expectedTool of turn.expected_tool_calls) {
        if (toolNames.includes(expectedTool)) {
          pass(`Tool called: ${expectedTool}`);
          passed++;
        } else {
          fail(`Expected tool call "${expectedTool}" but got: [${toolNames.join(", ")}]`);
          failed++;
        }
      }
    }

    // Check expected keywords in response
    if (turn.expected_keywords) {
      for (const keyword of turn.expected_keywords) {
        if (containsKeyword(responseText, keyword)) {
          pass(`Response contains: "${keyword}"`);
          passed++;
        } else {
          fail(`Response missing keyword: "${keyword}"`);
          failed++;
        }
      }
    }

    // Check absent keywords (data leakage, hallucinations)
    if (turn.expected_keywords_absent) {
      for (const keyword of turn.expected_keywords_absent) {
        if (!containsKeyword(responseText, keyword)) {
          pass(`Response correctly omits: "${keyword}"`);
          passed++;
        } else {
          fail(`Response contains forbidden keyword: "${keyword}" (data leakage or hallucination)`);
          failed++;
        }
      }
    }
  }

  return { passed, failed };
}

async function main() {
  const scenariosDir = path.join(__dirname, "scenarios");
  const files = fs.readdirSync(scenariosDir).filter((f) => f.endsWith(".json"));

  console.log(`${BOLD}Trendly Agent — Scenario Test Runner${RESET}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Scenarios: ${files.length}`);
  console.log(`${"─".repeat(60)}`);

  // Quick connectivity check
  try {
    const ping = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    if (!ping.ok && ping.status !== 200) {
      throw new Error(`Server returned ${ping.status}`);
    }
  } catch (err) {
    console.error(
      `${RED}Cannot reach ${BASE_URL}/api/chat — is the server running? (npm run dev)${RESET}\n`,
      err
    );
    process.exit(1);
  }

  let totalPassed = 0;
  let totalFailed = 0;
  const scenarioDelayMs = parseInt(process.env.SCENARIO_DELAY_MS ?? "3000", 10);

  for (let si = 0; si < files.length; si++) {
    if (si > 0) {
      await new Promise((r) => setTimeout(r, scenarioDelayMs));
    }
    const scenario: Scenario = JSON.parse(
      fs.readFileSync(path.join(scenariosDir, files[si]), "utf-8")
    );
    const { passed, failed } = await runScenario(scenario);
    totalPassed += passed;
    totalFailed += failed;
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(
    `${BOLD}Results: ${GREEN}${totalPassed} passed${RESET}${BOLD}, ${RED}${totalFailed} failed${RESET}${BOLD} out of ${totalPassed + totalFailed} assertions${RESET}`
  );

  if (totalFailed > 0) {
    console.log(`${RED}${BOLD}SOME TESTS FAILED${RESET}`);
    process.exit(1);
  } else {
    console.log(`${GREEN}${BOLD}ALL TESTS PASSED${RESET}`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
