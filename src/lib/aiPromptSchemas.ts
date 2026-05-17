// src/lib/aiPromptSchemas.ts
import { z } from 'zod';

export const WoodItemSchema = z.object({
  name: z.string().min(1),
  length_ft: z.number().positive(),
  width_in: z.number().positive(),
  thickness_in: z.number().positive(),
  qty: z.number().int().positive(),
  quality_tier: z
    .enum(['1st Quality', '2nd Quality', '3rd Quality'])
    .nullable()
    .optional(),
});
export type WoodItem = z.infer<typeof WoodItemSchema>;
export const WoodItemsSchema = z.array(WoodItemSchema);

export const SteelItemSchema = z.object({
  diameter_mm: z.union([
    z.literal(8),
    z.literal(10),
    z.literal(12),
    z.literal(16),
    z.literal(20),
    z.literal(25),
    z.literal(32),
  ]),
  length_m: z.number().positive(),
  qty: z.number().int().positive(),
  brand: z.string().nullable().optional(),
});
export type SteelItem = z.infer<typeof SteelItemSchema>;
export const SteelItemsSchema = z.array(SteelItemSchema);

export const TilesItemSchema = z.object({
  area_sqft: z.number().positive(),
  tile_size_sqft: z.number().positive(),
  wastage_pct: z.number().min(0).max(50),
  brand: z.string().nullable().optional(),
});
export type TilesItem = z.infer<typeof TilesItemSchema>;
export const TilesItemsSchema = z.array(TilesItemSchema);

export const GenericItemSchema = z.object({
  name: z.string().min(1),
  qty: z.number().positive(),
  unit: z.string(),
  brand: z.string().nullable().optional(),
});
export type GenericItem = z.infer<typeof GenericItemSchema>;
export const GenericItemsSchema = z.array(GenericItemSchema);

/**
 * Parse and validate AI JSON for a given category.
 * Returns items or throws ZodError.
 */
export function parseAiJson(categoryCode: string, raw: string): unknown[] {
  const parsed: unknown = JSON.parse(raw); // throws SyntaxError on bad JSON
  switch (categoryCode) {
    case 'WOD':
      return WoodItemsSchema.parse(parsed);
    case 'STL':
      return SteelItemsSchema.parse(parsed);
    case 'TIL':
      return TilesItemsSchema.parse(parsed);
    default:
      return GenericItemsSchema.parse(parsed);
  }
}
