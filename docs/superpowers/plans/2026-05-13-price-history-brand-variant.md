# Price History — Brand × Variant Context + Record Price Button

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Price History tab in the Materials inspect pane to show vendor / brand / variant context per entry, and add a "+ Record Price" button that opens a focused dialog for manually entering a historical price.

**Architecture:** Three-task change. (1) Add `recorded_date` to `PriceEntryFormData` so historical dates can be stored; skip the vendor-inventory current-price update for past dates. (2) New `RecordPriceDialog` component — focused on price entry only (vendor, variant, brand, price, date, quantity). (3) Upgrade `PriceHistoryTab` inside `MaterialInspectPane` to receive and render full `PriceHistoryWithDetails[]` (vendor name, brand name, variant name) and wire the dialog open button.

**Tech Stack:** Next.js 15, Supabase JS client, React Query (TanStack), MUI v7, TypeScript, Vitest + React Testing Library

**Spec (conversation):** User wants to see "TNPL × 43 Grade → ₹290 on 18 Nov 2025" in the Price History tab, and a button to add price entries without leaving the inspect pane.

---

## Key IDs / Data Already Known

| Piece | Location |
|---|---|
| `PriceEntryFormData` type | `src/types/material.types.ts:1506` |
| `useRecordPriceEntry` mutation | `src/hooks/queries/useVendorInventory.ts:700` |
| `useMaterialPriceHistory` hook | `src/hooks/queries/useVendorInventory.ts:618` |
| `PriceHistoryTab` component | `src/components/materials/MaterialInspectPane.tsx:1174` |
| Tab call site | `src/components/materials/MaterialInspectPane.tsx:327–334` |
| `useMaterialBrands(materialId)` | `src/hooks/queries/useMaterials.ts:1057` |
| `useMaterialVariants(parentId)` | `src/hooks/queries/useMaterials.ts:1618` |
| `useVendors(categoryId?)` | `src/hooks/queries/useVendors.ts:49` |

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types/material.types.ts` | Modify | Add `recorded_date?: string` to `PriceEntryFormData` |
| `src/hooks/queries/useVendorInventory.ts` | Modify | Use `data.recorded_date` in mutation; skip vendor-inventory update for past dates |
| `src/components/materials/RecordPriceDialog.tsx` | Create | Focused price-entry dialog (vendor, variant, brand, price, date, qty) |
| `src/components/materials/MaterialInspectPane.tsx` | Modify | PriceHistoryTab: show brand/vendor/variant columns; add "+ Record Price" button + dialog |

---

## Task 1: Add `recorded_date` to `PriceEntryFormData` and fix mutation

**Files:**
- Modify: `src/types/material.types.ts:1506–1521`
- Modify: `src/hooks/queries/useVendorInventory.ts:700–776`

- [ ] **Step 1: Add `recorded_date` to the type**

In `src/types/material.types.ts`, find `PriceEntryFormData` at line 1506 and add `recorded_date`:

```typescript
export interface PriceEntryFormData {
  vendor_id: string;
  material_id: string;
  brand_id?: string;
  price: number;
  price_includes_gst?: boolean;
  gst_rate?: number;
  transport_cost?: number;
  loading_cost?: number;
  unloading_cost?: number;
  source: PriceSource;
  source_reference?: string;
  quantity?: number;
  unit?: string;
  recorded_date?: string; // ISO date "YYYY-MM-DD"; defaults to today if omitted
  notes?: string;
}
```

- [ ] **Step 2: Use `recorded_date` in the mutation + skip inventory update for historical dates**

In `src/hooks/queries/useVendorInventory.ts`, inside `useRecordPriceEntry.mutationFn`:

Find line 729:
```typescript
          recorded_date: new Date().toISOString().split("T")[0],
```

Replace with:
```typescript
          recorded_date: data.recorded_date ?? new Date().toISOString().split("T")[0],
```

Then find the block starting at line 742 (`// Also update vendor inventory current price`). Wrap the ENTIRE vendor-inventory update block (lines 742–773) in an `isToday` guard so historical entries don't overwrite the current vendor price:

