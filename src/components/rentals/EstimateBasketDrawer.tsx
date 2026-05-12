"use client";

import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { useQueries } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useEstimateBasket } from "./EstimateBasket";
import { computeVendorEstimates } from "@/lib/utils/rentalCatalogUtils";
import type {
  EstimateBasketItem,
  RentalStoreInventoryWithDetails,
} from "@/types/rental.types";

interface EstimateBasketDrawerProps {
  open: boolean;
  onClose: () => void;
  onConvertToRequest: () => void;
}

function BasketItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: EstimateBasketItem;
  onUpdate: (patch: Partial<Pick<EstimateBasketItem, "quantity" | "days">>) => void;
  onRemove: () => void;
}) {
  return (
    <Box sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 0.5,
        }}
      >
        <Box>
          <Typography variant="body2" fontWeight={600}>
            {item.rental_item_name}
          </Typography>
          {item.size_label && (
            <Chip
              label={item.size_label}
              size="small"
              sx={{ fontSize: 10, height: 18, mt: 0.25 }}
            />
          )}
        </Box>
        <IconButton size="small" onClick={onRemove} color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
      <Stack direction="row" spacing={1}>
        <TextField
          label="Qty"
          type="number"
          size="small"
          value={item.quantity}
          onChange={(e) =>
            onUpdate({ quantity: Math.max(1, Number(e.target.value)) })
          }
          inputProps={{ min: 1 }}
          sx={{ flex: 1 }}
        />
        <TextField
          label="Days"
          type="number"
          size="small"
          value={item.days}
          onChange={(e) =>
            onUpdate({ days: Math.max(1, Number(e.target.value)) })
          }
          inputProps={{ min: 1 }}
          sx={{ flex: 1 }}
        />
      </Stack>
    </Box>
  );
}

export function EstimateBasketDrawer({
  open,
  onClose,
  onConvertToRequest,
}: EstimateBasketDrawerProps) {
  const { items, updateItem, removeItem, clearBasket, itemCount } =
    useEstimateBasket();

  const uniqueItemIds = [...new Set(items.map((i) => i.rental_item_id))];

  const inventoryQueries = useQueries({
    queries: uniqueItemIds.map((id) => ({
      queryKey: ["rentals", "storeInventory", "byItem", id],
      queryFn: async () => {
        const supabase = createClient();
        const { data } = await supabase
          .from("rental_store_inventory")
          .select(
            "*, vendor:vendors(id, name), rental_item:rental_items(id, name)"
          )
          .eq("rental_item_id", id);
        return {
          itemId: id,
          inventory: (data ?? []) as RentalStoreInventoryWithDetails[],
        };
      },
      enabled: open && !!id,
    })),
  });

  const inventoryByItemId: Record<string, RentalStoreInventoryWithDetails[]> =
    {};
  for (const q of inventoryQueries) {
    if (q.data) inventoryByItemId[q.data.itemId] = q.data.inventory;
  }

  const vendorEstimates = computeVendorEstimates(items, inventoryByItemId);
  const isLoading = inventoryQueries.some((q) => q.isLoading);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{ "& .MuiDrawer-paper": { width: { xs: "100%", sm: 400 } } }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ShoppingCartIcon color="warning" />
            <Typography variant="subtitle1" fontWeight={700}>
              Estimate Basket
            </Typography>
            <Chip label={itemCount} size="small" color="warning" />
          </Box>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {items.length === 0 ? (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 3,
              textAlign: "center",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No items yet. Browse the catalog and click &quot;+ Estimate&quot;.
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ flex: 1, overflow: "auto", px: 2, pt: 1 }}>
              {items.map((item) => (
                <BasketItemRow
                  key={item.id}
                  item={item}
                  onUpdate={(patch) => updateItem(item.id, patch)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}

              {/* Vendor comparison */}
              <Box sx={{ mt: 2 }}>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  color="text.secondary"
                >
                  VENDOR COMPARISON
                </Typography>
                {isLoading ? (
                  <Box
                    sx={{ display: "flex", justifyContent: "center", mt: 1 }}
                  >
                    <CircularProgress size={20} />
                  </Box>
                ) : vendorEstimates.length === 0 ? (
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    display="block"
                    sx={{ mt: 0.5 }}
                  >
                    No vendor pricing available
                  </Typography>
                ) : (
                  <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                    {vendorEstimates.map((est) => (
                      <Box
                        key={est.vendor_id}
                        sx={{
                          p: 1.25,
                          borderRadius: 1.5,
                          border: "1px solid",
                          borderColor: est.is_cheapest
                            ? "success.main"
                            : "divider",
                          bgcolor: est.is_cheapest
                            ? "success.light"
                            : "background.default",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {est.vendor_name}
                          </Typography>
                          {est.is_cheapest && (
                            <Chip
                              label="CHEAPEST"
                              size="small"
                              color="success"
                              sx={{ fontSize: 9, height: 16 }}
                            />
                          )}
                        </Box>
                        <Typography
                          variant="subtitle2"
                          fontWeight={700}
                          color="warning.main"
                        >
                          ₹{est.total_rental_cost.toLocaleString("en-IN")}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Box>

            <Divider />

            <Box
              sx={{
                p: 2,
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={onConvertToRequest}
              >
                Convert to Rental Request →
              </Button>
              <Button
                fullWidth
                variant="outlined"
                color="error"
                size="small"
                onClick={clearBasket}
              >
                Clear Basket
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Drawer>
  );
}
