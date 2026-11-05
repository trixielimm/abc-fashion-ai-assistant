import { spawnSync } from "node:child_process";

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";

import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

const outputDirectory = join(
  root,
  "docs",
  "test-evidence"
);

mkdirSync(outputDirectory, { recursive: true });

const started = new Date().toISOString();

const report = join(
  outputDirectory,
  `regression-${started.replace(/[:.]/g, "-")}.txt`
);

// Create a new report rather than overwriting an earlier run.
writeFileSync(report, "", { flag: "wx" });

function record(text) {
  console.log(text);
  appendFileSync(report, `${text}\n`);
}

const suites = [
  ["image-delivery", "test-image-delivery.ts"],
  ["product-images", "test-product-images.ts"],
  ["adaptive-reliability", "test-adaptive-reliability-fixes.mjs"],
  ["proactive-cross-sell", "test-proactive-cross-sell.mjs"],
  ["journey-remediation", "test-journey-remediation.mjs"],
  ["journey-harness", "test-stylist-journey-harness.mjs"],
  ["reactive-demo-fixes", "test-reactive-demo-fixes.mjs"],
  ["stylist-remediation", "test-stylist-remediation.mjs"],
  ["conversation-recovery", "test-conversation-recovery.mjs"],
  ["matching-set-budget", "test-matching-set-budget.mjs"],
  ["category-collection-defaults", "test-category-collection-defaults.mjs"],
  ["collection-first", "test-collection-first.mjs"],
  ["product-card-presentation", "test-product-card-presentation.mjs"],
  ["guided-discovery", "test-guided-discovery.mjs"],
  ["search-filters", "test-search-filters.mjs"],
  ["selected-outfit-review", "test-selected-outfit-review.mjs"],
  ["outfit-interface", "test-outfit-interface.mjs"],
  ["grouped-discovery-memory", "test-grouped-discovery-memory.mjs"],
  ["shared-outfit-budget", "test-outfit-budget.mjs"],
  ["customer-scenarios", "test-customer-scenario-regressions.mjs"],
  ["5,24", "test-preference-validation.ts"],
  ["9,24", "test-recommendation-contract.ts"],
  ["11,24", "test-grounded-recommendation.ts"],
  ["5,7,25", "test-validation-search.mjs"],
  ["16,17,19,24", "test-guided-follow-ups.mjs"],
  ["20,25", "test-cross-sell.mjs"],
  ["21,23,25", "test-cross-sell-client.mjs"],
  ["22,25", "test-upsell.mjs"],
  ["22,23,25", "test-upsell-client.mjs"],
  ["18,23,24", "test-chat-request.mjs"],
  ["9,20,22,24,25", "test-optional-discovery.mjs"],
  ["14,16,20,21,22,23,24,25", "test-card-actions.mjs"],
  ["16,17,18,19,24,25", "test-cheaper-search.mjs"],
  ["16,17,20,21,24,25", "test-viewed-product.mjs"],
  ["16,17,19,20,21,24,25", "test-conversation-foundation.mjs"],
  ["9,16,17,19,20,21,24,25", "test-conversation-plan.mjs"],
  ["9,10,12,16,17,18,19,20,21,22,24,25", "test-conversation-search.mjs"],
  ["9,10,16,17,19,23,24,25", "test-plan-evidence.mjs"],
  ["9,10,16,19,20,24,25", "test-plan-recovery.mjs"],
  ["9,10,16,17,18,19,20,24,25", "test-conversation-answers.mjs"],
  ["18,23,24,25", "test-conversation-production.mjs"],
  ["20,22,24,25", "test-stylist-commerce.mjs"],
  ["20,22,24,25", "test-stylist-feature-import.mjs"],
  ["20,22,24,25", "test-product-specifications.mjs"],
  ["18,23,24,25", "test-stylist-telemetry.mjs"],
["9,10,12,13,16,17,18,19,20,21,22,23,24,25", "test-conversation-integration.mjs"],
["9,13,14,15,16,18,19,20,21,22,24,25", "test-shopping-presentation.mjs"],
["15,18,19,20,21,22,24,25", "test-friendly-shopping-message.mjs"],
].map(([tasks, file]) => ({
  tasks,
  file,
  result: "NOT RUN",
}));

record("ABC Fashion - offline regression run");
record(`Started (UTC): ${started}`);
record(`Node: ${process.version}; platform: ${process.platform}`);

record(
  "Scope: listed offline test scripts only. No live/API/browser tests."
);

for (const suite of suites) {
  record(
    `\nRUN: ${suite.file} | Tasks ${suite.tasks}`
  );

  const script = join(root, "scripts", suite.file);

  if (!existsSync(script)) {
    suite.result = "FAIL";

    record(
      `Missing test file: scripts/${suite.file}`
    );

    process.exitCode = 1;
    break;
  }

  const args = ["--import", "tsx", script];

  if (["test-image-delivery.ts", "test-grounded-recommendation.ts", "test-conversation-production.mjs", "test-stylist-telemetry.mjs"].includes(suite.file)) {
    args.unshift("--conditions=react-server");
  }

  const child = spawnSync(process.execPath, args, {
    cwd: root,
    env: suite.file === "test-conversation-production.mjs"
      ? { ...process.env, NODE_ENV: "production" } : process.env,
    encoding: "utf8",
    timeout: 90_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });

  if (child.stdout?.trim()) {
    record(child.stdout.trimEnd());
  }

  if (child.stderr?.trim()) {
    record(child.stderr.trimEnd());
  }

  if (child.error) {
    record(`Execution error: ${child.error.message}`);
  }

  suite.result =
    !child.error && child.status === 0
      ? "PASS"
      : "FAIL";

  record(
    `${suite.result}: ${suite.file} (exit: ${child.status})`
  );

  if (suite.result === "FAIL") {
    process.exitCode = 1;
    break;
  }
}

record("\nSCRIPT SUMMARY");

for (const suite of suites) {
  record(`${suite.result}: ${suite.file}`);
}

const passed = suites.filter(
  (suite) => suite.result === "PASS"
).length;

record(
  `\n${passed}/${suites.length} test scripts completed successfully.`
);

record(`Finished (UTC): ${new Date().toISOString()}`);

record(
  "Not covered by this run: live stock, browser journeys, security audit, acceptance testing."
);

console.log(
  `Evidence saved: ${relative(root, report)}`
);
