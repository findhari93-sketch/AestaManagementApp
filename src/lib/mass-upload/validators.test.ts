import { describe, it, expect } from 'vitest';
import { validateField, validateRows } from './validators';
import type { FieldConfig } from '@/types/mass-upload.types';

describe('Mass Upload Validators', () => {
  describe('validateField', () => {
    describe('required fields', () => {
      const requiredFieldConfig: FieldConfig = {
        dbField: 'name',
        csvHeader: 'Name',
        required: true,
        type: 'string',
      };

      it('returns error for empty required field', () => {
        const result = validateField('', requiredFieldConfig, 1);

        expect(result.error).toBeDefined();
        expect(result.error!.errorType).toBe('required');
        expect(result.error!.message).toContain('required');
      });

      it('returns error for whitespace-only required field', () => {
        const result = validateField('   ', requiredFieldConfig, 1);

        expect(result.error).toBeDefined();
        expect(result.error!.errorType).toBe('required');
      });

      it('passes for non-empty required field', () => {
        const result = validateField('John Doe', requiredFieldConfig, 1);

        expect(result.error).toBeUndefined();
        expect(result.transformedValue).toBe('John Doe');
      });
    });

    describe('optional fields', () => {
      const optionalFieldConfig: FieldConfig = {
        dbField: 'notes',
        csvHeader: 'Notes',
        required: false,
        type: 'string',
        defaultValue: null,
      };

      it('returns default value for empty optional field', () => {
        const result = validateField('', optionalFieldConfig, 1);

        expect(result.error).toBeUndefined();
        expect(result.transformedValue).toBeNull();
      });

      it('returns provided default value', () => {
        const configWithDefault: FieldConfig = {
          ...optionalFieldConfig,
          defaultValue: 'N/A',
        };
        const result = validateField('', configWithDefault, 1);

        expect(result.transformedValue).toBe('N/A');
      });
    });

    describe('number validation', () => {
      const numberFieldConfig: FieldConfig = {
        dbField: 'amount',
        csvHeader: 'Amount',
        required: true,
        type: 'number',
      };

      it('parses valid integers', () => {
        const result = validateField('1000', numberFieldConfig, 1);

        expect(result.error).toBeUndefined();
        expect(result.transformedValue).toBe(1000);
      });

      it('parses valid decimals', () => {
        const result = validateField('1234.56', numberFieldConfig, 1);

        expect(result.error).toBeUndefined();
        expect(result.transformedValue).toBe(1234.56);
      });

      it('handles numbers with commas', () => {
        const result = validateField('1,00,000', numberFieldConfig, 1);

        expect(result.error).toBeUndefined();
        expect(result.transformedValue).toBe(100000);
      });

      it('handles numbers with spaces', () => {
        const result = validateField('1 000', numberFieldConfig, 1);

        expect(result.error).toBeUndefined();
        expect(result.transformedValue).toBe(1000);
      });

      it('returns error for non-numeric value', () => {
        const result = validateField('abc', numberFieldConfig, 1);

        expect(result.error).toBeDefined();
        expect(result.error!.errorType).toBe('type');
      });

      it('returns error for mixed content', () => {
        const result = validateField('Rs.1000', numberFieldConfig, 1);

        expect(result.error).toBeDefined();
        expect(result.error!.errorType).toBe('type');
      });
    });

    describe('date validation', () => {
      const dateFieldConfig: FieldConfig = {
        dbField: 'date',
        csvHeader: 'Date',
        required: true,
        type: 'date',
      };

      it('accepts ISO format (YYYY-MM-DD)', () => {
        const result = validateField('2024-01-15', dateFieldConfig, 1);

        expect(result.error).toBeUndefined();
        expect(result.transformedValue).toBe('2024-01-15');
      });

      it('accepts DD/MM/YYYY format', () => {
        const result = validateField('15/01/2024', dateFieldConfig, 1);

        expect(result.error).toBeUndefined();
        expect(result.transformedValue).toBe('2024-01-15');
      });

      it('accepts DD-MM-YYYY format', () => {
        const result = validateField('15-01-2024', dateFieldConfig, 1);

        expect(result.error).toBeUndefined();
        expect(result.transformedValue).toBe('2024-01-15');
      });

      it('returns error for invalid date format', () => {
        const result = validateField('Jan 15, 2024', dateFieldConfig, 1);

        expect(result.error).toBeDefined();
        expect(result.error!.errorType).toBe('format');
        expect(result.error!.suggestion).toContain('2024-01-15');
      });

      it('returns error for invalid date values', () => {
        const result = validateField('2024-13-45', dateFieldConfig, 1);

        expect(result.error).toBeDefined();
        expect(result.error!.errorType).toBe('format');
      });

      it('validates February correctly', () => {
        // Valid leap year date
        const validLeap = validateField('2024-02-29', dateFieldConfig, 1);
        expect(validLeap.error).toBeUndefined();

        // Invalid non-leap year date
        const invalidLeap = validateField('2023-02-29', dateFieldConfig, 1);
        expect(invalidLeap.error).toBeDefined();
      });
    });

    describe('boolean validation', () => {
      const booleanFieldConfig: FieldConfig = {
        dbField: 'is_paid',
        csvHeader: 'Is Paid',
        required: true,
        type: 'boolean',
      };

      it('accepts various true values', () => {
        expect(validateField('true', booleanFieldConfig, 1).transformedValue).toBe(true);
        expect(validateField('TRUE', booleanFieldConfig, 1).transformedValue).toBe(true);
        expect(validateField('yes', booleanFieldConfig, 1).transformedValue).toBe(true);
        expect(validateField('YES', booleanFieldConfig, 1).transformedValue).toBe(true);
        expect(validateField('1', booleanFieldConfig, 1).transformedValue).toBe(true);
        expect(validateField('y', booleanFieldConfig, 1).transformedValue).toBe(true);
      });

      it('accepts various false values', () => {
        expect(validateField('false', booleanFieldConfig, 1).transformedValue).toBe(false);
        expect(validateField('FALSE', booleanFieldConfig, 1).transformedValue).toBe(false);
        expect(validateField('no', booleanFieldConfig, 1).transformedValue).toBe(false);
        expect(validateField('NO', booleanFieldConfig, 1).transformedValue).toBe(false);
        expect(validateField('0', booleanFieldConfig, 1).transformedValue).toBe(false);
        expect(validateField('n', booleanFieldConfig, 1).transformedValue).toBe(false);
      });

      it('returns error for invalid boolean', () => {
        const result = validateField('maybe', booleanFieldConfig, 1);

        expect(result.error).toBeDefined();
        expect(result.error!.errorType).toBe('format');
      });
    });

    describe('enum validation', () => {
      const enumFieldConfig: FieldConfig = {
        dbField: 'status',
        csvHeader: 'Status',
        required: true,
        type: 'enum',
        enumValues: ['active', 'inactive', 'pending'],
      };

      it('accepts valid enum value', () => {
        const result = validateField('active', enumFieldConfig, 1);

        expect(result.error).toBeUndefined();
        expect(result.transformedValue).toBe('active');
      });

      it('is case-insensitive', () => {
        const result = validateField('ACTIVE', enumFieldConfig, 1);

        expect(result.error).toBeUndefined();
        expect(result.transformedValue).toBe('active');
      });

      it('returns error for invalid enum value', () => {
        const result = validateField('unknown', enumFieldConfig, 1);

        expect(result.error).toBeDefined();
        expect(result.error!.errorType).toBe('enum');
        expect(result.error!.message).toContain('active, inactive, pending');
      });
    });

    describe('time validation', () => {
      const timeFieldConfig: FieldConfig = {
        dbField: 'in_time',
        csvHeader: 'In Time',
        required: true,
        type: 'time',
      };

      it('accepts HH:MM format', () => {
        const result = validateField('08:30', timeFieldConfig, 1);

        expect(result.error).toBeUndefined();
        expect(result.transformedValue).toBe('08:30:00');
      });

      it('accepts HH:MM:SS format', () => {
        const result = validateField('08:30:45', timeFieldConfig, 1);

        expect(result.error).toBeUndefined();
        expect(result.transformedValue).toBe('08:30:45');
      });

      it('accepts single-digit hours', () => {
        const result = validateField('8:30', timeFieldConfig, 1);

        expect(result.error).toBeUndefined();
        expect(result.transformedValue).toBe('08:30:00');
      });

      it('returns error for invalid time format', () => {
        const result = validateField('8.30 AM', timeFieldConfig, 1);

        expect(result.error).toBeDefined();
        expect(result.error!.errorType).toBe('format');
      });

      it('returns error for invalid time values', () => {
        const result = validateField('25:00', timeFieldConfig, 1);

        expect(result.error).toBeDefined();
        expect(result.error!.errorType).toBe('format');
      });
    });
  });

  describe('validateRows', () => {
    const fieldConfigs: FieldConfig[] = [
      { dbField: 'name', csvHeader: 'Name', required: true, type: 'string' },
      { dbField: 'amount', csvHeader: 'Amount', required: true, type: 'number' },
      { dbField: 'date', csvHeader: 'Date', required: true, type: 'date' },
    ];

    it('returns all valid rows when no errors', () => {
      const rows = [
        { 'Name': 'John', 'Amount': '1000', 'Date': '2024-01-15' },
        { 'Name': 'Jane', 'Amount': '2000', 'Date': '2024-01-16' },
      ];

      const result = validateRows(rows, fieldConfigs);

      expect(result.validRows).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('excludes rows with errors', () => {
      const rows = [
        { 'Name': 'John', 'Amount': '1000', 'Date': '2024-01-15' },
        { 'Name': '', 'Amount': '2000', 'Date': '2024-01-16' }, // Missing name
        { 'Name': 'Jane', 'Amount': 'invalid', 'Date': '2024-01-17' }, // Invalid amount
      ];

      const result = validateRows(rows, fieldConfigs);

      expect(result.validRows).toHaveLength(1);
      expect(result.errors).toHaveLength(2);
    });

    it('transforms values correctly', () => {
      const rows = [
        { 'Name': 'John', 'Amount': '1,000', 'Date': '15/01/2024' },
      ];

      const result = validateRows(rows, fieldConfigs);

      expect(result.validRows[0]).toEqual({
        name: 'John',
        amount: 1000,
        date: '2024-01-15',
      });
    });

    it('reports correct row numbers (accounting for header)', () => {
      const rows = [
        { 'Name': '', 'Amount': '1000', 'Date': '2024-01-15' },
      ];

      const result = validateRows(rows, fieldConfigs);

      // Row 0 in data should be reported as row 2 (header is row 1)
      expect(result.errors[0].rowNumber).toBe(2);
    });
  });
});
