type TermKind = "colour" | "product" | "material" | "occasion" | "size" | "fit";

// Deliberate spelling corrections only. Edit-distance matching can turn valid
// shades, brands, sizes or unsupported requirements into something else.
const spellings: Record<TermKind, Record<string, string>> = {
  colour: { lavendar: "lavender", lavandar: "lavender", lavander: "lavender", burgandy: "burgundy", burgendy: "burgundy", purpel: "purple", turqoise: "turquoise", turquiose: "turquoise", fuschia: "fuchsia", beighe: "beige" },
  product: { dres: "dress", dresss: "dress", dreses: "dresses", dressses: "dresses", skrit: "skirt", skrits: "skirts", shrit: "shirt", shrits: "shirts", jaket: "jacket", jakets: "jackets", blous: "blouse", bloues: "blouse", sneeker: "sneaker", sneekers: "sneakers", sandles: "sandals", sandels: "sandals", handbg: "handbag", handbgs: "handbags", handag: "handbag", neckalce: "necklace", neckalces: "necklaces", trousres: "trousers", accesories: "accessories", acessories: "accessories" },
  material: { cotten: "cotton", coton: "cotton", linnen: "linen", polyster: "polyester", lether: "leather" },
  occasion: { weddding: "wedding", weding: "wedding", ocasion: "occasion", occassion: "occasion" },
  size: { meduim: "medium", meidum: "medium", samll: "small", larg: "large" },
  fit: { regualr: "regular", realxed: "relaxed", oversizeed: "oversized" },
};
const terms = new Map(Object.entries(spellings).flatMap(([kind, values]) =>
  Object.entries(values).filter(([from, to]) => from !== to).map(([from, to]) => [from, { kind: kind as TermKind, to }] as const)));

function replacementCase(value: string, original: string) {
  return original === original.toUpperCase() ? value.toUpperCase()
    : /^[A-Z]/.test(original) ? value[0].toUpperCase() + value.slice(1) : value;
}

export function shoppingSpellingView(message: string, protectedPhrases: readonly string[] = []) {
  const protectedRanges = protectedPhrases.filter(Boolean).flatMap(phrase => {
    const ranges: [number, number][] = [];
    let from = 0;
    while (from < message.length) {
      const at = message.toLowerCase().indexOf(phrase.toLowerCase(), from);
      if (at < 0) break;
      ranges.push([at, at + phrase.length]);
      from = at + phrase.length;
    }
    return ranges;
  });
  let text = "";
  let cursor = 0;
  const starts: number[] = [], ends: number[] = [];
  const corrections: { original: string; corrected: string; kind: TermKind }[] = [];
  function append(value: string, start: number, end?: number) {
    text += value;
    for (let index = 0; index < value.length; index++) {
      starts.push(end === undefined ? start + index : start);
      ends.push(end === undefined ? start + index + 1 : end);
    }
  }
  for (const match of message.matchAll(/\b[a-z]+\b/gi)) {
    const at = match.index!;
    const entry = terms.get(match[0].toLowerCase());
    if (!entry || protectedRanges.some(([start, end]) => at >= start && at < end)) continue;
    append(message.slice(cursor, at), cursor);
    const corrected = replacementCase(entry.to, match[0]);
    append(corrected, at, at + match[0].length);
    corrections.push({ original: match[0], corrected, kind: entry.kind });
    cursor = at + match[0].length;
  }
  append(message.slice(cursor), cursor);
  return {
    text, corrections,
    originalQuote(quote: string) {
      const at = text.toLowerCase().indexOf(quote.toLowerCase());
      return at >= 0 && quote.length ? message.slice(starts[at], ends[at + quote.length - 1]) : quote;
    },
  };
}

export function canonicalShoppingValue(field: string, value: string) {
  const kinds: Record<string, TermKind> = { preferred_colours: "colour", excluded_colours: "colour", product_type: "product", subcategory: "product", material: "material", occasion: "occasion", size: "size", fit: "fit" };
  const allowed = spellings[kinds[field]];
  if (!allowed) return value;
  return value.replace(/\b[a-z]+\b/gi, token => {
    const corrected = allowed[token.toLowerCase()];
    return corrected ? replacementCase(corrected, token) : token;
  });
}

// Only quotation-bearing fields are transformed. Product references, arbitrary
// requirements and customer-visible questions keep their original identity.
export function mapShoppingEvidence<T>(value: T, map: (quote: string) => string): T {
  if (Array.isArray(value)) return value.map(entry => mapShoppingEvidence(entry, map)) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key,
    typeof entry === "string" && ["evidence", "intent_evidence", "description", "purpose"].includes(key)
      ? map(entry) : mapShoppingEvidence(entry, map),
  ])) as T;
}
