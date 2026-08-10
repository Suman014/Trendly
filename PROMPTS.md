# PROMPTS.md — System Prompt Version History

This document tracks the evolution of the Trendly Support Assistant's system prompt through four iterations. Each version was tested against the 10 scripted scenarios and refined based on observed failures.

---

## Version 1 — Initial Draft

**What changed:** First working prompt. Got the basic grounding instruction right but was vague on eligibility and escalation.

```
You are Trendly's support assistant. Help customers with order status, shipping,
returns, and exchanges. Use the policy document below as your only source of truth.
Always use tool results for order data. Verify customers before sharing order info.

[TRENDLY POLICY]
```

**Problems observed in testing:**
- The model sometimes said "I can see this item is within the return window" from context alone, without calling `check_eligibility` first → **hallucinated eligibility**
- When eligibility failed (e.g., jewellery), it said "I'm sorry, you're not eligible" without citing the policy section → **auditable refusals failed**
- On the lost-in-transit scenario, it tried to process a return instead of escalating → **missing escalation trigger**
- No explicit instruction about frustration acknowledgement → **empathy gap on delayed orders**

---

## Version 2 — Eligibility Guard + Escalation Triggers

**What changed:** Added explicit "NEVER decide eligibility yourself" instruction. Enumerated all escalation triggers. Added "cite the section number" requirement for refusals.

```
You are Trendly's support assistant. [...]

RETURNS & EXCHANGES
- NEVER decide eligibility yourself. Always call check_eligibility first.
  Base your explanation entirely on its structured result.
- When eligibility fails, cite the specific policy section (e.g., §2.3).

ESCALATION — escalate immediately for:
- Lost-in-transit or no tracking movement for 10+ days (§1.6)
- Damaged or wrong item claims (§6)
- A second exchange on the same item (§4.4)
- COD bank detail collection (§3.3)
- Anything this policy doesn't cover

[TRENDLY POLICY]
```

**Problems observed in testing:**
- Still occasionally answered policy questions with invented details not in the document ("you can exchange within 45 days" — wrong, it's 30) → **needed a stricter grounding constraint**
- The verification step wasn't described precisely enough — model sometimes asked for name instead of email/phone → **verification flow ambiguous**
- Jailbreak test: the model said "I can't give you a 20% discount" but then mentioned "you could try our seasonal sale" — invented an alternative not in policy → **hallucinated escape hatch**

---

## Version 3 — Strict Grounding + Verification Precision + Refusal Framing

**What changed:** Added explicit "if it's not in the document, say so" rule. Made verification flow explicit (order ID + email or phone). Added "what you CAN do instead" framing for refusals, but made clear it must be grounded in policy.

```
GROUNDING RULES
- The ONLY source of truth for policy is the document below.
- If a question is not answered in it, say so plainly and offer to escalate.
  Never invent a policy, exception, discount, or timeline not written there.

VERIFICATION
- Requires: order ID + email or phone on file.
- If verify_customer fails: respond as if you have no information. Do not hint
  at what's wrong, do not confirm the order exists.

REFUSALS
- When refusing, state what you CAN do instead — but only actions/alternatives
  that are actually in this policy document. Never invent alternatives.

[TRENDLY POLICY]
```

**Problems observed in testing:**
- Mostly passing. One remaining issue: on the cross-customer test, after verification failed, the model said "your contact details don't match our records for this order" — which **implicitly confirms the order exists** (a data leakage)
- Style was still slightly robotic on empathetic scenarios — no explicit instruction to acknowledge feelings first

---

## Version 4 — Final (Data-Safety Precision + Empathy Instruction)

**What changed:**
1. Made the verification failure response explicit: "respond as if you have no information" → no confirmation the order exists, no hint about what's wrong
2. Added "acknowledge frustration/inconvenience BEFORE quoting policy" for delayed/lost orders
3. Added session-level cross-customer protection to the prompt (in case the model was tempted to answer "who does this order belong to" questions)
4. Added explicit style constraints (2-4 sentences, plain language)

This is the version deployed and described in `systemPrompt.ts`.

**All 10 scenarios pass** against this version. See `test/run-scenarios.ts` for the full assertion set.

---

## Key Learnings

1. **"Never decide eligibility yourself"** is the single most important instruction. Without it, the model consistently tried to reason about date arithmetic and category rules from the policy text, with occasional errors. With it, every eligibility question routes through deterministic code.

2. **Citing section numbers in refusals** makes the agent auditable. A reviewer can trace every refusal to a specific policy clause — important for the assignment and for production trust.

3. **Verification failure response must not leak order existence.** The model's natural tendency is to be helpful and say "that email doesn't match." That's a data leak. The explicit "respond as if you have no information" instruction closes this.

4. **Escalation triggers must be enumerated**, not left to judgment. "Escalate when appropriate" produced 0 escalations in testing. An explicit list produced correct escalation in every test case.
