# Trendly Support Assistant

An agentic customer support chat assistant for Trendly, a direct-to-consumer fashion retailer. Built for the Yellow.ai FDE Intern screening assignment.

**Live URL:** _Deploy to Vercel and add URL here_

---

## Quick Start

### 1. Clone & install

```bash
cd trendly-agent
npm install
```

### 2. Set your API key

```bash
cp .env.local.example .env.local
# Then edit .env.local and add your GROQ_API_KEY
```

Get a free Groq API key at [console.groq.com](https://console.groq.com) — no credit card needed.

**.env.local contents:**
```
GROQ_API_KEY=gsk_your_key_here
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Run test scenarios

With the dev server running in one terminal:

```bash
npm run test:scenarios
```

This runs 10 scripted multi-turn conversations against the live API and reports pass/fail on ~40 assertions.

---

## Deployment (Vercel)

```bash
npm install -g vercel
vercel --prod
```

Add `GROQ_API_KEY` in the Vercel dashboard → Settings → Environment Variables.

---

## Project Structure

```
trendly-agent/
├── app/
│   ├── api/chat/route.ts        # Agent loop: LLM + tool dispatch
│   ├── page.tsx                 # Chat UI shell
│   ├── layout.tsx               # Fonts, metadata
│   └── globals.css              # Design tokens + all component CSS
├── lib/
│   ├── agent/
│   │   ├── systemPrompt.ts      # Master system prompt (policy injected at boot)
│   │   ├── tools.ts             # Tool schemas passed to the LLM
│   │   ├── toolHandlers.ts      # Deterministic tool implementations
│   │   ├── eligibility.ts       # Pure policy-rule engine (unit-testable)
│   │   └── session.ts           # In-memory session store
│   ├── data/
│   │   ├── orders.json          # 10 fixed orders (load as-is)
│   │   └── trendly_policy.md    # Policy document (injected verbatim)
│   └── llm/client.ts            # Provider-agnostic LLM wrapper (Groq default)
├── components/
│   ├── ChatWindow.tsx           # Message list, bubble, typing indicator
│   ├── OrderCard.tsx            # Structured order card UI
│   ├── EligibilityBadge.tsx     # Color-coded eligibility result
│   ├── EscalationBanner.tsx     # Escalation callout with ticket ID
│   └── TracePanel.tsx           # Live tool call trace (collapsible)
├── test/
│   ├── scenarios/               # 10 scripted conversation JSON files
│   └── run-scenarios.ts         # Test runner
├── README.md
├── PROMPTS.md
├── SOLUTION.md
├── SOLUTION.pdf
└── SOLUTION_NOTE.md
```

---

## AI Usage

This project was built with Antigravity (Google DeepMind) as a coding assistant. Here's what was AI-generated vs. human-written:

| Component | Origin |
|---|---|
| Initial tool schemas (first draft) | AI-generated |
| Tool handler implementations | Human-written and reviewed |
| `eligibility.ts` (rule engine) | Human-written — deterministic code, no AI |
| System prompt v1 | AI-drafted from the roadmap brief |
| System prompt v2–v4 | Human-iterated after testing edge cases |
| UI component structure | AI-scaffolded |
| CSS design tokens and palette | Human-designed |
| Test scenarios | Human-written against the spec |
| SOLUTION_NOTE.md | Human-written |

All code was reviewed and understood before submission. The eligibility engine, verification gating, and action guards were written by hand because they are the core correctness guarantees — errors there would be invisible if they were just generated and not reasoned through.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Free API key from console.groq.com |
| `LLM_MODEL` | No | Override model (default: `llama-3.3-70b-versatile`) |
