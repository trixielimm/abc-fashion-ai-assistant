// Independent read-only stock oracle for the journey prerequisites.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } });
const products = [];
for (let offset = 0; ; offset += 200) {
  const { data, error } = await db.from('product_catalog').select('product_id,product_name,gender,category,subcategory,product_type,colour,occasion,sizes_available,price_aud,stock_qty,is_available')
    .order('product_id').range(offset, offset + 199).abortSignal(AbortSignal.timeout(15000));
  if (error || !data) throw new Error(`Catalogue audit failed: ${error?.code ?? 'no_data'}`);
  products.push(...data); if (data.length < 200) break;
}
const saleable = products.filter(p => p.is_available === true && p.stock_qty > 0 && Number.isFinite(p.price_aud));
const dresses = saleable.filter(p => p.gender === 'Women' && p.category === 'Clothing' && p.subcategory === 'Dresses');
const ids = rows => rows.map(p => p.product_id);
const black = dresses.filter(p => p.colour === 'Black' && p.price_aud <= 200);
const blue = dresses.filter(p => p.colour === 'Blue' && p.price_aud <= 200);
const checks = {
  J02_blue_beach_dresses_under200: ids(blue.filter(p => p.occasion === 'Beach Wedding')),
  J07_silver_necklaces_under100: ids(saleable.filter(p => p.category === 'Accessories' && /necklace/i.test(p.product_type ?? '') && p.colour === 'Silver' && p.price_aud <= 100)),
  J14_blue_dresses_size10_under200: ids(blue.filter(p => p.sizes_available?.includes('10'))),
  J16_black_dresses_size10_under200: ids(black.filter(p => p.sizes_available?.includes('10'))),
  J18_black_womens_shoes_size7_under150: ids(saleable.filter(p => p.category === 'Shoes' && p.gender === 'Women' && p.colour === 'Black' && p.sizes_available?.includes('7') && p.price_aud <= 150)),
  J21_J44_black_dresses_under200: ids(black),
  J23_blue_dresses_under150: ids(blue.filter(p => p.price_aud <= 150)),
  J28_formal_black_dress_size10: ids(black.filter(p => p.occasion === 'Formal' && p.sizes_available?.includes('10'))),
  J28_formal_silver_shoes_size7: ids(saleable.filter(p => p.category === 'Shoes' && p.gender === 'Women' && p.colour === 'Silver' && p.occasion === 'Formal' && p.sizes_available?.includes('7'))),
  J45_black_dresses_under150: ids(black.filter(p => p.price_aud <= 150)),
};
const report = { read_at: new Date().toISOString(), total: products.length, saleable: saleable.length,
  snapshot_sha256: createHash('sha256').update(JSON.stringify(products)).digest('hex'),
  scope: 'Independent exact catalogue predicates; no mutation or stock relaxation', checks, products };
const directory = new URL('../docs/test-evidence/stylist-remediation-2026-10-21/', import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('catalogue-audit.json', directory), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ total: report.total, saleable: report.saleable,
  checks: Object.fromEntries(Object.entries(checks).map(([key, ids]) => [key, ids.length])) }, null, 2));
