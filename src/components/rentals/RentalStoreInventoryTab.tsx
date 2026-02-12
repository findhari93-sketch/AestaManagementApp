"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import {
  useRentalStoreInventory,
  useRentalItems,
  useAddRentalStoreInventory,
} from "@/hooks/queries/useRentals";
import type {
  RentalStoreInventoryWithDetails,
  RentalStoreInventoryFormData,
} from "@/types/rental.types";
import { RENTAL_TYPE_LABELS } from "@/types/rental.types";

interface RentalStoreInventoryTabProps {
  vendorId: string;
  vendorName: string;
}

export default function RentalStoreInventoryTab({
  vendorId,
  vendorName,
}: RentalStoreInventoryTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] =
    useState<RentalStoreInventoryWithDetails | null>(null);

  const {
    data: inventory = [],
    isLoading,
    error,
  } = useRentalStoreInventory(vendorId);
  const { data: allRentalItems = [] } = useRentalItems();
  const addInventory = useAddRentalStoreInventory();

  const [formData, setFormData] = useState<
    Omit<RentalStoreInventoryFormData, "vendor_id">
  >({
    rental_item_id: "",
    daily_rate: 0,
    weekly_rate: undefined,
    monthly_rate: undefined,
    transport_cost: undefined,
    loading_cost: undefined,
    unloading_cost: undefined,
    min_rental_days: 1,
    long_term_discount_percentage: 0,
    long_term_threshold_days: 30,
    notes: "",
  });

  // Filter out items already in inventory
  const availableItems = allRentalItems.filter(
    (item) => !inventory.some((inv) => inv.rental_item_id === item.id)
  );

  const handleOpenDialog = (item?: RentalStoreInventoryWithDetails) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        rental_item_id: item.rental_item_id,
        daily_rate: item.daily_rate,
        weekly_rate: item.weekly_rate || undefined,
        monthly_rate: item.monthly_rate || undefined,
        transport_cost: item.transport_cost || undefined,
        loading_cost: item.loading_cost || undefined,
        unloading_cost: item.unloading_cost || undefined,
        min_rental_days: item.min_rental_days,
        long_term_discount_percentage: item.long_term_discount_percentage,
        long_term_threshold_days: item.long_term_threshold_days,
        notes: item.notes || "",
      });
    } else {
      setEditingItem(null);
      setFormData({
        rental_item_id: "",
        daily_rate: 0,
        weekly_rate: undefined,
        monthly_rate: undefined,
        transport_cost: undefined,
        loading_cost: undefined,
        unloading_cost: undefined,
        min_rental_days: 1,
        long_term_discount_percentage: 0,
        long_term_threshold_days: 30,
        notes: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleSave = async () => {
    if (!formData.rental_item_id || formData.daily_rate <= 0) return;

    try {
      await addInventory.mutateAsync({
        vendor_id: vendorId,
        ...formData,
      });
      handleCloseDialog();
    } catch (err) {
      console.error("Failed to save inventory:", err);
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load rental inventory. Please try again.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Box>
          <Typography variant="h6">Rental Inventory</Typography>
          <Typography variant="body2" color="text.secondary">
            Items available for rent from {vendorName}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          disabled={availableItems.length === 0}
        >
          Add Item
        </Button>
      </Box>

      {/* Inventory Table */}
      {inventory.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            No rental items added yet. Add items this store rents.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{ mt: 2 }}
            disabled={availableItems.length === 0}
          >
            Add First Item
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Daily Rate</TableCell>
                <TableCell align="right">Weekly</TableCell>
                <TableCell align="right">Monthly</TableCell>
                <TableCell align="right">Transport</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inventory.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {item.rental_item?.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.rental_item?.code}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={
                        item.rental_item?.rental_type
                          ? RENTAL_TYPE_LABELS[item.rental_item.rental_type]
                          : "Other"
                      }
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>
                      ₹{item.daily_rate}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {item.weekly_rate ? `₹${item.weekly_rate}` : "-"}
                  </TableCell>
                  <TableCell align="right">
                    {item.monthly_rate ? `₹${item.monthly_rate}` : "-"}
                  </TableCell>
                  <TableCell align="right">
                    {item.transport_cost ? `₹${item.transport_cost}` : "-"}
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {item.notes || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(item)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6" component="span">
              {editingItem ? "Edit Inventory Item" : "Add Inventory Item"}
            </Typography>
            <IconButton onClick={handleCloseDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={2}>
            {/* Item Selection */}
            <FormControl fullWidth required disabled={!!editingItem}>
              <InputLabel>Rental Item</InputLabel>
              <Select
                value={formData.rental_item_id}
                label="Rental Item"
                onChange={(e) =>
                  setFormData({ ...formData, rental_item_id: e.target.value })
                }
              >
                {editingItem ? (
                  <MenuItem value={editingItem.rental_item_id}>
                    {editingItem.rental_item?.name}
                  </MenuItem>
                ) : (
                  availableItems.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.name} ({item.code})
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {/* Rates */}
            <Box display="flex" gap={2}>
              <TextField
                fullWidth
                required
                type="number"
                label="Daily Rate"
                value={formData.daily_rate || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    daily_rate: parseFloat(e.target.value) || 0,
                  })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">₹</InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                type="number"
                label="Weekly Rate"
                value={formData.weekly_rate || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    weekly_rate: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">₹</InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                type="number"
                label="Monthly Rate"
                value={formData.monthly_rate || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    monthly_rate: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">₹</InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Transport Costs */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
              Transport & Handling
            </Typography>
            <Box display="flex" gap={2}>
              <TextField
                fullWidth
                type="number"
                label="Transport Cost"
                value={formData.transport_cost || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    transport_cost: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">₹</InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                type="number"
                label="Loading Cost"
                value={formData.loading_cost || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    loading_cost: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">₹</InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                type="number"
                label="Unloading Cost"
                value={formData.unloading_cost || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    unloading_cost: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">₹</InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Long Term Discount */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
              Long Term Discount
            </Typography>
            <Box display="flex" gap={2}>
              <TextField
                fullWidth
                type="number"
                label="Min Rental Days"
                value={formData.min_rental_days || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    min_rental_days: parseInt(e.target.value) || 1,
                  })
                }
              />
              <TextField
                fullWidth
                type="number"
                label="Discount %"
                value={formData.long_term_discount_percentage || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    long_term_discount_percentage: parseFloat(e.target.value) || 0,
                  })
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">%</InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                type="number"
                label="After Days"
                value={formData.long_term_threshold_days || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    long_term_threshold_days: parseInt(e.target.value) || 30,
                  })
                }
                helperText="Days after which discount applies"
              />
            </Box>

            {/* Notes */}
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Notes"
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Availability, quality notes, etc."
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} disabled={addInventory.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={
              addInventory.isPending ||
              !formData.rental_item_id ||
              formData.daily_rate <= 0
            }
          >
            {addInventory.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
