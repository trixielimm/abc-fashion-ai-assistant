import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareFeatureImport, renderFeatureImportSql } from './prepare-stylist-feature-import.mjs';

// Synthetic facts are used offline only, never imported into the live catalogue.
const product = {product_id:'D1',product_name:'Review Dress',category:'Clothing',subcategory:'Dresses',product_type:'Wrap Dress',gender:'Women'};
const fact = {feature_key:'pockets',value:true,source_reference:'supplier:OFFLINE-ONLY/specification#p2',source_version:'revision-1',evidence_quote:'Two side pockets are included.',review_status:'verified',reviewed_by:'offline-test-reviewer',verified_at:'2026-10-17T00:00:00Z'};
const input = (...features) => ({format_version:1,project_ref:'ppmldlrtdkuzdnjieudw',comparison_pairs:[{products:[{...product,features}]}]});
let passed=0;
async function check(name,run){await run();passed++;console.log(`PASS: ${name}`);}
await check('The real starter pack remains unknown and produces no import',()=>{
 const pack=JSON.parse(readFileSync(new URL('../docs/stylist-product-feature-intake.json',import.meta.url),'utf8'));
 const result=prepareFeatureImport(pack);assert.equal(result.rows.length,0);assert.equal(result.drafts,60);
 assert.throws(()=>renderFeatureImportSql(result),/No approved facts/);
});
await check('Both confirmed presence and confirmed absence survive without inference',()=>{
 assert.equal(prepareFeatureImport(input(fact)).rows[0].value,true);
 assert.equal(prepareFeatureImport(input({...fact,value:false})).rows[0].value,false);
 assert.throws(()=>prepareFeatureImport(input({...fact,value:null})));
});
await check('Draft and rejected facts never become published rows',()=>{
 const result=prepareFeatureImport(input({...fact,review_status:'draft'}, {...fact,review_status:'rejected'}));
 assert.equal(result.rows.length,0);assert.equal(result.drafts,1);assert.equal(result.rejected,1);
});
await check('Approval requires evidence, source version, reviewer and review date',()=>{
 for(const key of ['source_reference','source_version','evidence_quote','reviewed_by','verified_at']){
  assert.throws(()=>prepareFeatureImport(input({...fact,[key]:null})),key);
  assert.throws(()=>prepareFeatureImport(input({...fact,[key]:''})),key);
 }
});
await check('Typed feature values and duplicate approved facts are checked',()=>{
 for(const value of ['yes',0,[],{}])assert.throws(()=>prepareFeatureImport(input({...fact,value})));
 assert.throws(()=>prepareFeatureImport(input(fact,fact)),/Duplicate approved fact/);
 const capacity={...fact,feature_key:'capacity_litres',value:12};
 assert.equal(prepareFeatureImport(input(capacity)).rows[0].value,12);
 assert.throws(()=>prepareFeatureImport(input({...capacity,value:0})));
});
await check('Obvious demo evidence and signed/credential-bearing sources cannot be public facts',()=>{
 for(const source_reference of ['fixture:example','demo:example','synthetic:example','https://example.com/spec?token=private','https://example.com/spec?X-Amz-Signature=private']){
  assert.throws(()=>prepareFeatureImport(input({...fact,source_reference})),/public-safe/);
 }
});
await check('Generated SQL is transactional, validates identity and refuses conflicting updates',()=>{
 const sql=renderFeatureImportSql(prepareFeatureImport(input(fact)));
 assert.match(sql,/begin;/);assert.match(sql,/commit;\n$/);
 assert.match(sql,/product_identity_must_match/);assert.match(sql,/existing_facts_must_not_conflict/);
 assert.match(sql,/on conflict \(product_id,feature_key\) do nothing/);
 assert.doesNotMatch(sql,/do update|delete from public|update public/i);
});
await check('Apostrophes and backslashes remain data inside one escaped JSON literal',()=>{
 const hostile={...fact,evidence_quote:"Reviewed text with O'Brien's \\ path; '); drop table products; --"};
 const result=prepareFeatureImport(input(hostile));const sql=renderFeatureImportSql(result);
 const escaped=JSON.stringify(result.rows).replaceAll('\\','\\\\').replaceAll("'","''");
 assert.ok(sql.includes(`jsonb_to_recordset(E'${escaped}'::jsonb)`));
});
console.log(`\n${passed} feature-import checks passed; no network or database writes.`);
