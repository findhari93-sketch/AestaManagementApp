/**
 * CSV Parser for Mass Upload
 * Handles client-side CSV parsing and initial validation
 */

import Papa from 'papaparse';
import {
  MassUploadTableName,
  ParsedRow,
  ParseResult,
  ValidationError,
} from '@/types/mass-upload.types';
import { getTableConfig } from './tableConfigs';
import { validateField } from './validators';

// Known sample data patterns to detect sample rows
const SAMPLE_DATA_PATTERNS = [
  'Rajesh Kumar',
  'Suresh Singh',
  'Sample Name',
  'Sample',
  'sample@example.com',
  'test@example.com',
  'Sample Address',
  'Mason Team',
  'Helper Team',
  'Site Alpha',
  'Site Beta',
  'Block A',
  'Block B',
  'Chai Wala',
  'Tea Point',
  'Contract-001',
  'Contract-002',
  'REF001',
  'REF002',
];

/**
 * Check if a row contains sample/example data
 */
function isSampleRow(row: Record<string, string>): boolean {
  const values = Object.values(row).filter(v => v && v.trim() !== '');

  // Check if any value matches known sample patterns
  for (const value of values) {
    const trimmedValue = value.trim();
    for (const pattern of SAMPLE_DATA_PATTERNS) {
      if (trimmedValue.toLowerCase() === pattern.toLowerCase()) {
        return true;
      }
      // Check for pattern at start of value
      if (trimmedValue.toLowerCase().startsWith(pattern.toLowerCase())) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Parse CSV file and perform client-side validation
 */
export async function parseCSVFile(
  file: File,
  tableName: MassUploadTableName
): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const config = getTableConfig(tableName);
    if (!config) {
      reject(new Error(`No configuration found for table: ${tableName}`));
      return;
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        try {
          const parsedRows = processParseResults(results, tableName);

          resolve({
            rows: parsedRows,
            headers: results.meta.fields || [],
            totalRows: parsedRows.length,
            validRows: parsedRows.filter(r => r.status === 'valid' && !r.isSkipped).length,
            warningRows: parsedRows.filter(r => r.status === 'warning' && !r.isSkipped).length,
            errorRows: parsedRows.filter(r => r.status === 'error' && !r.isSkipped).length,
          });
        } catch (err) {
          reject(err);
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      },
    });
  });
}

/**
 * Process PapaParse results and validate each row
 */
function processParseResults(
  results: Papa.ParseResult<Record<string, string>>,
  tableName: MassUploadTableName
): ParsedRow[] {
  const config = getTableConfig(tableName);
  if (!config) return [];

  const parsedRows: ParsedRow[] = [];

  results.data.forEach((row, index) => {
    // Skip completely empty rows
    const hasAnyValue = Object.values(row).some(val => val && val.trim() !== '');
    if (!hasAnyValue) return;

    // Skip comment rows (starting with #)
    const firstValue = Object.values(row)[0];
    if (firstValue && firstValue.trim().startsWith('#')) return;

    const rowNumber = index + 2; // +2 for header row and 1-based indexing
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const transformedData: Record<string, unknown> = {};

    // Check if this is a sample row
    const sampleRow = isSampleRow(row);

    // Validate each field based on config
    config.fields.forEach((fieldConfig) => {
      const csvValue = row[fieldConfig.csvHeader];
      const trimmedValue = csvValue?.trim() || '';

      // Validate the field
      const validationResult = validateField(
        trimmedValue,
        fieldConfig,
        rowNumber
      );

      if (validationResult.error) {
        if (validationResult.error.errorType === 'required') {
          errors.push(validationResult.error);
        } else {
          // For non-required validation failures, treat as errors too
          errors.push(validationResult.error);
        }
      }

      if (validationResult.warning) {
        warnings.push(validationResult.warning);
      }

      // Store transformed value
      transformedData[fieldConfig.dbField] = validationResult.transformedValue;
    });

    // Check for unknown columns (optional warning)
    const expectedHeaders = new Set(config.fields.map(f => f.csvHeader.toLowerCase()));
    Object.keys(row).forEach(header => {
      if (!expectedHeaders.has(header.toLowerCase())) {
        warnings.push({
          rowNumber,
          field: header,
          csvHeader: header,
          value: row[header],
          errorType: 'format',
          message: `Unknown column "${header}" will be ignored`,
        });
      }
    });

    // Determine row status
    let status: 'valid' | 'warning' | 'error' = 'valid';
    if (errors.length > 0) {
      status = 'error';
    } else if (warnings.length > 0) {
      status = 'warning';
    }

    parsedRows.push({
      rowNumber,
      originalData: row,
      transformedData,
      errors,
      warnings,
      status,
      isSampleRow: sampleRow,
      isSkipped: false,
    });
  });

  return parsedRows;
}

/**
 * Parse CSV string (for testing or API use)
 */
