import type { CatalogueProduct } from "@/lib/recommendations/catalogue";

export type SearchProduct = CatalogueProduct & {
  product_id: string;
  product_name: string;
  price_aud: number;
};

function normalise(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/([\p{L}])['’]s\b/gu, "$1")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isSearchProduct(product: CatalogueProduct): product is SearchProduct {
  return (
    typeof product.product_id === "string" &&
    typeof product.product_name === "string" &&
    typeof product.price_aud === "number" &&
    Number.isFinite(product.price_aud) &&
    product.price_aud >= 0 &&
    product.is_available === true &&
    typeof product.stock_qty === "number" &&
    Number.isInteger(product.stock_qty) &&
    product.stock_qty > 0
  );
}

export function searchCatalogue(
  catalogue: readonly CatalogueProduct[],
  query: string
): SearchProduct[] {
  const phrase = normalise(query);
  const terms = phrase ? phrase.split(" ") : [];

  const matches = catalogue.filter(isSearchProduct).flatMap((product) => {
    const name = normalise(product.product_name);
    const category = normalise(
      [product.category, product.subcategory, product.product_type].filter(Boolean).join(" ")
    );
    const other = normalise(
      [
        product.brand_line,
        product.gender,
        product.colour,
        product.style,
        product.occasion,
        product.season,
        product.material,
        product.fit,
        product.description,
        ...(product.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
    );
    const searchable = `${name} ${category} ${other}`;

    if (!terms.every((term) => searchable.includes(term))) return [];

    const score = terms.length === 0
      ? 0
      : (name.includes(phrase) ? 100 : 0) +
        terms.reduce(
          (total, term) =>
            total + (name.includes(term) ? 12 : 0) +
            (category.includes(term) ? 5 : 0) +
            (other.includes(term) ? 1 : 0),
          0
        );

    return [{ product, score }];
  });

  matches.sort(
    (a, b) =>
      b.score - a.score ||
      a.product.product_name.localeCompare(b.product.product_name)
  );

  return matches.map(({ product }) => product);
}
