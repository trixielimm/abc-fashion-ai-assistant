// Report contradictory catalogue fields without guessing the supplier's data.
export function productRecordWarnings(product: { product_name: string | null; material: string | null; fit: string | null }) {
  const warnings: string[] = [];
  const fibre = product.product_name?.match(/\b(linen|cotton|silk|wool|leather|suede|polyester|viscose)\b/i)?.[1];
  if (fibre && product.material && !new RegExp(`\\b${fibre}\\b`, "i").test(product.material)) {
    warnings.push(`${product.product_name}: the name says ${fibre}, but the recorded material is ${product.material}. Full composition is unverified; check the supplier's label, especially for a fabric sensitivity.`);
  }
  const fit = product.product_name?.match(/\b(oversized|slim|regular|relaxed)\b/i)?.[1];
  if (fit && product.fit && fit.toLowerCase() !== product.fit.toLowerCase()) {
    warnings.push(`${product.product_name}: its name suggests ${fit}, but the recorded fit is ${product.fit}. Check measurements before deciding.`);
  }
  return warnings;
}
