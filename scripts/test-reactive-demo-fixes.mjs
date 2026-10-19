import assert from 'node:assert/strict';
import { product } from './fixtures/customer-scenarios.mjs';
import { newSession, makeTurn, acceptReply, snapshot } from '../lib/stylist/conversationProtocol.ts';
import { finishConversationTurn, shortcutPlan } from '../lib/stylist/conversationTurn.ts';
import { explicitCollection } from '../lib/stylist/collectionPreference.ts';
import { AnswerIntentSchema } from '../lib/stylist/answerPlan.ts';
import { requestedComponents } from '../lib/stylist/combinedShoppingRequest.ts';
import { emptyShoppingPreferences } from '../lib/stylist/preferenceScope.ts';
import { confirmedColourChoice } from '../lib/stylist/conversationIssues.ts';
import { prepareConversationTask } from '../lib/stylist/taskState.ts';

const rows = [
  product('D', 'Clothing', 135, { product_name: 'Sage Midi Dress', colour: 'Sage', occasion: 'Formal' }),
  product('S', 'Shoes', 60, { product_name: 'Red Block Heels', colour: 'Red', occasion: 'Formal' }),
  product('B', 'Bags', 50, { product_name: 'Silver Envelope Clutch', colour: 'Silver', occasion: 'Formal' }),
  product('R', 'Clothing', 120, { product_name: 'Burgundy Maxi Dress', product_type: 'Maxi Dress', occasion: 'Work' }),
  product('W', 'Clothing', 80, { product_name: 'Navy Wrap Dress', product_type: 'Wrap Dress', occasion: 'Work' }),
  product('J', 'Clothing', 110, { product_name: 'Grey Denim Jacket', subcategory: 'Outerwear', product_type: 'Denim Jacket', occasion: 'Casual' }),
  product('T', 'Clothing', 60, { product_name: 'Red Shirt', subcategory: 'Tops', product_type: 'Oxford Shirt', occasion: 'Casual' }),
];
const vocabulary = { rows, sizes: ['10', '12'], categories: rows.map(({category,subcategory})=>({category,subcategory})) };
const plan = (message, extra={}) => ({ action:'refine', intent_evidence:message.slice(0,250), changes:[], reference:null, question:null, continuation:false, ...extra });
function run(state, message, output) {
  const turn=makeTurn(state,message);
  const reply=finishConversationTurn(rows,turn,output??shortcutPlan(turn),vocabulary);
  return acceptReply(turn,reply);
}
let failed=0,passed=0;
function check(name, test) {try {test();passed++;console.log('PASS: '+name);}catch(error){failed++;console.error('FAIL: '+name+' — '+error.message);}}

