import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JOURNEYS, EVERYDAY_IDS, PACK_VERSION } from './fixtures/stylist-journeys.mjs';
import { packSourceHash, runLiveJourney, runFaultJourney, validatePack, fingerprint } from './lib/stylist-journey-harness.mjs';

const root = new URL('../', import.meta.url);
const liveCount = JOURNEYS.filter(journey => journey.mode === 'live').length;
const faultCount = JOURNEYS.length - liveCount;
const usage = `Usage: node --import tsx scripts/run-stylist-journeys.mjs [options]
  --suite everyday|prerelease  ${EVERYDAY_IDS.length} everyday or all ${JOURNEYS.length} journeys (default everyday)
  --base http://localhost:3000  Running local app (live mode only)
  --filter J18,J32            Select IDs within the suite
  --variant 1|2|3|all         Opening wording; follow-ups stay fixed (default 1)
  --repeat 1..20              Fresh independent trials per live wording (default 1)
  --timeout-ms 100..300000    Per-turn HTTP deadline (default 120000)
  --output PATH              New evidence directory; never overwrite an old run
  --list                     Print the selected journeys without any requests
  --check                    Validate the pack, with no requests or model calls
  --write-guide              Regenerate docs/ai-stylist-journey-pack.md
  --help                     Show this help

Live journeys call the real model/catalogue through the local app and incur API
usage. Recovery journeys use controlled local faults and make no model calls.
Exit codes: 0 automated checks passed, 1 failure/error, 2 catalogue blockers.
An automated pass still requires the listed human reviews before release.`;

export function parseOptions(args) {
  const options = { suite: 'everyday', base: 'http://127.0.0.1:3000', variant: '1', repeat: 1, timeoutMs: 120_000 };
  const valueFlags = new Map([['--suite', 'suite'], ['--base', 'base'], ['--variant', 'variant'], ['--repeat', 'repeat'],
    ['--timeout-ms', 'timeoutMs'], ['--filter', 'filter'], ['--output', 'output']]);
  const booleanFlags = new Map([['--list', 'list'], ['--check', 'check'], ['--write-guide', 'writeGuide'], ['--help', 'help']]);
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (booleanFlags.has(flag)) { options[booleanFlags.get(flag)] = true; continue; }
    if (!valueFlags.has(flag)) throw new Error(`Unknown option: ${flag}`);
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    options[valueFlags.get(flag)] = value;
  }
  if (!['everyday', 'prerelease'].includes(options.suite)) throw new Error('Suite must be everyday or prerelease.');
  if (!['1', '2', '3', 'all'].includes(options.variant)) throw new Error('Variant must be 1, 2, 3 or all.');
  options.repeat = Number(options.repeat); options.timeoutMs = Number(options.timeoutMs);
  if (!Number.isInteger(options.repeat) || options.repeat < 1 || options.repeat > 20) throw new Error('Repeat must be an integer from 1 to 20.');
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 100 || options.timeoutMs > 300_000) throw new Error('Invalid timeout-ms.');
  const base = new URL(options.base);
  if (base.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) ||
      base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('Base must be a plain local HTTP origin, for example http://127.0.0.1:3000.');
  }
  options.base = base.origin;
  if (options.filter) {
    options.ids = options.filter.split(',');
    for (const id of options.ids) {
      if (!JOURNEYS.some(journey => journey.id === id)) throw new Error(`Unknown journey ID: ${id}`);
      if (options.suite === 'everyday' && !EVERYDAY_IDS.includes(id)) throw new Error(`${id} belongs to prerelease; use --suite prerelease.`);
    }
  }
  return options;
}

export function selectJourneys(options) {
  return JOURNEYS.filter(journey => (options.suite === 'prerelease' || journey.everyday) && (!options.ids || options.ids.includes(journey.id)));
}

