import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { getProductSpecification, validateSpecification, specificationDetails } from '../lib/stylist/productSpecifications.ts';
import { comparableFeatures, compareBenefits, meetsFeatureRequirements } from '../lib/search/productBenefits.ts';
import { newSession, makeTurn, snapshot } from '../lib/stylist/conversationProtocol.ts';
import { answerConversationQuestion } from '../lib/stylist/conversationAnswers.ts';
const directory=new URL('../docs/data/prototype-specs-v1/',import.meta.url);
const source=JSON.parse(readFileSync(new URL('P1178.json',directory),'utf8'));
const product={...source.identity_snapshot,price_aud:95,stock_qty:20,is_available:true,sizes_available:['10'],description:'Baseline description',tags:[],brand_line:null,image_key:null,cross_sell_category:'Bags',synthetic_specification:source};
let passed=0;
async function check(name,run){await run();passed++;console.log(`PASS: ${name}`);}
await check('Every saved generated specification satisfies category and identity rules',()=>{
 const files=readdirSync(directory).filter(file=>/^P\d{4}\.json$/.test(file));assert.ok(files.length>=14);
 for(const file of files){const row=JSON.parse(readFileSync(new URL(file,directory),'utf8'));assert.equal(validateSpecification(row.identity_snapshot,row.specification).product_id,row.product_id);assert.ok(getProductSpecification({...row.identity_snapshot,synthetic_specification:row}));}
});
await check('Wrong-product, stale identity, malformed provenance and invalid feature data fail closed',()=>{
 assert.equal(getProductSpecification({...product,product_id:'OTHER'}),null);
 assert.equal(getProductSpecification({...product,material:'Silk'}),null);
 assert.equal(getProductSpecification({...product,synthetic_specification:{...source,source_kind:'verified'}}),null);
 assert.throws(()=>validateSpecification(product,{...source.specification,capacity_litres:5}));
 assert.throws(()=>validateSpecification({...product,material:'Silk'},{...source.specification,machine_washable:true}));
});
await check('Supplier-verified facts take precedence over synthetic fields',()=>{
 const withVerified={...product,verified_features:[{product_id:product.product_id,feature_key:'pockets',value:true,source_reference:'supplier:actual-document',source_version:'revision-1',review_status:'verified',verified_at:'2026-10-17T00:00:00Z'}]};
 const facts=comparableFeatures(withVerified);assert.equal(facts.filter(fact=>fact.feature_key==='pockets').length,1);assert.equal(facts.find(fact=>fact.feature_key==='pockets').review_status,'verified');
 assert.equal(meetsFeatureRequirements(withVerified,['pockets']),true);
});
await check('Synthetic feature benefits remain explicitly synthetic and unknown never becomes absence',()=>{
 const original=structuredClone(product);original.synthetic_specification.specification.pockets=false;
 const replacement=structuredClone(product);replacement.product_id='D2';replacement.synthetic_specification.product_id='D2';replacement.synthetic_specification.identity_snapshot.product_id='D2';replacement.synthetic_specification.specification.product_id='D2';replacement.synthetic_specification.specification.pockets=true;
 const comparison=compareBenefits(original,replacement,['pockets']);assert.equal(comparison.benefits.length,1);assert.equal(comparison.benefits[0].evidence_kind,'synthetic');assert.doesNotMatch(comparison.benefits[0].label,/verified/i);
 original.synthetic_specification.specification.pockets=null;assert.equal(compareBenefits(original,replacement,['pockets']).benefits.length,0);
});
await check('Product questions and care use the same stored specifications as product pages',()=>{
 const state=newSession();state.context.latest=[snapshot(product)];
 const turn=makeTurn(state,'Does the first dress have pockets?');
 const intent={kind:'product',topics:['general'],references:[{kind:'position',position:1,subcategory:'Dresses'}],purpose:null,continuation:false};
 const reply=answerConversationQuestion([product],turn,intent);assert.match(reply.message,new RegExp(`Pockets: ${source.specification.pockets?'Yes':'No'}`));
 const care=answerConversationQuestion([product],makeTurn(state,'How do I wash the first dress?'),{...intent,topics:['care']});assert.ok(care.message.includes(source.specification.care_instructions));
 assert.ok(specificationDetails(source.specification).some(detail=>detail.includes('Sample garment length:')));
});
console.log(`\n${passed} product-specification checks passed.`);
