# Rental Material Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-variant rate + optional photo to `rental_item_sizes`, persist the chosen variant on `rental_order_items`, and wire a variant picker into rental order creation so the daily rate auto-fills.

**Architecture:** Two `ALTER TABLE`s on existing tables (no new tables). A single `resolveVariantRate()` helper centralises the priority chain (vendor `size_rates` → variant `daily_rate` → parent `default_daily_rate`). The catalog dialog gains a variant section visible on create AND edit; the order dialog gains a required variant picker when an item has variants.

**Tech Stack:** Next.js 15, MUI v7, React Query, Supabase (PostgreSQL), Vitest, Playwright MCP for UI verification.

**Spec:** [docs/superpowers/specs/2026-05-15-rental-material-variants-design.md](../specs/2026-05-15-rental-material-variants-design.md)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260515120000_rental_variants_rate_and_photo.sql` | Create | Add `daily_rate`, `default_hourly_rate`, `image_url` to `rental_item_sizes`; add `rental_item_size_id`, `size_label_snapshot` to `rental_order_items` |
| `src/types/rental.types.ts` | Modify | Extend `RentalItemSize`, `RentalItemSizeFormData`, `RentalOrderItem`, `RentalOrderItemFormData` |
| `src/lib/utils/rentalCatalogUtils.ts` | Modify | Add `resolveVariantRate()` |
| `src/lib/utils/__tests__/rentalCatalogUtils.test.ts` | Modify | Add unit tests for `resolveVariantRate()` |
| `src/hooks/queries/useRentals.ts` | Modify | Extend `rental_items` select to fetch new size columns; add `useUpdateRentalItemSize`, `useDeleteRentalItemSize`; extend `useCreateRentalOrder` + `useCreateRentalRequest` to pass `rental_item_size_id` + `size_label_snapshot` |
| `src/components/rentals/RentalItemDialog.tsx` | Modify | Variant section visible on create + edit; per-row label/rate/photo/delete; deferred-insert on create |
| `src/components/rentals/RentalOrderDialog.tsx` | Modify | When picked item has variants, require variant selection; auto-fill rate via `resolveVariantRate`; carry size id + snapshot into line items |
| `src/components/rentals/RentalRequestForm.tsx` | Modify | Carry `rental_item_size_id` + snapshot through into `useCreateRentalRequest` payload |
| `src/components/rentals/RentalCostBreakdown.tsx` | Modify | Display `"<name> — <size_label_snapshot>"` for variant rows |
| `src/components/rentals/RentalOrderCard.tsx` | Modify | Display size snapshot beside item name |

---

## Task 1: DB migration — extend `rental_item_sizes` and `rental_order_items`

**Files:**
- Create: `supabase/migrations/20260515120000_rental_variants_rate_and_photo.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260515120000_rental_variants_rate_and_photo.sql`:

```sql
-- Per-variant rate + photo on rental_item_sizes (all nullable for back-compat)
ALTER TABLE public.rental_item_sizes
  ADD COLUMN IF NOT EXISTS daily_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS default_hourly_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Persist chosen variant on order line + snapshot label for history
ALTER TABLE public.rental_order_items
  ADD COLUMN IF NOT EXISTS rental_item_size_id UUID REFERENCES public.rental_item_sizes(id),
  ADD COLUMN IF NOT EXISTS size_label_snapshot TEXT;

CREATE INDEX IF NOT EXISTS idx_rental_order_items_size
  ON public.rental_order_items(rental_item_size_id)
  WHERE rental_item_size_id IS NOT NULL;
```

- [ ] **Step 2: Apply migration locally**

Run: `npm run db:reset`
Expected: `supabase db reset` completes, schema rebuild succeeds, no errors mentioning rental_item_sizes or rental_order_items.

- [ ] **Step 3: Verify columns exist**

Run:
```
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "\d public.rental_item_sizes" -c "\d public.rental_order_items"
```
(Password: `postgres`)
Expected: `rental_item_sizes` lists `daily_rate numeric`, `default_hourly_rate numeric`, `image_url text`. `rental_order_items` lists `rental_item_size_id uuid` and `size_label_snapshot text`.

- [ ] **Step 4: Commit**

```
git add supabase/migrations/20260515120000_rental_variants_rate_and_photo.sql
git commit -m "feat(rentals): add variant rate + photo + order-item size linkage"
```

---

## Task 2: TypeScript types — extend interfaces

**Files:**
- Modify: `src/types/rental.types.ts:177-190` (`RentalItemSize`, `RentalItemSizeFormData`), `src/types/rental.types.ts:244-262` (`RentalOrderItem`), `src/types/rental.types.ts:445-456` (`RentalOrderItemFormData`)

- [ ] **Step 1: Extend `RentalItemSize`**

In `src/types/rental.types.ts`, replace the `RentalItemSize` interface (currently lines 177-184) with:

```ts
export interface RentalItemSize {
  id: string;
  rental_item_id: string;
  size_label: string;       // e.g. "6×1½"
  display_order: number;
  is_active: boolean;
  created_at: string;
  daily_rate: number | null;            // catalog default daily rate for this variant
  default_hourly_rate: number | null;   // used when parent rate_type = 'hourly'
  image_url: string | null;             // optional; falls back to parent image_url
}
```

- [ ] **Step 2: Extend `RentalItemSizeFormData`**

Replace the `RentalItemSizeFormData` interface (currently lines 186-190) with:

```ts
export interface RentalItemSizeFormData {
  rental_item_id: string;
  size_label: string;
  display_order?: number;
  daily_rate?: number | null;
  default_hourly_rate?: number | null;
  image_url?: string | null;
}
```

- [ ] **Step 3: Extend `RentalOrderItem`**

In the `RentalOrderItem` interface (currently lines 244-262), add the two new columns just before `created_at`:

```ts
  rental_item_size_id: string | null;
  size_label_snapshot: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Extend `RentalOrderItemFormData`**

