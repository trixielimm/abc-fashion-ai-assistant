import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { SyntheticSpecificationSchema, validateSpecification, specificationIdentity } from '../lib/stylist/productSpecifications.ts';

const [catalogueFile, directory, output] = process.argv.slice(2);
if(!catalogueFile||!directory||!output)throw new Error('Usage: <catalogue.json> <spec-directory> <new-output.sql>');
const catalogue=JSON.parse(readFileSync(catalogueFile,'utf8')).rows;
if(!catalogue.length)throw new Error('Empty catalogue.');
const rows=catalogue.map(product=>{
 if(!/^P\d{4}$/.test(product.product_id))throw new Error('Unexpected product ID.');
 const raw=JSON.parse(readFileSync(join(directory,`${product.product_id}.json`),'utf8'));
 const {content_sha256,...data}=raw;
 if(createHash('sha256').update(JSON.stringify(data)).digest('hex')!==content_sha256)throw new Error(`Content checksum mismatch: ${product.product_id}`);
 const row=SyntheticSpecificationSchema.parse(data);
 if(JSON.stringify(row.identity_snapshot)!==JSON.stringify(specificationIdentity(product)))throw new Error(`Stale identity: ${product.product_id}`);
 validateSpecification(product,row.specification);
 return row;
});
const json=JSON.stringify(rows);
const literal=`E'${json.replaceAll('\\','\\\\').replaceAll("'","''")}'`;
const identityFields=['product_id','product_name','category','subcategory','product_type','gender','colour','material','fit','style','occasion','season'];
const identity=identityFields.map(key=>`'${key}',p.${key}`).join(',');
const sql=`-- Synthetic prototype specifications; never supplier-verified facts.
-- Expected products: ${rows.length}; SHA-256: ${createHash('sha256').update(json).digest('hex')}
begin;
lock table public.prototype_product_specifications in share row exclusive mode;
create temporary table _prototype_spec_import on commit drop as
select * from jsonb_to_recordset(${literal}::jsonb) as incoming(
 product_id text,source_kind text,dataset_version text,generator_model text,
 generated_at timestamptz,identity_snapshot jsonb,specification jsonb
);
alter table _prototype_spec_import add primary key (product_id);
create temporary table _prototype_spec_checks (
 identity_matches boolean not null check (identity_matches),
 existing_rows_match boolean not null check (existing_rows_match)
) on commit drop;
insert into _prototype_spec_checks select
 not exists(select 1 from _prototype_spec_import i left join public.product_catalog p using(product_id)
   where p.product_id is null or jsonb_build_object(${identity}) is distinct from i.identity_snapshot),
 not exists(select 1 from _prototype_spec_import i join public.prototype_product_specifications s using(product_id)
   where (s.source_kind,s.dataset_version,s.identity_snapshot,s.specification)
    is distinct from (i.source_kind,i.dataset_version,i.identity_snapshot,i.specification));
with inserted as (
 insert into public.prototype_product_specifications
  (product_id,source_kind,dataset_version,generator_model,generated_at,identity_snapshot,specification)
 select product_id,source_kind,dataset_version,generator_model,generated_at,identity_snapshot,specification from _prototype_spec_import
 on conflict(product_id) do nothing returning product_id
) select count(*) as newly_inserted from inserted;
commit;
`;
writeFileSync(output,sql,{flag:'wx'});
console.log(JSON.stringify({validated_products:rows.length,output,database_writes:0}));
