# Historical Rental Variants — Design

**Date:** 2026-05-15
**Status:** Draft, pending implementation
**Touches:** `HistoricalRentalDialog.tsx`, `useCreateHistoricalRental`, `useUpdateHistoricalRental`, `HistoricalRentalItemFormData`

## Problem

The Rental Material Variants feature (shipped earlier today, commits `bd6258f`..`8c1d296`) added per-variant rate + photo support and a variant picker in the regular order create flow (`RentalOrderDialog`). The historical/backfill dialog (`HistoricalRentalDialog`) was deliberately left out of that scope.

But historical records persist into the same `rental_order_items` table that already has `rental_item_size_id` + `size_label_snapshot` columns. So backfilled rentals can capture the variant — they just don't today, because the dialog has no variant picker. A site engineer entering "Roof Sheet rented in April" cannot mark which size; they're forced to either pick the parent material (loses the size) or type two free-text rows ("Roof Sheet 3×2" / "Roof Sheet 3×1½").

## Goals

- Variant picker in `HistoricalRentalDialog` row UI when the picked catalog item has 1+ active variants.
- Auto-fill `daily_rate` from variant default when a variant is chosen.
- Persist `rental_item_size_id` + `size_label_snapshot` on the inserted/updated `rental_order_items` row.
- Hydrate the variant selection on edit-mode load.

## Non-goals

- No backfill tooling to convert existing legacy free-text rows into catalog+variant rows.
- No required-variant enforcement. Historical entries can leave the variant column blank — backfill prioritises low friction.
- No change to read-side displays. `RentalCostBreakdown`, `RentalOrderCard`, and the order-dialog line table already render `size_label_snapshot` chips (Task 7 of the variants feature); historical records that store a snapshot will show the chip automatically.

## Data Model

**No DB migration needed.** Columns already exist:

- `rental_order_items.rental_item_size_id UUID REFERENCES rental_item_sizes(id)`
- `rental_order_items.size_label_snapshot TEXT`

Both nullable. The historical-items insert in `useCreateHistoricalRental` and the update path in `useUpdateHistoricalRental` will write to these columns when populated.

## Types

Extend `HistoricalRentalItemFormData` in [src/types/rental.types.ts](src/types/rental.types.ts):

```ts
export interface HistoricalRentalItemFormData {
  item_name: string;
  rental_item_id?: string | null;
  rental_item_size_id?: string | null;   // new — nullable: blank when no variant chosen or item has none
  size_label?: string | null;            // new — snapshot label, persisted as size_label_snapshot
  quantity: number;
  daily_rate: number;
  days: number;
}
```

The hook-internal type that `useUpdateHistoricalRental` uses to load existing items should mirror this shape.

## UX

Add a **"Variant"** column to the items table in `HistoricalRentalDialog`, positioned between **Item Name** and **Qty**.

For each row:

- If the row's `rental_item_id` resolves to a catalog item with 1+ active variants → render a `<Select size="small" variant="standard">` listing the variants by `size_label`. Empty placeholder reads "—" or "No variant". User may leave it blank.
- If the row has no `rental_item_id` (free-text mode) or the catalog item has zero variants → render a blank cell (no Select). Optional: render a dimmed "—" so the column visually aligns.
- On variant pick: set `rental_item_size_id` + `size_label` on the row, and auto-fill `daily_rate` via `resolveVariantRate(catalogItem, variant, null)`. Skip the auto-fill if the user has manually edited the rate (track a per-row `_rateEdited` flag — same pattern as the `Total Rental Amount` field already uses with `totalManuallyEdited`).
- On Item Name change (picking a different catalog item or back to free-text): reset `rental_item_size_id` + `size_label` to null.

Visual: the existing row already uses `variant="standard"` TextFields for compactness. The Variant Select should match (`variant="standard"`, `size="small"`, `minWidth: 80`). No icons or chips — just the label dropdown.

## Data flow

### Create path (`useCreateHistoricalRental`)

Inside the items insert map (around `useRentals.ts:2170-2189`), add two fields to the row object:

```ts
return {
  rental_order_id: order.id,
  rental_item_id: item.rental_item_id ?? null,
  rental_item_size_id: item.rental_item_size_id ?? null,
  size_label_snapshot: item.size_label ?? null,
  item_name_override: item.item_name,
  // ...rest unchanged
};
```

### Update path (`useUpdateHistoricalRental`)

Apply the same fields to the row update / re-insert logic in `useUpdateHistoricalRental` (around `useRentals.ts:2298+`).

### Edit-mode hydration

In `HistoricalRentalDialog.tsx`, the existing `useEffect` that hydrates items from `existingOrder.items` (around line 266) reads each row's catalog fields. Extend the mapping to:

```ts
return {
  item_name: it.item_name_override ?? it.rental_item?.name ?? "",
  rental_item_id: it.rental_item_id ?? null,
  rental_item_size_id: it.rental_item_size_id ?? null,
  size_label: it.size_label_snapshot ?? null,
  quantity: it.quantity,
  daily_rate: it.daily_rate_actual,
  days,
};
```

## Files Affected

| File | Change |
|---|---|
| `src/types/rental.types.ts` | Extend `HistoricalRentalItemFormData` with `rental_item_size_id?` + `size_label?` |
| `src/components/rentals/HistoricalRentalDialog.tsx` | New "Variant" column with conditional Select; auto-fill rate via `resolveVariantRate`; reset on item change; hydrate on edit |
| `src/hooks/queries/useRentals.ts` | `useCreateHistoricalRental` + `useUpdateHistoricalRental` write `rental_item_size_id` + `size_label_snapshot` |

## Risks

- **Items-list load race on edit:** `useRentalItems()` may not have returned by the time the row tries to populate the variant Select. The row still hydrates `size_label` (free-text snapshot) immediately because that comes from `existingOrder` directly. The Select binds to `rental_item_size_id`; if `allRentalItems` hasn't arrived yet, the Select renders with the id value already selected — once the variants resolve, the visible label appears. No blocking guard needed.
- **Free-text rows with variant-shaped names:** Engineers who already entered `"Roof Sheet 3×2"` as free text will keep working as today; no auto-migration. They can edit a record, change the row to pick "Roof Sheet" from the catalog + the `3×2` variant, save, and the row converts.
- **Variant soft-deleted later:** `size_label_snapshot` (already in DB) ensures the chip on read-side displays correctly even if the variant row is later set `is_active = false`. The Select on edit will show a deactivated option if its id is still referenced — acceptable for historical records.

## Verification

- `npm run build` passes.
- Open a historical record on `/site/rentals`, edit a row, pick "Roof Sheet", confirm Variant column appears, pick `3×2`, confirm rate auto-fills to `₹2/day`. Save. Reopen — variant still selected, rate still `2`.
- Pick a row with no catalog match (free-text "Cut Sheet"), confirm Variant cell is blank.
- Pick "Jackie" (no variants in catalog), confirm Variant cell is blank.
- Open `/site/rentals/[id]` for the saved historical order, confirm the cost-breakdown row shows the `3×2` chip.

## Out of scope (explicit non-goals)

- Backfill tooling for legacy free-text rows.
- Required-variant gate in historical mode.
- New display components — chips already render from Task 7 of the variants feature.
