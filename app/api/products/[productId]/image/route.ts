import { createClient } from "@/lib/supabase/server";
import { createProductImageHandler } from "@/lib/storage/product-image-delivery";
import { getProductStorageUrl, readProductStorageImage } from "@/lib/storage/product-images";

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
  return serveImage(request, productId);
}
