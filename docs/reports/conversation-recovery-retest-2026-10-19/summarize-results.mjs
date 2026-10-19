import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../../../", import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const captures = read("browser-evidence.json");
const messages = captures.filter(record => record.prompt && !record.excluded_reason && record.flow !== "delivery-reproduction");
const expected = [
  /4 clothing options/, /Size 12 is listed/, /couldn't apply size: 999/, /2 clothing options/,
  /A\$265\.00/, /I found Olive Maxi Dress/, /I found Olive Maxi Dress/,
  /can't verify suitable for grass/, /Sage Ballet Flats/,
  /155\.00\s+selected A\$\s+125\.00\s+left of A\$\s+280\.00/,
  /0\.00\s+selected A\$\s+280\.00\s+left of A\$\s+280\.00/,
  /men's clothing, women's clothing, or both/, /White Denim Jacket/, /Grey Denim Jacket/,
  /A\$175\.00/, /3\s+pieces/,
  /4 clothing options/, /Size 12 is listed/, /A\$265\.00/, /I found Olive Maxi Dress/,
];
assert.equal(messages.length, 20);
const outcomes = messages.map((record, index) => {
  const captureIndex = captures.indexOf(record);
  const state = record.state.includes("Checking your request") ? captures[captureIndex + 1].state : record.state;
  const response = state.slice(state.lastIndexOf("AI STYLIST"));
  assert.match(response, expected[index], `${record.flow}: ${record.prompt}`);
  if ([5, 6, 19].includes(index)) assert.doesNotMatch(response, /Shoes options|Combined outfit budget/);
  if ([14, 15].includes(index)) assert.doesNotMatch(response, /Event dress code|Which formal event/);
  return { number: index + 1, flow: record.flow, prompt: record.prompt, observed_at: record.at, expected_pattern: expected[index].source, pass: true };
});
writeFileSync(new URL("browser-results.json", import.meta.url), JSON.stringify(outcomes, null, 2));
const transcripts = messages.map((record, index) => {
  const captureIndex = captures.indexOf(record);
  const state = record.state.includes("Checking your request") ? captures[captureIndex + 1].state : record.state;
  return `## ${index + 1}. ${record.flow}\n\n${record.prompt}\n\n\`\`\`text\n${state.slice(state.lastIndexOf("AI STYLIST"))}\n\`\`\`\n`;
});
writeFileSync(new URL("transcripts.md", import.meta.url), `# Browser retest transcripts\n\n19 October 2026 · Australia/Sydney. Accessibility captures of each completed response.\n\n${transcripts.join("\n")}`);

const verification = read("source-verification.json");
const hash = path => createHash("sha256").update(readFileSync(path)).digest("hex");
verification.final_verified_at = new Date().toISOString();
verification.source_changes_during_retest = Object.entries(verification.hashes).filter(([file, expectedHash]) => hash(new URL(file, root)) !== expectedHash).map(([file]) => file);
verification.fresh_build_id = readFileSync("/private/tmp/abc-fashion-retest.iTy5M0/.next/BUILD_ID", "utf8");
verification.isolated_source_differences = Object.entries(verification.hashes).filter(([file, expectedHash]) => hash(`/private/tmp/abc-fashion-retest.iTy5M0/${file}`) !== expectedHash).map(([file]) => file);
assert.deepEqual(verification.source_changes_during_retest, []);
assert.deepEqual(verification.isolated_source_differences, []);
writeFileSync(new URL("source-verification.json", import.meta.url), JSON.stringify(verification, null, 2));
const summary = {
  completed_at: new Date().toISOString(), original_report_regression_scripts: { passed: 41, total: 41 },
  original_report_browser_messages: { passed: outcomes.length, total: 20 },
  all_existing_test_scripts: { passed: 45, failed: 5, total: 50 },
  failed_scripts: ["test-customer-scenarios.mjs", "test-conversation-answers-live.mjs", "test-stylist-commerce-live.mjs", "test-outfit-budget-live.mjs", "test-prototype-specs-live.mjs"],
  real_model_scenarios: { passed_runs: 103, failed_runs: 11, blocked_runs: 0, total_runs: 114, passed_turns: 288, failed_turns: 15, total_turns: 303 },
  lint: "passed", webpack_build_including_typescript: "passed", application_source_changed: false,
  protected_source_changed: false, original_build_id: verification.current_build_id, fresh_build_id: verification.fresh_build_id,
  limitations: ["Live suites can stop at their first failing assertion; their later checks are unexecuted.", "Synthetic-fixture model scenarios are not HTTP or browser acceptance.", "The development-only API passed after using its required environment.", "A separate fresh-browser delivery recheck succeeded; scripted delivery failures are contextual or model-sensitive.", "Two wrong-tab harness submissions are preserved but excluded from the 20-message replay."],
};
writeFileSync(new URL("results.json", import.meta.url), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
