// Read-only live catalogue audit. Never alters shared catalogue rows.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { enrichCommercialCatalogue } from '../lib/stylist/commerceCatalogue.ts';
import { getProductSpecification } from '../lib/stylist/productSpecifications.ts';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const columns = 'product_id,product_name,category,subcategory,product_type,colour,style,occasion,gender,brand_line,material,fit,season,sizes_available,price_aud,stock_qty,is_available,description,tags,cross_sell_category';
const rows = [];
for (let offset = 0; ; offset += 200) {
  const { data, error } = await db.from('product_catalog').select(columns).order('product_id').range(offset, offset + 199).abortSignal(AbortSignal.timeout(15000));
  if (error) throw new Error(`Catalogue read failed: ${error.code}`);
  rows.push(...data); if (data.length < 200) break;
}
const products = await enrichCommercialCatalogue(rows);
const available = p => p.is_available && p.stock_qty > 0;
const brief = predicate => products.filter(p => available(p) && predicate(p)).map(p => ({ product_id: p.product_id, product_name: p.product_name, price_aud: p.price_aud, colour: p.colour, sizes_available: p.sizes_available, occasion: p.occasion }));
const report = { date: new Date().toISOString(), total: products.length, available: products.filter(available).length,
  snapshot_sha256: createHash('sha256').update(JSON.stringify(products)).digest('hex'),
  specification_count: products.filter(getProductSpecification).length,
  checks: {
    black_dresses_size10_under150: brief(p => p.subcategory === 'Dresses' && p.colour === 'Black' && p.sizes_available.includes('10') && p.price_aud <= 150),
    black_dresses_size10_under1: brief(p => p.subcategory === 'Dresses' && p.colour === 'Black' && p.sizes_available.includes('10') && p.price_aud <= 1),
    blue_beach_wedding_dresses_under150: brief(p => p.subcategory === 'Dresses' && p.colour === 'Blue' && p.occasion === 'Beach Wedding' && p.price_aud <= 150),
    work_dresses_under120: brief(p => p.subcategory === 'Dresses' && p.occasion === 'Work' && p.price_aud <= 120),
    zip_bags_under100: brief(p => p.category === 'Bags' && p.price_aud <= 100 && getProductSpecification(p)?.zip_closure === true),
    black_work_shoes_size38_under120: brief(p => p.category === 'Shoes' && p.colour === 'Black' && p.occasion === 'Work' && p.sizes_available.includes('38') && p.price_aud <= 120),
    silver_necklaces_under80: brief(p => p.category === 'Accessories' && /necklace/i.test(p.product_type ?? '') && p.colour === 'Silver' && p.price_aud <= 80),
  }, products };
mkdirSync(new URL('../docs/test-evidence/', import.meta.url), { recursive: true });
const output = new URL(`../docs/test-evidence/customer-catalogue-${report.date.replace(/[:.]/g, '-')}.json`, import.meta.url);
writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ total: report.total, available: report.available, specifications: report.specification_count, checks: Object.fromEntries(Object.entries(report.checks).map(([k, v]) => [k, v.length])), evidence: output.pathname }, null, 2));
