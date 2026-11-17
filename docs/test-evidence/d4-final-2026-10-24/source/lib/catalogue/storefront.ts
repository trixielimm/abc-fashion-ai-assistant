import type { Database } from "@/lib/database.types";
import { getProductImageSrc } from "@/lib/product-image";
import { auditedImagePresent } from "./imageHealth";

export type StorefrontProduct = {
  id: string;
  name: string;
  price: number;
  image: string;
  href: string;
  category: string | null;
  subcategory: string | null;
  brandLine: string | null;
  gender: string | null;
  description: string | null;
};

export type StorefrontCategory = {
  id: string;
  name: string;
  href: string;
  image: string;
  imageAlt: string;
  description: string;
};

export type LandingCatalogueRow = Pick<
  Database["public"]["Views"]["product_catalog"]["Row"],
  "product_id" | "product_name" | "price_aud" | "image_key" | "category" |
  "subcategory" | "brand_line" | "gender" | "description" | "stock_qty" | "is_available"
>;

const matches = (actual: string | null, expected: string) => actual?.trim().toLowerCase() === expected;

export function buildLandingContent(rows: readonly LandingCatalogueRow[]) {
  const products = rows.flatMap((row): StorefrontProduct[] => {
    const image = getProductImageSrc(row.product_id, row.image_key);
    if (!row.product_id?.trim() || !row.product_name?.trim() || !image ||
      row.is_available !== true || !Number.isInteger(row.stock_qty) || (row.stock_qty ?? 0) <= 0 ||
      typeof row.price_aud !== "number" || !Number.isFinite(row.price_aud) || row.price_aud < 0 ||
      auditedImagePresent(row) === false) return [];

    return [{
      id: row.product_id, name: row.product_name, price: row.price_aud, image,
      href: `/products/${encodeURIComponent(row.product_id)}`,
      category: row.category, subcategory: row.subcategory, brandLine: row.brand_line,
      gender: row.gender, description: row.description,
    }];
  });

  // Merchandise a mix of collections and product types without pinning database IDs.
  const slots: ((product: StorefrontProduct) => boolean)[] = [
    product => matches(product.gender, "women") && matches(product.subcategory, "tops"),
    product => matches(product.gender, "men") && matches(product.subcategory, "outerwear"),
    product => matches(product.subcategory, "dresses"),
    product => matches(product.category, "bags"),
    product => matches(product.gender, "men") && matches(product.subcategory, "bottoms"),
    product => matches(product.category, "accessories"),
    product => matches(product.category, "shoes"),
    product => matches(product.gender, "women") && matches(product.subcategory, "outerwear"),
  ];
  const featured: StorefrontProduct[] = [];
  for (const slot of slots) {
    const unused = products.filter(product => !featured.some(selected => selected.id === product.id));
    const product = unused.find(slot) ?? unused[0];
    if (product) featured.push(product);
  }

  const categoryDefinitions: {
    id: string; name: string; description: string; params: Record<string, string>;
    select: (product: StorefrontProduct) => boolean;
  }[] = [
    {
      id: "essentials", name: "The Essentials",
      description: "Explore everyday pieces from our clothing collection.",
      params: { category: "clothing" },
      select: (product: StorefrontProduct) => matches(product.category, "clothing"),
    },
    {
      id: "accessories", name: "Accessories",
      description: "Discover the finishing touches in our accessories collection.",
      params: { category: "accessories" },
      select: (product: StorefrontProduct) => matches(product.category, "accessories"),
    },
    {
      id: "outerwear", name: "Outerwear",
      description: "Find your next layer in our current outerwear collection.",
      params: { category: "clothing", subcategory: "outerwear" },
      select: (product: StorefrontProduct) => matches(product.category, "clothing") && matches(product.subcategory, "outerwear"),
    },
  ];
  const categories = categoryDefinitions.flatMap((definition): StorefrontCategory[] => {
    const product = products.find(definition.select);
    if (!product) return [];
    return [{
      id: definition.id, name: definition.name, description: definition.description,
      href: `/search?${new URLSearchParams(definition.params)}`,
      image: product.image, imageAlt: product.name,
    }];
  });

  return {
    categories,
    featured,
    spotlight: featured.find(product => matches(product.subcategory, "outerwear")) ?? featured[0] ?? null,
  };
}
