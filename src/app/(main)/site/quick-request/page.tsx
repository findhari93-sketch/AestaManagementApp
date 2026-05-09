"use client";

import { useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  SwipeableDrawer,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Inventory2 as MaterialIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useAuth } from "@/contexts/AuthContext";
import { useSelectedSite } from "@/contexts/SiteContext";
import { useToast } from "@/contexts/ToastContext";
import { useMaterials } from "@/hooks/queries/useMaterials";
import { useSiteStock } from "@/hooks/queries/useStockInventory";
import { useCreateMaterialRequest } from "@/hooks/queries/useMaterialRequests";
import type { MaterialWithDetails } from "@/types/material.types";

interface CartItem {
  material_id: string;
  material_name: string;
  unit: string;
  qty: number;
}

const QUICK_QTY_PRESETS = [1, 5, 10, 25, 50];

export default function QuickRequestPage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { selectedSite } = useSelectedSite();
  const { showSuccess, showError } = useToast();

  const { data: materials = [], isLoading: materialsLoading } = useMaterials();
  const { data: stockItems = [] } = useSiteStock(selectedSite?.id);
  const createRequest = useCreateMaterialRequest();

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pickerMaterial, setPickerMaterial] = useState<MaterialWithDetails | null>(null);
  const [pickerQty, setPickerQty] = useState(1);
  const isSubmittingRef = useRef(false);

  const stockByMaterial = useMemo(() => {
    const map = new Map<string, number>();
    stockItems.forEach((s) => {
      map.set(s.material_id, (map.get(s.material_id) || 0) + (s.available_qty || 0));
    });
    return map;
  }, [stockItems]);

  const filteredMaterials = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...materials].sort((a, b) => {
      const stockA = stockByMaterial.get(a.id) || 0;
      const stockB = stockByMaterial.get(b.id) || 0;
      if (stockA !== stockB) return stockB - stockA;
      return a.name.localeCompare(b.name);
    });
    if (!q) return sorted;
    return sorted.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.code || "").toLowerCase().includes(q)
    );
  }, [materials, search, stockByMaterial]);

  const cartTotalItems = cart.length;

  const openPicker = (material: MaterialWithDetails) => {
    const existing = cart.find((c) => c.material_id === material.id);
    setPickerMaterial(material);
    setPickerQty(existing?.qty || 1);
  };

  const closePicker = () => {
    setPickerMaterial(null);
    setPickerQty(1);
  };

  const addOrUpdateCart = () => {
    if (!pickerMaterial || pickerQty <= 0) return;
    setCart((prev) => {
      const existingIdx = prev.findIndex((c) => c.material_id === pickerMaterial.id);
      const next: CartItem = {
        material_id: pickerMaterial.id,
        material_name: pickerMaterial.name,
        unit: pickerMaterial.unit || "",
        qty: pickerQty,
      };
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = next;
        return copy;
      }
      return [...prev, next];
    });
    closePicker();
  };

  const removeFromCart = (materialId: string) => {
    setCart((prev) => prev.filter((c) => c.material_id !== materialId));
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;
    if (!userProfile?.id) {
      showError("You must be signed in.");
      return;
    }
    if (!selectedSite?.id) {
      showError("Pick a site first.");
      return;
    }
    if (cart.length === 0) return;

    isSubmittingRef.current = true;
    try {
      await createRequest.mutateAsync({
        site_id: selectedSite.id,
        requested_by: userProfile.id,
        priority: "normal",
        items: cart.map((c) => ({
          material_id: c.material_id,
          requested_qty: c.qty,
        })),
      });
      showSuccess(
        cart.length === 1
          ? `Request sent: ${cart[0].qty} ${cart[0].unit} ${cart[0].material_name}`
          : `Request sent for ${cart.length} materials`
      );
      router.push("/site/material-requests");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send request";
      showError(message);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const submitting = createRequest.isPending;

  return (
    <Box sx={{ pb: cart.length > 0 ? 22 : 4, minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar>
          <IconButton edge="start" onClick={() => router.back()} aria-label="Back">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Request Material
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2 }}>
        {!selectedSite && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Select a site first.
          </Alert>
        )}

        <TextField
          fullWidth
          autoFocus
          placeholder="Search material…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            },
          }}
        />

        <Typography variant="overline" color="text.secondary" sx={{ display: "block", mt: 3, mb: 1 }}>
          {search ? "Results" : "All materials"}
        </Typography>

        {materialsLoading ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            Loading…
          </Typography>
        ) : filteredMaterials.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            No materials match &quot;{search}&quot;.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {filteredMaterials.map((material) => {
              const stock = stockByMaterial.get(material.id) || 0;
              const inCart = cart.find((c) => c.material_id === material.id);
              return (
                <Card key={material.id} variant="outlined">
                  <CardActionArea onClick={() => openPicker(material)} sx={{ p: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: 1.5,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: "action.hover",
                          color: "text.secondary",
                          flexShrink: 0,
                        }}
                      >
                        <MaterialIcon />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body1" fontWeight={500} noWrap>
                          {material.name}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                          {material.unit && (
                            <Typography variant="caption" color="text.secondary">
                              per {material.unit}
                            </Typography>
                          )}
                          {stock > 0 && (
                            <Chip
                              size="small"
                              label={`In stock: ${stock}`}
                              color="success"
                              variant="outlined"
                              sx={{ height: 20 }}
                            />
                          )}
                        </Stack>
                      </Box>
                      {inCart ? (
                        <Chip
                          color="primary"
                          label={`${inCart.qty} ${inCart.unit}`}
                          sx={{ flexShrink: 0 }}
                        />
                      ) : (
                        <AddIcon color="action" />
                      )}
                    </Stack>
                  </CardActionArea>
                </Card>
              );
            })}
          </Stack>
        )}
      </Box>

      {cart.length > 0 && (
        <Box
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            bgcolor: "background.paper",
            borderTop: 1,
            borderColor: "divider",
            p: 2,
            zIndex: 1100,
            boxShadow: "0 -4px 12px rgba(0,0,0,0.04)",
          }}
        >
          <Stack direction="row" spacing={1} sx={{ mb: 1.5, overflowX: "auto", pb: 0.5 }}>
            {cart.map((item) => (
              <Chip
                key={item.material_id}
                label={`${item.qty} ${item.unit} · ${item.material_name}`}
                onDelete={() => removeFromCart(item.material_id)}
                deleteIcon={<DeleteIcon />}
                sx={{ flexShrink: 0 }}
              />
            ))}
          </Stack>
          <Button
            fullWidth
            size="large"
            variant="contained"
            disabled={submitting || !selectedSite?.id}
            onClick={handleSubmit}
            sx={{ height: 52, fontSize: 16, fontWeight: 600 }}
          >
            {submitting ? "Sending…" : `Send request (${cartTotalItems})`}
          </Button>
        </Box>
      )}

      <SwipeableDrawer
        anchor="bottom"
        open={!!pickerMaterial}
        onClose={closePicker}
        onOpen={() => {}}
        disableSwipeToOpen
        slotProps={{
          paper: {
            sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "90vh" },
          },
        }}
      >
        {pickerMaterial && (
          <Box sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">{pickerMaterial.name}</Typography>
                {pickerMaterial.unit && (
                  <Typography variant="caption" color="text.secondary">
                    Quantity in {pickerMaterial.unit}
                  </Typography>
                )}
              </Box>
              <IconButton onClick={closePicker} aria-label="Close">
                <CloseIcon />
              </IconButton>
            </Stack>

            <Stack direction="row" alignItems="center" justifyContent="center" spacing={2} sx={{ my: 3 }}>
              <IconButton
                onClick={() => setPickerQty((q) => Math.max(1, q - 1))}
                size="large"
                sx={{ border: 1, borderColor: "divider", width: 56, height: 56 }}
              >
                <RemoveIcon fontSize="large" />
              </IconButton>
              <TextField
                value={pickerQty}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setPickerQty(isNaN(v) || v < 0 ? 0 : v);
                }}
                inputProps={{
                  inputMode: "decimal",
                  style: { textAlign: "center", fontSize: 32, fontWeight: 600, padding: "8px 0", width: 100 },
                }}
                variant="standard"
              />
              <IconButton
                onClick={() => setPickerQty((q) => q + 1)}
                size="large"
                sx={{ border: 1, borderColor: "divider", width: 56, height: 56 }}
              >
                <AddIcon fontSize="large" />
              </IconButton>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", justifyContent: "center", mb: 3 }}>
              {QUICK_QTY_PRESETS.map((n) => (
                <Chip
                  key={n}
                  label={n}
                  onClick={() => setPickerQty(n)}
                  variant={pickerQty === n ? "filled" : "outlined"}
                  color={pickerQty === n ? "primary" : "default"}
                  sx={{ minWidth: 56 }}
                />
              ))}
            </Stack>

            <Button
              fullWidth
              size="large"
              variant="contained"
              disabled={pickerQty <= 0}
              onClick={addOrUpdateCart}
              sx={{ height: 52, fontSize: 16, fontWeight: 600 }}
            >
              {cart.find((c) => c.material_id === pickerMaterial.id) ? "Update" : "Add to request"}
            </Button>
          </Box>
        )}
      </SwipeableDrawer>
    </Box>
  );
}