check('Compound collection answer survives a later shopping clause',()=>{
  assert.equal(explicitCollection('Both collections are fine. Show me everyday clothing under A$150 with softness unverified.',true)?.choice,'All');
  assert.equal(explicitCollection("Women's clothing, please. I want a bolder concert look.",true)?.choice,'Women');
  assert.equal(explicitCollection('Please retry: women’s everyday clothing under A$150. Keep my size unknown, and explain the fit labels while I browse.',true)?.choice,'Women');
});
check('Collection plus fit guidance resumes the search without a product-reference question',()=>{
  const s=newSession();s.scopes.item={...emptyShoppingPreferences(),category:'Clothing',max_price:150};
  s.collection.checkpoint={action:'new_search',discovery_intent:null};
  const message="Women's clothing. Keep everyday wear under A$150 and tell me what fit information is recorded.";
  const result=run(s,message,plan(message,{action:'none',answer:{kind:'product',topics:['fit'],references:[{kind:'context'}],purpose:null,continuation:false}}));
  assert.equal(result.session.collection.choice,'Women');assert.equal(result.session.collection.checkpoint,null);
  assert.doesNotMatch(result.reply.message,/Which item|identify that product/i);
});
check('Saved-search availability does not ask for a nonexistent product',()=>{
  const s=newSession();s.scopes.item={...emptyShoppingPreferences(),category:'Clothing',subcategory:'Dresses',preferred_colours:['Black'],size:'10',max_price:150};
  const m='Keep black, size 10, and A$150 as firm limits. Can you tell me whether any eligible dress is available without changing them?';
  const result=run(s,m,plan(m,{action:'none',answer:{kind:'product',topics:['availability'],references:[{kind:'context'}],purpose:null,continuation:false}}));
  assert.doesNotMatch(result.reply.message,/Which item|identify that product/i);assert.equal(result.session.scopes.item.max_price,150);
});
check('A referenced combination is an explicit answer operation',()=>{
  assert.equal(AnswerIntentSchema.safeParse({kind:'combination',topics:['total_price','recommendation'],references:[{kind:'id',value:'D'},{kind:'id',value:'S'},{kind:'id',value:'B'}],purpose:null,continuation:false}).success,true);
});
check('Named three-piece total is A$245 with A$155 remaining, without selection changes',()=>{
  const s=newSession();s.context.latest=rows.slice(0,3).map(snapshot);
  s.styling.outfit_request={total_budget_aud:400,evidence:'A$400 total',items:rows.slice(0,3).map(p=>({...emptyShoppingPreferences(),category:p.category,subcategory:p.subcategory}))};
  const m='What is the total for the Sage Midi Dress, Red Block Heels and Silver Envelope Clutch?';
  const result=run(s,m);
  assert.match(result.reply.message,/A\$245\.00/);assert.match(result.reply.message,/A\$155\.00/);
  assert.deepEqual(result.session.styling,s.styling);
});
check('Rejecting one dress does not save its Maxi Dress type',()=>{
  const s=newSession();s.collection.choice='All';s.scopes.item={...emptyShoppingPreferences(),category:'Clothing',subcategory:'Dresses',occasion:'Work',max_price:150};s.context.latest=rows.slice(3,5).map(snapshot);
  const m='I do not like the Burgundy Maxi Dress. Please do not show it again; keep work dresses under A$150.';
  const result=run(s,m,plan(m,{reference:{kind:'id',value:'R'},changes:[{scope:'item',field:'product_type',operation:'set',value:'Maxi Dress',evidence:'Burgundy Maxi Dress'}],styling_intent:{preferences:[],outfit_changes:[{operation:'reject',reference:{kind:'id',value:'R'},evidence:'I do not like the Burgundy Maxi Dress'}],owned_categories:[],offers:null}}));
  assert.equal(result.session.scopes.item.product_type,null);assert.ok(result.session.styling.rejected_ids.includes('R'));
  assert.ok([...result.reply.products,...result.reply.alternatives].some(p=>p.product_id==='W'));
});
check('Jacket and shirt component extraction uses Outerwear and Tops',()=>{
  const components=[...requestedComponents('Find a jacket and shirt with A$300 total for both.').values()];
  assert.equal(components.length,2);assert.ok(components.some(p=>p.subcategory==='Outerwear'));assert.ok(components.some(p=>p.subcategory==='Tops'));
});
check('An owned blazer is a styling anchor rather than a purchase component',()=>{
  const c=requestedComponents('I already own a navy blazer. Find trousers and a shirt to wear with it for work, A$220 for the new pieces together.');
  assert.equal(c.size,2);assert.ok(!c.has('Outerwear'));
});
check('Named candidates are reviewed with an owned blazer without saving them',()=>{
  const s=newSession();s.context.latest=[snapshot(rows[5]),snapshot(rows[6])];
  s.styling.external_items=[{external_id:'external-1',source:'customer_description',description:'navy blazer',category:'Clothing',product_type:'Blazer',colour:'navy',occasion:null}];
  const result=run(s,'Would the Grey Denim Jacket and Red Shirt work with my navy blazer? What is their total?');
  assert.match(result.reply.message,/A\$170\.00/);assert.match(result.reply.message,/navy blazer/);
  assert.doesNotMatch(result.reply.message,/Only one specific piece/);assert.deepEqual(result.session.styling,s.styling);
});
check('Duplicate references, quantities and current prices produce an exact total',()=>{
  const s=newSession();s.context.latest=rows.slice(0,3).map(snapshot);
  const m='What is the total for two Sage Midi Dress and Red Block Heels?';
  const result=run(s,m);assert.equal(result.reply.combination_summary.purchase_total_aud,330);
  assert.equal(run(s,'What is the total for seven Sage Midi Dress and Red Block Heels?').reply.combination_summary.purchase_total_aud,1005);
  const output=plan('Total these pieces',{action:'none',answer:{kind:'combination',topics:['total_price'],references:[{kind:'id',value:'D'},{kind:'id',value:'D'},{kind:'id',value:'S'}],purpose:null,continuation:false}});
  const reply=finishConversationTurn(rows.map(p=>p.product_id==='D'?{...p,price_aud:140}:p),makeTurn(s,'Total these pieces'),output,vocabulary);
  assert.equal(reply.combination_summary.purchase_total_aud,200);assert.equal(reply.combination_summary.items.length,2);
});
check('A missing current price prevents a fabricated full total',()=>{
  const s=newSession();s.context.latest=rows.slice(0,3).map(snapshot);const m='What is the total for Sage Midi Dress and Red Block Heels?';
  const t=makeTurn(s,m);const reply=finishConversationTurn(rows.map(p=>p.product_id==='D'?{...p,price_aud:null}:p),t,shortcutPlan(t),vocabulary);
  assert.equal(reply.combination_summary.purchase_total_aud,null);assert.match(reply.message,/price is missing/);
});
check('Owned catalogue pieces cost zero in a new purchase total',()=>{
  const s=newSession();s.context.latest=rows.slice(0,3).map(snapshot);s.styling.outfit=[{...snapshot(rows[0]),ownership:'owned'}];
  const r=run(s,'What is the total for Sage Midi Dress and Red Block Heels?');assert.equal(r.reply.combination_summary.purchase_total_aud,60);
});
check('Bright and flexible are guidance rather than literal hard labels',()=>{
  const s=newSession();s.collection.choice='All';const m='Show me bright clothing with a flexible fit under A$150.';
  const r=run(s,m,plan(m,{action:'new_search',changes:[{scope:'item',field:'preferred_colours',operation:'set',value:['Bright'],evidence:'bright'},{scope:'item',field:'fit',operation:'set',value:'Flexible',evidence:'flexible fit'}]}));
  assert.deepEqual(r.session.scopes.item.preferred_colours,[]);assert.equal(r.session.scopes.item.fit,null);
  assert.ok(r.session.task.brief.guidance.length);assert.notEqual(r.reply.status,'needs_clarification');
});
check('Green prompts recorded shade choices without changing the saved request',()=>{
  const s=newSession();const m='Show me green bags under A$100.';
  const r=run(s,m,plan(m,{action:'new_search',changes:[{scope:'item',field:'preferred_colours',operation:'set',value:['Green'],evidence:'green'}]}));
  assert.equal(r.reply.status,'needs_clarification');assert.match(r.reply.message,/related shades:.*Sage/);assert.deepEqual(r.session.scopes.item.preferred_colours,['Green']);
});
check('Confirmed shade choices survive compound wording while questions do not select a shade',()=>{
  const s=newSession();s.scopes.item={...emptyShoppingPreferences(),category:'Bags',preferred_colours:['Green'],max_price:100};
  s.task.issues=[{id:'colour',code:'invalid_preference',field:'preferred_colours',scope:'item',value:'Green',saved_value:null,options:['Sage','Olive']}];
  const m='Sage is fine. Change green to sage, keep A$100, and keep bag size labelled unverified.';
  assert.deepEqual(prepareConversationTask(makeTurn(s,m)).scopes.item.preferred_colours,['Sage']);
  assert.equal(confirmedColourChoice('Can the Sage bag arrive by Friday?',s.task.issues),null);
  assert.equal(confirmedColourChoice('Not Sage. Olive, please.',s.task.issues)?.value,'Olive');
});
check('Named-combination shortcuts do not swallow an explicit new search',()=>{
  const s=newSession();s.context.latest=rows.slice(0,3).map(snapshot);
  assert.equal(shortcutPlan(makeTurn(s,'Find shoes to work with Sage Midi Dress under A$100 total.')),null);
});
check('Duplicate product names ask for a reference rather than summing both records',()=>{
  const s=newSession();s.context.latest=[snapshot(rows[0]),snapshot({...rows[0],product_id:'D2'}),snapshot(rows[1])];
  const r=run(s,'What is the total for Sage Midi Dress and Red Block Heels?');
  assert.equal(r.reply.combination_summary,null);assert.match(r.reply.message,/More than one product/);
});
check('A model cannot omit a literal linen material or replace it with blend',()=>{
  const m='I only want a linen dress in size 12 under A$50. Do not substitute material, size or price.';
  for(const changes of [[],[{scope:'item',field:'material',operation:'set',value:'Linen Blend',evidence:'linen'}]]){
    const r=run(newSession(),m,plan(m,{action:'new_search',changes}));assert.equal(r.session.scopes.item.material,'Linen');assert.equal(r.reply.status,'needs_clarification');
  }
});
check('Travel goal and combined total survive collection and accepted piece roles',()=>{
  const m='I am packing a small wardrobe for warm afternoons and cool evenings, A$300 total.';
  const first=run(newSession(),m,plan(m,{action:'discover',discovery_intent:'everyday'}));
  const second=run(first.session,'Both collections, please.');
  assert.equal(second.session.task.brief.total_budget_aud,300);assert.equal(second.session.discovery.stage,'components');
  const choose='Find a jacket and shirt using my saved total budget.';
  const third=run(second.session,choose,plan(choose));
  assert.equal(third.reply.outfit_budget.limit_aud,300);assert.ok(third.reply.products.some(p=>p.product_id==='J'));assert.ok(third.reply.products.some(p=>p.product_id==='T'));
});
check('Grouped provisional results label the unknown on every card and retain a deadline',()=>{
  const s=newSession();s.scopes.unresolved_item=['shoes suited to grass'];
  const m='Browse provisional dress and shoes options for this weekend under A$300 total with grass suitability unverified.';
  const r=run(s,m,plan(m,{outfit_request:{total_budget_aud:300,evidence:m,items:[{...emptyShoppingPreferences(),category:'Clothing',subcategory:'Dresses'},{...emptyShoppingPreferences(),category:'Shoes'}]}}));
  assert.match(r.reply.message,/provisional/i);assert.match(r.reply.message,/can't confirm arrival/);
  assert.ok(r.reply.products.every(p=>p.unverified_requirements.includes('shoes suited to grass')));
});
check('Permission to browse softness unverified cannot make the requirement disappear',()=>{
  const s=newSession();s.collection.choice='All';s.scopes.item={...emptyShoppingPreferences(),category:'Clothing',max_price:150};
  const m='Both collections are fine. Show me everyday clothing under A$150 with softness unverified and labelled.';
  const r=run(s,m,plan(m));assert.equal(r.reply.alternative_kind,'unverified_preview');
  assert.ok(r.reply.unverified_requirements.some(value=>/softness/.test(value)));assert.equal(r.reply.products.length,0);
});
check('No substitutions is a scope instruction rather than a garment feature',()=>{
  const m='Please retry: I only want a linen dress under A$50, with no substitutions.';
  const r=run(newSession(),m,plan(m,{action:'new_search',changes:[{scope:'item',field:'unresolved',operation:'add',value:['no substitutions'],evidence:'no substitutions'}]}));
  assert.ok(!r.session.scopes.unresolved_item.includes('no substitutions'));assert.equal(r.session.scopes.item.material,'Linen');
  assert.ok(r.reply.issues.some(value=>value.field==='material'));
  const saved=newSession();saved.scopes.unresolved_item=['no substitutions','fabric softness'];
  const prepared=prepareConversationTask(makeTurn(saved,'Keep my limits.'));
  assert.deepEqual(prepared.scopes.unresolved_item,['fabric softness']);
});
console.log(`${passed} passed; ${failed} failed.`);if(failed)process.exitCode=1;
