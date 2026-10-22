import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const catalogue = read('catalogue-audit.json');
const byId = new Map(catalogue.products.map(p => [p.product_id, p]));
const records = [1, 2, 3, 4, 5].map(n => read(`S${n}-live.json`));
const failures = [], checks = [], observations = [];
let returnedCards = 0;
const uniqueIds = new Set();
const verify = (label, check) => { try { check(); checks.push(label); } catch(e) { failures.push({ label, error: e.message }); } };
const factualFields = ['product_name', 'price_aud', 'category', 'subcategory', 'product_type', 'brand_line', 'colour', 'occasion', 'style', 'sizes_available'];
function verifyCard(p, label, max = null, rejected = []) {
  returnedCards++; uniqueIds.add(p.product_id);
  verify(label, () => {
    const row = byId.get(p.product_id);
    assert.ok(row, `Unknown product ${p.product_id}`);
    for (const key of factualFields) if (key in p) assert.deepEqual(p[key], row[key], key);
    assert.equal(row.is_available, true); assert.ok(row.stock_qty > 0);
    if (max !== null) assert.ok(row.price_aud <= max, 'Above item budget');
    assert.ok(!rejected.includes(p.product_id), 'Rejected item returned');
  });
}
for (const record of records) {
  verify(`${record.id}: message cap`, () => assert.ok(record.turns.length * 2 <= 12));
  for (const [i,t] of record.turns.entries()) {
    const label = `${record.id} exchange ${i + 1}`;
    verify(`${label}: live response accepted`, () => { assert.equal(t.http_status, 200); assert.equal(t.accepted, true); assert.ok(!t.error); });
    const r = t.reply, prefs = r.proposed_scopes.item;
    for (const [kind, cards] of [['primary', r.products], ['alternative', r.alternatives]]) {
      for (const p of cards) verifyCard(p, `${label}: ${kind} ${p.product_id}`, prefs.max_price, r.styling.rejected_ids);
    }
    const offer = r.complementary_offer;
    if (offer) {
      for (const item of offer.items) verifyCard(item.product, `${label}: optional ${item.product.product_id}`, item.preferences.max_price, r.styling.rejected_ids);
      verify(`${label}: optional total`, () => {
        assert.equal(Math.round(offer.total_aud * 100), Math.round((offer.base_total_aud + offer.extras_total_aud) * 100));
        if (offer.combined_limit_aud !== null) assert.ok(offer.total_aud <= offer.combined_limit_aud);
      });
    }
    observations.push({scenario:record.id, exchange:i+1, status:r.status, action:r.action, elapsed_ms:t.elapsed_ms});
  }
}
const s1 = records[0].turns[0].reply;
verify('S1 complete brief matches P1259 catalogue material and fit', () => {
  const p=byId.get(s1.products[0].product_id); assert.equal(p.product_id,'P1259');
  assert.equal(p.material,'Cotton'); assert.equal(p.fit,'Regular'); assert.equal(p.occasion,'Work');
  assert.ok(p.sizes_available.includes('12')); assert.ok(p.price_aud<=180);
});
verify('S5 cotton update retains fit, size and occasion', () => {
  const t=records[4].turns[1].reply,p=byId.get(t.products[0].product_id);
  assert.equal(p.material,'Cotton'); assert.equal(p.fit,'Regular'); assert.equal(p.occasion,'Beach Wedding');
  assert.ok(p.sizes_available.includes('10')); assert.ok(p.price_aud<=80);
});
verify('S5 no rejected brown shirt returns after rejection', () => {
  for(const t of records[4].turns.slice(3)) {
    assert.ok(t.reply.styling.rejected_ids.includes('P1209'));
    assert.ok([...t.reply.products,...t.reply.alternatives].every(p=>p.product_id!=='P1209'));
  }
});
verify('S5 later beige alternative is cotton with disclosed occasion tradeoff', () => {
  const t=records[4].turns[4].reply,p=t.alternatives[0],row=byId.get(p.product_id);
  assert.equal(row.product_id,'P1210'); assert.equal(row.material,'Cotton'); assert.equal(row.fit,'Regular');
  assert.equal(row.price_aud,100); assert.match(p.differences.join(' '),/Brunch.*Beach Wedding/);
});
verify('S6 no navy men or unisex work shirt with M, regular fit and <=100', () => {
  assert.equal(catalogue.products.filter(p=>p.is_available&&p.stock_qty>0&&['Men','Unisex'].includes(p.gender)&&/shirt/i.test(p.product_type??'')&&p.colour==='Navy'&&p.fit==='Regular'&&p.occasion==='Work'&&p.price_aud<=100&&p.sizes_available.includes('M')).length,0);
});
for(const [id,name,price,fit,occasion] of [
  ['P1308','White Polo Shirt',95,'Slim','Smart Casual'],
  ['P1098','Blue Oxford Shirt',50,'Oversized','Formal'],
  ['P1013','Yellow Oversized Shirt',95,'Slim','Formal'],
]) verify(`S6 browser alternative ${id}`,()=>{
  const p=byId.get(id); assert.equal(p.product_name,name);assert.equal(p.price_aud,price);assert.equal(p.fit,fit);assert.equal(p.occasion,occasion);assert.ok(p.sizes_available.includes('M'));assert.ok(p.is_available&&p.stock_qty>0);
});
const giftMatches=catalogue.products.filter(p=>p.is_available&&p.stock_qty>0&&['Men','Unisex'].includes(p.gender)&&p.subcategory==='Scarves'&&['Blue','Grey'].includes(p.colour)&&p.price_aud<=90);
const times=observations.map(x=>x.elapsed_ms).sort((a,b)=>a-b);
const result={verified_at:new Date().toISOString(),http_requests:observations.length,http_200_and_accepted:checks.filter(x=>x.endsWith('live response accepted')).length,
  browser_exchanges:4,total_exchanges:observations.length+4,total_messages:(observations.length+4)*2,
  catalogue_rows:catalogue.total,catalogue_available:catalogue.available,
  returned_card_occurrences_checked:returnedCards,unique_returned_product_ids:[...uniqueIds].sort(),
  successful_automated_checks:checks.length,failures,
  http_latency_ms:{min:times[0],median:(times[14]+times[15])/2,p95:times[Math.ceil(times.length*.95)-1],max:times.at(-1)},
  gift_catalogue_candidates:giftMatches.map(({product_id,product_name,price_aud,occasion,sizes_available})=>({product_id,product_name,price_aud,occasion,sizes_available})),
  observations,scope:'Grounding and protocol checks only. Human scenario outcomes are assessed separately. Browser-only requests have no measured HTTP latency.'};