In the `RentalOrderItemFormData` interface (currently lines 445-456), add at the bottom (before the closing brace):

```ts
  rental_item_size_id?: string | null;
  size_label_snapshot?: string | null;
}
```

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: passes with no errors. If errors appear in files we haven't touched yet (e.g. `useRentals.ts` complaining the new fields are missing in a select), note them — they'll be fixed in Task 4.

- [ ] **Step 6: Commit**

```
git add src/types/rental.types.ts
git commit -m "feat(rentals): types for variant rate, photo, and order-item size linkage"
```

---

## Task 3: `resolveVariantRate()` helper + unit tests

**Files:**
- Modify: `src/lib/utils/rentalCatalogUtils.ts`
- Modify: `src/lib/utils/__tests__/rentalCatalogUtils.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/utils/__tests__/rentalCatalogUtils.test.ts` (after existing `describe` blocks):

```ts
import { resolveVariantRate } from "../rentalCatalogUtils";
import type {
  RentalItem,
  RentalItemSize,
  RentalStoreInventoryWithDetails,
} from "@/types/rental.types";

const makeItem = (overrides: Partial<RentalItem> = {}): RentalItem => ({
  id: "item-1",
  name: "Roof Sheet",
  code: null,
  local_name: null,
  category_id: null,
  description: null,
  rental_type: "scaffolding",
  source_type: "store",
  rate_type: "daily",
  unit: "piece",
  specifications: null,
  default_daily_rate: 5,
  image_url: null,
  is_active: true,
  created_at: "",
  updated_at: "",
  created_by: null,
  ...overrides,
});

const makeVariant = (overrides: Partial<RentalItemSize> = {}): RentalItemSize => ({
  id: "size-1",
  rental_item_id: "item-1",
  size_label: "3×2",
  display_order: 0,
  is_active: true,
  created_at: "",
  daily_rate: 2,
  default_hourly_rate: null,
  image_url: null,
  ...overrides,
});

describe("resolveVariantRate", () => {
  it("uses vendor size_rates override when present", () => {
    const item = makeItem();
    const variant = makeVariant({ size_label: "3×2", daily_rate: 2 });
    const vendorInv = {
      id: "inv-1",
      vendor_id: "v1",
      rental_item_id: "item-1",
      daily_rate: 10,
      size_rates: { "3×2": 4 },
    } as RentalStoreInventoryWithDetails;
    expect(resolveVariantRate(item, variant, vendorInv)).toBe(4);
  });

  it("falls back to variant.daily_rate when vendor has no size override", () => {
    const item = makeItem();
    const variant = makeVariant({ daily_rate: 2 });
    const vendorInv = {
      id: "inv-1",
      vendor_id: "v1",
      rental_item_id: "item-1",
      daily_rate: 10,
      size_rates: { "different-size": 4 },
    } as RentalStoreInventoryWithDetails;
    expect(resolveVariantRate(item, variant, vendorInv)).toBe(2);
  });

  it("falls back to parent default_daily_rate when variant has no rate", () => {
    const item = makeItem({ default_daily_rate: 5 });
    const variant = makeVariant({ daily_rate: null });
    expect(resolveVariantRate(item, variant, null)).toBe(5);
  });

  it("uses parent default when no variant is picked", () => {
    const item = makeItem({ default_daily_rate: 7 });
    expect(resolveVariantRate(item, null, null)).toBe(7);
  });

  it("returns 0 when nothing is set anywhere", () => {
    const item = makeItem({ default_daily_rate: null });
    const variant = makeVariant({ daily_rate: null });
    expect(resolveVariantRate(item, variant, null)).toBe(0);
  });

  it("prefers variant.default_hourly_rate when parent rate_type is hourly", () => {
    const item = makeItem({ rate_type: "hourly", default_daily_rate: 1 });
    const variant = makeVariant({ daily_rate: 2, default_hourly_rate: 9 });
    expect(resolveVariantRate(item, variant, null)).toBe(9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/__tests__/rentalCatalogUtils.test.ts`
Expected: FAIL — `resolveVariantRate is not a function` (the import line fails).

- [ ] **Step 3: Implement `resolveVariantRate`**