export function parseCSVString(
  csvContent: string,
  tableName: MassUploadTableName
): ParseResult {
  const config = getTableConfig(tableName);
  if (!config) {
    throw new Error(`No configuration found for table: ${tableName}`);
  }

  const results = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  const parsedRows = processParseResults(results, tableName);

  return {
    rows: parsedRows,
    headers: results.meta.fields || [],
    totalRows: parsedRows.length,
    validRows: parsedRows.filter(r => r.status === 'valid' && !r.isSkipped).length,
    warningRows: parsedRows.filter(r => r.status === 'warning' && !r.isSkipped).length,
    errorRows: parsedRows.filter(r => r.status === 'error' && !r.isSkipped).length,
  };
}

/**
 * Validate CSV headers match expected template
 */
export function validateCSVHeaders(
  headers: string[],
  tableName: MassUploadTableName
): { valid: boolean; missingRequired: string[]; unknown: string[] } {
  const config = getTableConfig(tableName);
  if (!config) {
    return { valid: false, missingRequired: [], unknown: headers };
  }

  const expectedHeaders = new Set(config.fields.map(f => f.csvHeader.toLowerCase()));
  const requiredHeaders = new Set(
    config.fields.filter(f => f.required).map(f => f.csvHeader.toLowerCase())
  );

  const providedHeaders = new Set(headers.map(h => h.toLowerCase()));

  // Find missing required headers
  const missingRequired: string[] = [];
  requiredHeaders.forEach(header => {
    if (!providedHeaders.has(header)) {
      const originalHeader = config.fields.find(
        f => f.csvHeader.toLowerCase() === header
      )?.csvHeader;
      if (originalHeader) {
        missingRequired.push(originalHeader);
      }
    }
  });

  // Find unknown headers
  const unknown: string[] = [];
  headers.forEach(header => {
    if (!expectedHeaders.has(header.toLowerCase())) {
      unknown.push(header);
    }
  });

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    unknown,
  };
}

/**
 * Get sample rows from CSV for preview
 */
export function getSampleRows(
  parseResult: ParseResult,
  maxRows: number = 5
): ParsedRow[] {
  return parseResult.rows.slice(0, maxRows);
}

/**
 * Export failed rows back to CSV for user to fix
 */
export function exportFailedRowsToCSV(
  parseResult: ParseResult,
  tableName: MassUploadTableName
): string {
  const config = getTableConfig(tableName);
  if (!config) return '';

  const failedRows = parseResult.rows.filter(r => r.status === 'error' && !r.isSkipped);
  if (failedRows.length === 0) return '';

  const headers = config.fields.map(f => f.csvHeader);
  const errorHeader = 'Errors';

  const data = failedRows.map(row => {
    const rowData = headers.map(header => row.originalData[header] || '');
    // Add error messages as last column
    const errorMessages = row.errors.map(e => e.message).join('; ');
    return [...rowData, errorMessages];
  });

  return Papa.unparse({
    fields: [...headers, errorHeader],
    data,
  });
}

/**
 * Toggle skip status for a row
 */
export function toggleRowSkip(
  parseResult: ParseResult,
  rowNumber: number
): ParseResult {
  const rows = parseResult.rows.map(row => {
    if (row.rowNumber === rowNumber) {
      return { ...row, isSkipped: !row.isSkipped };
    }
    return row;
  });

  return {
    ...parseResult,
    rows,
    validRows: rows.filter(r => r.status === 'valid' && !r.isSkipped).length,
    warningRows: rows.filter(r => r.status === 'warning' && !r.isSkipped).length,
    errorRows: rows.filter(r => r.status === 'error' && !r.isSkipped).length,
  };
}

/**
 * Skip all sample rows
 */
export function skipAllSampleRows(parseResult: ParseResult): ParseResult {
  const rows = parseResult.rows.map(row => {
    if (row.isSampleRow) {
      return { ...row, isSkipped: true };
    }
    return row;
  });

  return {
    ...parseResult,
    rows,
    validRows: rows.filter(r => r.status === 'valid' && !r.isSkipped).length,
    warningRows: rows.filter(r => r.status === 'warning' && !r.isSkipped).length,
    errorRows: rows.filter(r => r.status === 'error' && !r.isSkipped).length,
  };
}

/**
 * Update a specific cell value in a row
 */
export function updateRowCell(
  parseResult: ParseResult,
  rowNumber: number,
  field: string,
  value: string
): ParseResult {
  const rows = parseResult.rows.map(row => {
    if (row.rowNumber === rowNumber) {
      return {
        ...row,
        originalData: {
          ...row.originalData,
          [field]: value,
        },
      };
    }
    return row;
  });

  return {
    ...parseResult,
    rows,
  };
}

/**
 * Delete a row from parse result
 */
export function deleteRow(
  parseResult: ParseResult,
  rowNumber: number
): ParseResult {
  const rows = parseResult.rows.filter(row => row.rowNumber !== rowNumber);

  return {
    ...parseResult,
    rows,
    totalRows: rows.length,
    validRows: rows.filter(r => r.status === 'valid' && !r.isSkipped).length,
    warningRows: rows.filter(r => r.status === 'warning' && !r.isSkipped).length,
    errorRows: rows.filter(r => r.status === 'error' && !r.isSkipped).length,
  };
}

/**
 * Get rows that will be imported (not skipped)
 */
export function getRowsForImport(parseResult: ParseResult): ParsedRow[] {
  return parseResult.rows.filter(row => !row.isSkipped);
}
