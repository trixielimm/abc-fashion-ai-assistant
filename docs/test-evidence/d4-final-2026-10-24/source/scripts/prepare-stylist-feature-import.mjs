import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { FeatureKeySchema, VerifiedFeatureSchema } from '../lib/stylist/commerceSchema.ts';

const text = z.string().trim().min(1).max(250);
const intakeSchema = z.object({
  format_version: z.literal(1), project_ref: z.string().regex(/^[a-z]{20}$/),
  comparison_pairs: z.array(z.object({ products: z.array(z.object({
    product_id: text, product_name: text, category: text,
    subcategory: text.nullable(), product_type: text.nullable(), gender: text.nullable(),
    features: z.array(z.object({
      feature_key: FeatureKeySchema, value: z.unknown(),
      source_reference: z.string().nullable(), source_version: z.string().nullable(),
      evidence_quote: z.string().nullable(), reviewed_by: z.string().nullable(),
      verified_at: z.string().nullable(), review_status: z.enum(['draft','verified','rejected']),
    })).max(7),
  })).min(1).max(12) })).max(100),
});

// This prepares a reviewable import; it never connects to or writes a database.
export function prepareFeatureImport(input) {
  const intake = intakeSchema.parse(input);
  const rows = [], seen = new Set();
  let drafts = 0, rejected = 0;
  for (const pair of intake.comparison_pairs) for (const product of pair.products) for (const feature of product.features) {
    if (feature.review_status === 'draft') { drafts++; continue; }
    if (feature.review_status === 'rejected') { rejected++; continue; }
    const verified = VerifiedFeatureSchema.parse({ ...feature, product_id: product.product_id });
    const reviewer = text.parse(feature.reviewed_by);
    const excerpt = z.string().trim().min(8).max(2000).parse(feature.evidence_quote);
    if (/^(?:fixture|synthetic|demo):/i.test(verified.source_reference) || /[?&](?:token|api_key|signature|x-amz-[^=]+)=/i.test(verified.source_reference)) {
      throw new Error('Use a stable, public-safe real product source, not a fixture or credential-bearing URL.');
    }
    const identity = `${verified.product_id}:${verified.feature_key}`;
    if (seen.has(identity)) throw new Error(`Duplicate approved fact: ${identity}`);
    seen.add(identity);
    rows.push({ ...verified, reviewed_by: reviewer, evidence_quote: excerpt,
      product_name: product.product_name, category: product.category,
      subcategory: product.subcategory, product_type: product.product_type, gender: product.gender });
  }
  return { project_ref: intake.project_ref, rows, drafts, rejected };
}

// All input stays inside one escaped SQL string; no input becomes SQL syntax.
const literal = value => `E'${value.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
export function renderFeatureImportSql(prepared) {
  if (!prepared.rows.length) throw new Error('No approved facts. Complete source review before generating an import.');
  const json = JSON.stringify(prepared.rows);
  const hash = createHash('sha256').update(json).digest('hex');
  return `-- Target project: ${prepared.project_ref}
-- Approved facts SHA-256: ${hash}
-- Prepare only; review the intake evidence and target project before execution.
begin;
lock table public.stylist_product_features in share row exclusive mode;
create temporary table _stylist_feature_intake on commit drop as
select * from jsonb_to_recordset(${literal(json)}::jsonb) as facts(
  product_id text, product_name text, category text, subcategory text,
  product_type text, gender text, feature_key text, value jsonb,
  source_reference text, source_version text, review_status text,
  reviewed_by text, verified_at timestamptz, evidence_quote text
);
-- Check constraints fail the whole transaction on identity drift or conflicting
-- existing facts. Previously published facts are never silently overwritten.
create temporary table _stylist_feature_checks (
  identity_matches boolean not null constraint product_identity_must_match check (identity_matches),
  no_conflicts boolean not null constraint existing_facts_must_not_conflict check (no_conflicts)
) on commit drop;
insert into _stylist_feature_checks select
  not exists (
    select 1 from _stylist_feature_intake i left join public.product_catalog p using (product_id)
    where p.product_id is null or p.product_name is distinct from i.product_name
      or p.category is distinct from i.category or p.subcategory is distinct from i.subcategory
      or p.product_type is distinct from i.product_type or p.gender is distinct from i.gender
  ),
  not exists (
    select 1 from _stylist_feature_intake i join public.stylist_product_features f using (product_id,feature_key)
    where (f.value,f.source_reference,f.source_version,f.review_status,f.reviewed_by,f.verified_at)
      is distinct from (i.value,i.source_reference,i.source_version,i.review_status,i.reviewed_by,i.verified_at)
  );
with inserted as (
  insert into public.stylist_product_features
    (product_id,feature_key,value,source_reference,source_version,review_status,reviewed_by,verified_at)
  select product_id,feature_key,value,source_reference,source_version,review_status,reviewed_by,verified_at
    from _stylist_feature_intake order by product_id,feature_key
  on conflict (product_id,feature_key) do nothing returning product_id
)
select count(*) as newly_imported_facts from inserted;
commit;
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [input, flag, output, ...extra] = process.argv.slice(2);
    if (!input || extra.length || (flag && (flag !== '--out' || !output))) throw new Error('Usage: node --import tsx scripts/prepare-stylist-feature-import.mjs <intake.json> [--out <review.sql>]');
    if (statSync(input).size > 2_000_000) throw new Error('Intake exceeds 2 MB. Split it into smaller reviewed batches.');
    const prepared = prepareFeatureImport(JSON.parse(readFileSync(input, 'utf8')));
    if (output) {
      if (resolve(input) === resolve(output)) throw new Error('The SQL output must not overwrite the intake.');
      writeFileSync(output, renderFeatureImportSql(prepared), { flag: 'wx' });
    }
    console.log(JSON.stringify({ project_ref: prepared.project_ref, approved_facts: prepared.rows.length,
      draft_fields: prepared.drafts, rejected_fields: prepared.rejected, sql_created: output ?? null, database_writes: 0 }, null, 2));
  } catch (error) { console.error(error instanceof Error ? error.message : 'Invalid intake.'); process.exitCode = 1; }
}