Append to `src/lib/utils/rentalCatalogUtils.ts`:

```ts
import type {
  RentalItem,
  RentalItemSize,
} from "@/types/rental.types";

/**
 * Daily/hourly rate for an order line. Priority:
 *   1. vendor size_rates[label] (existing override)
 *   2. variant default (daily_rate or default_hourly_rate based on parent rate_type)
 *   3. parent default_daily_rate
 *   4. 0
 */
export function resolveVariantRate(
  parent: Pick<RentalItem, "default_daily_rate" | "rate_type">,
  variant: RentalItemSize | null,
  vendorInventory: RentalStoreInventoryWithDetails | null
): number {
  const isHourly = parent.rate_type === "hourly";

  if (variant && vendorInventory?.size_rates) {
    const override = vendorInventory.size_rates[variant.size_label];
    if (typeof override === "number") return override;
  }

  if (variant) {
    const variantRate = isHourly ? variant.default_hourly_rate : variant.daily_rate;
    if (typeof variantRate === "number") return variantRate;
  }

  return parent.default_daily_rate ?? 0;
}
```

Note: `RentalItem` and `RentalItemSize` need to be added to the existing import on line 1. Replace the existing import with:

```ts
import type {
  RentalItem,
  RentalItemSize,
  RentalStoreInventoryWithDetails,
  EstimateBasketItem,
  VendorEstimate,
} from "@/types/rental.types";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/utils/__tests__/rentalCatalogUtils.test.ts`
Expected: all 6 new tests in the `resolveVariantRate` describe block PASS. Existing tests still pass.

- [ ] **Step 5: Commit**

```
git add src/lib/utils/rentalCatalogUtils.ts src/lib/utils/__tests__/rentalCatalogUtils.test.ts
git commit -m "feat(rentals): resolveVariantRate helper with priority chain"
```

---

## Task 4: Hook updates — fetch new columns, add update/delete size hooks, pass through size on inserts

**Files:**
- Modify: `src/hooks/queries/useRentals.ts` — sections at lines 173-180 (item select), 1817-1839 (`useCreateRentalItemSize`), 1771-1791 (`useRentalItemSizes`), 877-890 (`useCreateRentalOrder` items insert), 1871-1900 (`useCreateRentalRequest`)

- [ ] **Step 1: Extend item-with-sizes select**

In `src/hooks/queries/useRentals.ts` around line 176, change:

```ts
          sizes:rental_item_sizes(id, size_label, display_order, is_active),
```

to:

```ts
          sizes:rental_item_sizes(id, size_label, display_order, is_active, daily_rate, default_hourly_rate, image_url),
```

- [ ] **Step 2: Extend `useRentalItemSizes` to return new fields by default**

The existing `useRentalItemSizes` (around lines 1771-1791) uses `select("*")` so it already returns the new columns. No code change needed; verify by re-reading lines 1772-1791 to confirm.

- [ ] **Step 3: Add `useUpdateRentalItemSize` and `useDeleteRentalItemSize`**

Insert after `useCreateRentalItemSize` (after line 1839 / before `useUpdateStoreInventorySizeRates`):

```ts
export function useUpdateRentalItemSize() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, rental_item_id, data }: { id: string; rental_item_id: string; data: Partial<RentalItemSizeFormData> }) => {
      await ensureFreshSession();

      const { data: result, error } = await (supabase as any)
        .from("rental_item_sizes")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return result as RentalItemSize;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: rentalQueryKeys.items.sizes(vars.rental_item_id),
      });
      queryClient.invalidateQueries({ queryKey: rentalQueryKeys.items.list() });
    },
  });
}

export function useDeleteRentalItemSize() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, rental_item_id }: { id: string; rental_item_id: string }) => {
      await ensureFreshSession();

      // Check if any order_items reference this size
      const { count, error: refErr } = await (supabase as any)
        .from("rental_order_items")
        .select("id", { count: "exact", head: true })
        .eq("rental_item_size_id", id);
      if (refErr) throw refErr;

      if ((count ?? 0) > 0) {
        // Soft-disable to preserve history
        const { error } = await (supabase as any)
          .from("rental_item_sizes")
          .update({ is_active: false })
          .eq("id", id);
        if (error) throw error;
        return { soft: true as const };
      }

      // Hard delete when unreferenced
      const { error } = await (supabase as any)
        .from("rental_item_sizes")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return { soft: false as const };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: rentalQueryKeys.items.sizes(vars.rental_item_id),
      });
      queryClient.invalidateQueries({ queryKey: rentalQueryKeys.items.list() });
    },
  });
}
```

- [ ] **Step 4: Pass size fields through `useCreateRentalOrder` items insert**

In the `useCreateRentalOrder` mutation around line 877, the existing code spreads `...item` from `RentalOrderItemFormData` so the new optional fields (`rental_item_size_id`, `size_label_snapshot`) flow through automatically. No code change needed — verify by re-reading lines 877-890.

- [ ] **Step 5: Pass size fields through `useCreateRentalRequest`**

In the `useCreateRentalRequest` mutation (starts around line 1866), the signature is currently:

