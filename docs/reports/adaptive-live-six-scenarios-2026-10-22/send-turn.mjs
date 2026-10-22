import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { makeTurn, acceptReply, newSession } from '../../../lib/stylist/conversationProtocol.ts';

// One manually chosen customer message per invocation. No scripted dialogue.
const [id, message] = process.argv.slice(2);
if (!/^S[1-6]$/.test(id ?? '') || !message) throw new Error('Supply S1–S6 and one customer message.');
const file = new URL('./live-evidence.json', import.meta.url);
let evidence;
try { evidence = JSON.parse(readFileSync(file, 'utf8')); }
catch { evidence = { started_at: new Date().toISOString(), endpoint: 'http://127.0.0.1:3002/api/conversation-search', max_customer_turns: 6, cases: {} }; }
const record = evidence.cases[id] ?? { turns: [], state: newSession() };
if (record.turns.length >= 6) throw new Error('12-message limit reached.');
const turn = makeTurn(record.state, message);
const requestId = randomUUID();
const entry = { at: new Date().toISOString(), customer: message, request_id: requestId, request: turn };
record.turns.push(entry);
const started = Date.now();
try {
  const response = await fetch(evidence.endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: requestId, retry: false, turn }),
    signal: AbortSignal.timeout(120_000),
  });
  entry.http_status = response.status;
  entry.reply = await response.json();
  if (response.ok) {
    try { record.state = acceptReply(turn, entry.reply).session; entry.accepted = true; }
    catch (error) { entry.acceptance_error = String(error); }
  }
} catch (error) { entry.error = String(error); }
entry.elapsed_ms = Date.now() - started;
// Merge after the request so different isolated scenarios can run concurrently.
const latest = JSON.parse(readFileSync(file, 'utf8'));
latest.cases[id] = record;
latest.updated_at = new Date().toISOString();
writeFileSync(new URL(`./${id}-evidence.json`, import.meta.url), JSON.stringify(record, null, 2));
writeFileSync(file, JSON.stringify(latest, null, 2));
const reply = entry.reply;
console.log(JSON.stringify({ case_id: id, turn: record.turns.length, http_status: entry.http_status,
  elapsed_ms: entry.elapsed_ms, error: entry.error, acceptance_error: entry.acceptance_error,
  status: reply?.status, action: reply?.action, message: reply?.message, optional_question: reply?.optional_question,
  suggested_replies: reply?.suggested_replies, complementary_offer: reply?.complementary_offer,
  products: reply?.products?.map(({product_id,product_name,price_aud,gender,category,colour,material,fit,sizes_available,reason,pairing_evidence,value_comparison,unverified_requirements})=>({product_id,product_name,price_aud,gender,category,colour,material,fit,sizes_available,reason,pairing_evidence,value_comparison,unverified_requirements})),
  alternatives: reply?.alternatives, issues: reply?.issues, pending: reply?.pending, pending_answer: reply?.pending_answer,
  outfit_budget: reply?.outfit_budget, purchase_budget: reply?.purchase_budget,
  scopes: reply?.proposed_scopes, styling: reply?.styling, task: reply?.task,
}, null, 2));
