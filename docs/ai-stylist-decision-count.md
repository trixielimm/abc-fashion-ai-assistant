# How many decisions sit behind request understanding?

Audited 31 October 2026 against the current working tree, based on commit `85d4f1b` with local edits. This is a static source audit, not a trace of one live message or a measurement of the deployed site.

## Presentation wording

**250+ coded conditional checks behind request understanding.**

Suggested narration:

> We combine AI language understanding with over 250 coded conditional checks to interpret intent, preserve preferences, resolve product references and handle uncertainty.

Small-print qualifier:

> Static count: 271 if statements across six core functions. Different messages take different paths.

## What was counted

The TypeScript parser identified **271 explicit `if` statements** in six functions used to interpret or validate a shopping request:

- **38** in [shortcutPlan](/Users/salvi/MQ/abc-fashion-ai-assistant/lib/stylist/conversationTurn.ts:32): recognise supported requests and choose a plan.
- **112** in [groundConversationPlan](/Users/salvi/MQ/abc-fashion-ai-assistant/lib/stylist/conversationGrounding.ts:57): ground intent, references and literal constraints.
- **95** in [checkConversationPlan](/Users/salvi/MQ/abc-fashion-ai-assistant/lib/stylist/conversationPlan.ts:99): validate intent, evidence and proposed state changes.
- **7** in [composePreferences](/Users/salvi/MQ/abc-fashion-ai-assistant/lib/stylist/preferenceScope.ts:102): reconcile item preferences with shared restrictions.
- **3** in [resolveProductReference](/Users/salvi/MQ/abc-fashion-ai-assistant/lib/stylist/productReference.ts:123): resolve which product the customer means.
- **16** in [prepareConversationTask](/Users/salvi/MQ/abc-fashion-ai-assistant/lib/stylist/taskState.ts:61): prepare context, task changes and recovery.

These same function bodies contain another **152 ternary expressions** (`condition ? value : otherValue`), yielding **423 conditional code sites** if both forms are included. The presentation headline uses only the more conservative `if` count. Some ternaries select defaults or representations rather than distinct shopping rules.

## Counting method and limits

Each `IfStatement` AST node inside a scoped function body is counted once, including nested helper/callback bodies. A compound condition such as `if (A && B && C)` counts as one `if` statement, not three. An `else if` contains its own `if` node and counts once. Ordinary `else` outcomes are not added. Loops and repeated validator calls do not multiply a source location.

Comments, prompt text, tests, schema fields, boolean subexpressions and loop-control conditions are excluded. Retrieval/ranking, product availability checks, response formatting, HTTP handling and browser UI code are outside this six-function tally.

An explicit conditional site is not necessarily an independent business rule. Several checks can protect one requirement or overlap across validation layers. The number is not a count of trained machine-learning decision trees, model reasoning steps, or model API calls. It does not mean every request executes 271 checks. Paths can return early, and repeated calls or loops can execute some sites several times. Runtime counts would need separate instrumentation.

The previously documented **104 branches** were entries in a hand-organised architecture map. They used a different unit and scope, so they should not be presented as a runtime decision count or compared directly to this audit.

## Reproduce the count

```sh
node scripts/count-stylist-decisions.mjs
```

The script reports each function, source lines, file SHA-256 hashes and the base Git commit. It reads local source only and makes no model or database calls.

[Saved machine-readable audit](./ai-stylist-decision-audit-2026-10-31.json)
