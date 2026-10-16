import { z } from "zod";

const ReferenceProductSchema = z.object({
  product_id: z.string().trim().min(1),
  product_name: z.string().trim().min(1),
  subcategory: z.string().nullable(),
});

const ContextSchema = z.strictObject({
  focused: ReferenceProductSchema.nullable(),
  latest: z.array(ReferenceProductSchema).max(4),
});

// This represents an interpreted reference, not the raw customer message.
export const ProductReferenceSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("context"),
  }),

  z.strictObject({
    kind: z.literal("position"),
    position: z.number().int().min(1).max(4),
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
        : context.latest
    );
  }

  if (reference.kind === "position") {
    const rows =
      reference.subcategory === null
        ? context.latest
        : context.latest.filter(
            (product) =>
              normalise(product.subcategory) ===
              normalise(reference.subcategory)
          );

    const product = rows[reference.position - 1];

    return choose(product ? [product] : []);
  }

  const pool = [
    ...(context.focused ? [context.focused] : []),
    ...context.latest,
  ];

  return choose(
    pool.filter((product) =>
      reference.kind === "id"
        ? product.product_id === reference.value
        : normalise(product.product_name) ===
          normalise(reference.value)
    )
  );
}