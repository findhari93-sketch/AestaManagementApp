"use client";

import { useState, useMemo } from "react";
import {
  Box,
  TextField,
  Autocomplete,
  Typography,
  Chip,
  Paper,
  CircularProgress,
  ListItem,
  ListItemText,
} from "@mui/material";
import { useRentalItems, useRentalStoreInventory } from "@/hooks/queries/useRentals";
import type { RentalItemWithDetails, RentalStoreInventoryWithDetails } from "@/types/rental.types";
import { RENTAL_TYPE_LABELS } from "@/types/rental.types";

interface SelectedItem {
  rentalItemId: string;
  quantity: number;
  dailyRateDefault: number;
  dailyRateActual: number;
}

interface RentalItemSelectorProps {
  vendorId?: string;
  selectedItems: SelectedItem[];
  onItemsChange: (items: SelectedItem[]) => void;
  disabled?: boolean;
}

export default function RentalItemSelector({
  vendorId,
  selectedItems,
  onItemsChange,
  disabled = false,
}: RentalItemSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch all rental items
  const { data: allItems = [], isLoading: loadingItems } = useRentalItems();

  // Fetch vendor inventory if vendor is selected
  const { data: vendorInventory = [], isLoading: loadingInventory } = useRentalStoreInventory(
    vendorId || ""
  );

  // Create a map of vendor prices
  const vendorPriceMap = useMemo(() => {
    const map = new Map<string, RentalStoreInventoryWithDetails>();
    vendorInventory.forEach((inv) => {
      map.set(inv.rental_item_id, inv);
    });
    return map;
  }, [vendorInventory]);

  // Combine items with vendor pricing
  const itemsWithPricing = useMemo(() => {
    return allItems.map((item) => {
      const vendorPrice = vendorPriceMap.get(item.id);
      return {
        ...item,
        vendorPrice: vendorPrice?.daily_rate || null,
        defaultPrice: vendorPrice?.daily_rate || item.default_daily_rate || 0,
      };
    });
  }, [allItems, vendorPriceMap]);

  // Filter out already selected items
  const availableItems = useMemo(() => {
    const selectedIds = new Set(selectedItems.map((s) => s.rentalItemId));
    return itemsWithPricing.filter((item) => !selectedIds.has(item.id));
  }, [itemsWithPricing, selectedItems]);

  // Get full item details for selected items
  const selectedItemsWithDetails = useMemo(() => {
    return selectedItems.map((selected) => {
      const item = itemsWithPricing.find((i) => i.id === selected.rentalItemId);
      return {
        ...selected,
        item,
      };
    });
  }, [selectedItems, itemsWithPricing]);

  const handleAddItem = (item: (typeof itemsWithPricing)[0] | null) => {
    if (!item) return;

    const newItem: SelectedItem = {
      rentalItemId: item.id,
      quantity: 1,
      dailyRateDefault: item.defaultPrice,
      dailyRateActual: item.defaultPrice,
    };

    onItemsChange([...selectedItems, newItem]);
    setSearchTerm("");
  };

  const handleRemoveItem = (rentalItemId: string) => {
    onItemsChange(selectedItems.filter((i) => i.rentalItemId !== rentalItemId));
  };

  const handleUpdateItem = (
    rentalItemId: string,
    field: "quantity" | "dailyRateActual",
    value: number
  ) => {
    onItemsChange(
      selectedItems.map((item) =>
        item.rentalItemId === rentalItemId ? { ...item, [field]: value } : item
      )
    );
  };

  const isLoading = loadingItems || (!!vendorId && loadingInventory);

  return (
    <Box>
      {/* Search and Add */}
      <Autocomplete
        options={availableItems}
        getOptionLabel={(option) =>
          `${option.name} ${option.code ? `(${option.code})` : ""}`
        }
        inputValue={searchTerm}
        onInputChange={(_, value) => setSearchTerm(value)}
        onChange={(_, value) => handleAddItem(value)}
        loading={isLoading}
        disabled={disabled}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search and add items"
            placeholder="Search by name or code..."
            size="small"
            slotProps={{
              input: {
                ...params.InputProps,
                endAdornment: (
                  <>
                    {isLoading && <CircularProgress size={20} />}
                    {params.InputProps.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
        renderOption={(props, option) => {
          const { key, ...otherProps } = props;
          return (
            <ListItem key={key} {...otherProps} dense>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2">{option.name}</Typography>
                    {option.code && (
                      <Chip
                        size="small"
                        label={option.code}
                        variant="outlined"
                        sx={{ height: 18, fontSize: "0.65rem" }}
                      />
                    )}
                  </Box>
                }
                secondary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="caption" color="text.secondary">
                      {RENTAL_TYPE_LABELS[option.rental_type]}
                    </Typography>
                    <Typography variant="caption" color="primary">
                      ₹{option.defaultPrice}/day
                    </Typography>
                    {option.vendorPrice && (
                      <Chip
                        size="small"
                        label="In inventory"
                        color="success"
                        sx={{ height: 16, fontSize: "0.6rem" }}
                      />
                    )}
                  </Box>
                }
              />
            </ListItem>
          );
        }}
        noOptionsText="No items found"
        sx={{ mb: 2 }}
      />

      {/* Selected Items */}
      {selectedItemsWithDetails.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ px: 1, display: "block", mb: 1 }}
          >
            SELECTED ITEMS ({selectedItemsWithDetails.length})
          </Typography>

          {selectedItemsWithDetails.map(({ rentalItemId, quantity, dailyRateDefault, dailyRateActual, item }) => (
            <Box
              key={rentalItemId}
              sx={{
                p: 1,
                mb: 1,
                bgcolor: "grey.50",
                borderRadius: 1,
                "&:last-child": { mb: 0 },
              }}
            >
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="flex-start"
                mb={1}
              >
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {item?.name || "Unknown Item"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item?.code} | {item?.unit}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label="Remove"
                  onDelete={() => handleRemoveItem(rentalItemId)}
                  sx={{ height: 20, fontSize: "0.65rem" }}
                />
              </Box>

              <Box display="flex" gap={2} alignItems="center">
                <TextField
                  type="number"
                  label="Qty"
                  value={quantity}
                  onChange={(e) =>
                    handleUpdateItem(
                      rentalItemId,
                      "quantity",
                      Math.max(1, parseInt(e.target.value) || 1)
                    )
                  }
                  size="small"
                  sx={{ width: 80 }}
                  disabled={disabled}
                  slotProps={{
                    htmlInput: { min: 1 },
                  }}
                />

                <TextField
                  type="number"
                  label="Rate/Day"
                  value={dailyRateActual}
                  onChange={(e) =>
                    handleUpdateItem(
                      rentalItemId,
                      "dailyRateActual",
                      Math.max(0, parseFloat(e.target.value) || 0)
                    )
                  }
                  size="small"
                  sx={{ width: 100 }}
                  disabled={disabled}
                  slotProps={{
                    input: { startAdornment: <Typography sx={{ mr: 0.5 }}>₹</Typography> },
                  }}
                />

                {dailyRateActual !== dailyRateDefault && (
                  <Typography variant="caption" color="text.secondary">
                    (Default: ₹{dailyRateDefault})
                  </Typography>
                )}

                <Box sx={{ ml: "auto" }}>
                  <Typography variant="body2" fontWeight={600}>
                    ₹{(quantity * dailyRateActual).toLocaleString()}/day
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}

          {/* Total */}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            pt={1}
            mt={1}
            borderTop={1}
            borderColor="divider"
          >
            <Typography variant="subtitle2" color="text.secondary">
              Total Daily Rate
            </Typography>
            <Typography variant="subtitle1" fontWeight={700}>
              ₹
              {selectedItemsWithDetails
                .reduce((sum, i) => sum + i.quantity * i.dailyRateActual, 0)
                .toLocaleString()}
              /day
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
