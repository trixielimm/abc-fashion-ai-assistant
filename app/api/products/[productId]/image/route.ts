import { getCatalogueProductById } from "@/lib/recommendations/catalogue";
import { getProductImageSrc } from "@/lib/product-image";
import { getProductStorageUrl } from "@/lib/storage/product-images";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const { productId } = await params;
    // Query through the catalogue's existing RLS: never sign an arbitrary
    // caller-supplied storage key or expose files belonging to hidden products.
    const product = await getCatalogueProductById(productId);
    if (!product?.image_key) {
      return new Response(null, { status: 404, headers });
    }

    const local = getProductImageSrc(productId, product.image_key);
    const url = local?.startsWith("/images/")
      ? new URL(local, request.url).href
      : await getProductStorageUrl(product.image_key);
    if (!url) return new Response(null, { status: 404, headers });

    return new Response(null, {
      status: 307,
      headers: { ...headers, Location: url },
    });
  } catch {
    // Provider errors can contain signed URLs; keep them out of logs/responses.
    return new Response(null, { status: 503, headers });
  }
}
