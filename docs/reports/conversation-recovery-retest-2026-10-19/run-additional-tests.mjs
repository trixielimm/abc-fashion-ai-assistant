import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = fileURLToPath(new URL("./", import.meta.url));
const evidenceDirectory = join(output, "docs", "test-evidence");
mkdirSync(evidenceDirectory, { recursive: true });
const results = [];
const suites = [
  "test-recommendation-api-validation.mjs",
  "test-search-filters-live.mjs",
  "test-prototype-specs-live.mjs",
  "test-outfit-budget-live.mjs",
  "test-stylist-commerce-live.mjs",
];

for (const suite of suites) {
  const record = { suite, started: new Date().toISOString() };
  const log = createWriteStream(join(output, `${suite}.log`));
  const child = spawn(process.execPath, [
    `--env-file=${join(root, ".env.local")}`,
    "--conditions=react-server",
    "--import", "tsx", join(root, "scripts", suite), "http://127.0.0.1:3000",
  ], { cwd: output, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  record.exit_code = await new Promise((resolve) => {
    child.on("error", error => { record.error = error.message; resolve(null); });
    child.on("exit", resolve);
  });
  await new Promise(resolve => log.end(resolve));
  record.finished = new Date().toISOString();
  record.pass = record.exit_code === 0;
  results.push(record);
  writeFileSync(join(output, "additional-tests.json"), JSON.stringify(results, null, 2));
  console.log(`${record.pass ? "PASS" : "FAIL"}: ${suite}`);
}

if (results.some(record => !record.pass)) process.exitCode = 1;
