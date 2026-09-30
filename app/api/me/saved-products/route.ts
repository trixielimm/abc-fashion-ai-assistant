import { z } from "zod";
import { authenticatedClient } from "@/lib/style/server";
import { productDetailMocks } from "@/lib/product-detail-mock";

const headers = { "Cache-Control": "no-store" };
const ProductIdSchema = z.object({ product_id: z.string().trim().min(1).max(100) });

export async function GET() {
  const auth = await authenticatedClient();
  if (!auth) return Response.json({ error: "Sign in to view saved products." }, { status: 401, headers });
  const { data, error } = await auth.supabase.from("saved_products")
    .select("product_id,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(100);
  if (error) return Response.json({ error: "Could not load saved products." }, { status: 503, headers });
  const ids = (data ?? []).map((item) => item.product_id);
  const catalogue = ids.length
    ? await auth.supabase.from("product_catalog").select("product_id,product_name,price_aud,colour,image_key,is_available").in("product_id", ids)
    : { data: [], error: null };
  if (catalogue.error) return Response.json({ error: "Could not load saved products." }, { status: 503, headers });
  const products = new Map((catalogue.data ?? []).map((product) => [product.product_id, product]));
  for (const product of productDetailMocks) {
    if (product.product_id && ids.includes(product.product_id) && !products.has(product.product_id)) {
      products.set(product.product_id, product);
    }
  }
  return Response.json({ items: (data ?? []).map((item) => ({ ...item, product: products.get(item.product_id) ?? null })) }, { headers });
}

export async function POST(request: Request) {
  const auth = await authenticatedClient();
  if (!auth) return Response.json({ error: "Sign in to save a product." }, { status: 401, headers });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers }); }
  const parsed = ProductIdSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid product ID." }, { status: 400, headers });
  const productId = parsed.data.product_id;
  const inMocks = productDetailMocks.some((item) => item.product_id === productId);
  if (!inMocks) {
    const { data, error } = await auth.supabase.from("product_catalog").select("product_id").eq("product_id", productId).maybeSingle();
    if (error || !data) return Response.json({ error: "Product unavailable." }, { status: 404, headers });
  }
  const { error } = await auth.supabase.from("saved_products").upsert({ user_id: auth.user.id, product_id: productId });
  if (error) return Response.json({ error: "Could not save this product." }, { status: 503, headers });
  return Response.json({ ok: true }, { headers });
}

export async function DELETE(request: Request) {
  const auth = await authenticatedClient();
  if (!auth) return Response.json({ error: "Sign in to change saved products." }, { status: 401, headers });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers }); }
  const parsed = ProductIdSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid product ID." }, { status: 400, headers });
  const { error } = await auth.supabase.from("saved_products").delete()
    .eq("user_id", auth.user.id).eq("product_id", parsed.data.product_id);
  if (error) return Response.json({ error: "Could not remove this product." }, { status: 503, headers });
  return Response.json({ ok: true }, { headers });
}
