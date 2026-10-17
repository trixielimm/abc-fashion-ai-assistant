// Existing customer-facing copy, shared by the product page and the stylist.
// This is not an ETA service or a complete returns policy. Do not infer fees,
// dispatch times, eligibility conditions or refund guarantees from this copy.
export const STORE_POLICY_COPY = {
  delivery: "Standard delivery is available across Australia.",
  returns: "Returns are accepted within 30 days of delivery.",
} as const;
export const DELIVERY_AND_RETURNS_COPY = `${STORE_POLICY_COPY.delivery} ${STORE_POLICY_COPY.returns}`;
