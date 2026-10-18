import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runFacetedSearch} from '../lib/search/facetedSearch.ts';
import {emptyFilters,parseFilters,serializeFilters,InvalidSearchFilters} from '../lib/search/filterState.ts';
const baseline=JSON.parse(readFileSync(new URL('../docs/data/prototype-specs-v1/catalogue-baseline.json',import.meta.url),'utf8'));
const catalogue=baseline.map(row=>{
 const spec=JSON.parse(readFileSync(new URL(`../docs/data/prototype-specs-v1/${row.product_id}.json`,import.meta.url),'utf8'));
 return {...row,...spec.identity_snapshot,brand_line:null,tags:[],sizes_available:['10','12'],image_key:null,cross_sell_category:null,synthetic_specification:spec};
});
const run=(params='',products=catalogue,available=true)=>runFacetedSearch(products,parseFilters(new URLSearchParams(params)),available);
let passed=0;
function check(name,test){test();passed++;console.log(`PASS ${name}`);}
check('Audited catalogue and narrowing journey match real prototype facts',()=>{
 assert.equal(run().total,316);assert.equal(run('gender=women').total,183);
 assert.equal(run('gender=women&category=clothing').total,120);
 assert.equal(run('gender=women&category=clothing&features=pockets').total,74);
 assert.equal(run('gender=women&category=clothing&features=pockets&max_price=150').total,42);
});
check('OR within facets, AND across facets, AND across required features',()=>{
 assert.equal(run('gender=women&gender=unisex').total,241);
 const both=run('features=pockets&features=lining');
 const expected=catalogue.filter(p=>p.synthetic_specification.specification.pockets===true&&p.synthetic_specification.specification.lining===true);
 assert.equal(both.total,expected.length);
});
check('Facet counts exclude their own selection but preserve other requirements',()=>{
 const r=run('gender=women&category=clothing');
 assert.equal(r.facets.gender.find(x=>x.value==='men').count,catalogue.filter(p=>p.category==='Clothing'&&p.gender==='Men').length);
 assert.equal(r.facets.category.find(x=>x.value==='clothing').count,120);
 assert.equal(r.features.find(x=>x.key==='pockets').count,74);
});
check('Counts precede pagination and final page is clamped after stock changes',()=>{
 const r=run('page=9999');assert.equal(r.total,316);assert.equal(r.state.page,14);assert.equal(r.products.length,4);
 assert.equal(run('features=pockets').facets.category.reduce((sum,x)=>sum+x.count,0),154);
});
check('Duplicates in size/tag arrays count each product only once',()=>{
 const p={...catalogue[0],sizes_available:['10','10','12'],tags:['Work','Work']};
 const r=run('',[p]);assert.equal(r.facets.size.find(x=>x.label==='10').count,1);assert.equal(r.facets.tags[0].count,1);
 assert.equal(run('size=10&size=12',[p]).total,1);
});
check('Size values distinguish shoes from clothing and preserve legacy unscoped links',()=>{
 const clothes={...catalogue.find(p=>p.category==='Clothing'),sizes_available:['10']};
 const shoes={...catalogue.find(p=>p.category==='Shoes'),sizes_available:['10']};
 assert.equal(run('size=clothing%3A10',[clothes,shoes]).total,1);assert.equal(run('size=10',[clothes,shoes]).total,2);
});
check('Case and whitespace normalize without merging different materials',()=>{
 const a={...catalogue[0],material:'Leather'},b={...catalogue[1],material:'Faux Leather'},c={...catalogue[2],material:' leather  '};
 const r=run('material=LEATHER',[a,b,c]);assert.equal(r.total,2);assert.equal(r.facets.material.length,2);
});
check('False verified facts override synthetic true facts',()=>{
 const p=structuredClone(catalogue.find(p=>p.synthetic_specification.specification.pockets===true));
 p.verified_features=[{product_id:p.product_id,feature_key:'pockets',value:false,source_reference:'supplier:spec',source_version:'v1',review_status:'verified',verified_at:'2026-10-18T00:00:00Z'}];
 assert.equal(run('features=pockets',[p]).total,0);
});
check('Unknown, false and stale specifications do not satisfy feature requirements',()=>{
 const p=catalogue.find(p=>p.synthetic_specification.specification.pockets===true);
 assert.equal(run('features=pockets',[{...p,synthetic_specification:undefined}]).total,0);
 assert.equal(run('features=pockets',[{...p,product_name:'Changed identity'}]).total,0);
});
check('Unknown measurements do not match ranges and zero is an inclusive boundary',()=>{
 const p=catalogue.find(p=>p.category==='Shoes'&&p.synthetic_specification.specification.heel_height_cm===0);
 assert.equal(run('heel_height_cm_max=0',[p]).total,1);
 assert.equal(run('heel_height_cm_min=0',[catalogue.find(p=>p.category==='Clothing')]).total,0);
 assert.equal(run('min_price=0&max_price=0',[{...catalogue[0],price_aud:0}]).total,1);
});
check('Inactive availability, invalid prices and invalid stock cannot enter counts',()=>{
 const p=catalogue[0];
 for(const changes of [{is_available:false},{stock_qty:0},{stock_qty:1.5},{stock_qty:Infinity},{price_aud:NaN},{price_aud:-1}]) assert.equal(run('',[{...p,...changes}]).total,0);
});
check('Unknown selected options remain visible at zero instead of broadening results',()=>{
 const r=run('colour=unknown');assert.equal(r.total,0);assert.equal(r.facets.colour.find(x=>x.value==='unknown').count,0);
});
check('Fastening zip aliases the shared feature state and keeps alternative fastening counts',()=>{
 assert.deepEqual(parseFilters(new URLSearchParams('closure=zip')).features,['zip_closure']);
 const r=run('closure=zip');assert.equal(r.total,78);assert.ok(r.facets.closure.find(x=>x.value==='button').count>0);
 assert.deepEqual(parseFilters(new URLSearchParams('closure=zip&closure=button')).values.closure,['zip','button']);
});
check('Unavailable feature sources fail explicitly for feature queries',()=>{
 assert.equal(run('',catalogue,false).featureDataAvailable,false);
 assert.throws(()=>run('features=pockets',catalogue,false));assert.throws(()=>run('capacity_litres_min=1',catalogue,false));
});
check('URLs round-trip every facet, range, repeated value and page',()=>{
 const query='q=blue+dress&gender=women&gender=unisex&size=clothing%3A10&features=lining&features=pockets&min_price=25&max_price=150&garment_length_cm_min=60&page=2';
 const state=parseFilters(new URLSearchParams(query));assert.deepEqual(parseFilters(new URLSearchParams(serializeFilters(state))),state);
 assert.equal(emptyFilters('dress').q,'dress');
});
check('Malformed, unbounded and contradictory filters are rejected',()=>{
 for(const query of ['page=0','page=10000','features=unknown','min_price=-1','max_price=Infinity','max_price=1e3','min_price=200&max_price=100','heel_height_cm_min=9&heel_height_cm_max=2','max_price=1000001']) assert.throws(()=>parseFilters(new URLSearchParams(query)),InvalidSearchFilters);
});
check('Product response excludes private/raw specification and storage metadata',()=>{
 const r=run('',[{...catalogue[0],image_key:'private/object.jpg'}]);
 assert.equal(r.products[0].image_src,`/api/products/${catalogue[0].product_id}/image`);
 for(const field of ['image_key','description','synthetic_specification','verified_features','stock_qty']) assert.ok(!(field in r.products[0]));
});
console.log(`${passed} search-filter checks passed.`);
