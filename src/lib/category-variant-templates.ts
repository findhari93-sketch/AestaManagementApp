/**
 * Category Variant Templates
 * Defines which variant fields are relevant for each material category
 */

import type {
  CategoryVariantTemplate,
  CategoryForTemplate,
} from '@/types/category-variant-fields.types';
import { TMT_WEIGHTS, TMT_STANDARD_LENGTH, TMT_RODS_PER_BUNDLE } from './weightCalculation';

/**
 * Predefined variant templates for common material categories
 */
export const CATEGORY_VARIANT_TEMPLATES: Record<string, CategoryVariantTemplate> = {
  // ============================================
  // TMT Bars / Steel
  // ============================================
  tmt: {
    fields: [
      {
        key: 'size',
        name: 'Size',
        type: 'text',
        unit: 'mm',
        required: false,
        placeholder: '8, 10, 12...',
        columnWidth: 80,
      },
      {
        key: 'weight_per_unit',
        name: 'Weight/Unit',
        type: 'number',
        unit: 'kg',
        required: false,
        step: 0.001,
        min: 0,
        placeholder: '0.395',
        columnWidth: 110,
      },
      {
        key: 'length_per_piece',
        name: 'Length/Pc',
        type: 'number',
        unit: 'ft',
        required: false,
        step: 0.1,
        min: 0,
        defaultValue: TMT_STANDARD_LENGTH,
        placeholder: '40',
        columnWidth: 100,
      },
      {
        key: 'rods_per_bundle',
        name: 'Rods/Bundle',
        type: 'number',
        required: false,
        step: 1,
        min: 1,
        placeholder: '10',
        columnWidth: 100,
      },
    ],
    defaultUnit: 'piece',
    autoGenerateConfig: {
      enabled: true,
      buttonLabel: 'Auto-generate TMT sizes (8mm - 32mm)',
      presets: Object.entries(TMT_WEIGHTS).map(([size, weight]) => ({
        name: size,
        values: {
          size: size.replace('mm', ''),
          weight_per_unit: weight,
          length_per_piece: TMT_STANDARD_LENGTH,
          rods_per_bundle: TMT_RODS_PER_BUNDLE[size] ?? null,
        },
      })),
    },
  },

  // ============================================
  // Sand & Aggregates (Combined category)
  // ============================================
  sand_aggregates: {
    fields: [
      {
        key: 'material_type',
        name: 'Type',
        type: 'select',
        required: false,
        options: [
          // Aggregates / Gravel - sorted by size
          { value: '6mm', label: '6mm (Stone Chips)' },
          { value: '12mm', label: '12mm (1/2")' },
          { value: '20mm', label: '20mm (3/4" Jalli)' },
          { value: 'muakkal', label: 'Muakkal (0.9")' },
          { value: '25mm', label: '25mm (1")' },
          { value: '40mm', label: '40mm (1.5" Jalli)' },
          { value: '50mm', label: '50mm (2")' },
          { value: 'dust', label: 'Stone Dust / Crusher Dust' },
          // Sand types
          { value: 'msand', label: 'M-Sand' },
          { value: 'psand', label: 'P-Sand (Plastering)' },
          { value: 'river_sand', label: 'River Sand' },
          { value: 'filling_sand', label: 'Filling Sand' },
          { value: 'red_sand', label: 'Red Sand' },
        ],
        columnWidth: 200,
      },
      {
        key: 'grade',
        name: 'Grade',
        type: 'text',
        required: false,
        placeholder: 'Zone I, II, III / M20...',
        columnWidth: 120,
      },
    ],
    defaultUnit: 'cft',
  },

  // ============================================
  // Gravel / Aggregates (Standalone)
  // ============================================
  aggregates: {
    fields: [
      {
        key: 'size',
        name: 'Size',
        type: 'select',
        required: false,
        options: [
          { value: '6mm', label: '6mm (Stone Chips)' },
          { value: '12mm', label: '12mm (1/2")' },
          { value: '20mm', label: '20mm (3/4" Jalli)' },
          { value: 'muakkal', label: 'Muakkal (0.9")' },
          { value: '25mm', label: '25mm (1")' },
          { value: '40mm', label: '40mm (1.5" Jalli)' },
          { value: '50mm', label: '50mm (2")' },
          { value: 'dust', label: 'Stone Dust / Crusher Dust' },
        ],
        columnWidth: 180,
      },
      {
        key: 'grade',
        name: 'Grade',
        type: 'text',
        required: false,
        placeholder: 'M20, M25...',
        helperText: 'Concrete grade suitability',
        columnWidth: 100,
      },
    ],
    defaultUnit: 'cft',
  },

  // ============================================
  // Bricks / Blocks
  // ============================================
  bricks: {
    fields: [
      {
        key: 'dimensions',
        name: 'Dimensions',
        type: 'text',
        required: false,
        placeholder: '9x4x3, 6x4x2...',
        helperText: 'LxWxH in inches',
        columnWidth: 120,
      },
      {
        key: 'brick_type',
        name: 'Type',
        type: 'select',
        required: false,
        options: [
          { value: 'red_clay', label: 'Red Clay' },
          { value: 'fly_ash', label: 'Fly Ash' },
          { value: 'concrete', label: 'Concrete Block' },
          { value: 'aac', label: 'AAC Block' },
          { value: 'clc', label: 'CLC Block' },
          { value: 'solid', label: 'Solid Block' },
          { value: 'hollow', label: 'Hollow Block' },
        ],
        columnWidth: 130,
      },
      {
        key: 'strength',
        name: 'Strength',
        type: 'text',
        required: false,
        placeholder: '3.5 N/mm²',
        columnWidth: 100,
      },
    ],
    defaultUnit: 'nos',
  },

  // ============================================
  // Cement
  // ============================================
  cement: {
    fields: [
      {
        key: 'bag_weight',
        name: 'Bag Weight',
        type: 'select',
        required: false,
        options: [
          { value: '50kg', label: '50 kg Bag' },
          { value: '25kg', label: '25 kg Bag' },
          { value: '1kg', label: '1 kg Pack' },
        ],
        defaultValue: '50kg',
        columnWidth: 110,
      },
      {
        key: 'cement_grade',
        name: 'Grade',
        type: 'select',
        required: false,
        options: [
          { value: 'ppc', label: 'PPC' },
          { value: 'opc33', label: 'OPC 33' },
          { value: 'opc43', label: 'OPC 43' },
          { value: 'opc53', label: 'OPC 53' },
          { value: 'psc', label: 'PSC' },
          { value: 'white', label: 'White Cement' },
        ],
        columnWidth: 100,
      },
    ],
    defaultUnit: 'bag',
  },

  // ============================================
  // PVC/CPVC Pipes
  // ============================================
  pipes: {
    fields: [
      {
        key: 'diameter',
        name: 'Diameter',
        type: 'text',
        required: false,
        placeholder: '1/2", 3/4", 1"...',
        columnWidth: 100,
      },
      {
        key: 'length',
        name: 'Length',
        type: 'number',
        unit: 'm',
        required: false,
        step: 0.5,
        defaultValue: 6,
        min: 0,
        columnWidth: 90,
      },
      {
        key: 'pipe_type',
        name: 'Type',
        type: 'select',
        required: false,
        options: [
          { value: 'pvc', label: 'PVC' },
          { value: 'cpvc', label: 'CPVC' },
          { value: 'upvc', label: 'uPVC' },
          { value: 'hdpe', label: 'HDPE' },
          { value: 'gi', label: 'GI Pipe' },
          { value: 'pprc', label: 'PPR-C' },
        ],
        columnWidth: 90,
      },
      {
        key: 'pressure_rating',
        name: 'Pressure',
        type: 'text',
        required: false,
        placeholder: '6 kg/cm²',
        columnWidth: 90,
      },
    ],
    defaultUnit: 'piece',
  },

  // ============================================
  // Electrical Wire / Cable
  // ============================================
  wire: {
    fields: [
      {
        key: 'gauge',
        name: 'Gauge',
        type: 'select',
        required: false,
        options: [
          { value: '0.75', label: '0.75 sq.mm' },
          { value: '1', label: '1 sq.mm' },
          { value: '1.5', label: '1.5 sq.mm' },
          { value: '2.5', label: '2.5 sq.mm' },
          { value: '4', label: '4 sq.mm' },
          { value: '6', label: '6 sq.mm' },
          { value: '10', label: '10 sq.mm' },
          { value: '16', label: '16 sq.mm' },
        ],
        columnWidth: 110,
      },
      {
        key: 'core_type',
        name: 'Core',
        type: 'select',
        required: false,
        options: [
          { value: 'single', label: 'Single Core' },
          { value: 'multi', label: 'Multi Core' },
          { value: 'flexible', label: 'Flexible' },
          { value: '2core', label: '2 Core' },
          { value: '3core', label: '3 Core' },
        ],
        columnWidth: 100,
      },
      {
        key: 'coil_length',
        name: 'Coil Length',
        type: 'number',
        unit: 'm',
        required: false,
        defaultValue: 90,
        min: 0,
        columnWidth: 100,
      },
    ],
    defaultUnit: 'rmt',
  },

  // ============================================
  // Sand
  // ============================================
  sand: {
    fields: [
      {
        key: 'sand_type',
        name: 'Type',
        type: 'select',
        required: false,
        options: [
          { value: 'msand', label: 'M-Sand' },
          { value: 'river', label: 'River Sand' },
          { value: 'plastering', label: 'Plastering Sand' },
          { value: 'filling', label: 'Filling Sand' },
          { value: 'red', label: 'Red Sand' },
        ],
        columnWidth: 140,
      },
      {
        key: 'grade',
        name: 'Grade',
        type: 'text',
        required: false,
        placeholder: 'Zone I, II, III',
        columnWidth: 100,
      },
    ],
    defaultUnit: 'cft',
  },

  // ============================================
  // Tiles / Flooring
  // ============================================
  tiles: {
    fields: [
      {
        key: 'tile_size',
        name: 'Size',
        type: 'text',
        required: false,
        placeholder: '2x2 ft, 60x60 cm',
        columnWidth: 120,
      },
      {
        key: 'thickness',
        name: 'Thickness',
        type: 'text',
        required: false,
        placeholder: '8mm, 10mm',
        columnWidth: 90,
      },
      {
        key: 'tile_type',
        name: 'Type',
        type: 'select',
        required: false,
        options: [
          { value: 'ceramic', label: 'Ceramic' },
          { value: 'vitrified', label: 'Vitrified' },
          { value: 'porcelain', label: 'Porcelain' },
          { value: 'mosaic', label: 'Mosaic' },
          { value: 'granite', label: 'Granite' },
          { value: 'marble', label: 'Marble' },
        ],
        columnWidth: 100,
      },
      {
        key: 'finish',
        name: 'Finish',
        type: 'select',
        required: false,
        options: [
          { value: 'glossy', label: 'Glossy' },
          { value: 'matte', label: 'Matte' },
          { value: 'satin', label: 'Satin' },
          { value: 'rustic', label: 'Rustic' },
          { value: 'polished', label: 'Polished' },
        ],
        columnWidth: 90,
      },
    ],
    defaultUnit: 'sqft',
  },

  // ============================================
  // Paint
  // ============================================
  paint: {
    fields: [
      {
        key: 'volume',
        name: 'Volume',
        type: 'select',
        required: false,
        options: [
          { value: '1L', label: '1 Liter' },
          { value: '4L', label: '4 Liters' },
          { value: '10L', label: '10 Liters' },
          { value: '20L', label: '20 Liters' },
        ],
        columnWidth: 100,
      },
      {
        key: 'paint_type',
        name: 'Type',
        type: 'select',
        required: false,
        options: [
          { value: 'emulsion', label: 'Emulsion' },
          { value: 'distemper', label: 'Distemper' },
          { value: 'enamel', label: 'Enamel' },
          { value: 'primer', label: 'Primer' },
          { value: 'putty', label: 'Putty' },
          { value: 'texture', label: 'Texture' },
        ],
        columnWidth: 100,
      },
      {
        key: 'finish',
        name: 'Finish',
        type: 'select',
        required: false,
        options: [
          { value: 'matte', label: 'Matte' },
          { value: 'silk', label: 'Silk/Satin' },
          { value: 'gloss', label: 'Gloss' },
          { value: 'eggshell', label: 'Eggshell' },
        ],
        columnWidth: 90,
      },
    ],
    defaultUnit: 'liter',
  },

  // ============================================
  // Waterproofing
  // ============================================
  waterproofing: {
    fields: [
      {
        key: 'product_type',
        name: 'Type',
        type: 'select',
        required: false,
        options: [
          { value: 'liquid', label: 'Liquid Membrane' },
          { value: 'sheet', label: 'Sheet/Roll' },
          { value: 'powder', label: 'Powder Additive' },
          { value: 'tape', label: 'Sealing Tape' },
        ],
        columnWidth: 130,
      },
      {
        key: 'coverage',
        name: 'Coverage',
        type: 'text',
        required: false,
        placeholder: 'sqft/L, sqm/kg',
        columnWidth: 100,
      },
    ],
    defaultUnit: 'liter',
  },

  // ============================================
  // Fittings (Plumbing/Electrical)
  // ============================================
  fittings: {
    fields: [
      {
        key: 'fitting_size',
        name: 'Size',
        type: 'text',
        required: false,
        placeholder: '1/2", 3/4", 1"...',
        columnWidth: 100,
      },
      {
        key: 'fitting_type',
        name: 'Type',
        type: 'text',
        required: false,
        placeholder: 'Elbow, Tee, Union...',
        columnWidth: 120,
      },
    ],
    defaultUnit: 'nos',
  },

  // ============================================
  // Default (Generic)
  // ============================================
  default: {
    fields: [
      {
        key: 'variant_spec',
        name: 'Specification',
        type: 'text',
        required: false,
        placeholder: 'Enter variant specification...',
        columnWidth: 200,
      },
    ],
  },
};

