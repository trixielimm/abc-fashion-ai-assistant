import { getCatalogueProducts } from "@/lib/recommendations/catalogue";
import {
  HardConstraintsSchema,
  filterByHardConstraints,
} from "@/lib/recommendations/hardConstraints";

export const runtime = "nodejs";

// Convert a price from the browser address into a number.
function readPrice(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  // An empty value is invalid, rather than a zero-dollar budget.
  if (value.trim() === "") {
    return Number.NaN;
  }

  return Number(value);
}

export async function GET(request: Request) {
  // Keep this test route available only during development.
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  const params = new URL(request.url).searchParams;

  const validation = HardConstraintsSchema.safeParse({
    size: params.get("size"),
    min_price: readPrice(params.get("min_price")),
    max_price: readPrice(params.get("max_price")),
    excluded_colours: params.getAll("exclude_colour"),
  });

  // Do not query products when the supplied filters are invalid.
  if (!validation.success) {
    return Response.json(
      {
        success: false,
        error: "Invalid filters.",
        issues: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  try {
    const products = await getCatalogueProducts();

    const filteredProducts = filterByHardConstraints(
      products,
      validation.data
    );

    return Response.json(
      {
        success: true,
        filters: validation.data,
        budget_scope: "per_product",
        total_before_filtering: products.length,
        total_after_filtering: filteredProducts.length,

        // Preview up to five products after filtering.
        sample_products: filteredProducts.slice(0, 5).map((product) => ({
          product_id: product.product_id,
          product_name: product.product_name,
          category: product.category,
          subcategory: product.subcategory,
          colour: product.colour,
          price_aud: product.price_aud,
          sizes_available: product.sizes_available,
          stock_qty: product.stock_qty,
          is_available: product.is_available,
        })),
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error(
      "Filter check failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return Response.json(
      {
        success: false,
        error: "Could not filter products. Check the VS Code terminal.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}