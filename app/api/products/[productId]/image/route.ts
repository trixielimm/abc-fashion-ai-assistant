import { createClient } from "@/lib/supabase/server";
import { createProductImageHandler } from "@/lib/storage/product-image-delivery";
import { getProductStorageUrl, readProductStorageImage } from "@/lib/storage/product-images";
import { PRESENTATION_MODE } from "@/lib/demo/config";
import { getDemoProduct } from "@/lib/demo/catalogue";

export const runtime = "nodejs";
const serveImage = createProductImageHandler({
  async getImageKey(productId) {
    const db = await createClient();
    const { data, error } = await db.from("product_catalog")
      .select("image_key").eq("product_id", productId)
      .abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
    if (error) throw new Error("Unable to retrieve the product image.");
    return data?.image_key ?? null;
  },
  getStorageUrl: getProductStorageUrl,
  readImage: readProductStorageImage,
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  if (PRESENTATION_MODE) {
    const image = getDemoProduct(productId)?.image_key;
    return image ? Response.redirect(new URL(image, request.url)) : new Response(null, { status: 404 });
  }
  return serveImage(request, productId);
}
