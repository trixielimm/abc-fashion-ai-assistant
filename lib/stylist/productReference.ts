import { z } from "zod";
import { MAX_DISPLAYED_PRODUCTS } from "./conversationLimits";

const ReferenceProductSchema = z.object({
  product_id: z.string().trim().min(1),
  product_name: z.string().trim().min(1),
  category: z.string().nullable().optional(),
  subcategory: z.string().nullable(),
  product_type: z.string().nullable().optional(),
});

const ContextSchema = z.strictObject({
  focused: ReferenceProductSchema.nullable(),
  latest: z.array(ReferenceProductSchema).max(MAX_DISPLAYED_PRODUCTS),
  previous: z.array(z.array(ReferenceProductSchema).max(MAX_DISPLAYED_PRODUCTS)).max(2).optional(),
  selected: z.array(ReferenceProductSchema).max(8).optional(),
  comparison: ReferenceProductSchema.optional(),
});

// This represents an interpreted reference, not the raw customer message.
export const ProductReferenceSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("context"),
  }),

  z.strictObject({
    kind: z.literal("position"),
    position: z.number().int().min(1).max(MAX_DISPLAYED_PRODUCTS),
    subcategory: z.string().trim().min(1).nullable(),
  }),

  z.strictObject({
    kind: z.literal("id"),
    value: z.string().trim().min(1),
  }),

  z.strictObject({
    kind: z.literal("name"),
    value: z.string().trim().min(1),
  }),
]);

type Resolution =
  | {
      status: "resolved";
      product_id: string;
    }
  | {
      status: "needs_clarification";
      message: string;
    };

const normalise = (value: string | null) =>
  (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export const isValueComparisonQuestion = (message: string) =>
  /\b(?:extra cost|gain\b.*\blose|price difference|improve\b.*without costing more)\b/i.test(message);

export function valueQuestionProducts(context: {
  comparison?: { product_id: string };
  focused: { product_id: string } | null;
  latest: { product_id: string; price_aud?: number }[];
}, message: string) {
  if (!context.comparison || !isValueComparisonQuestion(message) || /\b(?:first|second|third|fourth|fifth)\b/i.test(message)) return null;
  const original = context.comparison.product_id;
  const candidates = context.latest.filter(product => product.product_id !== original);
  let selected = candidates;
  if (/\bcheaper\b/i.test(message)) {
    const prices = candidates.flatMap(product => product.price_aud === undefined ? [] : [product.price_aud]);
    selected = prices.length === candidates.length ? candidates.filter(product => product.price_aud === Math.min(...prices)) : [];
  } else if (!/\bwhich options\b/i.test(message) && candidates.length > 1) {
    selected = candidates.filter(product => product.product_id === context.focused?.product_id);
  }
  if (!selected.length || (/\bcheaper\b/i.test(message) && selected.length !== 1)) {
    return { ids: [] as string[], question: "Which replacement would you like me to explain? Use its name or position in the results." };
  }
  if (selected.length > 3) return { ids: [] as string[], question: "Which replacements would you like to compare first? Choose up to three by name or position." };
  return { ids: [original, ...selected.map(product => product.product_id)], question: null };
}

// A customer's role noun is often broader than the catalogue subcategory:
// "first bag" includes Clutches and Handbags; "necklace" is a product type.
export function matchesRole(product: z.infer<typeof ReferenceProductSchema>, role: string) {
  const singular = (value: string) => /^dresses?$/i.test(value.trim()) ? "dress"
    : normalise(value).replace(/ies$/, "y").replace(/(?<!s)s$/, "");
  const wanted = singular(role);
  return [product.category, product.subcategory, product.product_type].some(value =>
    value != null && (singular(value) === wanted ||
      (wanted === "dress" && normalise(value) === "dresses") ||
      (wanted === "necklace" && /\bnecklace\b/i.test(value))));
}

export function resolveProductReference(
  contextInput: unknown,
  referenceInput: unknown
): Resolution {
  const context = ContextSchema.parse(contextInput);
  const reference = ProductReferenceSchema.parse(referenceInput);

  function choose(
    rows: Array<z.infer<typeof ReferenceProductSchema>>
  ): Resolution {
    const ids = [
      ...new Set(rows.map((product) => product.product_id)),
    ];

    return ids.length === 1
      ? {
          status: "resolved",
          product_id: ids[0],
        }
      : {
          status: "needs_clarification",
          message:
            ids.length === 0
              ? "I could not identify that product in the current context. Which item do you mean?"
              : "More than one product could match. Which item do you mean?",
        };
  }

  if (reference.kind === "context") {
    // The caller supplies a genuinely focused item, not a stale page reference.
    return choose(
      context.focused
        ? [context.focused]
        : context.latest.length ? context.latest : context.selected ?? []
    );
  }

  if (reference.kind === "position") {
    const rows =
      reference.subcategory === null
        ? context.latest
        : context.latest.filter(
            (product) =>
              matchesRole(product, reference.subcategory!)
          );

    const product = rows[reference.position - 1];

    return choose(product ? [product] : []);
  }

  const pool = [
    ...(context.focused ? [context.focused] : []),
    ...context.latest,
    ...(context.previous?.flat() ?? []),
    ...(context.selected ?? []),
    ...(context.comparison ? [context.comparison] : []),
  ];

  const exact = pool.filter(product => reference.kind === "id"
    ? product.product_id === reference.value
    : normalise(product.product_name) === normalise(reference.value));
  if (exact.length) return choose(exact);
  // Repair a transport label mix-up only for a unique exact known identity.
  // Never fuzzy-match a partial product name or invent an ID.
  return choose(pool.filter(product => reference.kind === "id"
    ? normalise(product.product_name) === normalise(reference.value)
    : product.product_id === reference.value));
}
