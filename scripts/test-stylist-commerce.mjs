import assert from 'node:assert/strict';
import { retrieveCrossSell } from '../lib/search/crossSell.ts';
import { retrieveUpsell } from '../lib/search/upsell.ts';
import { scoreCompatibility } from '../lib/search/stylingCompatibility.ts';
import { meetsFeatureRequirements } from '../lib/search/productBenefits.ts';
import { emptyShoppingPreferences } from '../lib/stylist/preferenceScope.ts';
import { VerifiedFeatureSchema, RecommendationEventSchema, COMMERCE_POLICY } from '../lib/stylist/commerceSchema.ts';
import { newSession, makeTurn, snapshot, acceptReply, TurnReplySchema } from '../lib/stylist/conversationProtocol.ts';
import { finishConversationTurn, shortcutPlan, cancellationReply } from '../lib/stylist/conversationTurn.ts';
import { checkConversationPlan, generateValidatedConversationPlan } from '../lib/stylist/conversationPlan.ts';

// Synthetic records stand in for merchant-reviewed facts; they are never seeded into the real catalogue.
const dress = { product_id:'D1', product_name:'Summer Dress', category:'Clothing', subcategory:'Dresses', product_type:'Wrap Dress', price_aud:80, stock_qty:5, is_available:true, sizes_available:['10'], colour:'Lavender', occasion:'Beach Wedding', style:'Relaxed', season:'Summer', fit:'Regular', material:'Cotton', gender:null, brand_line:null, description:null, tags:[], image_key:null, cross_sell_category:'Bags' };
const winter = { ...dress, product_id:'D2', product_name:'Winter Dress', occasion:'Work', style:'Formal', season:'Winter', colour:'Burgundy' };
const bag = { ...dress, product_id:'B1', product_name:'Summer Bag', category:'Bags', subcategory:'Clutches', product_type:'Clutch', price_aud:40, colour:'Beige', sizes_available:['One Size'], cross_sell_category:null };
const winterBag = { ...bag, product_id:'B2', product_name:'Winter Bag', stock_qty:100, occasion:'Work', style:'Formal', season:'Winter', colour:'Black' };
const shoe = { ...bag, product_id:'S1', product_name:'Summer Sandals', category:'Shoes', subcategory:'Sandals', product_type:'Flat Sandals', sizes_available:['38'] };
const premium = { ...dress, product_id:'D3', product_name:'Adjustable Dress', price_aud:105 };
const rows = [dress, winter, bag, winterBag, shoe, premium];
const vocabulary = { rows, sizes:['10','12','38','One Size'], categories:[{category:'Clothing',subcategory:null},{category:'Clothing',subcategory:'Dresses'},{category:'Bags',subcategory:null},{category:'Bags',subcategory:'Clutches'},{category:'Shoes',subcategory:null},{category:'Shoes',subcategory:'Sandals'}] };
const prefs = extra => ({ ...emptyShoppingPreferences(), category:'Clothing', subcategory:'Dresses', product_type:'Wrap Dress', max_price:150, ...extra });
const fact = (product, key, value, extra={}) => ({ product_id:product.product_id, feature_key:key, value, source_reference:`fixture:merchant-document/${product.product_id}/${key}`, source_version:'review-1', review_status:'verified', verified_at:'2026-10-16T00:00:00Z', ...extra });
const original = { ...dress, verified_features:[fact(dress,'adjustable_strap',false), fact(dress,'lining',true)] };
const upgraded = { ...premium, verified_features:[fact(premium,'adjustable_strap',true), fact(premium,'lining',true)] };
const upgrade = (catalogue=[original, upgraded], options={}, preferences={}) => retrieveUpsell(catalogue, { primary_product_id:'D1', preferences:prefs(preferences) }, vocabulary, { priorities:['adjustability'], allowComparable:true, ...options });
const intent = extra => ({ preferences:[], outfit_changes:[], owned_categories:[], offers:null, ...extra });
const plan = (message, extra={}) => ({ action:'none', intent_evidence:message, reference:null, changes:[], question:null, continuation:false, ...extra });
const finish = (turn, output, catalogue=rows) => finishConversationTurn(catalogue, turn, output, vocabulary);
const session = () => { const state=newSession(); state.context.latest=[snapshot(dress),snapshot(bag),snapshot(winterBag)]; return state; };
let passed=0;
async function check(name, run) { await run(); passed++; console.log(`PASS: ${name}`); }