export function manualGuide() {
  const lines = [
    '# AI Stylist: everyday and pre-release journey pack', '',
    '<!-- Generated from scripts/fixtures/stylist-journeys.mjs and proactive-cross-sell-journeys.mjs. Regenerate with npm run test:journeys:guide. -->', '',
    `This pack contains **${JOURNEYS.length} journeys**: ${liveCount} live HTTP conversations and ${faultCount} controlled recovery tests. The **${EVERYDAY_IDS.length} everyday journeys are a subset**, not ${EVERYDAY_IDS.length} additional cases. Each live journey has three opening wordings; these are variants of the same journey, not separate journeys.`, '',
    '## Run later', '',
    'Start the app in one terminal with `npm run dev`. Configure the server using `.env.local` as described in README.md. In another terminal, run:', '',
    '```sh', 'npm run test:journeys:everyday', 'npm run test:journeys:prerelease', '```', '',
    'These commands make real model calls through the running local app. They read catalogue data and do not add items to the cart, buy products, change inventory, or call recommendation analytics. HTTP testing does not verify browser rendering.', '',
    'Useful options:', '',
    '```sh',
    '# Inspect the pack without making requests.',
    'npm run test:journeys:prerelease -- --list',
    '# Use a different local app port.',
    'npm run test:journeys:everyday -- --base http://127.0.0.1:3002',
    '# Diagnose a clarification loop with five independent runs.',
    'npm run test:journeys:prerelease -- --filter J18,J32 --repeat 5',
    '# Focus on new recommendation coverage in each suite.',
    'npm run test:journeys:everyday -- --filter J51,J52,J53',
    'npm run test:journeys:prerelease -- --filter J51,J52,J53,J54 --variant all',
    '# Broader pre-release benchmark: three openings, three trials each.',
    'npm run test:journeys:prerelease -- --variant all --repeat 3',
    '# Only the five controlled recovery cases; no app or credentials needed.',
    'npm run test:journeys:prerelease -- --filter J46,J47,J48,J49,J50',
    '```', '',
    `The default runs one primary wording once: ${EVERYDAY_IDS.length} live conversations for everyday; ${liveCount} live conversations plus five controlled fault cases for pre-release. All variants with three repeats run **${liveCount * 9} live conversations plus five fault cases**. Fault cases run once because repeating wording does not apply to them. Cases execute sequentially to limit API load; each conversation starts fresh.`, '',
    '## How to read results', '',
    '- **AUTO_PASS:** explicit automated assertions passed. Human review remains PENDING.',
    '- **FAIL:** a requested state, response, product constraint, or recovery assertion failed.',
    '- **ERROR:** transport/provider/server failure prevented evaluation. It is included in attempted trials, not treated as a pass.',
    '- **BLOCKED_CATALOGUE:** too few results (including no_match) prevented a required shortlist or reference. Inspect the catalogue to distinguish an inventory limit from a search bug; this is not a pass.',
    '- Dependent turns stop at the first failure or blocker. Their number is recorded; they are never fabricated or counted as executed.', '',
    'Exit code 0 means all selected automated cases passed, 1 means a failure/error, and 2 means unresolved catalogue blockers without other failures. No exit code certifies human styling approval or production readiness.', '',
    'A new timestamped directory under `docs/test-evidence/stylist-journeys/` contains `summary.json`, one JSON transcript per trial, and `review.md`. Evidence includes request IDs, requests, parsed replies, saved state, durations, code commit, source hashes, and configuration. The server model ID is only recorded if supplied in the runner environment; verify it matches the app server. No hidden model reasoning or environment secrets are collected. Review files contain catalogue product text; keep their contents within your normal repository/data handling rules.', '',
    '## Manual browser execution', '',
    'Start a **New chat** for each journey. Use wording 1 on the first run, then wordings 2 and 3 on separate runs. Send follow-ups one at a time. Replace each placeholder with the actual returned field: `{{dress.product_name}}` is the recorded product name and `{{dress.extra_target}}` is its recorded complementary category. Record the product ID from the response. Never invent a product or category to continue a blocked conversation.', '',
    'If an unexpected question prevents the next prescribed step, record a failure with the transcript. Do not silently add rescue prompts. An exploratory follow-up can be saved separately, then turned into a new test. Review both the conversation and saved state when using developer tools.', '',
    'For each case record: Pass / Partial / Fail / Blocked, product IDs, actual versus expected outcome, missing answers, unsupported claims, screenshot or transcript, and reviewer. Do not mark a case fully passed from keyword matching alone. Manually record review outcomes in review.md; summary.json preserves the original automated results and its PENDING labels are not updated from that checklist.', '',
    'Catalogue prerequisites: have eligible dresses, bags, shoes, mens shirts, skirts and formal outfit combinations within the listed caps; at least two bags/dresses for comparison; shoe size 7 for J18/J28. Record catalogue version or an audit reference alongside the run. J38 assumes no eligible dress at A$1; J43 assumes waterproofing cannot be supplier-verified. If those assumptions change, update the case explicitly. Missing stock is a blocker; invented stock or silent substitutions are failures.', '',
    '## Recommendation coverage', '',
    '- J51 (both suites): actual complementary products on the first dress response, separate pricing and dress-only cap, questions about additions, primary dress ordinals, selecting an addition, and no repeated pitch on refinement.',
    '- J52 (both suites): no-extras preference persists while a later explicit matching request is fulfilled.',
    '- J53 (both suites): owned bags and shoes are not proposed as new purchases; other unowned roles may remain eligible.',
    '- J54 (pre-release): match additions to another displayed dress using the existing offer_anchor_id control; preserve filters, primary order, selected pieces and cart.', '',
    'J51 and J54 require at least two eligible primary dresses and supplier-approved, available complementary products for the chosen anchors. Missing primary stock is BLOCKED_CATALOGUE. If primary matches exist but the required preview is absent, the case FAILS; audit pairing rules and stock before deciding whether the cause is inventory or application behaviour. A missing preview never silently passes.', '',
    'Bindings use actual returned names and IDs, with separate primary and complementary product pools. HTTP checks exercise the rematching API control. Browser checks for card layout, Match a different dress, Hide these suggestions, No more extras, and dismissal after reload remain explicit manual review items.', '',
    '## Suggested cadence', '',
    `- Everyday: run the ${EVERYDAY_IDS.length} core cases during development; inspect every failure and blocker.`,
    `- Before release: run all ${JOURNEYS.length}; repeat critical conversations; review the actual cards, images, facts and browser recovery behaviour.`,
    '- Broader benchmark: use all three openings and repeated runs on an unchanged code/model/catalogue configuration. Report completed trials / attempted trials for each journey and variant; do not merge replayed and fresh-model evidence.',
    `- Keep some newly written prompts out of prompt tuning as a holdout. All ${JOURNEYS.length} cases here are visible development cases, not a hidden benchmark.`, '',
    'The runner checks state, independently specified product restrictions, grouped budget arithmetic and controlled faults. It does not independently query supplier truth, validate delivery, judge visual compatibility, test load across server instances, or run real outages. Those remain explicit reviews. The five recovery cases exercise client/store functions with injected faults; staging/browser checks below must be done separately.', '',
    '## Everyday selection', '',
    ...JOURNEYS.filter(journey => journey.everyday).map(journey => `- [${journey.id}: ${journey.name}](#${journey.id.toLowerCase()})`), '',
    `## All ${JOURNEYS.length} journeys`, '',
  ];
  for (const journey of JOURNEYS) {
    lines.push(`<a id="${journey.id.toLowerCase()}"></a>`, '', `### ${journey.id}: ${journey.name}`, '',
      `${journey.category} · ${journey.everyday ? 'Everyday and pre-release' : 'Pre-release'} · ${journey.mode === 'live' ? 'Live model and catalogue' : 'Controlled offline fault'}`, '');
    if (journey.mode === 'live') {
      lines.push('Opening wordings (choose one per fresh conversation):', '', ...journey.variants.map((prompt, index) => `${index + 1}. ${prompt}`), '', 'Primary conversation:', '');
      journey.turns.forEach((turn, index) => {
        lines.push(`${index + 1}. ${turn.prompt}`);
        if (turn.bind) lines.push(`   - Record: ${Object.entries(turn.bind).map(([name, selector]) => `${name} = ${selector.category ? `${selector.category} ` : ''}${selector.source ?? 'primary/alternative'} result ${selector.index + 1}${selector.excludeAnchor ? ' after excluding the current pairing anchor' : ''}`).join('; ')}.`);
        if (turn.offerAnchor) lines.push('   - Use Match a different dress and choose the recorded otherDress. The HTTP runner sends its ID using offer_anchor_id.');
      });
    } else lines.push('Controlled test actions:', '', ...journey.actions.map((action, index) => `${index + 1}. ${action}`));
    lines.push('', `Expected outcome: ${journey.expected}`, '', 'Human checks:', '', ...journey.review.map(text => `- ${text}`), '');
  }
  return lines.join('\n');
}

