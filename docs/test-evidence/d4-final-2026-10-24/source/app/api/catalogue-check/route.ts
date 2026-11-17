import { getCatalogueProducts } from "@/lib/recommendations/catalogue";

export const runtime = "nodejs";

export async function GET() {
  // Keep this diagnostic route available only during development.
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  try {
    // Read the products using our catalogue helper.
    const products = await getCatalogueProducts();

    return Response.json(
      {
        success: true,
        total_products: products.length,

        // Display only the first three products as a preview.
        sample_products: products.slice(0, 3).map((product) => ({
          product_id: product.product_id,
          product_name: product.product_name,
          category: product.category,
          subcategory: product.subcategory,
          price_aud: product.price_aud,
          sizes_available: product.sizes_available,
          stock_qty: product.stock_qty,
          is_available: product.is_available,
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Catalogue check failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return Response.json(
      {
        success: false,
        error: "Could not load products. Check the VS Code terminal.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}