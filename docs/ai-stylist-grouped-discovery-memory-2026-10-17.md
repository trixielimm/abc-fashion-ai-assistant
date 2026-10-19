# AI Stylist: grouped discovery and three-prompt memory

17 October 2026. Implemented and tested locally; not deployed.

## Customer-visible behaviour

The broad request “I want a dress and shoes for formal events, my budget for
both of them is 400 aud” now shows up to **three dress choices and three shoe
choices**, in separate groups. Missing type, colour and size preferences do not
block browsing and are not filled with invented preferences.

The shopper chooses **one product from each group**. The server checks that
every displayed combination fits the total; it does not interpret the six cards
as a purchase of six products or give each product its own A$400 allowance.

The real catalogue and browser checks returned:

| Dresses | Price | Shoes | Price |
| --- | ---: | --- | ---: |
| Cream Slip Dress, P1021 | A$75 | Red Block Heels, P1085 | A$60 |
| Sage Midi Dress, P1235 | A$135 | Grey Loafers, P1212 | A$90 |
| Pink Mini Dress, P1214 | A$160 | Blue Strappy Heels, P1138 | A$145 |

All nine one-dress/one-shoe combinations fit the allowance: **A$135–A$305**.
The reply states this range and explains choosing one from each group. The
records used by the live test mark the products available, in stock and Formal.

Optional follow-up questions appear **after** the product groups, for example:

> Would you like a particular dress style or colour? Do you have a preferred shoe style or heel height? You can also keep browsing these options.

They do not create a blocking clarification or require an answer. Already
specified preferences are retained; recently asked identical questions are not
repeated. A refinement such as “blue dresses, keep the shoes as they are” changes
the dress group only. Fewer than three eligible choices are shown when stock or
the shared budget does not support three safe alternatives.

Screenshots: [dress group and budget](test-evidence/grouped-discovery-dresses-2026-10-17.png),
[shoe group and optional questions](test-evidence/grouped-discovery-shoes-followups-2026-10-17.png).
The [accessibility transcript](test-evidence/grouped-discovery-browser-2026-10-17.txt)
records both groups and all six product IDs together.

## Memory and unclear intentions

The interpreter receives the last **three understood customer prompts and their
assistant replies**, rather than allowing unrecognised turns to displace useful
shopping context. The displayed chat still contains the full conversation.

Saved colour, size, occasion, total budget, component requirements and outfit
choices persist until the shopper changes them or starts New chat. Those
structured preferences do not expire just because a prompt leaves the raw
three-prompt history. The current result set and previous two result sets also
remain addressable by exact product names/IDs, with current catalogue details
checked again before answering.

For a genuinely unclear intention:

- The agent asks for clarification and returns no newly recommended products.
- Saved preferences, product context and outfit choices remain unchanged.
- The unclear exchange does not evict one of the three understood prompts.
- An existing pending task is retained, and a subsequent clear edit can resume
  the saved shopping task without requiring New chat.

The deterministic tests send **eight consecutive unintelligible edits** after
three understood prompts, then apply a clear budget change. The requirements,
history and product context survive every unclear edit. The live model scenario
also checks a confusing message followed by a flat-shoe refinement and a factual
question about an earlier dress.

## Implementation and problems corrected

`outfitBudgetSearch.ts` starts from a feasible complete set, then adds alternatives
in rounds, favouring different recorded product types and colours. It maintains
the sum of each group's highest price within the allowance. This makes all
displayed cross-group selections affordable without allocating arbitrary fixed
budgets to individual components.

The response protocol validates group membership, unique product IDs, per-piece
filters, minimum and maximum displayed combination totals, and the shared
allowance. The browser renders each group separately and uses that group's size
preferences. Interaction telemetry keeps a separate recommendation ID per group,
so six or twelve cards do not break the existing per-group position contract.

Memory limits and unclear-intent preservation are enforced in the domain and
client acceptance boundary, as well as described to the model. Earlier product
sets are included in reference resolution and authoritative answer checks.

Testing exposed and corrected these issues:

1. A duplicated dress-colour change could accidentally filter shoes to the same
   colour. Component constraints now have one authoritative representation.
2. “Keep both items” during a budget/filter edit could be interpreted as selecting
   ambiguous SKUs. Keeping requested components does not select products.
3. A model could omit an explicit beach-wedding occasion. Supported positive
   occasion phrases are now grounded in the customer's quoted request.
4. “Any colour” could produce an empty colour list rejected by the old schema.
   An empty preferred-colour set is supported, while clearing an existing
   restriction requires explicit permission. Empty removal operations are
   harmless no-ops; unsupported additions still require real labels.
