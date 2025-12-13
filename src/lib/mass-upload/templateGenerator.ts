/**
 * Template Generator for Mass Upload
 * Generates CSV templates based on table configurations
 */

import Papa from 'papaparse';
import { MassUploadTableName } from '@/types/mass-upload.types';
import { TABLE_CONFIGS, getTableConfig } from './tableConfigs';

/**
 * Generate CSV template content for a table
 */
export function generateCSVTemplate(tableName: MassUploadTableName): string {
  const config = getTableConfig(tableName);
  if (!config || config.fields.length === 0) {
    throw new Error(`No configuration found for table: ${tableName}`);
  }

  // Build headers from field configs
  const headers = config.fields.map(field => field.csvHeader);

  // Build example row if available
  const rows: string[][] = [];

  if (config.exampleRow) {
    const exampleValues = headers.map(header => config.exampleRow?.[header] || '');
    rows.push(exampleValues);
  }

  // Use PapaParse to generate proper CSV
  const csvContent = Papa.unparse({
    fields: headers,
    data: rows,
  });

  return csvContent;
}

/**
 * Generate CSV template with description comments
 * Returns template with header descriptions as second row
 */
export function generateCSVTemplateWithDescriptions(tableName: MassUploadTableName): string {
  const config = getTableConfig(tableName);
  if (!config || config.fields.length === 0) {
    throw new Error(`No configuration found for table: ${tableName}`);
  }

  // Build headers
  const headers = config.fields.map(field => field.csvHeader);

  // Build description row (shows data types and requirements)
  const descriptionRow = config.fields.map(field => {
    const parts: string[] = [];

    // Add type info
    switch (field.type) {
      case 'date':
        parts.push('DATE (YYYY-MM-DD)');
        break;
      case 'time':
        parts.push('TIME (HH:MM)');
        break;
      case 'number':
        parts.push('NUMBER');
        break;
      case 'boolean':
        parts.push('TRUE/FALSE');
        break;
      case 'enum':
        parts.push(`OPTIONS: ${field.enumValues?.join('/')}`);
        break;
      case 'uuid_lookup':
        parts.push('TEXT (lookup)');
        break;
      default:
        parts.push('TEXT');
    }

    // Add required indicator
    if (field.required) {
      parts.push('REQUIRED');
    }

    return parts.join(' - ');
  });

  const rows: string[][] = [];

  // Add description row (commented)
  rows.push(descriptionRow.map(desc => `# ${desc}`));

  // Add example row if available
  if (config.exampleRow) {
    const exampleValues = headers.map(header => config.exampleRow?.[header] || '');
    rows.push(exampleValues);
  }

  const csvContent = Papa.unparse({
    fields: headers,
    data: rows,
  });

  return csvContent;
}

/**
 * Generate template blob for download
 */
export function generateTemplateBlob(tableName: MassUploadTableName): Blob {
  const csvContent = generateCSVTemplate(tableName);
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Trigger template download in browser
 */
export function downloadTemplate(tableName: MassUploadTableName): void {
  const config = getTableConfig(tableName);
  if (!config) {
    throw new Error(`No configuration found for table: ${tableName}`);
  }

  const csvContent = generateCSVTemplate(tableName);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${tableName}_template.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get template info for a table (for UI display)
 */
export interface TemplateInfo {
  tableName: string;
  displayName: string;
  description: string;
  fieldCount: number;
  requiredFields: string[];
  optionalFields: string[];
  lookupFields: string[];
}

export function getTemplateInfo(tableName: MassUploadTableName): TemplateInfo | null {
  const config = getTableConfig(tableName);
  if (!config || config.fields.length === 0) {
    return null;
  }

  return {
    tableName: config.tableName,
    displayName: config.displayName,
    description: config.description,
    fieldCount: config.fields.length,
    requiredFields: config.fields
      .filter(f => f.required)
      .map(f => f.csvHeader),
    optionalFields: config.fields
      .filter(f => !f.required)
      .map(f => f.csvHeader),
    lookupFields: config.fields
      .filter(f => f.type === 'uuid_lookup')
      .map(f => `${f.csvHeader} (from ${f.lookupTable})`),
  };
}

/**
 * Get all available template infos
 */
export function getAllTemplateInfos(): TemplateInfo[] {
  return Object.keys(TABLE_CONFIGS)
    .map(tableName => getTemplateInfo(tableName as MassUploadTableName))
    .filter((info): info is TemplateInfo => info !== null && info.fieldCount > 0);
}