await check('Changing the anchor changes rankings on an occasion/style counterfactual',()=>{
 const summer=retrieveCrossSell(rows,{primary_product_id:'D1'},vocabulary);
 const work=retrieveCrossSell(rows,{primary_product_id:'D2'},vocabulary);
 assert.equal(summer.products[0].product_id,'B1'); assert.equal(work.products[0].product_id,'B2');
 assert.ok(summer.products[0].pairing_evidence.reasons.some(reason=>reason.includes('Beach Wedding')));
});
await check('An explicit Shoes request overrides the default Bags rule without substituting a bag',()=>{
 const reply=retrieveCrossSell(rows,{primary_product_id:'D1'},vocabulary,{...emptyShoppingPreferences(),category:'Shoes'});
 assert.equal(reply.status,'matches'); assert.deepEqual(reply.products.map(row=>row.product_id),['S1']);
 assert.equal(reply.applied_preferences.category,'Shoes');
});
await check('Explicit requested roles work when there is no default pairing rule',()=>{
 const reply=retrieveCrossSell([{...dress,cross_sell_category:null},shoe],{primary_product_id:'D1'},vocabulary,{...emptyShoppingPreferences(),category:'Shoes'});
 assert.equal(reply.products[0].product_id,'S1');
});
await check('A generic extra uses the next approved role instead of an already-owned category',()=>{
 const reply=retrieveCrossSell([{...dress,pairing_categories:['Bags','Shoes']},bag,shoe],{primary_product_id:'D1'},vocabulary,undefined,{occupied_categories:['Bags']});
 assert.deepEqual(reply.products.map(row=>row.product_id),['S1']);
});
await check('Stock cannot override a stronger compatibility score',()=>{
 const reply=retrieveCrossSell(rows,{primary_product_id:'D1'},vocabulary);
 assert.equal(reply.products[0].product_id,'B1'); assert.ok(winterBag.stock_qty>bag.stock_qty);
});
await check('Compatibility never relaxes hard colours, exclusions, size or budget',()=>{
 const filter={...emptyShoppingPreferences(),category:'Bags',preferred_colours:['Black'],excluded_colours:['Beige'],max_price:40,size:'One Size'};
 const reply=retrieveCrossSell(rows,{primary_product_id:'D1'},vocabulary,filter);
 assert.deepEqual(reply.products.map(row=>row.product_id),['B2']); assert.deepEqual(reply.applied_preferences,filter);
});
await check('Limited evidence stays labelled instead of becoming a confident match',()=>{
 const value=scoreCompatibility({...bag,style:null,occasion:null,season:null,colour:null},[{...dress,style:null,occasion:null,season:null,colour:null}]);
 assert.equal(value.evidence.level,'limited'); assert.match(value.evidence.reasons.join(' '),/little recorded evidence/);
});
await check('A verified relevant feature can justify an upgrade without an extra context label',()=>{
 const reply=upgrade(); assert.equal(reply.status,'options');
 const comparison=reply.products[0].value_comparison;
 assert.equal(comparison.extra_cost_aud,25); assert.equal(comparison.kind,'upgrade');
 assert.equal(comparison.benefits[0].feature_key,'adjustable_strap');
 assert.equal(comparison.benefits[0].source_references.length,2);
});
await check('Unknown original features cannot establish an improvement',()=>{
 const reply=upgrade([{...original,verified_features:[]},upgraded]); assert.equal(reply.status,'no_upsell');
});
await check('Draft, malformed and mismatched-product evidence cannot qualify',()=>{
 for(const feature of [fact(premium,'adjustable_strap',true,{review_status:'draft'}),fact(premium,'adjustable_strap','true'),fact(premium,'adjustable_strap',true,{source_reference:''}),fact(dress,'adjustable_strap',true)]) {
  assert.equal(upgrade([original,{...upgraded,verified_features:[feature]}]).status,'no_upsell');
 }
});
await check('Feature value types and source review dates are checked',()=>{
 assert.equal(VerifiedFeatureSchema.safeParse(fact(dress,'capacity_litres',false)).success,false);
 assert.equal(VerifiedFeatureSchema.safeParse(fact(dress,'capacity_litres',-1)).success,false);
 assert.equal(VerifiedFeatureSchema.safeParse(fact(dress,'use_cases',true)).success,false);
 assert.equal(VerifiedFeatureSchema.safeParse(fact(dress,'lining',true,{verified_at:'yesterday'})).success,false);
});
await check('More expensive identical features never establish a benefit',()=>{
 assert.equal(upgrade([original,{...upgraded,verified_features:[fact(premium,'adjustable_strap',false)]}]).status,'no_upsell');
});
await check('Same-price and cheaper benefits are honest alternatives, ranked before more expensive equivalents',()=>{
 const same={...upgraded,product_id:'D4',product_name:'Same Price',price_aud:80,verified_features:[fact({product_id:'D4'},'adjustable_strap',true)]};
 const less={...same,product_id:'D5',product_name:'Lower Price',price_aud:70,verified_features:[fact({product_id:'D5'},'adjustable_strap',true)]};
 const reply=upgrade([original,upgraded,same,less]);
 assert.equal(reply.products[0].product_id,'D5');
 assert.equal(reply.products[0].value_comparison.kind,'alternative');
 assert.equal(reply.products[0].value_comparison.extra_cost_aud,-10);
 assert.equal(reply.products.find(row=>row.product_id==='D4').value_comparison.extra_cost_aud,0);
});
await check('Feature losses are disclosed and explicit must-haves cannot be sacrificed',()=>{
 const loss={...upgraded,verified_features:[fact(premium,'adjustable_strap',true),fact(premium,'lining',false)]};
 assert.ok(upgrade([original,loss]).products[0].value_comparison.tradeoffs.some(text=>/lacks lining/.test(text)));
 assert.equal(upgrade([original,loss],{required_features:['lining']}).status,'no_upsell');
});
await check('Upgrades preserve the budget including zero and the exact inclusive boundary',()=>{
 assert.equal(upgrade(undefined,{}, {max_price:104}).status,'no_upsell');
 assert.equal(upgrade(undefined,{}, {max_price:105}).products[0].price_aud,105);
 assert.equal(upgrade(undefined,{}, {max_price:0}).products.length,0);
});
await check('Previously matched context still cannot be sacrificed for a feature',()=>{
 assert.equal(upgrade([original,{...upgraded,style:'Formal'}],{}, {style:'Relaxed'}).status,'no_upsell');
});
await check('Related types require internal permission and stay in the same functional subcategory',()=>{
 const other={...upgraded,product_type:'Maxi Dress'};
 assert.equal(upgrade([original,other]).status,'no_upsell');
 assert.equal(upgrade([original,other],{allowRelatedTypes:true}).products[0].product_id,'D3');
 assert.equal(upgrade([original,{...other,subcategory:'Jackets'}],{allowRelatedTypes:true}).status,'no_upsell');
});
await check('Required features fail closed instead of inferring facts from descriptions',()=>{
 assert.equal(meetsFeatureRequirements({...dress,description:'This has pockets.'},['pockets']),false);
 assert.equal(meetsFeatureRequirements({...dress,verified_features:[fact(dress,'pockets',true)]},['pockets']),true);
});
await check('Keeping a card stores an outfit choice without adding it to the cart or auto-selecting other cards',()=>{
 const turn=makeTurn(session(),'Keep the Summer Dress',null,{kind:'keep',product_id:'D1'});
 const reply=finish(turn,shortcutPlan(turn)); const next=acceptReply(turn,reply).session;
 assert.equal(reply.status,'no_action'); assert.deepEqual(next.styling.outfit.map(row=>row.product_id),['D1']);
 assert.equal(next.styling.outfit[0].ownership,'selected');
 assert.deepEqual(next.scopes,turn.scopes); assert.deepEqual(reply.products,[]);
});
await check('Outfit choices survive new results, product questions and cancellation',()=>{
 const turn=makeTurn(session(),'Keep the Summer Dress',null,{kind:'keep',product_id:'D1'});
 let state=acceptReply(turn,finish(turn,shortcutPlan(turn))).session;
 const search=makeTurn(state,'Show shoes');
 const reply=finish(search,plan(search.message,{action:'new_search',changes:[{scope:'item',field:'category',operation:'set',value:'Shoes',evidence:'shoes'}]}));
 state=acceptReply(search,reply).session;
 const next=makeTurn(state,'Find a bag for Summer Dress');
 assert.ok(next.context.selected.some(row=>row.product_id==='D1'));
 const checked=checkConversationPlan(next,plan(next.message,{action:'cross_sell',reference:{kind:'name',value:'Summer Dress'},changes:[{scope:'item',field:'category',operation:'set',value:'Bags',evidence:'bag'}]}));
 assert.deepEqual(checked.reference_product_ids,['D1']);
 const cancelled=cancellationReply(makeTurn(state,'cancel')); assert.deepEqual(cancelled.styling,state.styling);
 const question=makeTurn(state,'What is Summer Dress made of?');
 const answer=finish(question,plan(question.message,{answer:{kind:'product',topics:['material'],references:[{kind:'name',value:'Summer Dress'}],purpose:null,continuation:false}}));
 assert.deepEqual(answer.styling,state.styling);
});
await check('A later keep replaces the selected item in the same outfit role',()=>{
 const state=session(); state.context.latest=[snapshot(dress),snapshot(winter)];
 const first=makeTurn(state,'Keep summer',null,{kind:'keep',product_id:'D1'});
 const next=makeTurn(acceptReply(first,finish(first,shortcutPlan(first))).session,'Keep winter',null,{kind:'keep',product_id:'D2'});
 const reply=finish(next,shortcutPlan(next)); assert.deepEqual(reply.styling.outfit.map(row=>row.product_id),['D2']);
});
await check('Owned items and rejected products are retained and not repeated as additions',()=>{
 const state=session(); const own=makeTurn(state,'I own Summer Bag',null,{kind:'own',product_id:'B1'});
 const saved=acceptReply(own,finish(own,shortcutPlan(own))).session;
 const reject=makeTurn(saved,'Skip Winter Bag',null,{kind:'reject',product_id:'B2'});
 const next=acceptReply(reject,finish(reject,shortcutPlan(reject))).session;
 assert.equal(next.styling.outfit[0].ownership,'owned'); assert.deepEqual(next.styling.rejected_ids,['B2']);
 const turn=makeTurn(next,'Find a bag for Summer Dress');
 const reply=finish(turn,plan(turn.message,{action:'cross_sell',reference:{kind:'id',value:'D1'},changes:[{scope:'item',field:'category',operation:'set',value:'Bags',evidence:'bag'}]}));
 assert.equal(reply.products.length+reply.alternatives.length,0);
});
await check('Unlisted owned roles and no-extras are explicit, evidence-backed preferences',()=>{
 const turn=makeTurn(session(),'I already own a bag. No extras');
 const reply=finish(turn,plan(turn.message,{styling_intent:intent({owned_categories:[{category:'Bags',operation:'add',evidence:'own a bag'}],offers:{paused:true,evidence:'No extras'}})}));
 assert.deepEqual(reply.styling.owned_categories,['Bags']); assert.equal(reply.styling.offers_paused,true);
 assert.throws(()=>finish(turn,plan(turn.message,{styling_intent:intent({offers:{paused:false,evidence:'resume offers'}})})),/evidence/);
});
await check('Outfit actions preserve an unrelated pending shopping question',()=>{
 const state=session(); state.pending={action:'cross_sell',reference:null,goal:'Find a bag',question:'Which dress?',before_scopes:state.scopes};
 const turn=makeTurn(state,'Keep this dress',null,{kind:'keep',product_id:'D1'});
 const reply=finish(turn,shortcutPlan(turn)); assert.deepEqual(reply.pending,state.pending);
});
await check('Shared context checks happen before the display cap',()=>{
 const state=session(); state.scopes.shared.occasion='Work';
 const bad=Array.from({length:6},(_,index)=>({...bag,product_id:`BAD${index}`,product_name:`Bad ${index}`,stock_qty:1000}));
 const turn=makeTurn(state,'Show bags');
 const reply=finish(turn,plan(turn.message,{action:'new_search',changes:[{scope:'item',field:'category',operation:'set',value:'Bags',evidence:'bags'}]}),[...bad,winterBag]);
 assert.deepEqual(reply.products.map(row=>row.product_id),['B2']);
 const fresh=makeTurn(session(),'Show bags and keep Work for every item');
 const updated=finish(fresh,plan(fresh.message,{action:'new_search',changes:[
  {scope:'item',field:'category',operation:'set',value:'Bags',evidence:'bags'},
  {scope:'shared',field:'occasion',operation:'set',value:'Work',evidence:'Work'},
 ]}),[...bad,winterBag]);
 assert.deepEqual(updated.products.map(row=>row.product_id),['B2']);
});
await check('The active conversation preserves typed feature comparisons on cards',()=>{
 const state=session(); state.context.latest=[snapshot(original)]; state.scopes.item=prefs(); state.styling.priorities=['adjustability'];
 const turn=makeTurn(state,'Compare value',snapshot(original),{kind:'upsell',product_id:'D1'});
 const reply=finish(turn,shortcutPlan(turn),[original,upgraded]);
 assert.equal(reply.status,'matches'); assert.equal(reply.products[0].value_comparison.benefits[0].feature_key,'adjustable_strap');
 assert.match(reply.products[0].explanation,/adjustable strap/i); assert.doesNotMatch(reply.message,/higher-priced alternatives.*match to a preference/);
 const forged=structuredClone(reply); forged.products[0].value_comparison.extra_cost_aud=24;
 assert.throws(()=>TurnReplySchema.parse(forged));
 const compared=acceptReply(turn,reply).session;
 assert.equal(compared.context.comparison.product_id,'D1');
 assert.ok(compared.context.latest.some(product=>product.product_id==='D3'));
 const followup=makeTurn(compared,'Pockets would be useful');
 assert.equal(shortcutPlan(followup).reference.value,'D1');
 assert.equal(finish(followup,shortcutPlan(followup),[original,upgraded]).action,'upsell');
});
await check('An unfulfilled feature requirement stays saved with a useful information-limit answer',()=>{
 const turn=makeTurn(session(),'Show bags with pockets');
 assert.throws(()=>checkConversationPlan(turn,plan(turn.message,{action:'new_search',changes:[{scope:'item',field:'category',operation:'set',value:'Bags',evidence:'bags'}]})),/kind=requirement/);
 const reply=finish(turn,plan(turn.message,{action:'new_search',changes:[{scope:'item',field:'category',operation:'set',value:'Bags',evidence:'bags'}],styling_intent:intent({preferences:[{kind:'requirement',operation:'add',value:'pockets',evidence:'with pockets'}]})}));
 assert.equal(reply.status,'no_match'); assert.deepEqual(reply.styling.required_features,['pockets']); assert.match(reply.message,/couldn't verify/);
 const exact=finish(turn,shortcutPlan(turn));assert.equal(exact.status,'no_match');assert.deepEqual(exact.proposed_scopes.item.preferred_colours,[]);
 const next=acceptReply(turn,exact).session;
 const remove=makeTurn(next,'Remove my pockets requirement and show me bags');
 const removed=finish(remove,shortcutPlan(remove));assert.deepEqual(removed.styling.required_features,[]);assert.ok(removed.products.length);
 for(const message of ['Show bags with pockets under $50','Show bags with pockets but no leather','Show bags with no pockets']) assert.equal(shortcutPlan(makeTurn(session(),message)),null);
 assert.throws(()=>checkConversationPlan(turn,plan(turn.message,{action:'new_search',changes:[{scope:'item',field:'preferred_colours',operation:'add',value:['pockets'],evidence:'pockets'}]})),/Construction and care features/);
});
await check('No-benefit comparisons retain the reference for a subsequent priority answer',()=>{
 const turn=makeTurn(session(),'Compare value',snapshot(dress),{kind:'upsell',product_id:'D1'});
 const reply=finish(turn,shortcutPlan(turn)); const next=acceptReply(turn,reply).session;
 assert.equal(reply.status,'no_upsell'); assert.equal(next.context.focused.product_id,'D1');
 const followup=makeTurn(next,'Pockets would be useful');
 const result=finish(followup,shortcutPlan(followup));
 assert.equal(result.action,'upsell');assert.equal(result.comparison_reference_id,'D1');
 assert.ok(result.styling.priorities.includes('pockets'));
 assert.deepEqual(result.proposed_scopes,next.scopes);
 for(const message of ['No pockets','Pockets and lower my budget to $50','Pockets, but no leather']) {
  assert.equal(shortcutPlan(makeTurn(next,message)),null);
 }
 const unrelated=structuredClone(next);unrelated.history.at(-1).content='What would you like to find?';
 delete unrelated.context.comparison;
 assert.equal(shortcutPlan(makeTurn(unrelated,'Pockets would be useful')),null);
});
await check('Repeated category requests cannot reset to an empty item scope',async()=>{
 const state=session();state.scopes.item.category='Bags';state.scopes.item.max_price=50;
 const turn=makeTurn(state,'Show me bags');let calls=0;
 const result=await generateValidatedConversationPlan(turn,async(_field,feedback)=>{
  if(++calls===1)return plan(turn.message,{action:'new_search'});
  assert.match(feedback,/empty new_search/);return plan(turn.message,{action:'refine'});
 });
 const reply=finish(turn,result);assert.equal(calls,2);assert.ok(reply.products.length);assert.equal(reply.proposed_scopes.item.max_price,50);
});
await check('Finding a feature-based replacement is not blocked by a spurious two-product comparison question',async()=>{
 const state=session();state.context.focused=snapshot(dress);state.scopes.item=prefs();
 const turn=makeTurn(state,'Compare a replacement with pockets under $150');let calls=0;
 const result=await generateValidatedConversationPlan(turn,async(_field,feedback)=>{
  if(++calls===1)return plan(turn.message,{action:'upsell',reference:{kind:'context'},answer:{kind:'compare',topics:['recommendation'],references:[{kind:'context'}],purpose:null,continuation:false}});
  assert.match(feedback,/replacement/);
  return plan(turn.message,{action:'upsell',reference:{kind:'context'},styling_intent:intent({preferences:[
   {kind:'priority',operation:'add',value:'pockets',evidence:'pockets'},
   {kind:'requirement',operation:'add',value:'pockets',evidence:'with pockets'},
  ]})});
 });
 const reply=finish(turn,result,[{...dress,verified_features:[fact(dress,'pockets',false)]},{...premium,verified_features:[fact(premium,'pockets',true)]}]);
 assert.equal(calls,2);assert.equal(reply.action,'upsell');assert.equal(reply.status,'matches');assert.equal(reply.products[0].product_id,'D3');
});
await check('Telemetry accepts only minimal typed interaction data, never transcripts or sales claims',()=>{
 const record={event_id:crypto.randomUUID(),session_id:crypto.randomUUID(),recommendation_id:crypto.randomUUID(),event_type:'impression',product_id:'D1',position:1,policy_version:COMMERCE_POLICY};
 assert.equal(RecommendationEventSchema.safeParse(record).success,true);
 for(const override of [{message:'private transcript'},{event_type:'purchase'},{price:100},{position:5}]) assert.equal(RecommendationEventSchema.safeParse({...record,...override}).success,false);
});
console.log(`\n${passed} stylist-commerce checks passed.`);
