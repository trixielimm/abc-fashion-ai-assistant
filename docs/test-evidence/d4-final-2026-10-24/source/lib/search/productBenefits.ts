import { type StylingState, type VerifiedFeature, VerifiedFeatureSchema, COMMERCE_POLICY } from "../stylist/commerceSchema";
import type { CatalogueProduct } from "../recommendations/catalogue";
import { getProductSpecification, SPEC_DATASET } from "../stylist/productSpecifications";

const keys = { lining: "lining", adjustability: "adjustable_strap", pockets: "pockets", closure: "zip_closure", easy_care: "machine_washable", capacity: "capacity_litres", versatility: "use_cases" } as const;
const names = { lining: "Lining", adjustable_strap: "Adjustable strap", pockets: "Pockets", zip_closure: "Zip closure", machine_washable: "Machine-wash care", capacity_litres: "Greater recorded capacity", use_cases: "Additional recorded use cases" };
export function verifiedFeatures(product: CatalogueProduct): VerifiedFeature[] {
  return (product.verified_features ?? []).flatMap(input => {
    const parsed = VerifiedFeatureSchema.safeParse(input);
    return parsed.success && parsed.data.product_id === product.product_id ? [parsed.data] : [];
  });
}
type ComparableFeature = Omit<VerifiedFeature, "review_status"> & { review_status: "verified" | "synthetic" };
export function comparableFeatures(product: CatalogueProduct): ComparableFeature[] {
  const verified = verifiedFeatures(product);
  const spec = getProductSpecification(product);
  if (!spec) return verified;
  const synthetic: ComparableFeature[] = [];
  for (const key of Object.values(keys)) {
    const value = spec[key];
    if (value === null || verified.some(feature => feature.feature_key === key)) continue;
    synthetic.push({ product_id: product.product_id!, feature_key: key, value,
      source_reference: `prototype:${SPEC_DATASET}/${product.product_id}`, source_version: SPEC_DATASET,
      review_status: "synthetic", verified_at: product.synthetic_specification!.generated_at });
  }
  return [...verified, ...synthetic];
}
export function meetsFeatureRequirements(product: CatalogueProduct, requirements: StylingState["required_features"]) {
  const features = comparableFeatures(product);
  return requirements.every(key => features.some(feature => feature.feature_key === key && feature.value === true));
}
export function compareBenefits(primary: CatalogueProduct, candidate: CatalogueProduct, priorities: StylingState["priorities"]) {
  const before = comparableFeatures(primary), after = comparableFeatures(candidate);
  const benefits = priorities.flatMap(priority => {
    const key = keys[priority];
    const original = before.find(feature => feature.feature_key === key), replacement = after.find(feature => feature.feature_key === key);
    if (!original || !replacement) return []; // Unknown is not absent.
    const old = original.value, next = replacement.value;
    const improved = key === "capacity_litres" ? typeof old === "number" && typeof next === "number" && next > old
      : key === "use_cases" ? Array.isArray(old) && Array.isArray(next) && old.every(value => next.includes(value)) && next.some(value => !old.includes(value))
        : old === false && next === true;
    return improved ? [{ feature_key: key, label: names[key], before: old, after: next,
      evidence_kind: original.review_status === "synthetic" || replacement.review_status === "synthetic" ? "synthetic" as const : "verified" as const,
      source_references: [original.source_reference, replacement.source_reference] }] : [];
  });
  const tradeoffs = before.flatMap(original => {
    const replacement = after.find(feature => feature.feature_key === original.feature_key);
    if (!replacement) return [`${names[original.feature_key]} is recorded for the original but cannot be compared for the alternative.`];
    if (original.value === true && replacement.value === false) return [`The alternative lacks ${original.feature_key.replaceAll("_", " ")}, recorded for the original.`];
    if (typeof original.value === "number" && typeof replacement.value === "number" && replacement.value < original.value) return [`Recorded capacity decreases from ${original.value} to ${replacement.value} litres.`];
    if (Array.isArray(original.value) && Array.isArray(replacement.value)) {
      const values = replacement.value;
      const lost = original.value.filter(value => !values.includes(value));
      if (lost.length) return [`Documented use cases not preserved: ${lost.join(", ")}.`];
    }
    return [];
  });
  return { policy_version: COMMERCE_POLICY, benefits, tradeoffs: tradeoffs.slice(0, 12) };
}