```typescript
      // Only update vendor inventory current price for today's entries.
      // Historical price records should not overwrite the vendor's current price.
      const today = new Date().toISOString().split("T")[0];
      const isToday = !data.recorded_date || data.recorded_date === today;

      if (isToday) {
        let inventoryQuery = (supabase as any)
          .from("vendor_inventory")
          .select("id")
          .eq("vendor_id", data.vendor_id)
          .eq("material_id", data.material_id);

        if (data.brand_id) {
          inventoryQuery = inventoryQuery.eq("brand_id", data.brand_id);
        } else {
          inventoryQuery = inventoryQuery.is("brand_id", null);
        }

        const { data: existingInventory } = await inventoryQuery.maybeSingle();

        if (existingInventory) {
          await (supabase as any)
            .from("vendor_inventory")
            .update({
              current_price: data.price,
              price_includes_gst: data.price_includes_gst || false,
              gst_rate: data.gst_rate || null,
              transport_cost: data.transport_cost || null,
              loading_cost: data.loading_cost || null,
              unloading_cost: data.unloading_cost || null,
              last_price_update: new Date().toISOString(),
              price_source: data.source,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingInventory.id);
        }
      }
```

- [ ] **Step 3: Run tests**

```bash
npm run test -- --run
```

Expected: all tests pass (baseline — no behaviour change for today-dated entries).

- [ ] **Step 4: Commit**

```bash
git add src/types/material.types.ts src/hooks/queries/useVendorInventory.ts
git commit -m "feat(price-history): add recorded_date to PriceEntryFormData; skip inventory update for historical entries"
```

---

## Task 2: Create `RecordPriceDialog` component

**Files:**
- Create: `src/components/materials/RecordPriceDialog.tsx`

This is a focused dialog — no payment fields, no group stock, no site selection. Just: who sold it, at what grade, which brand, at what price, on what date, how many.

- [ ] **Step 1: Write the failing test**

Create `src/components/materials/__tests__/RecordPriceDialog.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RecordPriceDialog } from "../RecordPriceDialog";
import type { Material } from "@/types/material.types";

// Stub hooks
vi.mock("@/hooks/queries/useVendors", () => ({
  useVendors: () => ({ data: [{ id: "v1", name: "ARM Cement & Steel" }] }),
}));
vi.mock("@/hooks/queries/useVendorInventory", () => ({
  useRecordPriceEntry: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  }),
}));

const BASE_MATERIAL: Material = {
  id: "m1",
  name: "PPC Cement",
  code: "MAT-CEM-001",
  local_name: null,
  category_id: null,
  parent_id: null,
  description: null,
  unit: "BAG",
  secondary_unit: null,
  conversion_factor: null,
  hsn_code: null,
  gst_rate: null,
  specifications: null,
  weight_per_unit: null,
  weight_unit: null,
  length_per_piece: null,
  length_unit: null,
  rods_per_bundle: null,
  min_order_qty: null,
  reorder_level: null,
  image_url: null,
  is_active: true,
  created_at: "",
  updated_at: "",
  created_by: null,
};

const wrap = (ui: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient()}>
    {ui}
  </QueryClientProvider>
);

describe("RecordPriceDialog", () => {
  it("renders when open", () => {
    render(
      wrap(
        <RecordPriceDialog
          open={true}
          onClose={vi.fn()}
          material={BASE_MATERIAL}
          variants={[]}
          brands={[]}
        />
      )
    );
    expect(screen.getByText(/record price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      wrap(
        <RecordPriceDialog
          open={false}
          onClose={vi.fn()}
          material={BASE_MATERIAL}
          variants={[]}
          brands={[]}
        />
      )
    );
    expect(screen.queryByText(/record price/i)).not.toBeInTheDocument();
  });

  it("shows variant selector only when variants provided", () => {
    const variants: Material[] = [
      { ...BASE_MATERIAL, id: "v1", name: "43", parent_id: "m1" },
    ];
    render(
      wrap(
        <RecordPriceDialog
          open={true}
          onClose={vi.fn()}
          material={BASE_MATERIAL}
          variants={variants}
          brands={[]}
        />
      )
    );
    expect(screen.getByLabelText(/grade.*variant/i)).toBeInTheDocument();
  });

  it("submit button disabled when price is empty", () => {
    render(
      wrap(
        <RecordPriceDialog
          open={true}
          onClose={vi.fn()}
          material={BASE_MATERIAL}
          variants={[]}
          brands={[]}
        />
      )
    );
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npm run test -- src/components/materials/__tests__/RecordPriceDialog.test.tsx --run
```