```ts
mutationFn: async (data: { site_id: string; order_date: string; start_date: string; estimated_days: number; notes?: string; items: Array<{ rental_item_id: string; quantity: number; daily_rate_default: number; daily_rate_actual: number; rate_type: "daily" | "weekly" | "monthly" | "hourly" }> }) => {
```

Extend the items shape to include the two optional fields:

```ts
mutationFn: async (data: { site_id: string; order_date: string; start_date: string; estimated_days: number; notes?: string; items: Array<{ rental_item_id: string; quantity: number; daily_rate_default: number; daily_rate_actual: number; rate_type: "daily" | "weekly" | "monthly" | "hourly"; rental_item_size_id?: string | null; size_label_snapshot?: string | null }> }) => {
```

The insert path that consumes `items` already spreads each item into the row, so the new fields will reach `rental_order_items` automatically. Re-read lines 1880-1900 to confirm the insert spreads `...item`.

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 7: Commit**

```
git add src/hooks/queries/useRentals.ts
git commit -m "feat(rentals): hooks for variant update/delete; size linkage in order/request inserts"
```

---

## Task 5: Catalog dialog — variant section visible on create + edit, with rate + photo + delete

**Files:**
- Modify: `src/components/rentals/RentalItemDialog.tsx`

- [ ] **Step 1: Replace local variant state with a single staging array**

In `src/components/rentals/RentalItemDialog.tsx`, replace the existing state block (around lines 80-95) so the dialog tracks pending variant rows for both new and edit modes. Replace:

```tsx
  const { data: existingSizes = [] } = useRentalItemSizes(item?.id);
  const createSize = useCreateRentalItemSize();

  const [error, setError] = useState("");
  const [newSizeLabel, setNewSizeLabel] = useState("");
```

with:

```tsx
  const { data: existingSizes = [] } = useRentalItemSizes(item?.id);
  const createSize = useCreateRentalItemSize();
  const updateSize = useUpdateRentalItemSize();
  const deleteSize = useDeleteRentalItemSize();

  const [error, setError] = useState("");

  // Variant staging — for both new and edit. Each entry has either `id` (persisted) or `tempId` (pending).
  type VariantRow = {
    id?: string;
    tempId?: string;
    size_label: string;
    daily_rate: number | "";
    default_hourly_rate: number | "";
    image_url: string;
    is_active: boolean;
    _dirty?: boolean;       // for edits — needs UPDATE on save
    _new?: boolean;         // for new rows — needs INSERT on save
  };
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [newRow, setNewRow] = useState<{ size_label: string; daily_rate: string }>({ size_label: "", daily_rate: "" });
```

Add the new imports at the top of the file (alongside the existing `useRentals` imports):

```tsx
import {
  useCreateRentalItem,
  useUpdateRentalItem,
  useRentalCategories,
  useRentalItemSizes,
  useCreateRentalItemSize,
  useUpdateRentalItemSize,
  useDeleteRentalItemSize,
} from "@/hooks/queries/useRentals";
```

- [ ] **Step 2: Sync variants state from server data on edit**

Replace the `useEffect` that resets form data (around lines 97-130). The new effect must also seed `variants` from `existingSizes` when editing, and clear it on create:

```tsx
  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        code: item.code || "",
        local_name: item.local_name || "",
        category_id: item.category_id || "",
        description: item.description || "",
        rental_type: item.rental_type,
        source_type: item.source_type || "store",
        rate_type: item.rate_type || "daily",
        unit: item.unit,
        specifications: item.specifications || {},
        default_daily_rate: item.default_daily_rate || undefined,
        image_url: item.image_url || "",
      });
    } else {
      setFormData({
        name: "",
        code: "",
        local_name: "",
        category_id: "",
        description: "",
        rental_type: "scaffolding",
        source_type: "store",
        rate_type: "daily",
        unit: "piece",
        specifications: {},
        default_daily_rate: undefined,
        image_url: "",
      });
    }
    setError("");
    setNewRow({ size_label: "", daily_rate: "" });
    // Defer variants seeding until existingSizes loads
  }, [item, open]);

  useEffect(() => {
    if (item && existingSizes.length > 0) {
      setVariants(
        existingSizes.map((s) => ({
          id: s.id,
          size_label: s.size_label,
          daily_rate: s.daily_rate ?? "",
          default_hourly_rate: s.default_hourly_rate ?? "",
          image_url: s.image_url ?? "",
          is_active: s.is_active,
        }))
      );
    } else if (!item) {
      setVariants([]);
    }
  }, [item, existingSizes]);
```

- [ ] **Step 3: Replace the existing `handleAddSize` with staging-aware handlers**

Delete `handleAddSize` (around lines 137-145) and replace with:

