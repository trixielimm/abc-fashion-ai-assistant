import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=new URL(process.argv[2]??'http://localhost:3000');
if(!['localhost','127.0.0.1'].includes(base.hostname))throw new Error('Use a local server.');
const report={started:new Date().toISOString(),base:base.origin,checks:[]};
async function get(query=''){
 const start=performance.now();const response=await fetch(new URL(`/api/search?${query}`,base),{signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 const result=await response.json();report.checks.push({query,total:result.total,elapsed_ms:Math.round(performance.now()-start),pass:true});return result;
}
try{
 const all=await get();assert.ok(all.total>0);assert.ok(all.featureDataAvailable);
 const queries=['gender=women','gender=women&category=clothing','gender=women&category=clothing&features=pockets','gender=women&category=clothing&features=pockets&max_price=150'];
 const results=await Promise.all(queries.map(get));assert.deepEqual(results.map(r=>r.total),[183,120,74,42]);
 // Each option must agree with the count reported by the unfiltered live snapshot.
 const facets=['gender','category','subcategory','size','colour','material','fit','style','occasion','season','brand_line','product_type','tags','closure','use_cases','sole_material','hardware_finish'];
 for(let i=0;i<facets.length;i+=4)await Promise.all(facets.slice(i,i+4).map(async key=>{
  const option=all.facets[key].find(value=>value.count>0);if(!option)return;
  const result=await get(new URLSearchParams({[key]:option.value}).toString());assert.equal(result.total,option.count,`${key} count parity`);
 }));
 const second=await get(`${queries[3]}&page=2`);assert.equal(second.products.length,18);assert.equal(second.state.page,2);
 const last=await get('page=9999');assert.equal(last.state.page,last.pageCount);
 for(const query of ['max_price=-1','min_price=200&max_price=50','features=unknown']){
  const response=await fetch(new URL(`/api/search?${query}`,base));assert.equal(response.status,400);report.checks.push({query,http:400,pass:true});
 }
 const html=await (await fetch(new URL(`/search?${queries[3]}`,base))).text();assert.ok(html.includes('42 products'));assert.ok(html.includes('With pockets'));
 report.checks.push({name:'Server-rendered filtered page contains exact total and controls',pass:true});
 const invalid=await (await fetch(new URL('/search?max_price=-1',base))).text();assert.ok(invalid.includes('Check your filters'));
 report.checks.push({name:'Invalid URL has an explicit recovery state',pass:true});
 const changed=await get();assert.ok(changed.retrievedAt!==all.retrievedAt);report.checks.push({name:'Successive requests return fresh retrieval timestamps',pass:true});
 report.success=true;
}catch(error){report.success=false;report.error=error.message;process.exitCode=1;console.error(error);}
finally{report.finished=new Date().toISOString();writeFileSync('docs/test-evidence/search-filters-live-2026-10-18.json',JSON.stringify(report,null,2)+'\n');console.log(`${report.checks.filter(check=>check.pass).length} live checks; success=${report.success}`);}
