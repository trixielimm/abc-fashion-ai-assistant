import { z } from "zod";
import type { CatalogueProduct } from "../recommendations/catalogue";

export const SPEC_DATASET = "prototype-specs-v1";
const label = z.string().trim().min(1).max(250);
export const ProductSpecificationSchema = z.strictObject({
  product_id: label,
  description: z.string().trim().min(40).max(600),
  construction_details: z.array(label).min(2).max(5),
  care_instructions: z.string().trim().min(15).max(350),
  lining: z.boolean().nullable(), pockets: z.boolean().nullable(),
  adjustable_strap: z.boolean().nullable(), zip_closure: z.boolean().nullable(),
  machine_washable: z.boolean().nullable(),
  capacity_litres: z.number().positive().max(50).nullable(),
  use_cases: z.array(label).min(1).max(4),
  closure: z.enum(["zip", "button", "tie", "slip_on", "buckle", "snap", "open", "clasp", "lace_up", "hook_and_eye", "none"]),
  garment_length_cm: z.number().positive().max(180).nullable(),
  heel_height_cm: z.number().min(0).max(15).nullable(),
  dimensions_cm: z.strictObject({ width: z.number().positive().max(100), height: z.number().positive().max(100), depth: z.number().positive().max(40) }).nullable(),
  strap_drop_cm: z.number().positive().max(80).nullable(),
  compartments: z.number().int().min(1).max(12).nullable(),
  sole_material: label.nullable(), hardware_finish: label.nullable(),
});
export type ProductSpecification = z.infer<typeof ProductSpecificationSchema>;
export const SpecificationIdentitySchema = z.object({
  product_id: label, product_name: label,
  category: label.nullable(), subcategory: label.nullable(), product_type: label.nullable(),
  gender: label.nullable(), colour: label.nullable(), material: label.nullable(),
  fit: label.nullable(), style: label.nullable(), occasion: label.nullable(), season: label.nullable(),
});
export function specificationIdentity(product: CatalogueProduct) {
  return SpecificationIdentitySchema.parse(product);
}
export const SyntheticSpecificationSchema = z.object({
  product_id: label, source_kind: z.literal("synthetic"), dataset_version: z.literal(SPEC_DATASET),
  generator_model: label, generated_at: z.string().datetime({ offset: true }),
  identity_snapshot: SpecificationIdentitySchema, specification: ProductSpecificationSchema,
});
export type SyntheticSpecification = z.infer<typeof SyntheticSpecificationSchema>;

export function validateSpecification(product: CatalogueProduct, input: unknown): ProductSpecification {
  const spec = ProductSpecificationSchema.parse(input);
  const fail = (message: string) => { throw new Error(`${product.product_id}: ${message}`); };
  if (spec.product_id !== product.product_id) fail("specification belongs to another product");
  const category = product.category;
  if (category === "Bags") {
    if (!spec.dimensions_cm || spec.capacity_litres === null || spec.compartments === null) fail("bags require dimensions, capacity and compartments");
    if (spec.dimensions_cm && spec.capacity_litres !== null && spec.capacity_litres > spec.dimensions_cm.width * spec.dimensions_cm.height * spec.dimensions_cm.depth / 1000) fail(`capacity ${spec.capacity_litres} L exceeds external volume ${spec.dimensions_cm.width * spec.dimensions_cm.height * spec.dimensions_cm.depth / 1000} L; capacity must be smaller`);
  } else if (spec.capacity_litres !== null || spec.dimensions_cm !== null || spec.compartments !== null) fail("bag dimensions/capacity/compartments are not applicable");
  if (category === "Shoes") {
    if (spec.heel_height_cm === null || spec.sole_material === null) fail("shoes require heel height and sole material");
  } else if (spec.heel_height_cm !== null || spec.sole_material !== null) fail("shoe details are not applicable");
  if (category === "Clothing") {
    if (spec.garment_length_cm === null) fail("clothing requires a sample garment length");
  } else if (spec.garment_length_cm !== null) fail("garment length is not applicable");
  if (category !== "Bags" && spec.strap_drop_cm !== null) fail("strap drop is a bag measurement");
  if (spec.zip_closure !== null && spec.zip_closure !== (spec.closure === "zip")) fail("zip feature contradicts fastening");
  if (spec.machine_washable === true && (category !== "Clothing" || /leather|suede|silk|wool|cashmere|viscose/i.test(product.material ?? ""))) fail("machine wash is inappropriate for this category/material");
  const mentionsMachine = /machine[ -]wash|(?:gentle|delicate) cycle/i.test(spec.care_instructions);
  const deniesMachine = /(?:do not|don't|don’t|never|avoid|not suitable for|not recommended for)[^.;]{0,30}machine[ -]wash|machine[ -]wash(?:ing)?[^.;]{0,35}(?:not recommended|not suitable|not advised|not permitted)/i.test(spec.care_instructions);
  if (spec.machine_washable === true && (!mentionsMachine || deniesMachine)) fail(`machine_washable=true needs positive matching care instructions; received: ${spec.care_instructions}`);
  if (spec.machine_washable !== true && mentionsMachine && !deniesMachine) fail(`machine_washable=${spec.machine_washable} contradicts care: ${spec.care_instructions}`);
  if (/strapless/i.test(product.product_type ?? "") && spec.adjustable_strap === true) fail("strapless product cannot have adjustable straps");
  if (/\b(certified|guaranteed|antibacterial|waterproof|orthopaedic|orthopedic)\b/i.test([spec.description, ...spec.construction_details].join(" "))) fail("unsupported performance/certification claim");
  if (product.occasion && !spec.use_cases.some(value => value.toLowerCase() === product.occasion!.toLowerCase())) fail("existing occasion must be retained");
  return spec;
}

export function getProductSpecification(product: CatalogueProduct): ProductSpecification | null {
  const parsed = SyntheticSpecificationSchema.safeParse(product.synthetic_specification);
  if (!parsed.success || parsed.data.product_id !== product.product_id) return null;
  try {
    if (JSON.stringify(parsed.data.identity_snapshot) !== JSON.stringify(specificationIdentity(product))) return null;
    return validateSpecification(product, parsed.data.specification);
  } catch { return null; }
}

export function specificationDetails(spec: ProductSpecification) {
  const details = [...spec.construction_details];
  for (const [key, name] of [["lining", "Lining"], ["pockets", "Pockets"], ["adjustable_strap", "Adjustable straps"], ["zip_closure", "Zip closure"]] as const) {
    if (spec[key] !== null) details.push(`${name}: ${spec[key] ? "Yes" : "No"}`);
  }
  details.push(`Fastening: ${spec.closure.replaceAll("_", " ")}`);
  if (spec.garment_length_cm !== null) details.push(`Sample garment length: ${spec.garment_length_cm} cm (varies by size)`);
  if (spec.heel_height_cm !== null) details.push(`Heel height: ${spec.heel_height_cm} cm`);
  if (spec.sole_material) details.push(`Sole: ${spec.sole_material}`);
  if (spec.dimensions_cm) details.push(`Dimensions: ${spec.dimensions_cm.width} × ${spec.dimensions_cm.height} × ${spec.dimensions_cm.depth} cm (W × H × D)`);
  if (spec.capacity_litres !== null) details.push(`Capacity: ${spec.capacity_litres} L`);
  if (spec.compartments !== null) details.push(`Compartments: ${spec.compartments}`);
  if (spec.strap_drop_cm !== null) details.push(`Strap drop: ${spec.strap_drop_cm} cm`);
  if (spec.hardware_finish) details.push(`Hardware: ${spec.hardware_finish}`);
  return details;
}