Expected: FAIL — `RecordPriceDialog` not found.

- [ ] **Step 3: Create `RecordPriceDialog.tsx`**

Create `src/components/materials/RecordPriceDialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Box,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import type { Material, MaterialBrand, PriceSource } from "@/types/material.types";
import { useVendors } from "@/hooks/queries/useVendors";
import { useRecordPriceEntry } from "@/hooks/queries/useVendorInventory";
import type { Vendor } from "@/types/vendor.types";

export interface RecordPriceDialogProps {
  open: boolean;
  onClose: () => void;
  material: Material;
  variants: Material[];  // child variant materials (may be empty)
  brands: MaterialBrand[];
}

export function RecordPriceDialog({
  open,
  onClose,
  material,
  variants,
  brands,
}: RecordPriceDialogProps) {
  const { data: vendors = [] } = useVendors();
  const recordPrice = useRecordPriceEntry();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [variantId, setVariantId] = useState<string>("");
  const [brandId, setBrandId] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [date, setDate] = useState<string>(
    () => new Date().toISOString().split("T")[0]
  );
  const [quantity, setQuantity] = useState<string>("");
  const [source, setSource] = useState<PriceSource>("manual");
  const [notes, setNotes] = useState<string>("");

  function reset() {
    setVendor(null);
    setVariantId("");
    setBrandId("");
    setPrice("");
    setDate(new Date().toISOString().split("T")[0]);
    setQuantity("");
    setSource("manual");
    setNotes("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  const canSubmit =
    vendor !== null && price !== "" && !isNaN(Number(price)) && Number(price) > 0;

  function handleSubmit() {
    if (!canSubmit) return;

    // Use variant material_id if selected, otherwise parent material_id
    const materialId = variantId || material.id;

    recordPrice.mutate(
      {
        vendor_id: vendor!.id,
        material_id: materialId,
        brand_id: brandId || undefined,
        price: Number(price),
        quantity: quantity ? Number(quantity) : undefined,
        unit: material.unit ?? undefined,
        recorded_date: date,
        source,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          handleClose();
        },
      }
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>
          Record Price
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
          {material.name}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1.5 }}>
        {recordPrice.isError && (
          <Alert severity="error" sx={{ fontSize: 12 }}>
            Failed to save price. Please try again.
          </Alert>
        )}

        {/* Vendor */}
        <Autocomplete
          options={vendors}
          getOptionLabel={(v) => v.name}
          value={vendor}
          onChange={(_, v) => setVendor(v)}
          slotProps={{ popper: { disablePortal: false } }}
          renderInput={(params) => (
            <TextField {...params} label="Vendor / Supplier" size="small" required />
          )}
        />

        {/* Variant — only when material has child variants */}
        {variants.length > 0 && (
          <FormControl size="small" fullWidth>
            <InputLabel id="variant-label">Grade / Variant</InputLabel>
            <Select
              labelId="variant-label"
              label="Grade / Variant"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              inputProps={{ "aria-label": "Grade / Variant" }}
            >
              <MenuItem value="">
                <em>Any (parent material)</em>
              </MenuItem>
              {variants.map((v) => (
                <MenuItem key={v.id} value={v.id}>
                  {v.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Brand */}
        {brands.length > 0 && (
          <FormControl size="small" fullWidth>
            <InputLabel id="brand-label">Brand</InputLabel>
            <Select
              labelId="brand-label"
              label="Brand"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
            >
              <MenuItem value="">
                <em>No specific brand</em>
              </MenuItem>
              {brands.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.brand_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Price + Unit row */}
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            label="Price"
            size="small"
            required
            type="number"
            inputProps={{ min: 0, step: 0.01, "aria-label": "Price" }}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            sx={{ flex: 2 }}
          />
          <Typography
            sx={{ fontSize: 12, color: "text.secondary", whiteSpace: "nowrap", pt: 0.5 }}
          >
            per {material.unit ?? "unit"}
          </Typography>
        </Box>

        {/* Date */}
        <TextField
          label="Date"
          size="small"
          type="date"
          inputProps={{ "aria-label": "Date" }}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        {/* Quantity (optional) */}
        <TextField
          label="Quantity (optional)"
          size="small"
          type="number"
          inputProps={{ min: 0, step: 1 }}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />

        {/* Source */}
        <FormControl size="small" fullWidth>
          <InputLabel id="source-label">Source</InputLabel>
          <Select
            labelId="source-label"
            label="Source"
            value={source}
            onChange={(e) => setSource(e.target.value as PriceSource)}
          >
            <MenuItem value="manual">Manual entry</MenuItem>
            <MenuItem value="purchase">Purchase</MenuItem>
            <MenuItem value="enquiry">Enquiry / Quote</MenuItem>
          </Select>
        </FormControl>

        {/* Notes (optional) */}
        <TextField
          label="Notes (optional)"
          size="small"
          multiline
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} size="small">
          Cancel
        </Button>
        <Button
          variant="contained"
          size="small"
          disabled={!canSubmit || recordPrice.isPending}
          onClick={handleSubmit}
          startIcon={recordPrice.isPending ? <CircularProgress size={14} /> : null}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm run test -- src/components/materials/__tests__/RecordPriceDialog.test.tsx --run
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/materials/RecordPriceDialog.tsx \
        src/components/materials/__tests__/RecordPriceDialog.test.tsx
git commit -m "feat(price-history): add RecordPriceDialog for manual price entry"
```

