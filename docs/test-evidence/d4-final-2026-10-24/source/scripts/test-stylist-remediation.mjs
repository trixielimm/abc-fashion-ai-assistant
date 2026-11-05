import assert from 'node:assert/strict';
import { newSession, makeTurn, acceptReply, snapshot, TurnReplySchema } from '../lib/stylist/conversationProtocol.ts';
import { finishConversationTurn, cancellationReply, shortcutPlan } from '../lib/stylist/conversationTurn.ts';
import { emptyTaskState } from '../lib/stylist/taskState.ts';
import { hasEventContext } from '../lib/stylist/dressCode.ts';
import { groundRequirementEvidence } from '../lib/stylist/conversationGrounding.ts';
import { checkConversationPlan } from '../lib/stylist/conversationPlan.ts';
import { explicitCollection } from '../lib/stylist/collectionPreference.ts';
import { decodeModelPlan } from '../lib/ai/conversationModelPlan.ts';
import { matchesProductType } from '../lib/catalogue/productFamilies.ts';

// State/contract regressions using an authoritative synthetic catalogue. No model or network.
const base={category:'Clothing',subcategory:'Dresses',product_type:'Maxi Dress',price_aud:155,stock_qty:5,is_available:true,sizes_available:['M','12'],colour:'Navy',material:'Cotton',occasion:'Work',style:'Classic',gender:'Women',fit:'Regular',season:'Summer',brand_line:null,description:null,tags:[],image_key:null,cross_sell_category:'Shoes'};
const dress={...base,product_id:'RD',product_name:'Test Navy Maxi Dress'};
const jacket={...base,product_id:'RJ',product_name:'Test Black Cropped Jacket',subcategory:'Outerwear',product_type:'Cropped Jacket',price_aud:90,colour:'Black',occasion:'Casual'};
const beige={...jacket,product_id:'RJ2',product_name:'Test Beige Jacket',colour:'Beige',price_aud:80};
const shirt={...base,product_id:'RT',product_name:'Test Blue Oxford Shirt',subcategory:'Tops',product_type:'Oxford Shirt',price_aud:50,gender:'Men',colour:'Blue'};
const poly={...jacket,product_id:'RP',product_name:'Test Polyester Jacket',material:'Polyester',price_aud:70};
const shoes={...base,product_id:'RS',product_name:'Test Ballet Flats',category:'Shoes',subcategory:'Flats',product_type:'Ballet Flats',price_aud:110,sizes_available:['38'],cross_sell_category:null,colour:'Black'};
const expensiveShoes={...shoes,product_id:'RS2',product_name:'Test Expensive Ballet Flats',price_aud:130};
const bag={...base,product_id:'RB',product_name:'Test Bag',category:'Bags',subcategory:'Handbags',product_type:'Shoulder Bag',price_aud:30,sizes_available:['One Size'],cross_sell_category:null};
const catalogue=[dress,jacket,beige,shirt,poly,shoes,expensiveShoes,bag];
const vocab=rows=>({rows,sizes:[...new Set(rows.flatMap(p=>p.sizes_available))],categories:[...new Map(rows.flatMap(p=>[{category:p.category,subcategory:null},{category:p.category,subcategory:p.subcategory}]).map(v=>[JSON.stringify(v),v])).values()]});
const change=(field,value,evidence,operation='set',scope='item')=>({field,value,evidence,operation,scope});
const plan=(message,changes=[],extra={})=>({action:'refine',intent_evidence:message.slice(0,250),reference:null,changes,question:null,continuation:false,...extra});
const session=()=>{const s=newSession();s.collection.choice='All';return s;};
function send(s,message,changes=[],extra={},rows=catalogue){const t=makeTurn(s,message);const r=finishConversationTurn(rows,t,plan(message,changes,extra),vocab(rows));return acceptReply(t,r);}
let passed=0;function check(name,run){run();passed++;console.log('PASS: '+name);}
check('A trailing show-options phrase retains a complete mens shirt brief and canonical medium size',()=>{
 const m="I'm buying Dad a men's work shirt. Medium, regular fit, under $100. Show me options.";
 const {reply}=send(session(),m,[change('gender','Men',"men's"),change('product_type','Shirt','shirt'),change('size','medium','Medium'),change('fit','Regular','regular fit')],{action:'new_search'});
 assert.equal(reply.status,'matches');assert.equal(reply.applied_preferences.size,'M');assert.equal(reply.applied_preferences.subcategory,'Tops');assert.deepEqual(reply.products.map(p=>p.product_id),['RT']);
});
check('Jacket and flats umbrellas use the same catalogue family in search and reply validation',()=>{
 const j=send(session(),"Show women's jackets under $100, no beige.",[change('product_type','Jacket','jackets'),change('excluded_colours',['Beige'],'no beige','add')],{action:'new_search'}).reply;
 assert.ok(j.products.length+j.alternatives.length);assert.ok([...j.products,...j.alternatives].every(p=>p.category==='Clothing'&&p.colour!=='Beige'));
 const f=send(session(),'Show flat shoes under $125.',[change('category','Shoes','shoes'),change('product_type','Flats','flat shoes')],{action:'new_search'}).reply;
 assert.equal(f.status,'matches');assert.deepEqual(f.products.map(p=>p.product_id),['RS']);
 assert.equal(matchesProductType({category:'Shoes',product_type:'Mules'},'Flats'),false);
 assert.equal(matchesProductType({category:'Shoes',product_type:'Flat Mules'},'Flats'),true);
});
check('Named blockers carry exact values and a real shared conflict never disappears',()=>{
 const s=session();s.scopes.shared.gender='Men';const {reply}=send(s,"Show women's jackets.",[change('gender','Women',"women's"),change('product_type','Jacket','jackets')],{action:'new_search'});
 assert.equal(reply.status,'needs_clarification');assert.equal(reply.issues[0].code,'shared_conflict');assert.equal(reply.issues[0].saved_value,'Men');assert.equal(reply.issues[0].value,'Women');assert.match(reply.message,/Women.*Men/);
});
check('An explicit group relaxation removes only local fabric, waist and length requirements',()=>{
 const s=session();Object.assign(s.scopes.item,{category:'Clothing',subcategory:'Outerwear',product_type:'Jacket',max_price:100});s.scopes.unresolved_item=['no polyester','full length','no elasticated waist'];s.scopes.shared.excluded_colours=['Beige'];
 const {reply,session:next}=send(s,'Drop the fabric, waist and length checks. Show jackets under $100.');
 assert.deepEqual(next.scopes.unresolved_item,[]);assert.deepEqual(next.scopes.shared.excluded_colours,['Beige']);assert.ok(reply.products.length+reply.alternatives.length);
});
check('Provisional browsing needs explicit permission, retains unknowns and excludes known violations',()=>{
 const s=session();Object.assign(s.scopes.item,{category:'Clothing',subcategory:'Outerwear',product_type:'Jacket',max_price:100});s.scopes.unresolved_item=['no polyester'];
 const blocked=send(s,'Show me the jackets.').reply;assert.equal(blocked.status,'needs_clarification');
 const {reply,session:next}=send(s,'Keep those as things to check, but show me jackets.');
 assert.equal(reply.status,'alternatives');assert.equal(reply.alternative_kind,'unverified_preview');assert.deepEqual(reply.products,[]);assert.deepEqual(next.scopes.unresolved_item,['no polyester']);assert.ok(reply.alternatives.every(p=>p.product_id!=='RP'&&p.differences.some(v=>v.includes('no polyester'))));
 assert.throws(()=>acceptReply(makeTurn(s,'Show jackets'),reply),/explicit browsing permission/);
});
check('Replacing a stuck task keeps the saved look and explicit global constraints',()=>{
 const s=session();Object.assign(s.scopes.item,{category:'Shoes',product_type:'Flats',size:'999'});s.scopes.unresolved_item=['unverified heel'];s.scopes.shared.max_price=200;s.styling.outfit=[{...snapshot(dress),ownership:'selected'}];s.pending={action:'refine',reference:null,goal:'old shoes',question:'which size?',before_scopes:structuredClone(s.scopes)};
 const {reply,session:next}=send(s,"Forget the shoes. Show women's jackets under $100.",[change('product_type','Jacket','jackets'),change('gender','Women',"women's")],{action:'new_search'});
 assert.ok(reply.products.length+reply.alternatives.length);assert.equal(next.pending,null);assert.equal(next.scopes.item.size,null);assert.deepEqual(next.scopes.unresolved_item,[]);assert.equal(next.scopes.shared.max_price,200);assert.equal(next.styling.outfit[0].product_id,'RD');assert.equal(next.task.generation,1);
});
check('Compound name/number edits resume the validated draft without dropping its exclusions',()=>{
 const s=session();s.context.latest=[snapshot(bag),snapshot(jacket)];Object.assign(s.scopes.item,{category:'Clothing',subcategory:'Outerwear',product_type:'Jacket'});
 const original='Show more jackets under $120, no beige.';
 s.pending_answer={intent:{kind:'product',topics:['general'],references:[{kind:'context'}],purpose:null,continuation:false},question:original,follow_up:{action:'refine',reference:{kind:'context'},changes:[change('max_price',120,'under $120'),change('excluded_colours',['Beige'],'no beige','add')]}};
 const m='Number 2, the Test Black Cropped Jacket. Similar shape, under $100.';
 const {reply,session:next}=send(s,m,[change('max_price',100,'under $100')]);
 assert.equal(next.pending_answer,null);assert.equal(next.scopes.item.max_price,100);assert.deepEqual(next.scopes.item.excluded_colours,['Beige']);assert.ok(reply.products.length+reply.alternatives.length);
 const conflict=send(s,'Number 1, the Test Black Cropped Jacket.',[],{reference:{kind:'context'}}).reply;assert.equal(conflict.status,'needs_clarification');
});
check('A saved purchase uses current prices and a one-component addition cannot overspend',()=>{
 const s=session();s.context.latest=[snapshot(dress)];s.styling.outfit=[{...snapshot(dress),ownership:'selected'}];const rows=[{...dress,price_aud:165},...catalogue.filter(p=>p.product_id!=='RD')];
 const m='Show flat shoes for my saved dress, $280 combined total, shoes under $125.';
 const {reply}=send(s,m,[change('category','Shoes','shoes'),change('product_type','Flats','flat shoes'),change('max_price',125,'under $125')],{action:'cross_sell',reference:{kind:'id',value:'RD'}},rows);
 assert.equal(reply.status,'matches');assert.equal(reply.purchase_budget.fixed_total_aud,165);assert.equal(reply.purchase_budget.remaining_aud,115);assert.equal(reply.purchase_budget.maximum_total_aud,275);assert.deepEqual(reply.products.map(p=>p.product_id),['RS']);assert.equal(reply.styling.outfit[0].price_aud,165);
 assert.throws(()=>TurnReplySchema.parse({...reply,purchase_budget:{...reply.purchase_budget,maximum_total_aud:281}}));
 const owned=structuredClone(s);owned.styling.outfit[0].ownership='owned';const other=send(owned,m,[change('category','Shoes','shoes'),change('product_type','Flats','flat shoes'),change('max_price',125,'under $125')],{action:'cross_sell',reference:{kind:'id',value:'RD'}},rows).reply;
 assert.equal(other.purchase_budget.fixed_total_aud,0);assert.equal(other.purchase_budget.maximum_total_aud,110);
});
check('Keeping a named dress and requesting only shoes cannot rebuild the whole outfit',()=>{
 const s=session();s.context.latest=[snapshot(dress)];s.styling.outfit=[{...snapshot(dress),ownership:'selected'}];
 const old={total_budget_aud:280,evidence:'$280 total',items:[{...s.scopes.item,category:'Clothing',subcategory:'Dresses'},{...s.scopes.item,category:'Shoes'}]};s.styling.outfit_request=old;
 const m="I'll keep the Test Navy Maxi Dress. Show flat shoes instead, $280 for the dress and shoes together.";
 const {reply}=send(s,m,[],{action:'refine',outfit_request:{...old,evidence:m}});
 assert.equal(reply.action,'cross_sell');assert.equal(reply.styling.outfit_request,null);assert.equal(reply.purchase_budget.fixed_total_aud,155);assert.equal(reply.purchase_budget.remaining_aud,125);
 assert.ok(reply.products.length+reply.alternatives.length);assert.ok([...reply.products,...reply.alternatives].every(p=>p.category==='Shoes'&&p.price_aud<=125));
});
check('An explicit any-fit and any-colour refinement clears the local restrictions',()=>{
 const s=session();Object.assign(s.scopes.item,{category:'Clothing',subcategory:'Tops',product_type:'Shirt',fit:'Slim',preferred_colours:['Red'],size:'M'});
 const {reply}=send(s,'Show shirts, any fit, any colour, under $100.');
 assert.equal(reply.applied_preferences.fit,null);assert.deepEqual(reply.applied_preferences.preferred_colours,[]);assert.equal(reply.applied_preferences.size,'M');assert.ok(reply.products.length);
});
check('Expired recovery controls cannot mutate a later task',()=>{
 const s=session();Object.assign(s.scopes.item,{category:'Clothing',subcategory:'Outerwear',product_type:'Jacket'});s.scopes.unresolved_item=['no polyester'];const {reply,session:blocked}=send(s,'Show jackets.');
 const t=makeTurn(blocked,'Remove my item requirement: no polyester.',null,undefined,false,{issue_id:reply.issues[0].id,generation:99,operation:'drop_requirement'});
 assert.throws(()=>finishConversationTurn(catalogue,t,plan(t.message),vocab(catalogue)),/no longer current/);assert.deepEqual(blocked.scopes.unresolved_item,['no polyester']);
 const current=makeTurn(blocked,'Remove my item requirement: no polyester.',null,undefined,false,{issue_id:reply.issues[0].id,generation:blocked.task.generation,operation:'drop_requirement'});
 const corrected=finishConversationTurn(catalogue,current,shortcutPlan(current),vocab(catalogue));assert.deepEqual(corrected.proposed_scopes.unresolved_item,[]);assert.ok(corrected.products.length+corrected.alternatives.length);
});
check('Cancelling a pending outfit change restores task fields while keeping independently saved pieces',()=>{
 const s=session();s.styling.outfit=[{...snapshot(dress),ownership:'selected'}];const before=structuredClone(s.styling);s.pending={action:'refine',reference:null,goal:'change outfit',question:'which size?',before_scopes:structuredClone(s.scopes),before_styling:before};s.styling.outfit_request={total_budget_aud:220,items:[{...s.scopes.item,category:'Clothing'},{...s.scopes.item,category:'Shoes'}],evidence:'$220 total'};
 const reply=cancellationReply(makeTurn(s,'cancel'));assert.equal(reply.styling.outfit_request,null);assert.equal(reply.styling.outfit[0].product_id,'RD');assert.equal(reply.pending,null);
});
check('Work outfits have no event picker and old request shapes remain valid',()=>{
 assert.equal(hasEventContext({...session().styling,outfit_request:{items:[{occasion:'Work'},{occasion:'Work'}]}}),false);
 assert.equal(hasEventContext({...session().styling,dress_code:'cocktail'}),true);
 const legacy=makeTurn(session(),'Show shirts');delete legacy.task;assert.doesNotThrow(()=>finishConversationTurn(catalogue,legacy,plan(legacy.message,[change('category','Clothing','shirts'),change('product_type','Shirt','shirts')],{action:'new_search'}),vocab(catalogue)));
 assert.deepEqual(emptyTaskState().issues,[]);
});
check('A cocktail wedding is a supported event context rather than an unverified product feature',()=>{
 const s=session();const m='Show a dress and shoes for a cocktail wedding, $280 total.';
 const rows=catalogue.map(p=>({...p,occasion:'Wedding Guest'}));
 const empty=s.scopes.item;const {reply}=send(s,m,[change('occasion','Cocktail','cocktail'),change('style','Elegant','cocktail'),change('unresolved',['cocktail'],'cocktail','add')],{action:'new_search',outfit_request:{total_budget_aud:280,evidence:m,items:[{...empty,category:'Clothing',subcategory:'Dresses'},{...empty,category:'Shoes'}]}},rows);
 assert.equal(reply.status,'matches');assert.deepEqual(reply.proposed_scopes.unresolved_item,[]);assert.equal(reply.styling.dress_code,'wedding_guest');assert.ok(reply.outfit_choices.maximum_total_aud<=280);
});
check('A collection answer followed by a volunteered routine does not repeat the collection question',()=>{
 const m="Both collections, please. I said coffee and weekend markets. Show me some ideas now.";
 assert.equal(explicitCollection(m,true)?.choice,'All');
 const s=newSession();s.collection.checkpoint={action:'discover',discovery_intent:'start'};
 const {reply}=send(s,m,[],{action:'discover',discovery_intent:'browse'});
 assert.ok(reply.products.length+reply.alternatives.length);assert.equal(reply.collection.checkpoint,null);
 assert.equal(reply.discovery.stage,'browsing');
});
check('The task rollback flag keeps legacy turns and hides new transition behavior',()=>{
 const previous=process.env.STYLIST_TASK_RECOVERY_ENABLED;process.env.STYLIST_TASK_RECOVERY_ENABLED='false';
 try {const s=session();const m='Show shirts';const {reply}=send(s,m,[change('category','Clothing','shirts'),change('product_type','Shirt','shirts')],{action:'new_search'});assert.equal(reply.task_transition_applied,false);}
 finally {if(previous===undefined)delete process.env.STYLIST_TASK_RECOVERY_ENABLED;else process.env.STYLIST_TASK_RECOVERY_ENABLED=previous;}
});
check('Requirement quotation repair uses only explicit literal requirements and rejects invented evidence',()=>{
 const m="Show women's jackets. No polyester, no elasticated waist, full length not cropped.";
 const candidate=plan(m,[change('unresolved',['no polyester','no elasticated waist','full length'],'No polyester and full length','add')],{action:'new_search'});
 const repaired=groundRequirementEvidence(m,candidate);assert.equal(repaired.changes.length,1);
 assert.ok(repaired.changes.every(c=>m.toLowerCase().includes(c.evidence.toLowerCase())));
 assert.doesNotThrow(()=>checkConversationPlan(makeTurn(session(),m),repaired));
 const invented=plan(m,[change('unresolved',['waterproof'],'waterproof','add')],{action:'new_search'});
 assert.throws(()=>checkConversationPlan(makeTurn(session(),m),groundRequirementEvidence(m,invented)),/evidence/i);
 const missing=plan('Show jackets',[change('unresolved',['no polyester'],'No polyester','add')],{action:'new_search'});
 assert.throws(()=>checkConversationPlan(makeTurn(session(),'Show jackets'),groundRequirementEvidence('Show jackets',missing)),/evidence/i);
});
check('A scalar removal with null normalizes to the domain clear operation, without weakening other transport checks',()=>{
 const base={...plan('Drop the style restriction.'),discovery_intent:null,outfit_request:null,answer:null,styling_intent:null};
 const c={scope:'item',field:'style',operation:'remove',text_value:null,number_value:null,list_values:[],evidence:'Drop the style restriction'};
 assert.deepEqual(decodeModelPlan({...base,changes:[c]}).changes[0],{scope:'item',field:'style',operation:'set',value:null,evidence:c.evidence});
 assert.throws(()=>decodeModelPlan({...base,changes:[{...c,text_value:'Classic'}]}));
});
console.log(`${passed} stylist remediation state and budget checks passed.`);
