// Fresh synthetic journeys with live interpretation and a read-only catalogue.
// This integration probe is in-process; HTTP/browser coverage is run separately.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { JOURNEYS } from './fixtures/stylist-journeys.mjs';
import { runLiveJourney, packSourceHash } from './lib/stylist-journey-harness.mjs';
import { interpretConversation } from '../lib/ai/interpretConversation.ts';
import { interpreterInput, shortcutPlan, finishConversationTurn } from '../lib/stylist/conversationTurn.ts';
import { loadPreferenceValues } from '../lib/catalogue/preferenceValues.ts';
import { enrichCommercialCatalogue } from '../lib/stylist/commerceCatalogue.ts';
import { journeyCatalogue, journeyVocabulary } from './fixtures/stylist-journey-catalogue.mjs';

const phase = process.argv[2] || 'before';
if (!/^[a-z0-9-]+$/.test(phase)) throw new Error('Use a simple phase label.');
const ids = process.argv[3] === 'all' ? JOURNEYS.filter(journey => journey.mode === 'live').map(journey => journey.id) : (process.argv[3] || 'J18,J29,J32,J39,J42').split(',');
const fixture = process.argv[4] === 'fixture';
const variants = process.argv[5] === 'all' ? [1, 2, 3] : [1];
if (ids.some(id => !JOURNEYS.some(journey => journey.id === id && journey.mode === 'live'))) throw new Error('Select existing live journey IDs.');
const rows = [];
if (fixture) rows.push(...journeyCatalogue);
else {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } });
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await db.from('product_catalog').select('*').order('product_id')
      .range(offset, offset + 199).abortSignal(AbortSignal.timeout(15000));
    if (error || !data) throw new Error(`Catalogue read failed: ${error?.code ?? 'no_data'}`);
    rows.push(...data);
    if (data.length < 200) break;
  }
}
const catalogue = fixture ? rows : await enrichCommercialCatalogue(rows);
const vocabulary = fixture ? journeyVocabulary : await loadPreferenceValues();
const directory = new URL('../docs/test-evidence/stylist-remediation-2026-10-21/', import.meta.url);
mkdirSync(directory, { recursive: true });
const report = { scope: 'Fresh synthetic fixtures; live model/catalogue in-process, not HTTP or browser',
  catalogue_source: fixture ? 'isolated synthetic acceptance fixture; shared catalogue unchanged' : 'read-only live Supabase catalogue',
  started_at: new Date().toISOString(), model: process.env.OPENAI_CONVERSATION_MODEL || 'gpt-5.6-luna',
  variants, pack_sha256: packSourceHash(),
  source_sha256: Object.fromEntries(['lib/ai/interpretConversation.ts', 'lib/stylist/conversationPlan.ts',
    'lib/stylist/conversationGrounding.ts', 'lib/stylist/conversationTurn.ts', 'lib/stylist/combinedShoppingRequest.ts',
    'lib/stylist/answerPlan.ts', 'lib/stylist/conversationAnswers.ts', 'lib/stylist/priceContext.ts', 'lib/stylist/collectionPreference.ts',
    'scripts/fixtures/stylist-journey-catalogue.mjs'].map(path => [path, createHash('sha256').update(readFileSync(new URL(`../${path}`, import.meta.url))).digest('hex')])),
  catalogue_sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
  catalogue_count: rows.length, cases: [], diagnostics: [] };
const originalInfo = console.info;
process.env.STYLIST_DIAGNOSTICS_ENABLED = 'true';
console.info = (...args) => {
  if (args[0] === 'Stylist diagnostic') report.diagnostics.push(args[1]);
  originalInfo(...args);
};
try {
  for (const journey of JOURNEYS.filter(journey => ids.includes(journey.id))) for (const variant of variants) {
    console.log('DIAGNOSE', journey.id, variant);
    const result = await runLiveJourney(journey, { base: 'http://localhost:3000', variant, fetchImpl: async (_url, options) => {
      const { turn } = JSON.parse(options.body);
      const plan = shortcutPlan(turn) ?? await interpretConversation(interpreterInput(turn));
      return Response.json(finishConversationTurn(catalogue, turn, plan, vocabulary));
    } });
    report.cases.push(result);
    writeFileSync(new URL(`diagnosis-${phase}.json`, directory), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ id: journey.id, status: result.status, failure: result.failure ?? result.turns.at(-1)?.failure }));
  }
  report.finished_at = new Date().toISOString();
  report.counts = Object.fromEntries(['AUTO_PASS', 'FAIL', 'ERROR', 'BLOCKED_CATALOGUE'].map(status => [status, report.cases.filter(result => result.status === status).length]));
  writeFileSync(new URL(`diagnosis-${phase}.json`, directory), JSON.stringify(report, null, 2));
  console.log('RESULTS', JSON.stringify(report.counts));
  if (report.counts.FAIL || report.counts.ERROR) process.exitCode = 1;
  else if (report.counts.BLOCKED_CATALOGUE) process.exitCode = 2;
} finally { console.info = originalInfo; }
