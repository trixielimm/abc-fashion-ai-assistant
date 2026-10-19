import { readFileSync, writeFileSync } from "node:fs";
import { interpretConversation } from "../../../lib/ai/interpretConversation.ts";
import { acceptReply, makeTurn } from "../../../lib/stylist/conversationProtocol.ts";
import { interpreterInput, finishConversationTurn } from "../../../lib/stylist/conversationTurn.ts";
import { allCollectionSession } from "../../../scripts/fixtures/collection-session.mjs";

const root = new URL("../../../", import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const evidence = read("docs/test-evidence/answers-live-2026-10-19T07-30-51-298Z.json");
let state = allCollectionSession();
for (const record of evidence.checks.slice(0, 2)) {
  state = acceptReply(makeTurn(state, record.message), record.reply).session;
}
const request = interpreterInput(makeTurn(state, "Can this arrive by Friday?"));
const plan = await interpretConversation(request);
const results = [{ name: "Delivery after product explanation", plan }];
console.log("DELIVERY RESULT", JSON.stringify(plan));

const directory = "docs/test-evidence/customer-scenarios-2026-10-19T07-30-48-350Z/";
const fixtures = read(`${directory}fixtures.json`);
for (const [id, repeat, number] of [["S5-B", 1, 1], ["S5-B", 1, 2], ["SET-A", 1, 2]]) {
  const run = read(`${directory}${id}-run-${repeat}.json`);
  const turn = run.turns[number - 1];
  const rows = id.startsWith("SET-") ? fixtures.matchingSetCatalogue : fixtures.fixtures[id];
  const vocabulary = { rows, sizes: [...new Set(rows.flatMap(product => product.sizes_available))], categories: rows.flatMap(product => [{ category: product.category, subcategory: null }, { category: product.category, subcategory: product.subcategory }]) };
  const replay = finishConversationTurn(rows, turn.input, turn.plan, vocabulary);
  const record = {
    id, repeat, number, message: turn.message, recorded_plan: turn.plan,
    replay_status: replay.status, replay_message: replay.message,
    applied_preferences: replay.applied_preferences,
    products: replay.products.map(product => product.product_id),
    issues: replay.issues,
  };
  if (id === "SET-A") {
    const explicitAnchor = structuredClone(turn.plan);
    explicitAnchor.reference = { kind: "id", value: "SET-JACKET" };
    const comparison = finishConversationTurn(rows, turn.input, explicitAnchor, vocabulary);
    record.explicit_anchor_comparison = { status: comparison.status, products: comparison.products.map(product => product.product_id), issues: comparison.issues };
  }
  results.push(record);
  console.log("REPLAY", JSON.stringify(record));
}
writeFileSync(new URL("diagnosis.json", import.meta.url), JSON.stringify(results, null, 2));