5. A pairing explanation could confuse the discussed bag with its owned dress
   anchor. Pure product questions with explicit ordinals retain the target
   product; genuine comparisons and mixed search requests remain separate.
6. The last full fresh-model run treated “other” in a simple supported browsing
   phrase as an unknown product requirement. That complete narrow grammar now
   takes the normal refinement path directly. Additional qualifiers still go
   through the interpreter, so unknown requirements are not silently removed.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Offline regression suites on final code | **31/31 pass** | [Log](test-evidence/grouped-discovery-final-regression.txt) |
| New grouped discovery and memory checks | **14/14 pass**, included above | `scripts/test-grouped-discovery-memory.mjs` |
| Customer-scenario regression checks | **21/21 pass**, included above | `scripts/test-customer-scenario-regressions.mjs` |
| Existing outfit-budget checks | **17/17 pass**, included above | `scripts/test-outfit-budget.mjs` |
| Production HTTP, real model and public catalogue | **6/6 pass**, all HTTP 200 | [Recorded replies](test-evidence/outfit-budget-http-2026-10-17T12-12-06-792Z.json) |
| Production build including TypeScript | Pass | [Log](test-evidence/grouped-discovery-final-checks-build.txt) |
| ESLint | Pass | [Log](test-evidence/grouped-discovery-final-lint.txt) |
| Browser | Three dresses, three shoes, shared-budget range and optional questions verified | Screenshots above |
| Full fresh-model run: 25 cases × 3 repeats | **74 pass, 1 fail**, no blocked cases | [Summary](test-evidence/customer-scenarios-2026-10-17T12-11-29-199Z/summary.json) |
| New five-turn discovery/memory journey B5 in that fresh run | **3/3 pass** | Same summary and case transcripts |
| Affected necklace journey after its final fix | **3/3 fresh retests pass** | [Summary](test-evidence/customer-scenarios-2026-10-17T12-19-48-022Z/summary.json) |
| All scenarios through final domain/session code with recorded model plans | **75/75 replay checks pass** | [Summary](test-evidence/customer-scenarios-2026-10-17T12-23-01-315Z/summary.json) |

The production requests cover the original broad request, a nonsensical edit
with unchanged memory, an A$1 no-match total, restoration to A$400, a material
question about the first dress and a three-component outfit. The test independently
reads the 316-row public catalogue and verifies returned IDs, prices,
availability, stock and Formal occasion. It also checks that no cart mutation
occurs.

The fresh-model run executed 228 turns: 213 interpreted by the configured real
model (`gpt-5.6-luna`, low reasoning) and 15 handled by existing production
shortcuts. The sole failing case was S6-B run 1, turn 3: the model incorrectly
saved “other” as an unresolved requirement. Its focused three-repeat fresh
retest passed after the narrow browsing fix. The new B5 journey passed all three
fresh repeats, including colour refinement, unclear-intent retention, flat-shoe
refinement and an earlier exact-name product reference.

After the last narrow fix, every recorded scenario was re-executed through the
final production shortcuts, search, presentation and session state transitions.
That replay passed 75/75. It freezes the model plans; it is **not a new 75/75
fresh-model run**, and the original 74/75 result remains recorded. The replay
harness was corrected to execute current code instead of trusting cached
replies or cached session state. No further full fresh-model run followed the
last narrow grammar fix.

The [readable transcript report](ai-stylist-grouped-discovery-memory-transcripts-2026-10-17.md)
contains the three new B5 journeys and the three focused S6-B retests. All raw
plans, inputs, replies and states remain in the linked evidence directories.
Earlier pilot/intermediate evidence is also retained, including a provider
timeout and the failures that led to the corrections above. These attempts are
not counted as successful runs.

## Remaining boundaries

The supported multi-item request contains 2–4 named components and one maximum
AUD budget. Results are limited to three choices per component. The conservative
budget rule can omit an expensive alternative that would work with only some
other choices; every displayed combination is guaranteed to fit instead.

Variety uses recorded product types and colours. Visual coordination and
real-world fit still need human judgment. Product photos in this environment
showed the existing unavailable-photo placeholder. This change does not repair
photo assets or add long-term memory across browser restarts.

Source fingerprint: [164-file manifest](test-evidence/grouped-discovery-source-manifest-2026-10-17.json),
SHA-256 `1ac2326ae9628bb5612560022feef6d0cfc7cd58530363347c36e7772214a8bb`.
