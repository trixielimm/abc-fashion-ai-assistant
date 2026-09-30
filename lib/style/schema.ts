import { z } from "zod";

export const SizeSchema = z.object({
  item_type: z.enum(["dress", "shoes"]),
  size_system: z.string().trim().min(1).max(20),
  size_label: z.string().trim().min(1).max(30),
});

export const MemorySchema = z.object({
  kind: z.enum(["like", "avoid", "note"]),
  facet: z.enum(["colour", "style", "brand_line", "material", "fit", "product_type", "tag", "note"]),
  value: z.string().trim().min(1).max(240),
  item_scope: z.string().trim().min(1).max(80).nullable(),
}).refine((memory) => (memory.kind === "note") === (memory.facet === "note"), {
  message: "Notes must use the note facet.",
});

export const ProfileUpdateSchema = z.strictObject({
  preferred_name: z.string().trim().max(80).optional(),
  sizes: z.array(SizeSchema).max(2).refine(
    (sizes) => new Set(sizes.map((size) => size.item_type)).size === sizes.length,
    "Only one size can be saved for each item type.",
  ).optional(),
});

export type StyleSize = z.infer<typeof SizeSchema>;
export type StyleMemoryInput = z.infer<typeof MemorySchema>;
export type StyleMemory = StyleMemoryInput & { id: string; created_at: string };
export type StyleProfile = {
  preferred_name: string;
  sizes: StyleSize[];
  memories: StyleMemory[];
};
