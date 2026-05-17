"use client";

import {
  Grid,
  TextField,
  Select,
  MenuItem,
  InputAdornment,
  Typography,
} from "@mui/material";
import type {
  CalculatorTemplate,
  CalculatorInputField,
  UnitOption,
} from "@/lib/category-calculator-templates";

interface CalculatorInputsProps {
  template: CalculatorTemplate;
  values: Record<string, number | "">;
  units: Record<string, UnitOption>;
  onValueChange: (key: string, value: number | "") => void;
  onUnitChange: (key: string, unit: UnitOption) => void;
}

/** Determine responsive column size for each field based on total count. */
function fieldColSize(totalFields: number): number {
  // 4 fields → 3 columns each (4-per-row on sm+, full-width on xs)
  // 3 fields → 4 columns each (3-per-row on sm+)
  // 2 fields → 6 columns each (2-per-row)
  // 1 field  → 12 (full-width)
  if (totalFields >= 4) return 3;
  if (totalFields === 3) return 4;
  if (totalFields === 2) return 6;
  return 12;
}

interface FieldInputProps {
  field: CalculatorInputField;
  value: number | "";
  unit: UnitOption;
  onValueChange: (key: string, value: number | "") => void;
  onUnitChange: (key: string, unit: UnitOption) => void;
}

function FieldInput({
  field,
  value,
  unit,
  onValueChange,
  onUnitChange,
}: FieldInputProps) {
  const hasUnitChoice = field.unitOptions.length > 1;

  const endAdornment = (
    <InputAdornment position="end">
      {hasUnitChoice ? (
        <Select
          value={unit}
          onChange={(e) =>
            onUnitChange(field.key, e.target.value as UnitOption)
          }
          size="small"
          variant="standard"
          disableUnderline
          sx={{ fontSize: "0.75rem", minWidth: 36 }}
        >
          {field.unitOptions.map((u) => (
            <MenuItem key={u} value={u} sx={{ fontSize: "0.75rem" }}>
              {u}
            </MenuItem>
          ))}
        </Select>
      ) : (
        <Typography variant="caption" sx={{ color: "text.secondary", pr: 0.5 }}>
          {field.unitOptions[0] ?? unit}
        </Typography>
      )}
    </InputAdornment>
  );

  return (
    <TextField
      label={field.label}
      type="number"
      size="small"
      fullWidth
      value={value === "" ? "" : value}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "" || raw === undefined) {
          onValueChange(field.key, "");
        } else {
          const parsed = parseFloat(raw);
          onValueChange(field.key, isNaN(parsed) ? "" : parsed);
        }
      }}
      slotProps={{
        input: {
          endAdornment,
          inputProps: {
            min: field.min ?? 0,
            step: field.step ?? 0.01,
          },
        },
      }}
    />
  );
}

/**
 * Schema-driven dimension input renderer.
 *
 * Renders a responsive MUI Grid of numeric inputs based on the template's
 * `inputs` array. Each field may have a unit selector (multi-option) or a
 * read-only unit adornment (single-option).
 */
export default function CalculatorInputs({
  template,
  values,
  units,
  onValueChange,
  onUnitChange,
}: CalculatorInputsProps) {
  const total = template.inputs.length;
  const smColSize = fieldColSize(total);

  return (
    <Grid container spacing={2}>
      {template.inputs.map((field) => (
        <Grid
          key={field.key}
          size={{ xs: 12, sm: smColSize }}
        >
          <FieldInput
            field={field}
            value={values[field.key] ?? ""}
            unit={units[field.key] ?? field.defaultUnit}
            onValueChange={onValueChange}
            onUnitChange={onUnitChange}
          />
        </Grid>
      ))}
    </Grid>
  );
}
