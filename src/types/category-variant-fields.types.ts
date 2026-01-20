/**
 * Category Variant Fields Types
 * Type definitions for the dynamic variant field system
 */

export type VariantFieldType = 'number' | 'text' | 'select';

export interface VariantFieldOption {
  value: string;
  label: string;
}

export interface VariantFieldDefinition {
  /** Storage key in specifications JSONB */
  key: string;
  /** Display label for the field */
  name: string;
  /** Input type */
  type: VariantFieldType;
  /** Unit suffix (e.g., "mm", "kg", "cft") */
  unit?: string;
  /** Whether field is required */
  required: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Helper text shown below field */
  helperText?: string;
  /** For number type: minimum value */
  min?: number;
  /** For number type: maximum value */
  max?: number;
  /** For number type: step increment */
  step?: number;
  /** Options for select type */
  options?: VariantFieldOption[];
  /** Default value */
  defaultValue?: string | number | null;
  /** Column width in pixels for table display */
  columnWidth?: number;
}

export interface AutoGeneratePreset {
  /** Variant name suffix (e.g., "8mm") */
  name: string;
  /** Field values for this preset */
  values: Record<string, unknown>;
}

export interface AutoGenerateConfig {
  /** Whether auto-generate is enabled for this category */
  enabled: boolean;
  /** Button label (e.g., "Auto-generate TMT sizes (8mm - 32mm)") */
  buttonLabel?: string;
  /** Presets to generate */
  presets: AutoGeneratePreset[];
}

export interface CategoryVariantTemplate {
  /** Fields to display for variants of this category */
  fields: VariantFieldDefinition[];
  /** Suggested default unit for materials in this category */
  defaultUnit?: string;
  /** Auto-generate configuration for this category */
  autoGenerateConfig?: AutoGenerateConfig;
}

/** Minimal category interface for template resolution */
export interface CategoryForTemplate {
  id: string;
  name: string;
  code?: string | null;
  parent_id?: string | null;
}
