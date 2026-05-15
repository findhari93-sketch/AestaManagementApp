# Rental Material Variants — Design

**Date:** 2026-05-15
**Status:** Draft, pending implementation
**Touches:** `/company/rentals`, `/site/rentals`, `rental_item_sizes`, `rental_order_items`

## Problem

On `/company/rentals`, a material like "Roof Sheet" has only a single daily rate and a single photo. In practice, the same material is rented in multiple sizes with different rates (3×2 sheet @ ₹2/day, 3×1½ sheet @ ₹3/day). Today there is no way to:

1. Configure per-size rates on the catalog (rates only live per-vendor in `rental_store_inventory.size_rates`).
2. Attach a per-size photo (optional override; falls back to parent).
3. Persist the chosen variant on a rental order so the rate auto-fills and history is accurate.

`rental_item_sizes` exists but stores only labels + display order. The order line table `rental_order_items` has no size column at all — size is tracked client-side in the Estimate Basket and lost on save.

## Goals

- Per-variant **default daily rate** at the catalog level.
- Per-variant **optional photo**, falling back to the parent material's photo.
- Variant picker in rental order creation that **auto-fills the rate** and **persists the variant** on the order line.
- Parent `default_daily_rate` and per-vendor `size_rates` continue to work as fallbacks/overrides.

## Non-goals

- No bulk variant import.
- No per-variant inventory/stock tracking. Quantity remains at the material level.
- `HistoricalRentalDialog` untouched — backdated entries keep using free-text `item_name`.

## Data Model

### `rental_item_sizes` — extend

```sql
ALTER TABLE rental_item_sizes
  ADD COLUMN daily_rate NUMERIC,            -- nullable; catalog default rate for this variant
  ADD COLUMN default_hourly_rate NUMERIC,   -- nullable; used when parent rate_type = 'hourly'
  ADD COLUMN image_url TEXT;                -- nullable; falls back to parent rental_items.image_url
```

All new columns nullable so existing variant rows keep working untouched.

### `rental_order_items` — extend

```sql
ALTER TABLE rental_order_items
  ADD COLUMN rental_item_size_id UUID REFERENCES rental_item_sizes(id),
  ADD COLUMN size_label_snapshot TEXT;      -- captured at order time; survives rename/delete of variant
```

Both nullable. Materials with no variants keep storing NULL in both columns and behave exactly as today.

### Rate resolution

When a user picks a variant on a rental order line, the resolved daily rate is computed in priority order:

1. Vendor override — `rental_store_inventory.size_rates[size_label]` for the selected vendor.
2. Variant catalog default — `rental_item_sizes.daily_rate` (or `default_hourly_rate` when parent `rate_type = 'hourly'`).
3. Parent material default — `rental_items.default_daily_rate`.
4. User edit — the resolved value lands in `daily_rate_actual` on the order line, which remains editable per existing UX.

A single helper `resolveVariantRate(item, variant, vendorInventory)` in [src/lib/services/rentalService.ts](src/lib/services/rentalService.ts) is the only source of truth for this chain. Both the picker UI and the order-insert path call it.

## UI Changes

### Catalog — `/company/rentals` → `RentalItemDialog`

Today (`src/components/rentals/RentalItemDialog.tsx:363-392`):
- The Size Variants section renders **only after** the parent item is saved (`item?.id` gate).
- Each variant is a chip showing the label. No rate, no photo, no delete.

Redesign:
- Section visible on **create and edit**. On create, variants are collected locally and persisted **after** the parent row insert in the same submit transaction.
- Each variant row shows: label, daily rate input (or hourly when parent is hourly), photo thumbnail with `ImageUploadWithCrop` (bucket `rental-items`, folder `variant-photos/`), delete button.
- Parent `default_daily_rate` field stays visible with helper text: *"Used when an order line doesn't pick a variant."*
- Add row UI: label + rate inline; photo optional and added after row is created.

### Order side — `/site/rentals` → variant picker

Today the size chip is only in the Estimate Basket (vendor comparison) and not persisted on the order item.

Changes:
- In the material → order flow, if a material has ≥1 active variants, the **Add to Order** action must show a variant picker. Submit is blocked until a variant is chosen. Materials without variants behave as today.
- The picker lists each variant with: photo (variant `image_url` or parent fallback), label, resolved daily rate from `resolveVariantRate`. User sees price before adding.
- On add, the order line is created with:
  - `rental_item_id` = parent material
  - `rental_item_size_id` = chosen variant id
  - `size_label_snapshot` = chosen variant label at this moment
  - `daily_rate_default` = resolved variant rate
  - `daily_rate_actual` = same (editable later)
