import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { enrichCommercialCatalogue } from '../lib/stylist/commerceCatalogue.ts';
import { getProductSpecification } from '../lib/stylist/productSpecifications.ts';
import { makeTurn,newSession,snapshot,acceptReply } from '../lib/stylist/conversationProtocol.ts';

const base=new URL(process.argv[2]??'http://localhost:3102');
if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw new Error('Use a local server.');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
const report={started:new Date().toISOString(),base:base.origin,checks:[]};
const [catalogueResponse,specResponse]=await Promise.all([db.from('product_catalog').select('*').order('product_id'),db.from('prototype_product_specifications').select('*')]);
assert.equal(catalogueResponse.error,null);assert.equal(specResponse.error,null);
assert.equal(catalogueResponse.data.length,316);assert.equal(specResponse.data.length,316);
const catalogue=await enrichCommercialCatalogue(catalogueResponse.data);
assert.ok(catalogue.every(product=>getProductSpecification(product)));
report.checks.push({name:'All 316 public products expose valid, matching specifications',pass:true});
const before=JSON.parse(readFileSync(new URL('../docs/data/prototype-specs-v1/catalogue-baseline.json',import.meta.url),'utf8'));
for(const product of catalogue){const original=before.find(row=>row.product_id===product.product_id);
 for(const field of ['product_name','description','material','stock_qty','is_available'])assert.deepEqual(product[field],original[field],`${product.product_id}.${field}`);
 assert.equal(createHash('sha256').update(JSON.stringify(product.image_key)).digest('hex'),original.image_key_sha256);
 assert.equal(product.price_aud,original.price_aud);
}
report.checks.push({name:'Original names, descriptions, materials, stock, images, availability and prices unchanged',pass:true});
async function send(state,message,verify,shortcut){
 const turn=makeTurn(state,message,null,shortcut);const started=Date.now();
 const response=await fetch(new URL('/api/conversation-search',base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:crypto.randomUUID(),retry:false,turn}),signal:AbortSignal.timeout(90000)});
 const reply=await response.json();const check={message,http:response.status,elapsed_ms:Date.now()-started,reply};report.checks.push(check);
 assert.equal(response.status,200,JSON.stringify(reply));const accepted=acceptReply(turn,reply);verify(accepted.reply,accepted.session);check.pass=true;console.log(`PASS: ${message} → ${reply.status}`);return accepted.session;
}
try{
 const primary=catalogue.find(product=>product.product_id==='P1178');const spec=getProductSpecification(primary);
 let state=newSession();state.context.focused=snapshot(primary);state.context.latest=[snapshot(primary)];state.scopes.item.category='Clothing';state.scopes.item.subcategory='Dresses';state.scopes.item.max_price=150;
 state=await send(state,'Does this dress have pockets?',reply=>{assert.equal(reply.status,'answered');assert.match(reply.message,new RegExp(`Pockets: ${spec.pockets?'Yes':'No'}`));});
 state=await send(state,'How should I wash this dress?',reply=>{assert.equal(reply.status,'answered');assert.ok(reply.message.includes(spec.care_instructions));});
 state=await send(state,'Compare a replacement with pockets under $150',(reply,next)=>{
  assert.equal(reply.action,'upsell');assert.equal(reply.status,'matches');assert.ok(reply.products.length);
  assert.ok(reply.products.every(product=>product.price_aud<=150&&product.value_comparison.benefits.some(benefit=>benefit.feature_key==='pockets'&&benefit.before===false&&benefit.after===true&&benefit.evidence_kind==='synthetic')));
  assert.equal(next.context.comparison.product_id,primary.product_id);
 });
 state=await send(state,'Pockets would be useful',(reply,next)=>{assert.equal(reply.action,'upsell');assert.equal(next.context.comparison.product_id,primary.product_id);});
 state=await send(state,`Keep ${primary.product_name} for my outfit`,(_reply,next)=>assert.equal(next.styling.outfit[0].product_id,primary.product_id),{kind:'keep',product_id:primary.product_id});
 state=await send(state,'Find a bag with a zip closure to go with my kept dress under $100',reply=>{
  assert.equal(reply.action,'cross_sell');assert.ok(reply.products.length+reply.alternatives.length);
  for(const product of [...reply.products,...reply.alternatives]){assert.equal(product.category,'Bags');assert.ok(product.price_aud<=100);assert.equal(getProductSpecification(catalogue.find(row=>row.product_id===product.product_id)).zip_closure,true);}
 });
 state=await send(state,'What is the capacity of the first bag?',reply=>{assert.equal(reply.status,'answered');assert.match(reply.message,/Capacity: [\d.]+ L/);});
 const page=await fetch(new URL('/products/P1178',base));assert.equal(page.status,200);const html=await page.text();
 assert.ok(html.includes('Sample garment length:'));assert.ok(html.includes('AI-generated specifications'));assert.ok(html.includes(spec.care_instructions));
 report.checks.push({name:'Production product page contains specification details, care and prototype disclosure',pass:true});
 report.success=true;
}catch(error){report.success=false;report.error=error.message;console.error(error);process.exitCode=1;}
finally{report.finished=new Date().toISOString();writeFileSync('docs/test-evidence/prototype-specs-live-2026-10-17.json',JSON.stringify(report,null,2)+'\n');console.log(`${report.checks.filter(check=>check.pass).length}/${report.checks.length} specification checks passed.`);}
