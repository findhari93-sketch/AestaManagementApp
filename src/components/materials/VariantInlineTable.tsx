"use client";

import { useState, useCallback } from "react";
import {
  Box,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  IconButton,
  Button,
  Paper,
  Typography,
  Tooltip,
  TableContainer,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  AutoAwesome as AutoGenerateIcon,
} from "@mui/icons-material";
import type { VariantFormData } from "@/types/material.types";
import { TMT_WEIGHTS, TMT_STANDARD_LENGTH, TMT_STANDARD_LENGTH_UNIT, TMT_RODS_PER_BUNDLE } from "@/lib/weightCalculation";

interface VariantInlineTableProps {
  parentName: string;
  parentCode?: string;
  parentUnit: string;
  variants: VariantFormData[];
  onVariantsChange: (variants: VariantFormData[]) => void;
}

export default function VariantInlineTable({
  parentName,
  parentCode,
  parentUnit,
  variants,
  onVariantsChange,
}: VariantInlineTableProps) {
  const [newVariant, setNewVariant] = useState<Partial<VariantFormData>>({
    name: "",
    weight_per_unit: null,
    length_per_piece: null,
    rods_per_bundle: null,
  });

  const handleAddVariant = useCallback(() => {
    if (!newVariant.name?.trim()) return;

    const variantCode = parentCode
      ? `${parentCode}-V${(variants.length + 1).toString().padStart(2, "0")}`
      : undefined;

    onVariantsChange([
      ...variants,
      {
        name: newVariant.name.trim(),
        code: variantCode,
        weight_per_unit: newVariant.weight_per_unit,
        length_per_piece: newVariant.length_per_piece,
        rods_per_bundle: newVariant.rods_per_bundle,
      },
    ]);

    setNewVariant({ name: "", weight_per_unit: null, length_per_piece: null, rods_per_bundle: null });
  }, [newVariant, variants, parentCode, onVariantsChange]);

  const handleRemoveVariant = useCallback(
    (index: number) => {
      onVariantsChange(variants.filter((_, i) => i !== index));
    },
    [variants, onVariantsChange]
  );

  const handleVariantChange = useCallback(
    (index: number, field: keyof VariantFormData, value: unknown) => {
      onVariantsChange(
        variants.map((v, i) => (i === index ? { ...v, [field]: value } : v))
      );
    },
    [variants, onVariantsChange]
  );

  // Auto-generate common TMT sizes
  const handleAutoGenerate = useCallback(() => {
    const commonSizes = Object.entries(TMT_WEIGHTS).map(
      ([size, weight], index) => ({
        name: `${parentName} ${size}`,
        code: parentCode
          ? `${parentCode}-V${(variants.length + index + 1).toString().padStart(2, "0")}`
          : undefined,
        weight_per_unit: weight,
        length_per_piece: TMT_STANDARD_LENGTH,
        rods_per_bundle: TMT_RODS_PER_BUNDLE[size] ?? null,
      })
    );

    onVariantsChange([...variants, ...commonSizes]);
  }, [parentName, parentCode, variants, onVariantsChange]);

  // Check if parent name contains TMT for showing auto-generate button
  const isTMT = parentName.toLowerCase().includes("tmt");

  return (
    <Box>
      {/* Quick Actions */}
      {isTMT && variants.length === 0 && (
        <Box sx={{ mb: 2 }}>
          <Button
            size="small"
            startIcon={<AutoGenerateIcon />}
            onClick={handleAutoGenerate}
            variant="outlined"
          >
            Auto-generate TMT sizes (8mm - 32mm)
          </Button>
        </Box>
      )}

      {/* Variants Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Variant Name *</TableCell>
              <TableCell align="center" sx={{ width: 100 }}>
                Code
              </TableCell>
              <TableCell align="right" sx={{ width: 120 }}>
                Weight/Unit (kg)
              </TableCell>
              <TableCell align="right" sx={{ width: 110 }}>
                Length/Pc (ft)
              </TableCell>
              <TableCell align="right" sx={{ width: 100 }}>
                Rods/Bundle
              </TableCell>
              <TableCell sx={{ width: 50 }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {variants.map((variant, index) => (
              <TableRow key={index} hover>
                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    value={variant.name}
                    onChange={(e) =>
                      handleVariantChange(index, "name", e.target.value)
                    }
                    variant="standard"
                    placeholder="e.g., TMT Bars 8mm"
                  />
                </TableCell>
                <TableCell align="center">
                  <Typography variant="caption" color="text.secondary">
                    {variant.code || "Auto"}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <TextField
                    size="small"
                    type="number"
                    value={variant.weight_per_unit ?? ""}
                    onChange={(e) =>
                      handleVariantChange(
                        index,
                        "weight_per_unit",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    variant="standard"
                    slotProps={{
                      input: { inputProps: { step: 0.001, min: 0 } },
                    }}
                    sx={{ width: 100 }}
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    size="small"
                    type="number"
                    value={variant.length_per_piece ?? ""}
                    onChange={(e) =>
                      handleVariantChange(
                        index,
                        "length_per_piece",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    variant="standard"
                    slotProps={{
                      input: { inputProps: { step: 0.1, min: 0 } },
                    }}
                    sx={{ width: 90 }}
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    size="small"
                    type="number"
                    value={variant.rods_per_bundle ?? ""}
                    onChange={(e) =>
                      handleVariantChange(
                        index,
                        "rods_per_bundle",
                        e.target.value ? parseInt(e.target.value, 10) : null
                      )
                    }
                    variant="standard"
                    slotProps={{
                      input: { inputProps: { step: 1, min: 1 } },
                    }}
                    sx={{ width: 70 }}
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="Remove variant">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemoveVariant(index)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}

            {/* Add New Row */}
            <TableRow sx={{ backgroundColor: "action.hover" }}>
              <TableCell>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="New variant name..."
                  value={newVariant.name || ""}
                  onChange={(e) =>
                    setNewVariant((prev) => ({ ...prev, name: e.target.value }))
                  }
                  variant="standard"
                  onKeyDown={(e) => e.key === "Enter" && handleAddVariant()}
                />
              </TableCell>
              <TableCell align="center">
                <Typography variant="caption" color="text.secondary">
                  Auto
                </Typography>
              </TableCell>
              <TableCell align="right">
                <TextField
                  size="small"
                  type="number"
                  placeholder="0.000"
                  value={newVariant.weight_per_unit ?? ""}
                  onChange={(e) =>
                    setNewVariant((prev) => ({
                      ...prev,
                      weight_per_unit: e.target.value
                        ? parseFloat(e.target.value)
                        : null,
                    }))
                  }
                  variant="standard"
                  slotProps={{
                    input: { inputProps: { step: 0.001, min: 0 } },
                  }}
                  sx={{ width: 100 }}
                />
              </TableCell>
              <TableCell align="right">
                <TextField
                  size="small"
                  type="number"
                  placeholder="0.0"
                  value={newVariant.length_per_piece ?? ""}
                  onChange={(e) =>
                    setNewVariant((prev) => ({
                      ...prev,
                      length_per_piece: e.target.value
                        ? parseFloat(e.target.value)
                        : null,
                    }))
                  }
                  variant="standard"
                  slotProps={{
                    input: { inputProps: { step: 0.1, min: 0 } },
                  }}
                  sx={{ width: 90 }}
                />
              </TableCell>
              <TableCell align="right">
                <TextField
                  size="small"
                  type="number"
                  placeholder="0"
                  value={newVariant.rods_per_bundle ?? ""}
                  onChange={(e) =>
                    setNewVariant((prev) => ({
                      ...prev,
                      rods_per_bundle: e.target.value
                        ? parseInt(e.target.value, 10)
                        : null,
                    }))
                  }
                  variant="standard"
                  slotProps={{
                    input: { inputProps: { step: 1, min: 1 } },
                  }}
                  sx={{ width: 70 }}
                />
              </TableCell>
              <TableCell>
                <Tooltip title="Add variant">
                  <span>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={handleAddVariant}
                      disabled={!newVariant.name?.trim()}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {variants.length === 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1, textAlign: "center" }}
        >
          Add variants for different sizes (e.g., 8mm, 10mm, 12mm for TMT bars)
        </Typography>
      )}

      {variants.length > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1 }}
        >
          {variants.length} variant{variants.length !== 1 ? "s" : ""} will be
          created with the parent material
        </Typography>
      )}
    </Box>
  );
}
