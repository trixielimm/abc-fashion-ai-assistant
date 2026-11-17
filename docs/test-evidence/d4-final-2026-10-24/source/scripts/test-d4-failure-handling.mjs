// Isolated HTTP adapter around the real route. Module mocks affect this test
// process only and never alter the shared Supabase or OpenAI configuration.
import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {createServer} from 'node:http';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {newSession,makeTurn,acceptReply} from '../lib/stylist/conversationProtocol.ts';
import {emptyShoppingPreferences} from '../lib/stylist/preferenceScope.ts';
let stage='model';
const message='Show me a blue bag under 80 aud for a wedding.';
const plan={action:'new_search',intent_evidence:message,reference:null,changes:[{scope:'item',field:'category',operation:'set',value:'Bags',evidence:'bag'},{scope:'item',field:'max_price',operation:'set',value:80,evidence:'under 80 aud'},{scope:'item',field:'preferred_colours',operation:'set',value:['Blue'],evidence:'blue'}],question:null,continuation:false};
mock.module(new URL('../lib/ai/interpretConversation.ts',import.meta.url).href,{namedExports:{interpretConversation:async()=>{if(stage==='model')throw new Error('INJECTED_PROVIDER_PRIVATE_DETAIL');return plan;}}});
mock.module(new URL('../lib/recommendations/catalogue.ts',import.meta.url).href,{namedExports:{getCatalogueProducts:async()=>{if(stage==='catalogue')throw new Error('INJECTED_DATABASE_PRIVATE_DETAIL');return [{product_id:'D4-BAG',product_name:'D4 Blue Bag',brand_line:'ABC',gender:'Women',category:'Bags',subcategory:'Handbags',product_type:'Handbag',colour:'Blue',occasion:'Wedding Guest',style:'Classic',season:'All Season',material:'Cotton',fit:'Regular',sizes_available:['One Size'],price_aud:50,stock_qty:3,description:'Test-only bag',tags:[],cross_sell_category:null,image_key:null,is_available:true}];},getCatalogueProductsByIds:async()=>[]}});
mock.module(new URL('../lib/catalogue/preferenceValues.ts',import.meta.url).href,{namedExports:{loadPreferenceValues:async()=>({rows:[{...emptyShoppingPreferences(),category:'Bags',colour:'Blue'}],sizes:['One Size'],categories:[{category:'Bags',subcategory:null}]})}});
const {POST}=await import('../app/api/conversation-search/route.ts');
const server=createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const response=await POST(new Request('http://127.0.0.1:3002'+req.url,{method:'POST',headers:req.headers,body:Buffer.concat(chunks)}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());}catch(e){res.writeHead(500);res.end(JSON.stringify({test_adapter_error:e.message}));}});
await new Promise(resolve=>server.listen(3002,'127.0.0.1',resolve));
const report={started:new Date().toISOString(),scope:'Real POST route through isolated HTTP server with process-local provider/catalogue module mocks; no shared-service disruption.',checks:[]};
try{
for(const [id,mode,http,code] of [['TC-INT-01','model',502,'CONVERSATION_FAILED'],['TC-INT-02','catalogue',503,'CATALOGUE_UNAVAILABLE']]){
 stage=mode;const before=newSession();const initial=JSON.stringify(before);const turn=makeTurn(before,message);const request_id=randomUUID();
 const r=await fetch('http://127.0.0.1:3002/api/conversation-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id,retry:false,turn})});const body=await r.json();
 assert.equal(r.status,http);assert.equal(body.code,code);assert.match(body.error,/could not be completed safely.*No cart changes/i);assert.ok(!JSON.stringify(body).includes('PRIVATE_DETAIL'));assert.equal(JSON.stringify(before),initial);assert.ok(!('products' in body));
 report.checks.push({id,status:'Pass',request_id,injection:mode,http:r.status,body,state_unchanged:true});console.log('Pass',id);
}
stage='healthy';const turn=makeTurn(newSession(),message);const r=await fetch('http://127.0.0.1:3002/api/conversation-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:randomUUID(),retry:false,turn})});const body=await r.json();assert.equal(r.status,200);acceptReply(turn,body);assert.ok(body.products.length||body.alternatives.length);report.checks.push({id:'TC-INT-02-recovery',status:'Pass',http:r.status,body});console.log('Pass recovery');
}catch(e){report.error=e.message;report.checks.push({id:'execution',status:'Fail',error:e.message});process.exitCode=1;console.error(e.message);}finally{server.close();mock.restoreAll();report.finished=new Date().toISOString();writeFileSync('docs/test-evidence/d4-final-2026-10-24/controlled-failures.json',JSON.stringify(report,null,2));}