```tsx
  const handleAddVariant = () => {
    const label = newRow.size_label.trim();
    if (!label) return;
    if (variants.some((v) => v.size_label === label)) {
      setError(`Variant "${label}" already exists`);
      return;
    }
    const rate = newRow.daily_rate.trim() === "" ? "" : parseFloat(newRow.daily_rate);
    setVariants((prev) => [
      ...prev,
      {
        tempId: `tmp-${Date.now()}`,
        size_label: label,
        daily_rate: rate === "" || Number.isNaN(rate as number) ? "" : (rate as number),
        default_hourly_rate: "",
        image_url: "",
        is_active: true,
        _new: true,
      },
    ]);
    setNewRow({ size_label: "", daily_rate: "" });
  };

  const updateVariant = (key: string, patch: Partial<VariantRow>) => {
    setVariants((prev) =>
      prev.map((v) => {
        const k = v.id ?? v.tempId;
        if (k !== key) return v;
        return { ...v, ...patch, _dirty: v.id ? true : v._dirty };
      })
    );
  };

  const removeVariant = async (row: VariantRow) => {
    if (row.id && item) {
      await deleteSize.mutateAsync({ id: row.id, rental_item_id: item.id });
    }
    setVariants((prev) => prev.filter((v) => (v.id ?? v.tempId) !== (row.id ?? row.tempId)));
  };
```

- [ ] **Step 4: Persist variants after parent save in `handleSubmit`**

Replace the existing `handleSubmit` (around lines 147-164):

```tsx
  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      let parentId: string;
      if (isEdit && item) {
        await updateItem.mutateAsync({ id: item.id, data: formData });
        parentId = item.id;
      } else {
        const created = await createItem.mutateAsync(formData);
        parentId = created.id;
      }

      // Persist variant changes
      for (const v of variants) {
        const payload = {
          daily_rate: v.daily_rate === "" ? null : Number(v.daily_rate),
          default_hourly_rate: v.default_hourly_rate === "" ? null : Number(v.default_hourly_rate),
          image_url: v.image_url || null,
        };
        if (v._new) {
          await createSize.mutateAsync({
            rental_item_id: parentId,
            size_label: v.size_label,
            display_order: 0,
            ...payload,
          });
        } else if (v.id && v._dirty) {
          await updateSize.mutateAsync({
            id: v.id,
            rental_item_id: parentId,
            data: { size_label: v.size_label, ...payload },
          });
        }
      }

      onClose();
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Failed to save rental item");
    }
  };
```

`createItem.mutateAsync(formData)` must return the inserted row. Verify by reading `useCreateRentalItem` in `useRentals.ts` — if it does not return `{ id }`, fix it there to `.select().single()` before continuing this task.

- [ ] **Step 5: Replace the variant chip section with an editable rows table**

Replace the variant block (currently `{item?.id && ( ... )}` around lines 363-392). The new block is shown on both create and edit. Replace it with:

```tsx
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Size Variants
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Each variant has its own rate and optional photo. The parent rate above is used when no variant is picked on an order.
          </Typography>

          {variants.length > 0 && (
            <Stack spacing={1} sx={{ mb: 1 }}>
              {variants.map((v) => {
                const key = v.id ?? v.tempId!;
                return (
                  <Box
                    key={key}
                    sx={{
                      p: 1,
                      bgcolor: "grey.50",
                      borderRadius: 1,
                      display: "flex",
                      gap: 1,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <TextField
                      size="small"
                      label="Size"
                      value={v.size_label}
                      onChange={(e) => updateVariant(key, { size_label: e.target.value })}
                      sx={{ flex: "1 1 120px" }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label={formData.rate_type === "hourly" ? "₹/hr" : "₹/day"}
                      value={
                        formData.rate_type === "hourly"
                          ? (v.default_hourly_rate as number | "")
                          : (v.daily_rate as number | "")
                      }
                      onChange={(e) => {
                        const num = e.target.value === "" ? "" : parseFloat(e.target.value);
                        if (formData.rate_type === "hourly") {
                          updateVariant(key, { default_hourly_rate: num as number | "" });
                        } else {
                          updateVariant(key, { daily_rate: num as number | "" });
                        }
                      }}
                      sx={{ width: 110 }}
                    />
                    <Box sx={{ width: 64 }}>
                      <ImageUploadWithCrop
                        supabase={supabase}
                        bucketName="rental-items"
                        folderPath="variant-photos"
                        fileNamePrefix={`variant-${key}`}
                        value={v.image_url || null}
                        onChange={(url) => updateVariant(key, { image_url: url || "" })}
                        disabled={isLoading}
                        label=""
                        aspectRatio={1}
                        maxSizeKB={300}
                        cropShape="rect"
                      />
                    </Box>
                    <IconButton size="small" color="error" onClick={() => removeVariant(v)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                );
              })}
            </Stack>
          )}

          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              size="small"
              label='Size (e.g. 3×2)'
              value={newRow.size_label}
              onChange={(e) => setNewRow((r) => ({ ...r, size_label: e.target.value }))}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              type="number"
              label={formData.rate_type === "hourly" ? "₹/hr" : "₹/day"}
              value={newRow.daily_rate}
              onChange={(e) => setNewRow((r) => ({ ...r, daily_rate: e.target.value }))}
              sx={{ width: 110 }}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={handleAddVariant}
              disabled={!newRow.size_label.trim()}
            >
              Add
            </Button>
          </Box>
        </Box>
```

