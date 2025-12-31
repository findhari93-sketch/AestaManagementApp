"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  TableContainer,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import {
  useAddVariantToMaterial,
  useDeleteMaterial,
} from "@/hooks/queries/useMaterials";
import type {
  MaterialWithDetails,
  VariantFormData,
} from "@/types/material.types";

interface MaterialVariantsTabProps {
  material: MaterialWithDetails;
  canEdit: boolean;
}

export default function MaterialVariantsTab({
  material,
  canEdit,
}: MaterialVariantsTabProps) {
  const router = useRouter();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newVariant, setNewVariant] = useState<VariantFormData>({
    name: "",
    weight_per_unit: null,
    length_per_piece: null,
    rods_per_bundle: null,
  });

  const addVariant = useAddVariantToMaterial();
  const deleteMaterial = useDeleteMaterial();

  const handleAddVariant = async () => {
    if (!newVariant.name.trim()) return;

    try {
      await addVariant.mutateAsync({
        parentId: material.id,
        variant: newVariant,
      });
      setAddDialogOpen(false);
      setNewVariant({ name: "", weight_per_unit: null, length_per_piece: null, rods_per_bundle: null });
    } catch (error) {
      console.error("Failed to add variant:", error);
    }
  };

  const handleDeleteVariant = async (id: string, name: string) => {
    if (!confirm(`Delete variant "${name}"?`)) return;
    try {
      await deleteMaterial.mutateAsync(id);
    } catch (error) {
      console.error("Failed to delete variant:", error);
    }
  };

  const variants = material.variants || [];

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h6">
          Material Variants ({variants.length})
        </Typography>
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
            size="small"
          >
            Add Variant
          </Button>
        )}
      </Box>

      {/* Variants Table */}
      {variants.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Variant Name</TableCell>
                <TableCell>Code</TableCell>
                <TableCell align="right">Weight/Unit</TableCell>
                <TableCell align="right">Length/Pc</TableCell>
                <TableCell align="right">Rods/Bundle</TableCell>
                <TableCell align="center">Unit</TableCell>
                {canEdit && <TableCell width={100}>Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {variants.map((variant) => (
                <TableRow
                  key={variant.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => router.push(`/company/materials/${variant.id}`)}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {variant.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {variant.code || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {variant.weight_per_unit ? (
                      <Typography variant="body2">
                        {variant.weight_per_unit} {variant.weight_unit || "kg"}
                      </Typography>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {variant.length_per_piece ? (
                      <Typography variant="body2">
                        {variant.length_per_piece} {variant.length_unit || "m"}
                      </Typography>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {variant.rods_per_bundle ? (
                      <Typography variant="body2">
                        {variant.rods_per_bundle}
                      </Typography>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={variant.unit} size="small" />
                  </TableCell>
                  {canEdit && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() =>
                            router.push(`/company/materials/${variant.id}`)
                          }
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() =>
                            handleDeleteVariant(variant.id, variant.name)
                          }
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            No variants defined for this material.
          </Typography>
          {canEdit && (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
              sx={{ mt: 2 }}
            >
              Add First Variant
            </Button>
          )}
        </Paper>
      )}

      {/* Add Variant Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Variant to {material.name}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Variant Name"
                value={newVariant.name}
                onChange={(e) =>
                  setNewVariant((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder={`e.g., ${material.name} 8mm`}
                required
                autoFocus
              />
            </Grid>
            <Grid size={6}>
              <TextField
                fullWidth
                type="number"
                label="Weight per Unit (kg)"
                value={newVariant.weight_per_unit ?? ""}
                onChange={(e) =>
                  setNewVariant((prev) => ({
                    ...prev,
                    weight_per_unit: e.target.value
                      ? parseFloat(e.target.value)
                      : null,
                  }))
                }
                helperText="e.g., 0.395 for 8mm TMT"
                slotProps={{
                  input: { inputProps: { step: 0.001, min: 0 } },
                }}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                fullWidth
                type="number"
                label="Length per Piece (m)"
                value={newVariant.length_per_piece ?? ""}
                onChange={(e) =>
                  setNewVariant((prev) => ({
                    ...prev,
                    length_per_piece: e.target.value
                      ? parseFloat(e.target.value)
                      : null,
                  }))
                }
                helperText="e.g., 12 for TMT bars"
                slotProps={{
                  input: { inputProps: { step: 0.1, min: 0 } },
                }}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                fullWidth
                type="number"
                label="Rods per Bundle"
                value={newVariant.rods_per_bundle ?? ""}
                onChange={(e) =>
                  setNewVariant((prev) => ({
                    ...prev,
                    rods_per_bundle: e.target.value
                      ? parseInt(e.target.value, 10)
                      : null,
                  }))
                }
                helperText="e.g., 10 for 8mm TMT"
                slotProps={{
                  input: { inputProps: { step: 1, min: 1 } },
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddVariant}
            disabled={!newVariant.name.trim() || addVariant.isPending}
          >
            {addVariant.isPending ? "Adding..." : "Add Variant"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
