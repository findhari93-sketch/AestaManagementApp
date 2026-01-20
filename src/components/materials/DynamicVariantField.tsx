"use client";

import {
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputAdornment,
  FormHelperText,
} from "@mui/material";
import type { VariantFieldDefinition } from "@/types/category-variant-fields.types";

interface DynamicVariantFieldProps {
  field: VariantFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  size?: "small" | "medium";
  disabled?: boolean;
  variant?: "standard" | "outlined" | "filled";
  fullWidth?: boolean;
}

/**
 * Renders a dynamic form field based on the field definition
 * Supports number, text, and select field types
 */
export default function DynamicVariantField({
  field,
  value,
  onChange,
  size = "small",
  disabled = false,
  variant = "standard",
  fullWidth = false,
}: DynamicVariantFieldProps) {
  const handleChange = (newValue: string | number | null) => {
    if (field.type === "number") {
      // Convert to number or null
      if (newValue === "" || newValue === null) {
        onChange(null);
      } else {
        const num = typeof newValue === "string" ? parseFloat(newValue) : newValue;
        onChange(isNaN(num) ? null : num);
      }
    } else {
      onChange(newValue);
    }
  };

  // Select field
  if (field.type === "select" && field.options) {
    return (
      <FormControl
        size={size}
        variant={variant}
        fullWidth={fullWidth}
        disabled={disabled}
        sx={{ minWidth: field.columnWidth ? field.columnWidth - 20 : 100 }}
      >
        <Select
          value={value ?? ""}
          onChange={(e) => handleChange(e.target.value as string)}
          displayEmpty
          size={size}
        >
          <MenuItem value="">
            <em>Select...</em>
          </MenuItem>
          {field.options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        {field.helperText && (
          <FormHelperText>{field.helperText}</FormHelperText>
        )}
      </FormControl>
    );
  }

  // Number field
  if (field.type === "number") {
    return (
      <TextField
        size={size}
        type="number"
        value={value ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        variant={variant}
        disabled={disabled}
        fullWidth={fullWidth}
        placeholder={field.placeholder}
        helperText={field.helperText}
        slotProps={{
          input: {
            inputProps: {
              step: field.step ?? 1,
              min: field.min,
              max: field.max,
            },
            endAdornment: field.unit ? (
              <InputAdornment position="end">{field.unit}</InputAdornment>
            ) : undefined,
          },
        }}
        sx={{ width: field.columnWidth ? field.columnWidth - 20 : 100 }}
      />
    );
  }

  // Text field (default)
  return (
    <TextField
      size={size}
      type="text"
      value={value ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      variant={variant}
      disabled={disabled}
      fullWidth={fullWidth}
      placeholder={field.placeholder}
      helperText={field.helperText}
      slotProps={{
        input: {
          endAdornment: field.unit ? (
            <InputAdornment position="end">{field.unit}</InputAdornment>
          ) : undefined,
        },
      }}
      sx={{ width: field.columnWidth ? field.columnWidth - 20 : 150 }}
    />
  );
}