- [ ] **Step 6: Update parent rate helper text**

Find the parent default rate TextField (around lines 329-348). Add a `helperText` prop so the field's role is clearer:

```tsx
              helperText="Used when an order line doesn't pick a variant"
```

(Add it inside the TextField props, alongside `placeholder="0"`.)

- [ ] **Step 7: Manual verify in dev**

Run: `npm run dev`
- Open `http://localhost:3000/dev-login` (auto-login), navigate to `/company/rentals`
- Click "Add Rental Item" → fill name "Roof Sheet TEST", set rate type Daily, default rate 5
- Before saving, in Size Variants add `3×2` @ ₹2 and `3×1½` @ ₹3 → Save
- Reopen the item → both variants visible with rates → upload a photo on one variant → Save → reopen → photo persisted
- Delete a variant → confirm it disappears
- Take a screenshot via Playwright MCP and read console for errors

Expected: variant rows persist with rate + photo; no console errors.

- [ ] **Step 8: Commit**

```
git add src/components/rentals/RentalItemDialog.tsx
git commit -m "feat(rentals): variant editor with rate + photo on catalog dialog"
```

---

## Task 6: Order dialog — variant picker required when item has variants, auto-fill rate

**Files:**
- Modify: `src/components/rentals/RentalOrderDialog.tsx`

- [ ] **Step 1: Track selected variant state**

In `src/components/rentals/RentalOrderDialog.tsx`, alongside the existing `selectedItem`/`itemQuantity`/`itemRate`/`itemHours` state (around lines 99-103), add:

```tsx
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
```

In the `useEffect` that resets form fields when `open` changes (around lines 105-125), also reset `setSelectedSizeId(null)` alongside `setSelectedItem(null)`.

- [ ] **Step 2: Derive variants for the currently picked item**

After the state declarations (around line 104), add:

```tsx
  const itemVariants = useMemo(() => {
    if (!selectedItem) return [];
    return ((selectedItem as RentalItemWithDetails).sizes ?? []).filter((s) => s.is_active);
  }, [selectedItem]);

  const selectedVariant = useMemo(
    () => itemVariants.find((v) => v.id === selectedSizeId) ?? null,
    [itemVariants, selectedSizeId]
  );
```

- [ ] **Step 3: Replace the rate-prefill effect to use `resolveVariantRate`**

Replace the existing rate-prefill `useEffect` (currently around lines 128-139) with:

```tsx
  useEffect(() => {
    if (!selectedItem) {
      setItemRate(0);
      return;
    }
    const vendorInv =
      (selectedVendor &&
        vendorInventory.find((inv) => inv.rental_item_id === selectedItem.id)) ||
      null;
    const rate = resolveVariantRate(selectedItem, selectedVariant, vendorInv ?? null);
    setItemRate(rate);
  }, [selectedItem, selectedVendor, vendorInventory, selectedVariant]);
```

Add the helper import at the top of the file:

```tsx
import { resolveVariantRate } from "@/lib/utils/rentalCatalogUtils";
```

- [ ] **Step 4: Reset selected variant when item changes**

In the existing `Autocomplete onChange` for `selectedItem` (around line 417), update:

```tsx
              onChange={(_, value) => { setSelectedItem(value); setSelectedSizeId(null); }}
```

- [ ] **Step 5: Render a variant picker when the item has variants**

After the item `Autocomplete` Grid (so visually between item search and qty), insert a new conditional Grid (around line 427, right before the Qty Grid):

```tsx
          {itemVariants.length > 0 && (
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Variant</InputLabel>
                <Select
                  value={selectedSizeId ?? ""}
                  label="Variant"
                  onChange={(e) => setSelectedSizeId((e.target.value as string) || null)}
                >
                  {itemVariants.map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      {v.size_label}
                      {v.daily_rate != null && ` (₹${v.daily_rate}/${selectedItem?.rate_type === "hourly" ? "hr" : "day"})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
```

- [ ] **Step 6: Block `handleAddItem` until variant is chosen, and persist it on the line**

Replace the existing `handleAddItem` (lines 141-195) with:

```tsx
  const handleAddItem = () => {
    if (!selectedItem) {
      setError("Please select an item");
      return;
    }
    if (itemVariants.length > 0 && !selectedVariant) {
      setError("Please select a variant");
      return;
    }
    if (itemQuantity <= 0) {
      setError("Quantity must be greater than 0");
      return;
    }
    if (itemRate <= 0) {
      setError("Rate must be greater than 0");
      return;
    }

    // Each (item, variant) pair is its own line — don't merge across variants.
    const existingIndex = lineItems.findIndex(
      (li) =>
        li.rental_item_id === selectedItem.id &&
        (li.rental_item_size_id ?? null) === (selectedVariant?.id ?? null)
    );

    if (existingIndex >= 0) {
      setLineItems((prev) =>
        prev.map((li, i) =>
          i === existingIndex ? { ...li, quantity: li.quantity + itemQuantity } : li
        )
      );
    } else {
      const isHourly = selectedItem.rate_type === "hourly";
      const newItem: OrderLineItem = {
        tempId: `temp-${Date.now()}`,
        rental_item_id: selectedItem.id,
        itemName: selectedItem.name,
        itemRateType: selectedItem.rate_type || "daily",
        quantity: itemQuantity,
        daily_rate_default: itemRate,
        daily_rate_actual: itemRate,
        rate_type: selectedItem.rate_type || "daily",
        hours_used: isHourly ? itemHours : undefined,
        rental_item_size_id: selectedVariant?.id ?? null,
        size_label_snapshot: selectedVariant?.size_label ?? null,
      };
      setLineItems((prev) => [...prev, newItem]);
    }

    setSelectedItem(null);
    setSelectedSizeId(null);
    setItemQuantity(1);
    setItemRate(0);
    setItemHours(8);
    setError("");
  };
