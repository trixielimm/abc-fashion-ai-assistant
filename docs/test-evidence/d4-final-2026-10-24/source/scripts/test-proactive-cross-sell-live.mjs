// Live interpretation of fresh synthetic prompts and synthetic catalogue context.
// In-process integration: no shared database writes or saved conversation replay.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { proactiveJourneys } from "./fixtures/proactive-cross-sell-journeys.mjs";
import { rows, vocabulary } from "./fixtures/proactive-cross-sell.mjs";
import { runLiveJourney } from "./lib/stylist-journey-harness.mjs";
import { interpretConversation } from "../lib/ai/interpretConversation.ts";
import { finishConversationTurn, interpreterInput, shortcutPlan } from "../lib/stylist/conversationTurn.ts";

const directory = new URL("../docs/test-evidence/proactive-cross-sell-2026-10-21/", import.meta.url);
mkdirSync(directory, { recursive: true });
const began = new Date().toISOString();
const output = new URL(`live-synthetic-${began.replace(/[:.]/g, "-")}.json`, directory);
const sources = ["lib/stylist/proactiveCrossSell.ts", "lib/stylist/conversationProtocol.ts", "lib/stylist/conversationTurn.ts",
  "lib/stylist/conversationGrounding.ts", "lib/ai/interpretConversation.ts", "scripts/fixtures/proactive-cross-sell.mjs",
  "scripts/fixtures/proactive-cross-sell-journeys.mjs"];
const report = { started_at: began, scope: "Live model with isolated synthetic catalogue; in-process, not HTTP/browser. No database writes.",
  model: process.env.OPENAI_CONVERSATION_MODEL || "gpt-5.6-luna", cases: [], diagnostics: [],
  source_sha256: Object.fromEntries(sources.map(path => [path, createHash("sha256").update(readFileSync(new URL(`../${path}`, import.meta.url))).digest("hex")])) };
writeFileSync(output, JSON.stringify(report, null, 2), { flag: "wx" });
process.env.STYLIST_DIAGNOSTICS_ENABLED = "true";
const originalInfo = console.info;
console.info = (label, detail) => { if (label === "Stylist diagnostic") report.diagnostics.push(detail); else originalInfo(label, detail); };
for (const journey of proactiveJourneys) for (const variant of [1, 2, 3]) {
  const result = await runLiveJourney(journey, { base: "http://localhost:3000", variant,
    fetchImpl: async (_url, options) => {
      const { turn } = JSON.parse(options.body);
      const plan = shortcutPlan(turn) ?? await interpretConversation(interpreterInput(turn));
      return Response.json(finishConversationTurn(rows, turn, plan, vocabulary));
    } });
  report.cases.push(result);
  writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ id: journey.id, variant, status: result.status, failure: result.turns.at(-1)?.failure }));
}
report.finished_at = new Date().toISOString();
report.counts = Object.fromEntries(["AUTO_PASS", "FAIL", "ERROR", "BLOCKED_CATALOGUE"].map(status => [status,
  report.cases.filter(result => result.status === status).length]));
writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ counts: report.counts, output: output.pathname }));
if (report.counts.FAIL || report.counts.ERROR || report.counts.BLOCKED_CATALOGUE) process.exitCode = 1;