writeFileSync(new URL('verification.json',import.meta.url),JSON.stringify(result,null,2));
let md='# Adaptive live conversation transcripts\n\n22 October 2026, Australia/Sydney. Each follow-up was chosen after inspecting the preceding live response. Five HTTP sessions use the same makeTurn/acceptReply protocol as the customer UI. S6 was conducted directly in the browser.\n\n';
for(const record of records){md+=`## ${record.id}\n\n`;
  for(const [i,t]of record.turns.entries()){
    md+=`### Exchange ${i+1}\n\n**Customer:** ${t.customer}\n\n**Why this reply:** ${t.adaptive_reason}\n\n**Agent:** ${t.reply.message}\n\n`;
    if(t.reply.optional_question)md+=`**Optional question:** ${t.reply.optional_question}\n\n`;
    if(t.reply.suggested_replies?.length)md+=`**Suggested replies:** ${t.reply.suggested_replies.map(x=>x.label).join('; ')}\n\n`;
    for(const[kind,products]of[['Primary',t.reply.products],['Alternative',t.reply.alternatives]])for(const pof of products)md+=`- ${kind}: ${pof.product_name} (${pof.product_id}), A$${pof.price_aud.toFixed(2)}${pof.differences?.length?'; '+pof.differences.join('; '):''}\n`;
    if(t.reply.complementary_offer){const o=t.reply.complementary_offer;md+=`- Optional additions for ${o.anchor.product_name}: ${o.items.map(x=>x.product.product_name+' (A$'+x.product.price_aud.toFixed(2)+')').join('; ')}. Combined example A$${o.total_aud.toFixed(2)}; combined cap ${o.combined_limit_aud??'not set (item-only budget)'}.\n`;}
    md+=`\nHTTP ${t.http_status}; ${t.elapsed_ms} ms; status ${t.reply.status}; action ${t.reply.action}.\n\n`;
  }
}
md+='## S6 — direct browser conversation\n\n';
for(const [i,file]of['S6-turn1.txt','S6-turn2.txt','S6-turn3.txt','S6-turn4.txt'].entries())md+=`[Browser state after exchange ${i+1}](${file})\n\n`;
md+='The fourth snapshot contains the complete cumulative conversation and all three alternative cards with disclosed fit and occasion differences. [Screenshot](S6-differences.png).\n';
writeFileSync(new URL('transcripts.md',import.meta.url),md);
console.log(JSON.stringify(result,null,2));
if(failures.length)process.exitCode=1;