---

## Task 3: Upgrade PriceHistoryTab + wire the "+ Record Price" button

**Files:**
- Modify: `src/components/materials/MaterialInspectPane.tsx`

The price history tab currently receives `{ date, price }[]` — we need to pass full `PriceHistoryWithDetails[]` and show vendor / brand / variant columns.

- [ ] **Step 1: Read the current PriceHistoryTab before editing**

Read `src/components/materials/MaterialInspectPane.tsx` lines 1174–1271 (the full `PriceHistoryTab` function) and lines 110–140 (hook calls) and lines 325–338 (tab call site).

- [ ] **Step 2: Add imports to `MaterialInspectPane.tsx`**

At the top of the file, add:

```typescript
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { RecordPriceDialog } from "./RecordPriceDialog";
import type { PriceHistoryWithDetails } from "@/types/material.types";
```

(`PriceHistoryWithDetails` should already be imported if it's used elsewhere — check first, add only if missing.)

- [ ] **Step 3: Add dialog state to `MaterialInspectPane`**

Inside `MaterialInspectPane` function body, after the existing hook calls, add:

```typescript
const [recordPriceOpen, setRecordPriceOpen] = useState(false);
```

- [ ] **Step 4: Change the `PriceHistoryTab` call site (lines 327–334)**

Replace:
```typescript
          ) : activeTab === "price-history" ? (
            <PriceHistoryTab
              isLoading={historyLoading}
              points={priceHistory.map((p) => ({
                date: p.recorded_date,
                price: p.price,
              }))}
            />
```

With:
```typescript
          ) : activeTab === "price-history" ? (
            <>
              <PriceHistoryTab
                isLoading={historyLoading}
                entries={priceHistory}
                variants={variants}
                onAddPrice={() => setRecordPriceOpen(true)}
              />
              <RecordPriceDialog
                open={recordPriceOpen}
                onClose={() => setRecordPriceOpen(false)}
                material={material}
                variants={variants}
                brands={(material as any).brands ?? []}
              />
            </>
```

Note: `variants` is already fetched as `useMaterialVariants(materialId)` in the inspect pane. `material.brands` is the embedded brands array from the material query. If the embedded brands aren't available, use `useMaterialBrands(materialId)` — check what's already fetched in the component and use the available data.

Actually, to be safe, add a `useMaterialBrands` hook call if not already present:

```typescript
const { data: materialBrands = [] } = useMaterialBrands(material?.id);
```

And import `useMaterialBrands` from `@/hooks/queries/useMaterials`.

Then pass `brands={materialBrands}` to `RecordPriceDialog`.

- [ ] **Step 5: Rewrite `PriceHistoryTab` to show brand/vendor/variant columns**

Replace the entire `PriceHistoryTab` function (lines 1174–1271) with:

```typescript
function PriceHistoryTab({
  isLoading,
  entries,
  variants,
  onAddPrice,
}: {
  isLoading: boolean;
  entries: PriceHistoryWithDetails[];
  variants: Material[];
  onAddPrice: () => void;
}) {
  // Build a lookup from variant material_id → variant name
  const variantNameById = Object.fromEntries(
    variants.map((v) => [v.id, v.name])
  );

  const sparklinePoints = entries.map((e) => ({
    date: e.recorded_date,
    price: e.price,
  }));

  if (isLoading) {
    return (
      <Box sx={{ p: 1.5 }}>
        <Skeleton variant="rounded" height={64} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={32} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={32} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
      {/* Header: count + sparkline + add button */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          border: 1,
          borderColor: "divider",
          borderRadius: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography
          sx={{
            fontSize: 9.5,
            fontWeight: 700,
            color: "text.secondary",
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {entries.length} entries
        </Typography>
        {entries.length > 0 && (
          <PriceHistorySparkline points={sparklinePoints} width={100} height={36} />
        )}
        <Button
          size="small"
          startIcon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
          onClick={onAddPrice}
          sx={{ fontSize: 11, py: 0.4, px: 1, minWidth: 0, whiteSpace: "nowrap" }}
        >
          Record Price
        </Button>
      </Box>

      {entries.length === 0 ? (
        <Box sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            No price history recorded yet.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {[...entries]
            .sort(
              (a, b) =>
                new Date(b.recorded_date).getTime() -
                new Date(a.recorded_date).getTime()
            )
            .slice(0, 30)
            .map((entry) => {
              const variantName = variantNameById[entry.material_id];
              return (
                <Box
                  key={entry.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr auto",
                    alignItems: "center",
                    gap: 0.75,
                    px: 1.25,
                    py: 0.75,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    bgcolor: "background.paper",
                  }}
                >
                  {/* Date */}
                  <Typography
                    sx={{
                      fontSize: 10,
                      color: "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: 0.3,
                    }}
                  >
                    {formatDate(entry.recorded_date)}
                  </Typography>

                  {/* Vendor · Brand · Variant */}
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: 11,
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.vendor?.name ?? "—"}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 10,
                        color: "text.secondary",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {[entry.brand?.brand_name, variantName]
                        .filter(Boolean)
                        .join(" · ") || "No brand / variant"}
                    </Typography>
                  </Box>

                  {/* Price */}
                  <Box sx={{ textAlign: "right" }}>
                    <Typography
                      sx={{
                        fontSize: 13,
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatCurrency(entry.price)}
                    </Typography>
                    {entry.quantity != null && (
                      <Typography sx={{ fontSize: 10, color: "text.secondary" }}>
                        {entry.quantity} {entry.unit ?? ""}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 6: Run all tests**

```bash
npm run test -- --run
```

Expected: all tests pass including the new `RecordPriceDialog.test.tsx` (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/components/materials/MaterialInspectPane.tsx
git commit -m "feat(price-history): show vendor/brand/variant per entry + Record Price button"
```

---

## Self-Review

**Spec coverage:**
- ✅ Price History tab shows brand name, variant name, vendor name per entry
- ✅ "+ Record Price" button opens dialog from the inspect pane
- ✅ Dialog fields: vendor, variant (if applicable), brand, price, date, quantity, source, notes
- ✅ Historical dates don't overwrite vendor_inventory current price
- ✅ `material_id` in price_history is variant ID when variant is selected

**Placeholder scan:** None.

**Type consistency:**
- `RecordPriceDialogProps.brands` is `MaterialBrand[]` — matches what `useMaterialBrands` returns
- `RecordPriceDialogProps.variants` is `Material[]` — matches what `useMaterialVariants` returns
- `PriceHistoryTab.entries` is `PriceHistoryWithDetails[]` — matches what `useMaterialPriceHistory` returns
