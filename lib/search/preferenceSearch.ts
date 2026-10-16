import type { ShoppingPreferences } from "@/lib/ai/preferenceSchema";
import type { CatalogueProduct } from "@/lib/recommendations/catalogue";

export type StylistProduct = {
  product_id: string;
  product_name: string;
  price_aud: number;
  brand_line: string | null;
  category: string | null;
  subcategory: string | null;
  product_type: string | null;
  colour: string | null;
  image_key: string | null;
  sizes_available: string[];
};

export type PreferenceSearchResult = {
  status: "matches" | "partial" | "no_match" | "needs_more_detail";
  message: string;
  products: StylistProduct[];
};

type AvailableProduct = CatalogueProduct & {
  product_id: string;
  product_name: string;
  price_aud: number;
  stock_qty: number;
  sizes_available: string[];
};

const MAX_RECOMMENDATIONS = 4;

function words(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
      if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) {
        return word.slice(0, -1);
      }
      return word;
    });
}

function labelMatches(actual: string | null, requested: string): boolean {
  if (!actual) return false;
  const requestedWords = words(requested);
  if (requestedWords.length === 0) return false;
  const actualWords = new Set(words(actual));
  return requestedWords.every((word) => actualWords.has(word));
}

 export function relatedLabel(actual: string | null, requested: string): boolean {
  if (!actual) return false;
  const actualWords = words(actual);
  const requestedWords = words(requested);
  if (actualWords.length === 0 || requestedWords.length === 0) return false;

  // Occasion labels can vary between "Wedding" and "Wedding Guest".
  return (
    requestedWords.every((word) => actualWords.includes(word)) ||
    actualWords.every((word) => requestedWords.includes(word))
  );
}
function sizeLabelsMatch(actual: string, requested: string): boolean {
  const normaliseSize = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLowerCase();

  return normaliseSize(actual) === normaliseSize(requested);
}
function validProduct(product: CatalogueProduct): product is AvailableProduct {
  return (
    product.is_available === true &&
    typeof product.product_id === "string" &&
    product.product_id.trim().length > 0 &&
    typeof product.product_name === "string" &&
    product.product_name.trim().length > 0 &&
    typeof product.price_aud === "number" &&
    Number.isFinite(product.price_aud) &&
    product.price_aud >= 0 &&
    typeof product.stock_qty === "number" &&
    Number.isSafeInteger(product.stock_qty) &&
    product.stock_qty > 0 &&
    Array.isArray(product.sizes_available) &&
    product.sizes_available.length > 0 &&
    product.sizes_available.every(
      (size) => typeof size === "string" && size.trim().length > 0
    )
  );
}