```

- [ ] **Step 7: Pass new fields through to insert**

In the existing `handleSubmit` (around line 278), the `items.map` already passes the spread of `OrderLineItem` fields, but it explicitly enumerates them. Replace the `items: lineItems.map(...)` block (around lines 278-285) with:

```tsx
        items: lineItems.map((li) => ({
          rental_item_id: li.rental_item_id,
          quantity: li.quantity,
          daily_rate_default: li.daily_rate_default,
          daily_rate_actual: li.daily_rate_actual,
          rate_type: li.rate_type,
          hours_used: li.hours_used,
          rental_item_size_id: li.rental_item_size_id ?? undefined,
          size_label_snapshot: li.size_label_snapshot ?? undefined,
        })),
```

- [ ] **Step 8: Show variant label in the line items table**

Find the `<TableCell>` for the item name (around line 507):

```tsx
                          <TableCell>
                            {li.itemName}
                            {isHourly && (
                              <Chip label="Hourly" size="small" sx={{ ml: 1 }} />
                            )}
                          </TableCell>
```

Replace with:

```tsx
                          <TableCell>
                            {li.itemName}
                            {li.size_label_snapshot && (
                              <Chip
                                label={li.size_label_snapshot}
                                size="small"
                                sx={{ ml: 1 }}
                                variant="outlined"
                              />
                            )}
                            {isHourly && (
                              <Chip label="Hourly" size="small" sx={{ ml: 1 }} />
                            )}
                          </TableCell>
```

- [ ] **Step 9: Type check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 10: Manual verify**

`npm run dev`, open `/site/rentals`, create a new rental order for the test "Roof Sheet" item created earlier. Picking it should reveal the Variant select. Picking `3×2` should auto-fill ₹2/day; switching to `3×1½` should auto-fill ₹3/day. Add both variants to the same order → they appear as two separate rows with the size chip. Click Create. Open the new order — both rows still show their variant chip. Take a Playwright screenshot. Read browser console for errors.

Expected: variant required, rate auto-fills, each variant is its own line, no console errors.

- [ ] **Step 11: Commit**

```
git add src/components/rentals/RentalOrderDialog.tsx
git commit -m "feat(rentals): variant picker on order create — rate auto-fills, line per variant"
```

---

## Task 7: Carry variants through request form + show in cost displays

**Files:**
- Modify: `src/components/rentals/RentalRequestForm.tsx`
- Modify: `src/components/rentals/RentalCostBreakdown.tsx`
- Modify: `src/components/rentals/RentalOrderCard.tsx`

- [ ] **Step 1: Carry size through `RentalRequestForm`**

In `src/components/rentals/RentalRequestForm.tsx`, change the `RequestItem` interface (line 20-25) to also carry the size id. Replace it with:

```tsx
interface RequestItem {
  rental_item_id: string;
  rental_item_name: string;
  size_label: string | null;
  rental_item_size_id: string | null;
  quantity: number;
}
```

In the prefill block (around lines 44-51), update to:

```tsx
  const [items, setItems] = useState<RequestItem[]>(() =>
    prefillItems.map((i) => ({
      rental_item_id: i.rental_item_id,
      rental_item_name: i.rental_item_name,
      size_label: i.size_label,
      rental_item_size_id: (i as EstimateBasketItem & { rental_item_size_id?: string | null }).rental_item_size_id ?? null,
      quantity: i.quantity,
    }))
  );
```

In `handleSubmit` (around lines 62-77), pass the size through to the request payload:

```tsx
  const handleSubmit = async () => {
    await createRequest.mutateAsync({
      site_id: siteId,
      order_date: startDate,
      start_date: startDate,
      estimated_days: estimatedDays,
      notes,
      items: items.map((item) => ({
        rental_item_id: item.rental_item_id,
        quantity: item.quantity,
        daily_rate_default: 0,
        daily_rate_actual: 0,
        rate_type: "daily" as const,
        rental_item_size_id: item.rental_item_size_id,
        size_label_snapshot: item.size_label,
      })),
    });
    onSuccess?.();
    onClose();
  };
