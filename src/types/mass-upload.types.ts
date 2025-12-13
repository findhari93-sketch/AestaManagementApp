/**
 * Type definitions for Mass Upload feature
 */

// Field types supported in CSV templates
export type FieldType =
  | 'string'
  | 'number'
  | 'date'
  | 'time'
  | 'boolean'
  | 'enum'
  | 'uuid_lookup';

// Configuration for a single field in a table
export interface FieldConfig {
  dbField: string;                    // Database column name
  csvHeader: string;                  // Human-readable CSV header
  required: boolean;                  // Is field required for insert?
  type: FieldType;                    // Field data type
  enumValues?: string[];              // For enum types - allowed values
  lookupTable?: string;               // For uuid_lookup - table to lookup
  lookupField?: string;               // For uuid_lookup - field to match (name, phone, etc.)
  lookupDisplayField?: string;        // For uuid_lookup - field to display in errors
  defaultValue?: string | number | boolean | null;  // Auto-fill value if not provided
  validation?: RegExp;                // Optional validation pattern
  description?: string;               // Help text for CSV template
  transform?: (value: string) => unknown; // Value transformer function
}

// Configuration for a table that supports mass upload
export interface TableConfig {
  tableName: string;                  // Database table name
  displayName: string;                // Human-readable name
  description: string;                // Description shown in UI
  fields: FieldConfig[];              // Field configurations
  requiredContext: ('site_id' | 'user_id')[]; // Auto-injected fields from context
  upsertKey?: string[];               // Fields for upsert matching (if supported)
  exampleRow?: Record<string, string>; // Example data for template
}

// Supported table names for mass upload
export type MassUploadTableName =
  | 'daily_attendance'
  | 'market_laborer_attendance'
  | 'expenses'
  | 'labor_payments'
  | 'laborers'
  | 'subcontracts'
  | 'subcontract_payments'
  | 'tea_shop_entries'
  | 'advances';

// Validation error for a single field
export interface ValidationError {
  rowNumber: number;
  field: string;
  csvHeader: string;
  value: unknown;
  errorType: 'required' | 'type' | 'enum' | 'lookup' | 'format' | 'constraint';
  message: string;
  suggestion?: string;                // e.g., "Did you mean 'Rajesh Kumar'?"
}

// Result of parsing and validating a single row
export interface ParsedRow {
  rowNumber: number;
  originalData: Record<string, string>;  // Raw CSV data
  transformedData: Record<string, unknown>; // Transformed for DB insert
  errors: ValidationError[];
  warnings: ValidationError[];
  status: 'valid' | 'warning' | 'error';
  isSampleRow?: boolean;  // True if this is a sample/example row from template
  isSkipped?: boolean;    // True if user chose to skip this row
}

// Result of parsing entire CSV file
export interface ParseResult {
  rows: ParsedRow[];
  headers: string[];
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
}

// Lookup cache for resolving names to UUIDs
export interface LookupCache {
  laborers: Map<string, { id: string; name: string; phone: string | null }>;
  categories: Map<string, { id: string; name: string }>;
  roles: Map<string, { id: string; name: string }>;
  sections: Map<string, { id: string; name: string }>;
  teams: Map<string, { id: string; name: string }>;
  teaShops: Map<string, { id: string; name: string }>;
  expenseCategories: Map<string, { id: string; name: string }>;
}

// Server-side validation request
export interface ValidateRequest {
  tableName: MassUploadTableName;
  siteId: string;
  rows: Record<string, string>[];
}

// Server-side validation response
export interface ValidateResponse {
  success: boolean;
  parsedRows: ParsedRow[];
  lookupErrors: ValidationError[];
  summary: {
    total: number;
    valid: number;
    warnings: number;
    errors: number;
  };
}

// Import request
export interface ImportRequest {
  tableName: MassUploadTableName;
  siteId: string;
  rows: Record<string, unknown>[];
  userId: string;
  userName: string;
}

// Import result
export interface ImportResult {
  success: boolean;
  importLogId?: string;
  summary: {
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  errors: Array<{
    rowNumber: number;
    error: string;
  }>;
}

// Import progress for UI updates
export interface ImportProgress {
  status: 'idle' | 'validating' | 'importing' | 'completed' | 'error';
  currentRow: number;
  totalRows: number;
  successCount: number;
  errorCount: number;
  message?: string;
}

// Wizard step type
export type WizardStep = 'select-table' | 'upload' | 'preview' | 'import';

// Wizard state
export interface MassUploadState {
  step: WizardStep;
  selectedTable: MassUploadTableName | null;
  selectedSiteId: string | null;
  selectedSiteName: string | null;
  uploadedFile: File | null;
  parseResult: ParseResult | null;
  importProgress: ImportProgress;
  importResult: ImportResult | null;
}