/**
 * Map of category codes/names to template keys
 * Used for quick lookup before pattern matching
 */
const CATEGORY_CODE_MAP: Record<string, string> = {
  // Exact code matches (case-insensitive)
  TMT: 'tmt',
  STEEL: 'tmt',
  AGGR: 'aggregates',
  GRAVEL: 'aggregates',
  'SAND-AGG': 'sand_aggregates',
  BRICK: 'bricks',
  BLOCK: 'bricks',
  CEMENT: 'cement',
  CEM: 'cement',
  PVC: 'pipes',
  PIPE: 'pipes',
  ELEC: 'wire',
  WIRE: 'wire',
  CABLE: 'wire',
  SAND: 'sand',
  TILE: 'tiles',
  PAINT: 'paint',
  WP: 'waterproofing',
  FIT: 'fittings',
};

/**
 * Pattern matchers for category name detection
 * Order matters - more specific patterns first
 */
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; templateKey: string }> = [
  // TMT / Steel
  { pattern: /\b(tmt|steel|bar|rod|rebar)\b/i, templateKey: 'tmt' },
  // Sand & Aggregates (combined) - MUST come before individual sand/aggregates patterns
  { pattern: /sand\s*[&,]\s*aggregate/i, templateKey: 'sand_aggregates' },
  { pattern: /aggregate\s*[&,]\s*sand/i, templateKey: 'sand_aggregates' },
  // Aggregates (standalone)
  { pattern: /\b(aggregate|gravel|jalli|blue\s*metal|stone\s*chip|coarse)\b/i, templateKey: 'aggregates' },
  // Bricks / Blocks
  { pattern: /\b(brick|block|aac|clc|fly\s*ash)\b/i, templateKey: 'bricks' },
  // Cement
  { pattern: /\b(cement|ppc|opc|psc)\b/i, templateKey: 'cement' },
  // Pipes
  { pattern: /\b(pipe|pvc|cpvc|upvc|hdpe|plumbing)\b/i, templateKey: 'pipes' },
  // Wire / Cable
  { pattern: /\b(wire|cable|electrical\s*wire)\b/i, templateKey: 'wire' },
  // Sand (standalone)
  { pattern: /\b(sand|m-sand|msand|river\s*sand)\b/i, templateKey: 'sand' },
  // Tiles
  { pattern: /\b(tile|flooring|ceramic|vitrified|porcelain)\b/i, templateKey: 'tiles' },
  // Paint
  { pattern: /\b(paint|primer|distemper|enamel|putty)\b/i, templateKey: 'paint' },
  // Waterproofing
  { pattern: /\b(waterproof|dr\s*fixit|fosroc|sika)\b/i, templateKey: 'waterproofing' },
  // Fittings
  { pattern: /\b(fitting|elbow|tee|union|coupling|valve)\b/i, templateKey: 'fittings' },
];