- Order detail and `RentalCostBreakdown` display `"Roof Sheet — 3×2"` instead of `"Roof Sheet"` for variant rows.

## Types & Hooks

Extend in [src/types/rental.types.ts](src/types/rental.types.ts):

```ts
export interface RentalItemSize {
  // existing fields...
  daily_rate: number | null;
  default_hourly_rate: number | null;
  image_url: string | null;
}

export interface RentalItemSizeFormData {
  // existing fields...
  daily_rate?: number;
  default_hourly_rate?: number;
  image_url?: string;
}

export interface RentalOrderItem {
  // existing fields...
  rental_item_size_id: string | null;
  size_label_snapshot: string | null;
}

export interface RentalOrderItemFormData {
  // existing fields...
  rental_item_size_id?: string;
  size_label_snapshot?: string;
}
```

Hooks in [src/hooks/queries/useRentals.ts](src/hooks/queries/useRentals.ts):
- `useCreateRentalItemSize` — exists; extend payload.
- `useUpdateRentalItemSize` — new.
- `useDeleteRentalItemSize` — new. Soft-disable (set `is_active = false`) when the variant is referenced by any historical `rental_order_items.rental_item_size_id`. Hard-delete otherwise.

## Migration

Single migration `supabase/migrations/20260515*_rental_variants_rate_and_photo.sql`:

```sql
ALTER TABLE rental_item_sizes
  ADD COLUMN daily_rate NUMERIC,
  ADD COLUMN default_hourly_rate NUMERIC,
  ADD COLUMN image_url TEXT;

ALTER TABLE rental_order_items
  ADD COLUMN rental_item_size_id UUID REFERENCES rental_item_sizes(id),
  ADD COLUMN size_label_snapshot TEXT;

CREATE INDEX IF NOT EXISTS idx_rental_order_items_size
  ON rental_order_items(rental_item_size_id)
  WHERE rental_item_size_id IS NOT NULL;
```

No data backfill needed. Storage bucket `rental-items` is reused; new folder `variant-photos/` created on first upload.

## Files Affected

| File | Change |
|---|---|
| `supabase/migrations/20260515*_rental_variants_rate_and_photo.sql` | New migration |
| `src/types/rental.types.ts` | Extend `RentalItemSize`, `RentalItemSizeFormData`, `RentalOrderItem`, `RentalOrderItemFormData` |
| `src/hooks/queries/useRentals.ts` | New `useUpdateRentalItemSize`, `useDeleteRentalItemSize`; extend `useCreateRentalItemSize`; include new columns in selects |
| `src/lib/services/rentalService.ts` | New `resolveVariantRate(item, variant, vendorInventory)` |
| `src/components/rentals/RentalItemDialog.tsx` | Variant section visible on create + edit; per-variant rate input + photo upload + delete |
| `src/components/rentals/RentalItemSelector.tsx` | Variant picker step when material has variants |
| `src/components/rentals/RentalRequestForm.tsx` | Carry `rental_item_size_id` + snapshot through to insert |
| `src/components/rentals/EstimateBasket.tsx`, `EstimateBasketDrawer.tsx` | Use `resolveVariantRate` for displayed rate |
| `src/components/rentals/RentalCostBreakdown.tsx`, `RentalOrderCard.tsx` | Show `"<material> — <size_label_snapshot>"` for variant rows |

## Open Questions

None — all rate/photo/parent-rate decisions confirmed during brainstorming.

## Risks

- **Existing per-vendor `size_rates` JSON:** keeps working as the top-priority override. No migration of that data; if a vendor has a rate set, it wins.
- **Variant deletion mid-flight:** snapshotting `size_label` on the order line means renaming or soft-deleting a variant cannot corrupt historical orders. The reference id may become a dangling FK target if hard-deleted — `useDeleteRentalItemSize` blocks hard-delete when references exist (soft-disables instead).
- **Create-flow transaction:** if parent insert succeeds but variant inserts fail, user sees a partial state. Mitigation: surface the error and let user retry adding variants from edit mode; parent row already exists, so no data is lost.
