import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeTurn, acceptReply, newSession } from '../lib/stylist/conversationProtocol.ts';

const [caseId, ...messageParts] = process.argv.slice(2);
const message = messageParts.join(' ').trim();
if (!/^S(?:[1-9]|1\d|20)(?:-V\d+)?$/.test(caseId ?? '') || !message) {
  throw new Error('Usage: node --import tsx scripts/run-reactive-stylist-demos.mjs S1 "customer message"');
}

const file = resolve(process.env.STYLIST_DEMO_EVIDENCE ?? 'docs/reports/reactive-stylist-fixes-2026-10-19/live-evidence.json');
let evidence;
try { evidence = JSON.parse(readFileSync(file, 'utf8')); }
catch { evidence = { started_at: new Date().toISOString(), endpoint: 'http://127.0.0.1:43117/api/conversation-search', cases: {} }; }
evidence.endpoint = process.env.STYLIST_DEMO_ENDPOINT ?? 'http://127.0.0.1:43117/api/conversation-search';
const record = evidence.cases[caseId] ?? { turns: [], state: newSession() };
const turn = makeTurn(record.state, message);
const started = Date.now();
let status = null;
let raw;
try {
  const response = await fetch(evidence.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: randomUUID(), retry: false, turn }),
    signal: AbortSignal.timeout(120_000),
  });
  status = response.status;
  raw = await response.json();
  let accepted = null;
  if (response.ok) {
    accepted = acceptReply(turn, raw);
    record.state = accepted.session;
  }
  const entry = { at: new Date().toISOString(), customer: message, request: turn, http_status: status,
    elapsed_ms: Date.now() - started, reply: raw };
  record.turns.push(entry);
  evidence.cases[caseId] = record;
  writeFileSync(file, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ case_id: caseId, turn: record.turns.length,
    http_status: status, elapsed_ms: entry.elapsed_ms,
    status: raw.status, action: raw.action, message: raw.message,
    optional_question: raw.optional_question,
    combination_summary: raw.combination_summary,
    unverified_requirements: raw.unverified_requirements,
    brief: raw.task?.brief,
    issues: raw.issues?.map(({ code, message }) => ({ code, message })),
    products: raw.products?.map(({ product_id, product_name, price_aud, category, colour, sizes_available }) =>
      ({ product_id, product_name, price_aud, category, colour, sizes_available })),
    alternatives: raw.alternatives?.map(({ product_id, product_name, price_aud }) =>
      ({ product_id, product_name, price_aud })),
    pending: raw.pending, pending_answer: raw.pending_answer,
    saved: accepted && { item: accepted.session.scopes.item,
      styling: accepted.session.styling, collection: accepted.session.collection } }, null, 2));
} catch (error) {
  record.turns.push({ at: new Date().toISOString(), customer: message,
    http_status: status, elapsed_ms: Date.now() - started, error: String(error) });
  evidence.cases[caseId] = record;
  writeFileSync(file, JSON.stringify(evidence, null, 2));
  throw error;
}
