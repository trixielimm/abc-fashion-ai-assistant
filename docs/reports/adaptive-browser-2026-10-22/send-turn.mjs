// Live, one-turn probe. Every customer message is chosen after reading the last reply.
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { newSession, makeTurn, acceptReply } from '../../../lib/stylist/conversationProtocol.ts';

const [id, message, reason] = process.argv.slice(2);
if (!/^S[1-6]$/.test(id ?? '') || !message || !reason) throw new Error('Supply scenario, message and adaptive reason.');
const file = new URL(`./${id}-live.json`, import.meta.url);
let record;
try { record = JSON.parse(readFileSync(file, 'utf8')); }
catch { record = { id, started_at: new Date().toISOString(), endpoint: 'http://127.0.0.1:3003/api/conversation-search', max_total_messages: 12, turns: [], state: newSession() }; }
if (record.turns.length >= 6) throw new Error('Twelve total messages reached.');
const turn = makeTurn(record.state, message);
const entry = { at: new Date().toISOString(), customer: message, adaptive_reason: reason, request: turn };
record.turns.push(entry);
const began = Date.now();
try {
  const response = await fetch(record.endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: randomUUID(), retry: false, turn }),
    signal: AbortSignal.timeout(115000),
  });
  entry.http_status = response.status;
  entry.reply = await response.json();
  if (response.ok) { record.state = acceptReply(turn, entry.reply).session; entry.accepted = true; }
} catch (error) { entry.error = String(error); }
entry.elapsed_ms = Date.now() - began;
writeFileSync(file, JSON.stringify(record, null, 2));
const r = entry.reply;
const card = p => ({ id: p.product_id, name: p.product_name, price: p.price_aud, colour: p.colour,
  occasion: p.occasion, sizes: p.sizes_available, explanation: p.explanation,
  differences: p.differences, unverified: p.unverified_requirements });
console.log(JSON.stringify({ id, turn: record.turns.length, http_status: entry.http_status, elapsed_ms: entry.elapsed_ms,
  error: entry.error, status: r?.status, action: r?.action, message: r?.message,
  optional_question: r?.optional_question, suggested_replies: r?.suggested_replies,
  products: r?.products?.map(card), alternatives: r?.alternatives?.map(card),
  complementary_offer: r?.complementary_offer && { anchor: r.complementary_offer.anchor.product_id,
    items: r.complementary_offer.items.map(x => ({...card(x.product), preferences: x.preferences})),
    total: r.complementary_offer.total_aud, limit: r.complementary_offer.combined_limit_aud },
  pending: r?.pending, pending_answer: r?.pending_answer, scopes: r?.proposed_scopes,
  issues: r?.issues, task: r?.task, styling: r?.styling,
}, null, 2));
