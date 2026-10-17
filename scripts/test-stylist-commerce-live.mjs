import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { makeTurn, newSession, acceptReply } from '../lib/stylist/conversationProtocol.ts';
const base=new URL(process.argv[2]??'http://localhost:3000');
if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname)) throw new Error('Use a local test server.');
const started=new Date().toISOString();
const report={started,base:base.origin,checks:[]};
async function send(state,message,verify,shortcut){
 const turn=makeTurn(state,message,null,shortcut);
 const start=Date.now();
 const response=await fetch(new URL('/api/conversation-search',base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:crypto.randomUUID(),retry:false,turn}),signal:AbortSignal.timeout(120000)});
 const reply=await response.json(); const record={message,http:response.status,elapsed_ms:Date.now()-start,reply};report.checks.push(record);
 assert.equal(response.status,200,JSON.stringify(reply));
 const accepted=acceptReply(turn,reply); verify?.(accepted.reply,accepted.session,turn);record.pass=true;
 console.log(`PASS (${record.elapsed_ms}ms): ${message} → ${reply.status}`); return accepted.session;
}
const visible=reply=>[...reply.products,...reply.alternatives];
try{
 const seed=await send(newSession(),'Show me dresses under $150',reply=>assert.ok(reply.products.length>=2));
 let state=await send(structuredClone(seed),'Keep the second dress for my outfit',(reply,next)=>{assert.equal(next.styling.outfit.length,1);assert.equal(next.styling.outfit[0].product_id,seed.context.latest[1].product_id);assert.deepEqual(reply.products,[]);});
 const kept=state.styling.outfit[0];
 state=await send(state,'Show me bags',(reply,next)=>{assert.ok(visible(reply).length);assert.equal(next.styling.outfit[0].product_id,kept.product_id);});
 const bag=state.context.latest[0];
 state=await send(state,`Keep ${bag.product_name} for my outfit`,(_reply,next)=>assert.equal(next.styling.outfit.length,2),{kind:'keep',product_id:bag.product_id});
 state=await send(state,`Find shoes to go with ${kept.product_name}`,(reply)=>{assert.equal(reply.action,'cross_sell');assert.equal(reply.applied_preferences.category,'Shoes');assert.ok(visible(reply).length);assert.ok(visible(reply).every(product=>product.category==='Shoes'&&product.pairing_evidence.anchor_ids.includes(kept.product_id)&&product.pairing_evidence.anchor_ids.includes(bag.product_id)));});
 state=await send(state,'Why would you suggest the first product with my outfit?',(reply)=>{assert.equal(reply.status,'answered');assert.match(reply.message,/styling|pairing/i);assert.ok(reply.answer_sources.length);});
 state=await send(state,'Show me bags with pockets',(reply,next)=>{assert.ok(next.styling.required_features.includes('pockets'));assert.ok(!next.scopes.item.preferred_colours.includes('pockets'));if(reply.feature_data_status!=='available'){assert.equal(reply.status,'no_match');assert.equal(visible(reply).length,0);assert.match(reply.message,/verify/i);}});
 state=await send(state,'Remove my pockets requirement and show me bags',(reply,next)=>{assert.ok(!next.styling.required_features.includes('pockets'));assert.ok(visible(reply).length);});
 const rejected=state.context.latest[0];
 state=await send(state,`Skip ${rejected.product_name}`,(_reply,next)=>assert.ok(next.styling.rejected_ids.includes(rejected.product_id)),{kind:'reject',product_id:rejected.product_id});
 state=await send(state,'Show me bags',reply=>{assert.ok(visible(reply).length);assert.ok(visible(reply).every(product=>product.product_id!==rejected.product_id));});
 state=await send(state,'No extras',(_reply,next)=>assert.equal(next.styling.offers_paused,true));
 await send(state,'I already own a bag',(_reply,next)=>assert.ok(next.styling.owned_categories.includes('Bags')));
 let comparison=await send(structuredClone(seed),'Compare a replacement for the second dress with adjustable straps',(reply,next)=>{assert.equal(reply.action,'upsell');assert.ok(next.styling.priorities.includes('adjustability'));if(reply.feature_data_status!=='available')assert.equal(reply.status,'no_upsell');});
 comparison=await send(comparison,'Pockets would be useful',(reply,next)=>{assert.equal(reply.action,'upsell');assert.ok(next.styling.priorities.includes('pockets'));assert.ok(reply.status==='no_upsell'||visible(reply).length);});
 await send(comparison,'Can this arrive by Friday?',(reply,next,turn)=>{assert.equal(reply.status,'answered');assert.deepEqual(next.styling,turn.styling);assert.match(reply.message,/can't confirm arrival/i);});
 report.success=true;
} catch(error){report.success=false;report.error=error.message;console.error(error);process.exitCode=1;}
finally{report.finished=new Date().toISOString();const file=new URL(`../docs/test-evidence/commerce-live-${started.replace(/[:.]/g,'-')}.json`,import.meta.url);writeFileSync(file,JSON.stringify(report,null,2));console.log(`${report.checks.filter(check=>check.pass).length}/${report.checks.length} live commerce requests passed. Evidence: ${file.pathname}`);}