```

- [ ] **Step 2: Add `rental_item_size_id` to `EstimateBasketItem`**

In `src/types/rental.types.ts` around line 610, extend the `EstimateBasketItem` interface:

```ts
export interface EstimateBasketItem {
  id: string;
  rental_item_id: string;
  rental_item_name: string;
  size_label: string | null;
  rental_item_size_id: string | null;  // populated when a variant was picked
  quantity: number;
  days: number;
}
```

Then update the basket producers (where `EstimateBasketItem`s are created) to include the new field. Find the callsite in `src/components/rentals/RentalItemInspectPane.tsx` around line 84 (`addItem({ ... })`) and change to:

```tsx
    addItem({
      rental_item_id: itemId,
      rental_item_name: itemName,
      size_label: effectiveSize,
      rental_item_size_id: sizes.find((s) => s.size_label === effectiveSize)?.id ?? null,
      quantity: qty,
      days,
    });
```

Then `npx tsc --noEmit` to find any other callsite (e.g. `EstimateBasket.tsx`) that constructs `EstimateBasketItem` and add `rental_item_size_id: null` (or the right value) to fix the type error. Fix each one until type check passes.

- [ ] **Step 3: Show variant chip in `RentalCostBreakdown`**

Open `src/components/rentals/RentalCostBreakdown.tsx` and find where each item's name is rendered. Add `{li.size_label_snapshot && <Chip label={li.size_label_snapshot} size="small" variant="outlined" sx={{ ml: 1 }} />}` next to the item name, mirroring the approach in Task 6 Step 8. Use `Read` to inspect the file first to find the exact JSX line, since the file structure isn't reproduced in this plan. Apply the change there.

- [ ] **Step 4: Show variant chip in `RentalOrderCard`**

Open `src/components/rentals/RentalOrderCard.tsx`. Find the loop or render block that lists order items and render the variant snapshot beside the item name, same Chip pattern as Step 3.

- [ ] **Step 5: Type check + manual verify**

Run: `npx tsc --noEmit`
Expected: passes.

Then `npm run dev`, open `/site/rentals/<the order created in Task 6>`, confirm the cost breakdown and order card both show the variant label.

- [ ] **Step 6: Commit**

```
git add src/components/rentals/RentalRequestForm.tsx src/components/rentals/RentalCostBreakdown.tsx src/components/rentals/RentalOrderCard.tsx src/components/rentals/RentalItemInspectPane.tsx src/components/rentals/EstimateBasket.tsx src/types/rental.types.ts
git commit -m "feat(rentals): display variant label on cost breakdown + order card; carry variant id through request form"
```

(If any of those files were not actually modified, drop them from `git add`.)

---

## Task 8: End-to-end verification

**Files:** none modified

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build completes with no errors. If any TS/lint errors surface, fix before continuing.

- [ ] **Step 2: Run all unit tests**

Run: `npx vitest run`
Expected: all tests pass, including the new `resolveVariantRate` tests from Task 3 and existing `rentalCatalogUtils` tests.

- [ ] **Step 3: Playwright walkthrough**

With dev server running, use Playwright MCP:
1. Navigate to `http://localhost:3000/dev-login` (auto-login).
2. Go to `/company/rentals`. Open the "Roof Sheet TEST" item from Task 5 → verify both variants exist with their rates and photos.
3. Go to `/site/rentals`. Create a new rental order for any test site, pick the "Roof Sheet TEST" item, pick the `3×2` variant → verify rate auto-fills to ₹2/day. Add the `3×1½` variant → verify it appears as a second line with ₹3/day.
4. Submit the order. Open the new order's detail page. Confirm both rows show their size chip.
5. Take a final screenshot. Read browser console — must have zero errors and zero warnings.
6. Close the Playwright browser.

- [ ] **Step 4: Confirm production-readiness summary**

Report back to the user:
- All tasks completed and committed.
- `npm run build` passed.
- All unit tests passed.
- Playwright walkthrough succeeded, no console errors.
- Awaiting "move to prod" instruction.

---

## Self-Review Notes (post-write)

- Spec coverage: ✅ migration (Task 1), types (Task 2), rate helper (Task 3), hooks (Task 4), catalog UI on create+edit with photo (Task 5), order picker (Task 6), display + request flow (Task 7), verification (Task 8). No spec requirement is unmapped.
- Placeholder scan: No "TBD"/"TODO" — every step contains actual code or exact commands. Two callouts use `Read` for files not fully reproduced (`RentalCostBreakdown.tsx`, `RentalOrderCard.tsx`) but provide explicit instructions on what to render and where, plus the Chip pattern is repeated inline so engineer doesn't have to scroll back.
- Type consistency: `resolveVariantRate(parent, variant, vendorInventory)` signature consistent between Tasks 3 and 6. `RentalItemSizeFormData` extension in Task 2 matches what's passed into `useCreateRentalItemSize`/`useUpdateRentalItemSize` in Task 4 and Task 5. `OrderLineItem` extends `RentalOrderItemFormData`, so adding `rental_item_size_id?` + `size_label_snapshot?` there in Task 2 is what makes the Task 6 assignments compile.