function hasText(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function searchByPreferences(
  catalogue: readonly CatalogueProduct[],
  preferences: ShoppingPreferences,
): PreferenceSearchResult {
  const preferredColours = preferences.preferred_colours.filter((colour) => colour.trim());
  const excludedColours = preferences.excluded_colours.filter((colour) => colour.trim());
  const category = hasText(preferences.category) ? preferences.category : null;
  const subcategory = hasText(preferences.subcategory) ? preferences.subcategory : null;
  const productType = hasText(preferences.product_type) ? preferences.product_type : null;
  const brandLine = hasText(preferences.brand_line) ? preferences.brand_line : null;
  const material = hasText(preferences.material) ? preferences.material : null;
  const size = hasText(preferences.size) ? preferences.size : null;

  const productAnchor = Boolean(
    category || subcategory || productType || brandLine || material || preferredColours.length,
  );
  const contextAnchor = Boolean(
    hasText(preferences.occasion) ||
      hasText(preferences.style) ||
      hasText(preferences.season) ||
      hasText(preferences.fit),
  );

  if (!productAnchor && !contextAnchor) {
    return {
      status: "needs_more_detail",
      message: "What kind of item are you looking for? Try adding a product, colour, style, or occasion.",
      products: [],
    };
  }

  if (
    preferences.min_price !== null &&
    preferences.max_price !== null &&
    preferences.min_price > preferences.max_price
  ) {
    return {
      status: "needs_more_detail",
      message: "Your minimum price is higher than your maximum price. Please check the budget.",
      products: [],
    };
  }

  if (
    preferredColours.some((preferred) =>
      excludedColours.some((excluded) =>
        words(preferred).join(" ") === words(excluded).join(" "),
      ),
    )
  ) {
    return {
      status: "needs_more_detail",
      message: "A colour is both preferred and excluded. Please tell me which you want.",
      products: [],
    };
  }

  const candidates = catalogue.filter(validProduct).filter((product) => {
    if (preferences.min_price !== null && product.price_aud < preferences.min_price) return false;
    if (preferences.max_price !== null && product.price_aud > preferences.max_price) return false;
    if (size && !product.sizes_available.some((available) => sizeLabelsMatch(available, size))) {
  return false;
}
    if (preferences.gender) {
      const requested = words(preferences.gender).join(" ");
      const actual = words(product.gender ?? "").join(" ");
      if (actual !== requested && !(requested !== "unisex" && actual === "unisex")) return false;
    }
    if (category && !labelMatches(product.category, category)) return false;
    if (subcategory && !labelMatches(product.subcategory, subcategory)) return false;
    if (productType && !labelMatches(product.product_type, productType)) return false;
    if (brandLine && !labelMatches(product.brand_line, brandLine)) return false;
    if (material && !labelMatches(product.material, material)) return false;
   if (excludedColours.length > 0) {
  // A missing colour cannot be checked against the customer's exclusions.
  if (!hasText(product.colour)) return false;

  if (excludedColours.some((colour) => relatedLabel(product.colour, colour))) {
    return false;
  }
}
    // A requested colour is central to a fashion recommendation. Don't show
    // a different colour merely because the other attributes happen to match.
    if (preferredColours.length && !preferredColours.some((colour) => relatedLabel(product.colour, colour))) {
      return false;
    }
    return true;
  });

  const softPreferences = [
    { value: preferences.occasion, field: "occasion", weight: 4 },
    { value: preferences.style, field: "style", weight: 3 },
    { value: preferences.fit, field: "fit", weight: 2 },
    { value: preferences.season, field: "season", weight: 1 },
  ] as const;
  const activeSoft = softPreferences.filter((item) => hasText(item.value));
  const maximumScore = activeSoft.reduce((total, item) => total + item.weight, 0);

  const ranked = candidates.map((product) => {
    const score = activeSoft.reduce((total, item) => {
      const requested = item.value;
      if (!requested) return total;
      return total + (relatedLabel(product[item.field], requested) ? item.weight : 0);
    }, 0);
    const genderBonus = preferences.gender && labelMatches(product.gender, preferences.gender) ? 1 : 0;
    return { product, score, genderBonus };
  });

  // When a catalogue item matches the requested context, show only items with
  // a context match. A short, relevant list is better than padding it to four.
  const contextMatches = ranked.filter((item) => item.score > 0);
  const relevant = contextMatches.length > 0
    ? contextMatches
    : productAnchor
      ? ranked
      : [];
  relevant.sort(
    (a, b) =>
      b.score - a.score ||
      b.genderBonus - a.genderBonus ||
      b.product.stock_qty - a.product.stock_qty ||
      a.product.price_aud - b.product.price_aud ||
      a.product.product_id.localeCompare(b.product.product_id),
  );

  const seenProducts = new Set<string>();
  const selected = relevant.filter(({ product }) => {
    const key = [product.product_name, product.colour, product.brand_line]
      .map((value) => words(value ?? "").join(" "))
      .join("|");
    if (seenProducts.has(key)) return false;
    seenProducts.add(key);
    return true;
  }).slice(0, MAX_RECOMMENDATIONS);
  if (selected.length === 0) {
    return {
      status: "no_match",
      message: "I couldn't find an available item that fits those preferences. Try another size, colour, product type, or budget.",
      products: [],
    };
  }

  const partial = maximumScore > 0 && selected.some((item) => item.score < maximumScore);
  return {
    status: partial ? "partial" : "matches",
    message: partial
      ? "These are the closest available items. Some occasion, style, fit, or season details may differ."
      : "Here are a few available items that fit your preferences.",
    products: selected.map(({ product }) => ({
      product_id: product.product_id,
      product_name: product.product_name,
      price_aud: product.price_aud,
      brand_line: product.brand_line,
      category: product.category,
      subcategory: product.subcategory,
      product_type: product.product_type,
      colour: product.colour,
      image_key: product.image_key,
      occasion: product.occasion,
      style: product.style,
      sizes_available: Array.from(new Set(product.sizes_available
        .filter((size): size is string => typeof size === "string" && size.trim().length > 0)
        .map((size) => size.trim()))),
    })),
  };
}
