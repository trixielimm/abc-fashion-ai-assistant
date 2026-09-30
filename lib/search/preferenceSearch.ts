import type { ShoppingPreferences } from "@/lib/ai/preferenceSchema";
import type { CatalogueProduct } from "@/lib/recommendations/catalogue";
import type { StyleMemory, StyleProfile, StyleSize } from "@/lib/style/schema";

export type StylistProduct = {
  product_id: string;
  product_name: string;
  price_aud: number;
  brand_line: string | null;
  category: string | null;
  subcategory: string | null;
  product_type: string | null;
  colour: string | null;
  sizes_available: string[];
};

export type PreferenceSearchResult = {
  status: "matches" | "partial" | "no_match" | "needs_more_detail";
  message: string;
  products: StylistProduct[];
  applied_memories?: string[];
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
      if (word.endsWith("sses") && word.length > 4) return word.slice(0, -2);
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

function savedSizeMatches(available: string, saved: StyleSize): boolean {
  const system = saved.size_system.toUpperCase();
  const labelledSystem = words(available).find((word) => ["au", "uk", "eu", "us"].includes(word));
  // The existing unqualified catalogue labels are Australian. A saved size
  // from another system must carry that system in the product's size label.
  return (labelledSystem ? labelledSystem === system.toLowerCase() : system === "AU") &&
    labelMatches(available, saved.size_label);
}

function relatedLabel(actual: string | null, requested: string): boolean {
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

function validProduct(product: CatalogueProduct): product is AvailableProduct {
  return (
    product.is_available === true &&
    typeof product.product_id === "string" &&
    product.product_id.length > 0 &&
    typeof product.product_name === "string" &&
    product.product_name.length > 0 &&
    typeof product.price_aud === "number" &&
    Number.isFinite(product.price_aud) &&
    product.price_aud >= 0 &&
    typeof product.stock_qty === "number" &&
    product.stock_qty > 0 &&
    Array.isArray(product.sizes_available) &&
    product.sizes_available.some((size) => typeof size === "string" && size.trim())
  );
}

function hasText(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function productHasScope(product: CatalogueProduct, scope: string | null): boolean {
  if (!scope) return true;
  return [product.category, product.subcategory, product.product_type, ...(product.tags ?? [])]
    .some((label) => relatedLabel(label, scope));
}

function memoryMatches(product: CatalogueProduct, memory: StyleMemory): boolean {
  if (!productHasScope(product, memory.item_scope)) return false;
  if (memory.facet === "note") {
    const detail = memory.value.replace(/^i\s+(prefer|like|love|avoid|don't like)\s+/i, "").trim();
    return (product.tags ?? []).some((tag) => relatedLabel(tag, detail));
  }
  if (memory.facet === "tag") return (product.tags ?? []).some((tag) => relatedLabel(tag, memory.value));
  return relatedLabel(product[memory.facet], memory.value);
}

function explicitlyRequested(preferences: ShoppingPreferences, memory: StyleMemory): boolean {
  const requested = memory.facet === "colour" ? preferences.preferred_colours
    : memory.facet === "tag" || memory.facet === "note" ? []
      : [preferences[memory.facet]];
  return requested.some((value) => typeof value === "string" && relatedLabel(value, memory.value)) ||
    (memory.facet === "fit" && hasText(preferences.product_type) && relatedLabel(preferences.product_type, memory.value));
}

function savedSizeFor(preferences: ShoppingPreferences, profile: StyleProfile | null) {
  if (!profile || preferences.size) return null;
  const dress = relatedLabel(preferences.subcategory, "dress") || relatedLabel(preferences.product_type, "dress");
  const shoes = relatedLabel(preferences.category, "shoes");
  const itemType = dress ? "dress" : shoes ? "shoes" : null;
  return itemType ? profile.sizes.find((size) => size.item_type === itemType) ?? null : null;
}

function memoryRelevantToSearch(
  catalogue: readonly CatalogueProduct[], preferences: ShoppingPreferences, memory: StyleMemory,
): boolean {
  if (!memory.item_scope) return true;
  const requested = [preferences.category, preferences.subcategory, preferences.product_type]
    .filter((value): value is string => hasText(value));
  if (requested.length === 0) return true;
  return catalogue.some((product) =>
    productHasScope(product, memory.item_scope) &&
    (!preferences.category || labelMatches(product.category, preferences.category)) &&
    (!preferences.subcategory || labelMatches(product.subcategory, preferences.subcategory)) &&
    (!preferences.product_type || labelMatches(product.product_type, preferences.product_type)),
  );
}

export function searchByPreferences(
  catalogue: readonly CatalogueProduct[],
  preferences: ShoppingPreferences,
  profile: StyleProfile | null = null,
): PreferenceSearchResult {
  const preferredColours = preferences.preferred_colours.filter((colour) => colour.trim());
  const excludedColours = preferences.excluded_colours.filter((colour) => colour.trim());
  const category = hasText(preferences.category) ? preferences.category : null;
  const subcategory = hasText(preferences.subcategory) ? preferences.subcategory : null;
  const productType = hasText(preferences.product_type) ? preferences.product_type : null;
  const brandLine = hasText(preferences.brand_line) ? preferences.brand_line : null;
  const material = hasText(preferences.material) ? preferences.material : null;
  const savedSize = savedSizeFor(preferences, profile);
  const size = hasText(preferences.size) ? preferences.size : savedSize?.size_label ?? null;
  const avoid = (profile?.memories ?? []).filter((memory) => memory.kind === "avoid" && !explicitlyRequested(preferences, memory));
  const likes = (profile?.memories ?? []).filter((memory) => memory.kind === "like" || memory.kind === "note");
  const appliedMemories = [
    ...(savedSize ? [`Using saved ${savedSize.size_system} ${savedSize.size_label} ${savedSize.item_type} size`] : []),
    ...avoid.filter((memory) => memoryRelevantToSearch(catalogue, preferences, memory))
      .map((memory) => `Avoiding ${memory.value}${memory.item_scope ? ` for ${memory.item_scope}` : ""}`),
  ];

  const productAnchor = Boolean(
    category || subcategory || productType || brandLine || material || preferredColours.length,
  );
  const contextAnchor = Boolean(
    hasText(preferences.occasion) ||
      hasText(preferences.style) ||
      hasText(preferences.season) ||
      hasText(preferences.fit),
  );
  const memoryAnchor = likes.length > 0;

  if (!productAnchor && !contextAnchor && !memoryAnchor) {
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
    if (size && !product.sizes_available?.some((available) => savedSize
      ? savedSizeMatches(available, savedSize)
      : labelMatches(available, size))) {
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
    if (excludedColours.some((colour) => relatedLabel(product.colour, colour))) return false;
    // A requested colour is central to a fashion recommendation. Don't show
    // a different colour merely because the other attributes happen to match.
    if (preferredColours.length && !preferredColours.some((colour) => relatedLabel(product.colour, colour))) {
      return false;
    }
    if (avoid.some((memory) => memoryMatches(product, memory))) return false;
    // An unlabelled fit cannot be verified against a saved fit exclusion.
    if (avoid.some((memory) => memory.facet === "fit" && productHasScope(product, memory.item_scope) && !product.fit)) return false;
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
    const memoryBonus = likes.reduce((total, memory) => total + (memoryMatches(product, memory) ? 1 : 0), 0);
    return { product, score, genderBonus, memoryBonus };
  });

  // When a catalogue item matches the requested context, show only items with
  // a context match. A short, relevant list is better than padding it to four.
  const contextMatches = ranked.filter((item) => item.score > 0);
  const relevant = contextMatches.length > 0
    ? contextMatches
    : productAnchor
      ? ranked
      : memoryAnchor
        ? ranked.filter((item) => item.memoryBonus > 0)
        : [];
  relevant.sort(
    (a, b) =>
      b.score - a.score ||
      b.memoryBonus - a.memoryBonus ||
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
      message: savedSize
        ? `I couldn't find an available item labelled for your saved ${savedSize.size_system} ${savedSize.size_label} ${savedSize.item_type} size. The catalogue does not convert sizes between systems. You can ask for another size or change it in My Style.`
        : "I couldn't find an available item that fits those preferences. Try another size, colour, product type, or budget.",
      products: [],
      applied_memories: appliedMemories,
    };
  }

  const partial = maximumScore > 0 && selected.some((item) => item.score < maximumScore);
  return {
    status: partial ? "partial" : "matches",
    message: partial
      ? "These are the closest available items. Some occasion, style, fit, or season details may differ."
      : "Here are a few available items that fit your preferences.",
    applied_memories: [
      ...appliedMemories,
      ...likes.filter((memory) => selected.some(({ product }) => memoryMatches(product, memory)))
        .map((memory) => memory.kind === "note"
          ? `Your note: ${memory.value}${memory.item_scope ? ` for ${memory.item_scope}` : ""}`
          : `You like ${memory.value}${memory.item_scope ? ` for ${memory.item_scope}` : ""}`),
    ],
    products: selected.map(({ product }) => ({
      product_id: product.product_id,
      product_name: product.product_name,
      price_aud: product.price_aud,
      brand_line: product.brand_line,
      category: product.category,
      subcategory: product.subcategory,
      product_type: product.product_type,
      colour: product.colour,
      sizes_available: Array.from(new Set(product.sizes_available
        .filter((size): size is string => typeof size === "string" && size.trim().length > 0)
        .map((size) => size.trim()))),
    })),
  };
}
