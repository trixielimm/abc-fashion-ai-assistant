// Upload only still-missing catalogue images from the reviewed 150-image batch.
// Run: node --env-file=.env.local scripts/upload-generated-product-images.mjs
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const required = name => {
  const value = process.env[name]?.trim();
  if (!value || /^(your[-_]|<)/i.test(value)) throw new Error(`Missing ${name}`);
  return value;
};
const bucket = required('S3_BUCKET_NAME');
const s3 = new S3Client({
  endpoint: required('S3_ENDPOINT'),
  region: required('S3_BUCKET_REGION'),
  forcePathStyle: true,
  credentials: {
    accessKeyId: required('S3_ACCESS_KEY_ID'),
    secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
  },
});
const db = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
  auth: { persistSession: false },
});
const items = JSON.parse(readFileSync(resolve('output/imagegen/modelled-priority-150-prompts.json'), 'utf8')).products;
const reportPath = resolve('output/imagegen/modelled-priority-150-upload-report.json');
const report = {
  started_at: new Date().toISOString(),
  bucket,
  requested: items.length,
  uploaded: [],
  skipped_existing: [],
  failed: [],
};
const saveReport = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const timeout = () => AbortSignal.timeout(30000);
const hash = data => createHash('sha256').update(data).digest('hex');

if (items.length !== 150 || new Set(items.map(item => item.product_id)).size !== 150) {
  throw new Error('Manifest must contain 150 unique products');
}
const { data: products, error } = await db.from('product_catalog')
  .select('product_id,image_key')
  .in('product_id', items.map(item => item.product_id))
  .abortSignal(timeout());
if (error) throw new Error(`Catalogue read failed: ${error.message}`);
if (products?.length !== items.length) throw new Error(`Catalogue returned ${products?.length ?? 0} of ${items.length} products`);
const liveKeys = new Map(products.map(product => [product.product_id, product.image_key]));
for (const item of items) {
  if (!/^abc_\d+\.jpg$/.test(item.image_key)) throw new Error(`Unexpected storage key for ${item.product_id}`);
  if (liveKeys.get(item.product_id) !== item.image_key) throw new Error(`Catalogue image key changed for ${item.product_id}`);
  const file = resolve('output/imagegen/catalogue-ready', item.image_key);
  if (!existsSync(file) || statSync(file).size < 10000) throw new Error(`Missing or empty JPEG for ${item.product_id}`);
  const marker = readFileSync(file).subarray(0, 3);
  if (marker[0] !== 0xff || marker[1] !== 0xd8 || marker[2] !== 0xff) throw new Error(`Invalid JPEG for ${item.product_id}`);
}

const stored = new Map();
let continuation;
do {
  const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1000, ContinuationToken: continuation }), { abortSignal: timeout() });
  for (const object of page.Contents ?? []) stored.set(object.Key, object.Size ?? 0);
  if (page.IsTruncated && !page.NextContinuationToken) throw new Error('Incomplete storage listing');
  continuation = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (continuation);

const planned = items.filter(item => !(stored.get(item.image_key) > 0));
report.planned_uploads = planned.length;
report.existing_matching_keys = items.length - planned.length;
saveReport();
console.log(`Uploading ${planned.length} missing JPEGs to ${bucket}; ${report.existing_matching_keys} already exist.`);

async function uploadOne(item) {
  const key = item.image_key;
  let existing;
  try {
    existing = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: timeout() });
  } catch (error) {
    if (error?.$metadata?.httpStatusCode !== 404) throw error;
  }
  if ((existing?.ContentLength ?? 0) > 0) return { status: 'skipped_existing', product_id: item.product_id, key };

  const local = readFileSync(resolve('output/imagegen/catalogue-ready', key));
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: local,
    ContentType: 'image/jpeg',
    ContentLength: local.length,
  }), { abortSignal: timeout() });
  const downloaded = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: timeout() });
  const remote = Buffer.from(await downloaded.Body.transformToByteArray());
  if (remote.length !== local.length || hash(remote) !== hash(local)) throw new Error(`Uploaded bytes did not verify for ${item.product_id}`);
  if (downloaded.ContentType !== 'image/jpeg') throw new Error(`Unexpected content type for ${item.product_id}`);
  return { status: 'uploaded', product_id: item.product_id, key, bytes: local.length, sha256: hash(local) };
}

for (let offset = 0; offset < planned.length; offset += 4) {
  const group = planned.slice(offset, offset + 4);
  const outcomes = await Promise.allSettled(group.map(uploadOne));
  for (let index = 0; index < group.length; index++) {
    const outcome = outcomes[index];
    if (outcome.status === 'fulfilled') {
      report[outcome.value.status].push(outcome.value);
    } else {
      report.failed.push({ product_id: group[index].product_id, key: group[index].image_key, error: String(outcome.reason?.message ?? outcome.reason) });
    }
  }
  saveReport();
  console.log(`Processed ${Math.min(offset + group.length, planned.length)}/${planned.length}: ${report.uploaded.length} uploaded, ${report.failed.length} failed.`);
}
report.finished_at = new Date().toISOString();
saveReport();
if (report.failed.length) process.exitCode = 1;
