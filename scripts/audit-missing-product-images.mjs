// Read-only comparison of the live catalogue with Supabase Storage.
// Run: node --env-file=.env.local --import tsx scripts/audit-missing-product-images.mjs
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeLocalImagePath } from '../lib/stylist/catalogueImages.ts';
import { getStorageImageKey } from '../lib/product-image.ts';

const bucket = process.env.S3_BUCKET_NAME;
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_BUCKET_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } });
const columns = 'product_id,product_name,category,subcategory,colour,image_key,is_available,stock_qty';
const [products, objects] = await Promise.all([
  (async () => {
    const rows = [];
    for (let offset = 0; ; offset += 200) {
      const { data, error } = await db.from('product_catalog').select(columns)
        .order('product_id').range(offset, offset + 199)
        .abortSignal(AbortSignal.timeout(30000));
      if (error) throw new Error(`Catalogue read failed: ${error.message}`);
      if (!data) throw new Error('Catalogue response was empty');
      rows.push(...data);
      if (data.length < 200) return rows;
    }
  })(),
  (async () => {
    const rows = [];
    let token;
    do {
      const page = await s3.send(new ListObjectsV2Command({
        Bucket: bucket, MaxKeys: 1000, ContinuationToken: token,
      }), { abortSignal: AbortSignal.timeout(30000) });
      rows.push(...(page.Contents || []));
      if (page.IsTruncated && !page.NextContinuationToken) throw new Error('Storage pagination is incomplete');
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return rows;
  })(),
]);
const sizes = new Map(objects.map(o => [o.Key, o.Size]));
const origins = [new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin, new URL(process.env.S3_ENDPOINT).origin];
const missing = [];
const health = {};
const fingerprint = value => { let h=2166136261; for(const c of value) h=Math.imul(h^c.charCodeAt(0),16777619); return (h>>>0).toString(36); };
const publicRoot=fileURLToPath(new URL('../public/',import.meta.url));
for (const product of products) {
  const raw = product.image_key?.trim();
  const key = raw ? getStorageImageKey(raw, bucket, origins) : null;
  const local = safeLocalImagePath(raw) ? join(publicRoot,raw) : null;
  const localOK = local && existsSync(local) && statSync(local).size>0;
  const reason = local ? localOK ? null : 'Referenced local image missing or empty' : !raw ? 'No image_key assigned'
    : !key ? 'Image key does not resolve to this bucket'
    : !sizes.has(key) ? 'Referenced object missing from bucket'
    : sizes.get(key) === 0 ? 'Referenced object is empty (0 bytes)' : null;
  health[product.product_id]={ key_fingerprint:fingerprint(raw || ''), object_present:!reason };
  if (reason) missing.push({ ...product, resolved_image_key: key || '', reason });
}
const checkedAt = new Date().toISOString();
const summary = {
  checked_at: checkedAt, bucket, catalogue_products: products.length,
  bucket_objects: objects.length, matching_nonempty_objects: products.length - missing.length,
  products_without_matching_images: missing.length,
  catalogue_access: 'publishable key (RLS-visible catalogue)',
  matching_rule: 'Exact bucket-relative image_key using the app resolver; zero-byte objects count as missing images.',
  reasons: Object.fromEntries([...new Set(missing.map(p => p.reason))].map(reason => [reason, missing.filter(p => p.reason === reason).length])),
};
const dir = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('../docs/reports/', import.meta.url));
mkdirSync(dir, { recursive: true });
const fields = ['product_id','product_name','category','subcategory','colour','image_key','resolved_image_key','reason','is_available','stock_qty'];
const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = [fields, ...missing.map(row => fields.map(field => row[field]))]
  .map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
writeFileSync(join(dir,'products-without-matching-images.csv'), csv);
writeFileSync(join(dir,'products-without-matching-images.json'), JSON.stringify({ ...summary, products: missing }, null, 2) + '\n');
writeFileSync(join(dir,'image-health.json'),JSON.stringify({checked_at:checkedAt,images:health},null,2)+'\n');
console.log(JSON.stringify(summary, null, 2));