function reviewReport(summary) {
  const lines = ['# Stylist journey review', '', `Started: ${summary.started_at}`, `Suite: ${summary.suite} · Pack: ${summary.pack_version}`, '',
    `Automated results: ${JSON.stringify(summary.counts)}. Every human review is PENDING.`, '',
    'AUTO_PASS certifies only the listed automated checks. Check catalogue facts, missed requests, visual styling and browser behaviour before approving release.', ''];
  for (const result of summary.results) {
    lines.push(`## ${result.id}: ${result.name} (${result.trial})`, '', `Automated: **${result.status}** · Human: **PENDING**`, '',
      `Expected: ${result.expected}`, '', `Evidence: [${result.file}](${result.file})`, '',
      ...(result.failure ? [`Failure: ${result.failure}`, ''] : []),
      ...result.review.map(text => `- [ ] ${text}`), '',
      'Reviewer: ______ · Outcome (Pass / Partial / Fail / Blocked): ______ · Notes: ______', '');
  }
  return lines.join('\n');
}

export async function main(args) {
  const options = parseOptions(args);
  if (options.help) { console.log(usage); return; }
  const counts = validatePack(JOURNEYS, EVERYDAY_IDS);
  if (options.check) { console.log(JSON.stringify({ pack: PACK_VERSION, ...counts })); return; }
  if (options.writeGuide) {
    const guide = new URL('docs/ai-stylist-journey-pack.md', root);
    writeFileSync(guide, manualGuide()); console.log(`Guide saved: ${guide.pathname}`); return;
  }
  const selected = selectJourneys(options);
  if (options.list) {
    selected.forEach(journey => console.log(`${journey.id}  ${journey.mode.padEnd(5)}  ${journey.name}`));
    console.log(`${selected.length} journeys selected; no requests made.`); return;
  }
  const variants = options.variant === 'all' ? [1, 2, 3] : [Number(options.variant)];
  const jobs = selected.flatMap(journey => journey.mode === 'fault' ? [{ journey, variant: null, repeat: 1 }]
    : variants.flatMap(variant => Array.from({ length: options.repeat }, (_, index) => ({ journey, variant, repeat: index + 1 }))));
  const started = new Date().toISOString();
  const directory = resolve(options.output ?? new URL(`docs/test-evidence/stylist-journeys/${started.replace(/[:.]/g, '-')}-${options.suite}`, root).pathname);
  mkdirSync(resolve(directory, '..'), { recursive: true });
  mkdirSync(directory); // EEXIST intentionally protects previously saved evidence.
  let commit = 'unavailable';
  let workingTreeDirty = null;
  try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* Exported source tree. */ }
  try { workingTreeDirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()); } catch { /* Exported source tree. */ }
  const sources = ['lib/ai', 'lib/stylist', 'lib/search', 'components/stylist', 'app/api/conversation-search'].flatMap(folder =>
    readdirSync(new URL(folder, root)).filter(file => /\.(?:ts|tsx|css)$/.test(file)).map(file => `${folder}/${file}`)).sort();
  const summary = { pack_version: PACK_VERSION, started_at: started, suite: options.suite,
    base: options.base, commit, pack_sha256: packSourceHash(),
    interpreter_sha256: fingerprint(readFileSync(new URL('lib/ai/interpretConversation.ts', root))),
    working_tree_dirty: workingTreeDirty,
    source_files_sha256: Object.fromEntries(sources.map(file => [file, fingerprint(readFileSync(new URL(file, root)))])),
    model_label: process.env.OPENAI_CONVERSATION_MODEL?.trim() || 'Not reported; verify running server configuration',
    catalogue_reference: process.env.JOURNEY_CATALOGUE_REFERENCE || 'Not supplied; record snapshot/audit during review',
    configuration: { variant: options.variant, repeat: options.repeat, timeout_ms: options.timeoutMs },
    scope: `Live HTTP for ${liveCount} conversation definitions; ${faultCount} isolated in-process recovery faults. Human reviews pending.`,
    selected_journeys: selected.length, planned_trials: jobs.length, counts: {}, results: [] };
  function save() {
    summary.counts = Object.fromEntries(['AUTO_PASS', 'FAIL', 'ERROR', 'BLOCKED_CATALOGUE'].map(status => [status, summary.results.filter(result => result.status === status).length]));
    summary.human_reviews_pending = summary.results.length;
    summary.by_journey = selected.map(journey => {
      const trials = summary.results.filter(result => result.id === journey.id);
      return { id: journey.id, mode: journey.mode, attempted: trials.length,
        auto_passed: trials.filter(result => result.status === 'AUTO_PASS').length,
        failed: trials.filter(result => result.status === 'FAIL').length,
        errors: trials.filter(result => result.status === 'ERROR').length,
        catalogue_blocked: trials.filter(result => result.status === 'BLOCKED_CATALOGUE').length };
    });
    writeFileSync(join(directory, 'summary.json'), JSON.stringify(summary, null, 2));
    writeFileSync(join(directory, 'review.md'), reviewReport(summary));
  }
  save();
  console.log(`${options.suite}: ${selected.length} journeys, ${jobs.length} trials. Live cases call the configured model and catalogue.`);
  for (const job of jobs) {
    const trial = job.variant ? `v${job.variant}-run${job.repeat}` : 'fault';
    const start = Date.now();
    console.log(`RUN ${job.journey.id} ${trial}: ${job.journey.name}`);
    const result = job.journey.mode === 'fault' ? await runFaultJourney(job.journey)
      : await runLiveJourney(job.journey, { base: options.base, variant: job.variant, timeoutMs: options.timeoutMs,
        onTurn: turn => console.log(`  Turn ${turn.number}: ${turn.status} (${turn.elapsed_ms}ms)${turn.failure ? ` ${turn.failure}` : ''}`) });
    result.trial = trial; result.elapsed_ms = Date.now() - start;
    result.failure ??= result.turns?.find(turn => turn.failure)?.failure;
    result.file = `${result.id}-${trial}.json`;
    writeFileSync(join(directory, result.file), JSON.stringify(result, null, 2));
    const { turns, checks, ...compact } = result;
    summary.results.push({ ...compact, executed_turns: turns?.length ?? 0, controlled_checks: checks?.length ?? 0 });
    save();
    console.log(`${result.status}: ${result.id} ${trial}`);
  }
  summary.finished_at = new Date().toISOString(); save();
  console.log(`Results: ${JSON.stringify(summary.counts)}. Human reviews pending: ${summary.human_reviews_pending}.`);
  console.log(`Evidence: ${directory}`);
  if (summary.counts.FAIL || summary.counts.ERROR) process.exitCode = 1;
  else if (summary.counts.BLOCKED_CATALOGUE) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
