import assert from 'node:assert/strict';
import { product } from './fixtures/customer-scenarios.mjs';
import { newSession, makeTurn, acceptReply, snapshot, TurnReplySchema } from '../lib/stylist/conversationProtocol.ts';
import { finishConversationTurn, shortcutPlan } from '../lib/stylist/conversationTurn.ts';
import { messageProductReference, resolveProductReference } from '../lib/stylist/productReference.ts';
import { statedCombinedBudget } from '../lib/stylist/combinedShoppingRequest.ts';
import { requestedClothing, shoppingBrief, explicitCollection } from '../lib/stylist/collectionPreference.ts';

// Controlled catalogue, adversarial model plans, full domain/reply/session path.
// Separate live retests are required to assess real model interpretation.
const top = product('TOP', 'Clothing', 170, { product_name: 'Silver Blouse', subcategory: 'Tops', product_type: 'Blouse', material: 'Cotton', fit: 'Regular', occasion: 'Work', colour: 'Silver' });
const pants = product('PANTS', 'Clothing', 140, { product_name: 'Grey Trousers', subcategory: 'Bottoms', product_type: 'Tailored Trousers', occasion: 'Work' });
const beige = product('BEIGE', 'Clothing', 100, { product_name: 'Beige Linen Shirt', subcategory: 'Tops', product_type: 'Linen Shirt', material: 'Cotton', colour: 'Beige', occasion: 'Brunch' });
const brown = product('BROWN', 'Clothing', 40, { product_name: 'Brown Linen Shirt', subcategory: 'Tops', product_type: 'Linen Shirt', material: 'Cotton', colour: 'Brown' });
const black = product('BLACK', 'Clothing', 95, { product_name: 'Black Linen Shirt', subcategory: 'Tops', product_type: 'Linen Shirt', material: 'Linen Blend' });
const scarf = product('SCARF', 'Accessories', 25, { product_name: 'Blue Lightweight Scarf', product_type: 'Lightweight Scarf', subcategory: 'Scarves', colour: 'Blue', gender: 'Unisex', occasion: 'Casual', fit: 'Standard', cross_sell_category: 'Bags' });
const grey = product('GREY', 'Accessories', 80, { product_name: 'Grey Silk Scarf', product_type: 'Silk Scarf', subcategory: 'Scarves', colour: 'Grey', gender: 'Men', occasion: 'Travel', fit: 'Standard' });
const jewellery = product('JEWEL', 'Accessories', 15, { product_name: 'Blue Bracelet', product_type: 'Bracelet', colour: 'Blue', occasion: 'Casual', gender: 'Unisex' });
const bag = product('BAG9', 'Bags', 9, { product_name: 'Beige Clutch', colour: 'Beige', occasion: 'Brunch' });
const dearBag = product('BAG20', 'Bags', 20, { product_name: 'Blue Clutch', colour: 'Blue', occasion: 'Casual' });
const platform = product('PLATFORM', 'Shoes', 100, { product_name: 'Sage Platform Sandals', subcategory: 'Sandals', product_type: 'Platform Sandals', colour: 'Sage', occasion: 'Casual' });
const flat = product('FLAT', 'Shoes', 65, { product_name: 'Blue Flat Sandals', subcategory: 'Sandals', product_type: 'Flat Sandals', colour: 'Blue', occasion: 'Casual' });
const rows = [top, pants, beige, brown, black, scarf, grey, jewellery, bag, dearBag, platform, flat];
const vocab = catalogue => ({ rows: catalogue, sizes: [...new Set(catalogue.flatMap(p => p.sizes_available))], categories: [
  ...['Clothing','Shoes','Bags','Accessories'].map(category=>({category,subcategory:null})),
  ...catalogue.map(({ category, subcategory }) => ({ category, subcategory })),
] });
const change = (field, value, evidence, operation='set') => ({ scope:'item', field, value, evidence, operation });
const plan = (message, extra={}) => ({ action:'refine', intent_evidence:message.slice(0,250), changes:[], reference:null, question:null, continuation:false, ...extra });
function run(state, message, output, catalogue=rows) {
  const turn=makeTurn(state,message);
  const reply=finishConversationTurn(catalogue,turn,output??shortcutPlan(turn),vocab(catalogue));
  return { ...acceptReply(turn,reply), turn };
}
const known = (...products) => { const s=newSession(); s.context.latest=products.map(snapshot); return s; };
const all = reply => [...reply.products,...reply.alternatives];
let passed=0,failed=0;
function check(name,test){try{test();passed++;console.log('PASS: '+name);}catch(error){failed++;console.error('FAIL: '+name+' — '+error.stack);}}

