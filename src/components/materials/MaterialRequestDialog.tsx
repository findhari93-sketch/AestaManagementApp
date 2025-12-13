"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Box,
  Typography,
  IconButton,
  Alert,
  Autocomplete,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAuth } from "@/contexts/AuthContext";
import { useMaterials } from "@/hooks/queries/useMaterials";
import { useSiteStock } from "@/hooks/queries/useStockInventory";
import {
  useCreateMaterialRequest,
  useUpdateMaterialRequest,
} from "@/hooks/queries/useMaterialRequests";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  MaterialRequestWithDetails,
  MaterialRequestItemFormData,
  MaterialWithDetails,
  RequestPriority,
} from "@/types/material.types";

interface MaterialRequestDialogProps {
  open: boolean;
  onClose: () => void;
  request: MaterialRequestWithDetails | null;
  siteId: string;
}

interface RequestItemRow extends MaterialRequestItemFormData {
  id?: string;
  materialName?: string;
  unit?: string;
  availableStock?: number;
}

const PRIORITY_OPTIONS: { value: RequestPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export default function MaterialRequestDialog({
  open,
  onClose,
  request,
  siteId,
}: MaterialRequestDialogProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const isEdit = !!request;

  const { data: materials = [] } = useMaterials();
  const { data: stockItems = [] } = useSiteStock(siteId);

  // Fetch building sections for this site
  const supabase = createClient();
  const { data: sections = [] } = useQuery({
    queryKey: ["buildingSections", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("building_sections")
        .select("id, name, status, sequence_order")
        .eq("site_id", siteId)
        .order("sequence_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });

  const createRequest = useCreateMaterialRequest();
  const updateRequest = useUpdateMaterialRequest();

  const [error, setError] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [requiredByDate, setRequiredByDate] = useState("");
  const [priority, setPriority] = useState<RequestPriority>("normal");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<RequestItemRow[]>([]);

  // New item form
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialWithDetails | null>(null);
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemNotes, setNewItemNotes] = useState("");

  // Get available stock for a material
  const getAvailableStock = (materialId: string) => {
    const stockItem = stockItems.find((s) => s.material_id === materialId);
    return stockItem?.available_qty || 0;
  };

  // Reset form when request changes
  useEffect(() => {
    if (request) {
      setSectionId(request.section_id || "");
      setRequiredByDate(request.required_by_date || "");
      setPriority(request.priority);
      setNotes(request.notes || "");

      // Map existing items
      const existingItems: RequestItemRow[] =
        request.items?.map((item) => ({
          id: item.id,
          material_id: item.material_id,
          brand_id: item.brand_id || undefined,
          requested_qty: item.requested_qty,
          notes: item.notes || undefined,
          materialName: item.material?.name,
          unit: item.material?.unit,
          availableStock: getAvailableStock(item.material_id),
        })) || [];
      setItems(existingItems);
    } else {
      setSectionId("");
      setRequiredByDate("");
      setPriority("normal");
      setNotes("");
      setItems([]);
    }
    setError("");
    setSelectedMaterial(null);
    setNewItemQty("");
    setNewItemNotes("");
  }, [request, open, stockItems]);

  const handleAddItem = () => {
    if (!selectedMaterial) {
      setError("Please select a material");
      return;
    }
    if (!newItemQty || parseFloat(newItemQty) <= 0) {
      setError("Please enter a valid quantity");
      return;
    }

    // Check if material already added
    if (items.some((item) => item.material_id === selectedMaterial.id)) {
      setError("This material is already in the request");
      return;
    }

    const availableStock = getAvailableStock(selectedMaterial.id);

    const newItem: RequestItemRow = {
      material_id: selectedMaterial.id,
      requested_qty: parseFloat(newItemQty),
      notes: newItemNotes || undefined,
      materialName: selectedMaterial.name,
      unit: selectedMaterial.unit,
      availableStock,
    };

    setItems([...items, newItem]);
    setSelectedMaterial(null);
    setNewItemQty("");
    setNewItemNotes("");
    setError("");
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      setError("User not authenticated");
      return;
    }
    if (items.length === 0) {
      setError("Please add at least one item");
      return;
    }

    try {
      if (isEdit) {
        await updateRequest.mutateAsync({
          id: request.id,
          data: {
            section_id: sectionId || undefined,
            required_by_date: requiredByDate || undefined,
            priority,
            notes: notes || undefined,
          },
        });
      } else {
        await createRequest.mutateAsync({
          site_id: siteId,
          section_id: sectionId || undefined,
          requested_by: user.id,
          required_by_date: requiredByDate || undefined,
          priority,
          notes: notes || undefined,
          items: items.map((item) => ({
            material_id: item.material_id,
            brand_id: item.brand_id,
            requested_qty: item.requested_qty,
            notes: item.notes,
          })),
        });
      }
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save request";
      setError(message);
    }
  };

  const isSubmitting = createRequest.isPending || updateRequest.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h6">
          {isEdit
            ? `Edit Request ${request.request_number}`
            : "New Material Request"}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2}>
          {/* Section Selection */}
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth>
              <InputLabel>Section (Optional)</InputLabel>
              <Select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                label="Section (Optional)"
              >
                <MenuItem value="">No Section</MenuItem>
                {sections.map((section) => (
                  <MenuItem key={section.id} value={section.id}>
                    {section.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 6, md: 4 }}>
            <TextField
              fullWidth
              type="date"
              label="Required By"
              value={requiredByDate}
              onChange={(e) => setRequiredByDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>

          <Grid size={{ xs: 6, md: 4 }}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as RequestPriority)}
                label="Priority"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Add Item Section - Only for new requests */}
          {!isEdit && (
            <>
              <Grid size={12}>
                <Divider sx={{ my: 1 }}>
                  <Typography variant="subtitle2">Add Items</Typography>
                </Divider>
              </Grid>

              <Grid size={{ xs: 12, md: 5 }}>
                <Autocomplete
                  options={materials}
                  getOptionLabel={(option) =>
                    `${option.name}${option.code ? ` (${option.code})` : ""}`
                  }
                  value={selectedMaterial}
                  onChange={(_, value) => setSelectedMaterial(value)}
                  renderInput={(params) => (
                    <TextField {...params} label="Material" size="small" />
                  )}
                  renderOption={(props, option) => {
                    const stock = getAvailableStock(option.id);
                    return (
                      <li {...props} key={option.id}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2">{option.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.code} • {option.unit}
                            {stock > 0 && (
                              <span style={{ color: "green" }}>
                                {" "}
                                • In Stock: {stock}
                              </span>
                            )}
                          </Typography>
                        </Box>
                      </li>
                    );
                  }}
                />
              </Grid>

              <Grid size={{ xs: 4, md: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Quantity"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(e.target.value)}
                  slotProps={{ input: { inputProps: { min: 0, step: 0.01 } } }}
                />
              </Grid>

              <Grid size={{ xs: 8, md: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Notes"
                  value={newItemNotes}
                  onChange={(e) => setNewItemNotes(e.target.value)}
                  placeholder="Optional"
                />
              </Grid>

              <Grid size={{ xs: 12, md: 2 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleAddItem}
                  sx={{ height: 40 }}
                >
                  Add
                </Button>
              </Grid>
            </>
          )}

          {/* Items Table */}
          <Grid size={12}>
            <Paper variant="outlined" sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Material</TableCell>
                    <TableCell align="right">Requested</TableCell>
                    <TableCell align="right">In Stock</TableCell>
                    <TableCell>Notes</TableCell>
                    {!isEdit && <TableCell width={50}></TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ py: 2 }}
                        >
                          No items added yet
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Typography variant="body2">
                            {item.materialName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.unit}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{item.requested_qty}</TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color={
                              (item.availableStock || 0) >= item.requested_qty
                                ? "success.main"
                                : "warning.main"
                            }
                          >
                            {item.availableStock || 0}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {item.notes || "-"}
                          </Typography>
                        </TableCell>
                        {!isEdit && (
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Paper>
          </Grid>

          {/* Notes */}
          <Grid size={12}>
            <TextField
              fullWidth
              label="Request Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={2}
              placeholder="Additional notes for this request..."
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting || items.length === 0}
        >
          {isSubmitting
            ? "Submitting..."
            : isEdit
            ? "Update Request"
            : "Submit Request"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