/**
 * Get the variant template for a category
 *
 * @param category - The category to get template for
 * @param parentCategory - Optional parent category for hierarchical matching
 * @returns The variant template for the category
 */
export function getCategoryTemplate(
  category: CategoryForTemplate | null,
  parentCategory?: CategoryForTemplate | null
): CategoryVariantTemplate {
  if (!category) {
    return CATEGORY_VARIANT_TEMPLATES.default;
  }

  // 1. Check by code first (exact match)
  const code = category.code?.toUpperCase();
  if (code && CATEGORY_CODE_MAP[code]) {
    return CATEGORY_VARIANT_TEMPLATES[CATEGORY_CODE_MAP[code]];
  }

  // 2. Build full name for pattern matching (include parent if available)
  const fullName = parentCategory
    ? `${parentCategory.name} ${category.name}`
    : category.name;

  // 3. Check patterns
  for (const { pattern, templateKey } of CATEGORY_PATTERNS) {
    if (pattern.test(fullName)) {
      return CATEGORY_VARIANT_TEMPLATES[templateKey];
    }
  }

  // 4. Fallback to default
  return CATEGORY_VARIANT_TEMPLATES.default;
}

/**
 * Get the template key for a category (useful for debugging)
 */
export function getCategoryTemplateKey(
  category: CategoryForTemplate | null,
  parentCategory?: CategoryForTemplate | null
): string {
  if (!category) {
    return 'default';
  }

  const code = category.code?.toUpperCase();
  if (code && CATEGORY_CODE_MAP[code]) {
    return CATEGORY_CODE_MAP[code];
  }

  const fullName = parentCategory
    ? `${parentCategory.name} ${category.name}`
    : category.name;

  for (const { pattern, templateKey } of CATEGORY_PATTERNS) {
    if (pattern.test(fullName)) {
      return templateKey;
    }
  }

  return 'default';
}

/**
 * Check if a category has auto-generate capability
 */
export function categoryHasAutoGenerate(
  category: CategoryForTemplate | null,
  parentCategory?: CategoryForTemplate | null
): boolean {
  const template = getCategoryTemplate(category, parentCategory);
  return template.autoGenerateConfig?.enabled ?? false;
}

/**
 * Get all available template keys (for debugging/admin)
 */
export function getAllTemplateKeys(): string[] {
  return Object.keys(CATEGORY_VARIANT_TEMPLATES);
}