check('Store navigation supplies a verified product link and honest prototype/bag steps',()=>{
  for(const message of ['How do I complete the purchase of that blouse in size 12?', 'The store says it is a browsing prototype. Is checkout available, or can I only save the blouse to my bag?', 'Where should I go in this store to select size 12 and save the Silver Blouse to my bag?', 'Please give me the product link for Silver Blouse so I can choose size 12 myself. No other products, thanks.']){
    const s=known(top);s.scopes.item.max_price=180;
    const {reply,session,turn}=run(s,message);
    assert.equal(reply.status,'answered');assert.match(reply.message,/Checkout, payment and order placement are unavailable/);
    assert.match(reply.message,/Add to bag/);assert.doesNotMatch(reply.message,/sample garment length|specifications don't establish/);
    assert.deepEqual(reply.proposed_scopes,turn.scopes);assert.deepEqual(session.styling.outfit,[]);
    assert.ok(reply.answer_sources.some(source=>source.url==='/products/TOP'));
    assert.ok(reply.answer_sources.some(source=>source.url==='/cart'));
  }
});
check('General checkout does not demand a product and navigation does not swallow a mixed search',()=>{
  const {reply}=run(known(top,pants),'Is checkout available?');assert.equal(reply.pending_answer,null);assert.match(reply.message,/browsing prototype/);
  assert.equal(shortcutPlan(makeTurn(known(top),'Find a blue bag under A$50 and give me the product link.')),null);
});
check('Navigation keeps an unrelated pending search and rejects external source links',()=>{
  const s=known(top);s.pending={action:'refine',reference:null,goal:'fit',question:'Which fit?',before_scopes:s.scopes};
  const {reply,session}=run(s,'Is checkout available?');assert.deepEqual(session.pending,s.pending);
  assert.throws(()=>TurnReplySchema.parse({...reply,answer_sources:[{label:'Bad',url:'https://other.example/cart'}]}));
});
check('Work already volunteered is not asked again after collection selection',()=>{
  const s=newSession();const m="I need something nice for work that isn't too formal.";
  const first=run(s,m,plan(m,{action:'discover',discovery_intent:'occasion',changes:[change('occasion','Work','work')]}));
  const second=run(first.session,"Women's, please.");
  assert.ok(all(second.reply).length);assert.doesNotMatch(second.reply.message,/What's the occasion/);
  assert.match(second.reply.optional_question,/fit or spending limit/);assert.equal(second.session.scopes.item.size,null);
});
check('Gift discovery asks about the recipient without inferring a collection or size',()=>{
  const m="I'm looking for a birthday present for my dad, up to A$90. I don't know his clothing size.";
  const first=run(newSession(),m,plan(m,{action:'discover',discovery_intent:'start',changes:[change('max_price',90,'up to A$90')]}));
  assert.equal(first.session.scopes.item.gender,null);assert.equal(first.session.scopes.item.size,null);
  const second=run(first.session,"Men's, please.");
  assert.match(second.reply.message,/your dad.*enjoy wearing or doing/);assert.equal(second.session.task.brief.uncertain_recipient_size,true);
});
check('Recipient dislikes and size uncertainty do not block recommendations or admit jewellery',()=>{
  const s=newSession();s.collection.choice='Men';s.task.brief.gift_recipient='dad';s.task.brief.uncertain_recipient_size=true;s.scopes.item.max_price=90;
  const m="Dad likes blues for everyday use and dislikes jewellery. Something easier to fit would help because I don't know his size.";
  const r=run(s,m,plan(m,{action:'discover',discovery_intent:'everyday',changes:[change('preferred_colours',['Blue'],'blues'),change('occasion','Casual','everyday use'),change('unresolved',['dislikes jewellery','easier to fit'],'dislikes jewellery','add')]}));
  assert.notEqual(r.reply.status,'needs_clarification',r.reply.message);assert.deepEqual(r.session.scopes.unresolved_item,[]);
  assert.ok(all(r.reply).some(p=>p.product_id==='SCARF'));assert.ok(all(r.reply).every(p=>p.product_id!=='JEWEL'));
  assert.ok(r.session.task.brief.excluded_roles.includes('Jewellery'));
});
check('Gift size uncertainty cannot discard an unknown physical requirement',()=>{
  const s=newSession();s.collection.choice='Men';s.task.brief.gift_recipient='dad';s.task.brief.uncertain_recipient_size=true;
  const m='Find a blue scarf with verified softness for Dad.';
  const r=run(s,m,plan(m,{action:'new_search',changes:[change('product_type','Scarf','scarf'),change('unresolved',['verified softness'],'verified softness','add')]}));
  assert.equal(r.reply.status,'needs_clarification');assert.ok(r.session.scopes.unresolved_item.some(x=>/soft/.test(x)));
});
check('Generic scarf is a supported umbrella over lightweight and silk scarves',()=>{
  for(const word of ['scarf','scarves']){
    const s=newSession();s.collection.choice='All';const m=`Show blue or grey ${word} under A$90.`;
    const r=run(s,m,plan(m,{action:'new_search',changes:[change('product_type',word,word)]}));
    assert.ok(all(r.reply).some(p=>p.product_id==='SCARF'));assert.ok(all(r.reply).every(p=>p.subcategory==='Scarves'));
  }
});
check('A requested top overrides the model confusing owned trousers with the purchase',()=>{
  const s=newSession();s.collection.choice='Women';s.scopes.item.occasion='Work';
  const m='I need a regular-fit top in size 12 under A$180 to wear with trousers I already own.';
  const r=run(s,m,plan(m,{changes:[change('category','Clothing','top'),change('subcategory','Bottoms','trousers'),change('product_type','Tailored Trousers','trousers'),change('fit','Regular','regular-fit')]}));
  assert.equal(r.session.scopes.item.subcategory,'Tops');assert.equal(r.session.scopes.item.product_type,null);
  assert.equal(r.session.scopes.item.size,'12');assert.equal(r.session.scopes.item.max_price,180);
  assert.ok(all(r.reply).length);assert.ok(all(r.reply).every(p=>p.subcategory==='Tops'));
});
check('A unique descriptive product reference repairs a filtered-position model error',()=>{
  const s=known(top,platform,pants);s.collection.choice='Women';
  const m='The sage sandals are more my sort of thing than either jacket. I prefer flat shoes under A$110.';
  assert.equal(messageProductReference(s.context,m).reference.value,'PLATFORM');
  const r=run(s,m,plan(m,{reference:{kind:'position',position:2,subcategory:'Sandals'},changes:[change('category','Clothing','shoes'),change('product_type','Flats','flat shoes')]}));
  assert.notEqual(r.reply.status,'needs_clarification');assert.equal(r.session.scopes.item.category,'Shoes');assert.ok(all(r.reply).some(p=>p.product_id==='FLAT'));
});
check('True filtered ordinals and ambiguous descriptions stay distinct from displayed ordinals',()=>{
  const s=known(top,platform,flat);
  assert.equal(resolveProductReference(s.context,{kind:'position',position:2,subcategory:'Sandals'}).product_id,'FLAT');
  assert.equal(resolveProductReference(s.context,{kind:'position',position:2,subcategory:null}).product_id,'PLATFORM');
  s.context.latest.push(snapshot({...flat,product_id:'FLAT2',product_name:'Blue Flat Sandals Two'}));
  assert.equal(messageProductReference(s.context,'The blue sandals, please.').status,'ambiguous');
});
check('Short flats descriptions resolve the footwear rather than another mentioned dress',()=>{
  const s=known(top,{...flat,product_id:'SAGE',product_name:'Sage Ballet Flats',subcategory:'Flats',product_type:'Ballet Flats'},pants);
  assert.equal(messageProductReference(s.context,'The sage flats appeal to me more than the dress.').reference.value,'SAGE');
});
check('Recipient colours are retained even if the model omits plural colour words',()=>{
  const s=newSession();s.collection.choice='Men';s.task.brief.gift_recipient='dad';s.task.brief.uncertain_recipient_size=true;s.scopes.item.max_price=90;
  const m='Dad walks to cafes on weekends, likes understated blues and greys, and dislikes jewellery.';
  const r=run(s,m,plan(m,{action:'discover',discovery_intent:'everyday',changes:[]}));
  assert.deepEqual(r.session.scopes.item.preferred_colours,['Blue','Grey']);assert.ok(all(r.reply).every(p=>['Blue','Grey'].includes(p.colour)));
  const buyer='I like red, but Dad prefers blues and greys.';
  const b=run(s,buyer,plan(buyer,{action:'discover',discovery_intent:'browse',changes:[]}));
  assert.deepEqual(b.session.scopes.item.preferred_colours,['Blue','Grey']);
});
check('A neutral colour direction asks a focused shade question without discarding it',()=>{
  const s=newSession();s.collection.choice='Women';const m='Show neutral flat shoes under A$110.';
  const r=run(s,m,plan(m,{action:'new_search',changes:[change('preferred_colours',['Neutral'],'neutral')]}));
  assert.equal(r.reply.status,'needs_clarification');assert.match(r.reply.message,/Which neutral shade/);
  assert.doesNotMatch(r.reply.message,/Lavender|Pink|Burgundy/);assert.deepEqual(r.session.scopes.item.preferred_colours,['Neutral']);
});
check('Office wording uses Work context without changing preferences or inventing compatibility',()=>{
  const s=known(top);s.scopes.item.occasion='Work';const m='Why choose the Silver Blouse for my office?';
  const r=run(s,m,plan(m,{action:'none',answer:{kind:'product',topics:['recommendation'],references:[{kind:'id',value:'TOP'}],purpose:'my office',continuation:false}}));
  assert.match(r.reply.message,/explicitly lists Work/);assert.doesNotMatch(r.reply.message,/my office is not confirmed|occasion match is uncertain/);
  assert.deepEqual(r.session.scopes,s.scopes);
});
check('Cotton update retains size, fit and occasion; rejected products remain rejected',()=>{
  const s=known(black,brown);s.collection.choice='Women';Object.assign(s.scopes.item,{category:'Clothing',subcategory:'Tops',product_type:'Shirt',occasion:'Beach Wedding',size:'10',fit:'Regular',max_price:110});
  const m='Only cotton please, and my shirt budget is now A$80. Keep size 10 and regular fit.';
  const r=run(s,m,plan(m,{changes:[change('material','Cotton','cotton'),change('max_price',80,'A$80')]}));
  assert.deepEqual(r.reply.products.map(p=>p.product_id),['BROWN']);assert.equal(r.session.scopes.item.occasion,'Beach Wedding');
  assert.match(r.reply.message,/name says Linen.*material is Cotton/);
  const reject='Reject the Brown Linen Shirt. Keep my other requirements.';
  const next=run(r.session,reject,plan(reject,{styling_intent:{preferences:[],outfit_changes:[{operation:'reject',reference:{kind:'id',value:'BROWN'},evidence:'Reject the Brown Linen Shirt'}],owned_categories:[],offers:null}}));
  assert.ok(next.session.styling.rejected_ids.includes('BROWN'));assert.deepEqual(all(next.reply),[]);
});
check('Whole-purchase wording is a combined limit, not the bag maximum',()=>{
  assert.equal(statedCombinedBudget('Is there a bag that keeps the whole purchase under A$110?'),110);
  assert.equal(statedCombinedBudget('A$110 altogether for the shirt and bag.'),110);
  assert.equal(statedCombinedBudget('Under A$110 for each bag.'),null);
});
function exampleAddition(catalogue=rows){
  const s=known(beige);s.collection.choice='Women';s.styling.rejected_ids=['BROWN'];Object.assign(s.scopes.item,{category:'Clothing',subcategory:'Tops',product_type:'Shirt',material:'Cotton',fit:'Regular',size:'10',max_price:110});
  const m='I can consider the Beige Linen Shirt at A$100. Is there an optional matching bag that keeps the whole purchase under A$110? Keep the shirt cotton-only and do not bring back the brown shirt.';
  return run(s,m,plan(m,{action:'cross_sell',reference:{kind:'id',value:'BEIGE'},changes:[change('category','Clothing','Beige Linen Shirt'),change('product_type','Shirt','Beige Linen Shirt'),change('material','Cotton','cotton-only')]}),catalogue);
}
check('An affordable bag is found within the remaining budget without selecting the example',()=>{
  const r=exampleAddition();assert.equal(r.reply.action,'cross_sell');assert.equal(r.reply.applied_preferences.category,'Bags');
  assert.equal(r.reply.applied_preferences.material,null);assert.equal(r.reply.applied_preferences.max_price,10);
  assert.equal(r.reply.purchase_budget.fixed_total_aud,100);assert.equal(r.reply.purchase_budget.remaining_aud,10);
  assert.deepEqual(r.reply.purchase_budget.example_items,[{product_id:'BEIGE',price_aud:100}]);
  assert.deepEqual(r.session.styling.outfit,[]);assert.deepEqual(all(r.reply).map(p=>p.product_id),['BAG9']);
  assert.equal(r.reply.purchase_budget.maximum_total_aud,109);assert.ok(r.session.styling.rejected_ids.includes('BROWN'));
});
check('No affordable bag explains the remaining amount rather than silently raising a cap',()=>{
  const r=exampleAddition(rows.filter(p=>p.product_id!=='BAG9'));assert.equal(r.reply.status,'no_match');
  assert.match(r.reply.message,/A\$10\.00 for this addition/);assert.deepEqual(all(r.reply),[]);assert.equal(r.reply.purchase_budget.limit_aud,110);
});
check('Example budgets refresh current prices and reject invented example references',()=>{
  const r=exampleAddition(rows.map(p=>p.product_id==='BEIGE'?{...p,price_aud:102}:p));
  assert.equal(r.reply.purchase_budget.fixed_total_aud,102);assert.equal(r.reply.purchase_budget.remaining_aud,8);assert.deepEqual(all(r.reply),[]);
  const original=exampleAddition();assert.throws(()=>acceptReply(makeTurn(newSession(),'Find a bag'),original.reply),/example purchase must belong/);
});
check('Initial complete recommendations give recorded material/fit while preserving stock uncertainty',()=>{
  const s=newSession();const m="Find a women's silver cotton blouse for work, size 12, regular fit, under A$180.";
  const r=run(s,m,plan(m,{action:'new_search',changes:[change('gender','Women',"women's"),change('product_type','Blouse','blouse'),change('fit','Regular','regular fit')]}));
  assert.equal(r.reply.products[0].product_id,'TOP');assert.match(r.reply.message,/material Cotton, fit Regular, occasion Work/);
  assert.doesNotMatch(r.reply.message,/size 12 is in stock|reserved for you/);
});
check('Polite garment briefs and trailing find-the-best-match retain the actual target',()=>{
  const message="I need a navy shirt for work, men's medium, regular fit, no more than A$100. Please find the best match.";
  assert.match(shoppingBrief(message),/navy shirt/);assert.equal(explicitCollection(message).choice,'Men');
  assert.equal(requestedClothing("I'd like a women's shirt for a beach wedding, size 10, regular fit, under A$110.").subcategory,'Tops');
  const s=newSession();s.collection.choice='Women';const m="I'd like a women's shirt for a beach wedding, size 10, regular fit, under A$110. I'm open to colours.";
  const r=run(s,m,plan(m,{action:'new_search',changes:[]}));
  assert.equal(r.session.scopes.item.subcategory,'Tops');assert.equal(r.session.scopes.item.product_type,'Shirt');assert.equal(r.session.scopes.item.fit,'Regular');
  assert.ok(all(r.reply).length);assert.ok(all(r.reply).every(p=>/shirt/i.test(p.product_type)));
});
check('A model cannot omit colour, material or blouse identity from a complete polite brief',()=>{
  const m="I'd like a women's silver cotton blouse for work, size 12, regular fit, under A$180.";
  const r=run(newSession(),m,plan(m,{action:'new_search',changes:[]}));
  assert.equal(r.session.scopes.item.material,'Cotton');assert.deepEqual(r.session.scopes.item.preferred_colours,['Silver']);
  assert.equal(r.session.scopes.item.product_type,'Blouse');assert.deepEqual(r.reply.products.map(p=>p.product_id),['TOP']);
});
check('Explicit colour choices survive omitted model filters and broad flat shoes stay broad',()=>{
  const s=newSession();s.collection.choice='Men';const m='Please show blue or grey scarves under A$90.';
  const r=run(s,m,plan(m,{action:'new_search',changes:[]}));
  assert.deepEqual(r.session.scopes.item.preferred_colours,['Blue','Grey']);assert.ok(all(r.reply).every(p=>['Blue','Grey'].includes(p.colour)));
  const f=known(platform);f.collection.choice='Women';const fm='Show similar flat shoes under A$110.';
  const fr=run(f,fm,plan(fm,{reference:{kind:'id',value:'PLATFORM'},changes:[]}));
  assert.equal(fr.session.scopes.item.product_type,'Flats');assert.ok(all(fr.reply).some(p=>p.product_id==='FLAT'));
});
check('Uncertain recipient sizing suppresses size-dependent optional purchases',()=>{
  const s=newSession();s.collection.choice='Men';s.task.brief.gift_recipient='dad';s.task.brief.uncertain_recipient_size=true;
  const m='Show blue scarves under A$90.';
  const r=run(s,m,plan(m,{action:'new_search',changes:[]}),[{...scarf,cross_sell_category:'Shoes'}, {...flat,gender:'Men'}]);
  assert.ok(r.reply.products.length);assert.equal(r.reply.complementary_offer,null);
});
check('A combined gift cap bounds discovery even when the model omits the item cap',()=>{
  const m="I need a birthday gift for Dad from the men's collection, A$90 total. He likes blues and greys and dislikes jewellery. I don't know his clothing size. Show me ideas.";
  const expensive=product('OVER','Clothing',195,{gender:'Men',colour:'Grey'});
  const s=newSession();const r=run(s,m,plan(m,{action:'discover',discovery_intent:'browse',changes:[change('category','Clothing','clothing size')]}),[...rows,expensive]);
  assert.equal(r.session.scopes.item.category,null);assert.ok(all(r.reply).length);assert.ok(all(r.reply).every(p=>p.price_aud<=90));
  assert.ok(all(r.reply).some(p=>p.product_id==='SCARF'));assert.equal(r.reply.applied_preferences.max_price,90);
});
check('The remaining combined cap survives more-options refinements without being repeated',()=>{
  const first=exampleAddition();const m='Show me more bags.';
  const r=run(first.session,m,plan(m,{action:'refine'}));
  assert.equal(r.reply.purchase_budget.remaining_aud,10);assert.ok(all(r.reply).every(p=>p.price_aud<=10));assert.deepEqual(r.session.styling.outfit,[]);
});
check('Raising a combined total keeps a named example as the anchor rather than rebuilding it',()=>{
  const first=exampleAddition();const m='I can raise the combined total to A$140 for the Beige Linen Shirt and a bag. Find an affordable matching bag; the shirt is still just an example.';
  assert.equal(statedCombinedBudget(m),140);
  const r=run(first.session,m,plan(m,{action:'refine',outfit_request:{total_budget_aud:140,evidence:'A$140 for the Beige Linen Shirt and a bag',items:[{...first.turn.scopes.item,category:'Clothing',subcategory:'Tops'},{...first.turn.scopes.item,category:'Bags',subcategory:null,product_type:null}]} }));
  assert.equal(r.reply.action,'cross_sell');assert.equal(r.reply.styling.outfit_request,null);
  assert.equal(r.reply.purchase_budget.limit_aud,140);assert.equal(r.reply.purchase_budget.remaining_aud,40);
  assert.ok(all(r.reply).length);assert.ok(all(r.reply).every(p=>p.category==='Bags'&&p.price_aud<=40));assert.deepEqual(r.session.styling.outfit,[]);
});

console.log(`\n${passed} checks passed; ${failed} failed.`);if(failed)process.exitCode=1;
