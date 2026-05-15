# Historical Rental Variants Implementation Plan

> **For agentic workers:** Small inline-executable plan. Steps use checkbox syntax.

**Goal:** Add a Variant column to `HistoricalRentalDialog` so backfilled rentals can capture which size variant was rented, and persist the variant id + label snapshot to `rental_order_items`.

**Architecture:** No schema changes. `rental_order_items.rental_item_size_id` and `size_label_snapshot` already exist. Types extended, dialog gains a conditional Select, two hook insert maps gain two fields.

**Spec:** [docs/superpowers/specs/2026-05-15-historical-rental-variants-design.md](../specs/2026-05-15-historical-rental-variants-design.md)

---

## Task 1: Extend `HistoricalRentalItemFormData`

- [ ] Open [src/types/rental.types.ts](src/types/rental.types.ts). Find `interface HistoricalRentalItemFormData`. Add two optional fields:

```ts
export interface HistoricalRentalItemFormData {
  item_name: string;
  rental_item_id?: string | null;
  rental_item_size_id?: string | null;   // new
  size_label?: string | null;            // new — persisted as size_label_snapshot
  quantity: number;
  daily_rate: number;
  days: number;
}
```

- [ ] `npx tsc --noEmit` — expect zero new errors.

---

## Task 2: Persist variant in `useCreateHistoricalRental` and `useUpdateHistoricalRental`

- [ ] Open [src/hooks/queries/useRentals.ts](src/hooks/queries/useRentals.ts). In `useCreateHistoricalRental` (around line 2176, inside the `itemsToInsert` map), add two fields to the returned row object:

```ts
return {
  rental_order_id: order.id,
  rental_item_id: item.rental_item_id ?? null,
  rental_item_size_id: item.rental_item_size_id ?? null,
  size_label_snapshot: item.size_label ?? null,
  item_name_override: item.item_name,
  // ... rest unchanged
};
```

- [ ] In `useUpdateHistoricalRental` (around line 2348, the symmetric `itemsToInsert` map), add the same two fields.

- [ ] `npx tsc --noEmit` — expect zero new errors.

---

## Task 3: Variant column in `HistoricalRentalDialog`

- [ ] Open [src/components/rentals/HistoricalRentalDialog.tsx](src/components/rentals/HistoricalRentalDialog.tsx).

**Step 3a: Add helper to resolve variant for a row**

After the existing `useRentalItems` hook call (around line 195), derive a helper that maps rental_item_id → its catalog entry. Already implicitly available through `allRentalItems`. We'll do the lookup inline per row, no separate memo needed since the table is small.

**Step 3b: Hydrate variants on edit-mode load**

Find the hydration `useEffect` (around line 266). In the `.map((it: any) => { ... return { ... } })`, add two fields to the returned object:

```ts
return {
  item_name: it.item_name_override ?? it.rental_item?.name ?? "",
  rental_item_id: it.rental_item_id ?? null,
  rental_item_size_id: it.rental_item_size_id ?? null,   // new
  size_label: it.size_label_snapshot ?? null,            // new
  quantity: it.quantity,
  daily_rate: it.daily_rate_actual,
  days,
};
```

**Step 3c: Add Variant column header**

Find the `<TableHead>` (line 671-680). Insert a new `<TableCell>` between "Item Name" and "Qty":

```tsx
<TableCell sx={{ minWidth: 100 }}>Variant</TableCell>
```

**Step 3d: Add Variant cell per row**

Find the row render (line 682+). Right after the Item Name `<TableCell>` (closes at line 720), insert:

```tsx
<TableCell sx={{ minWidth: 100 }}>
  {(() => {
    const catalogItem = item.rental_item_id
      ? allRentalItems.find((ci) => ci.id === item.rental_item_id)
      : null;
    const variants = (catalogItem?.sizes ?? []).filter((s) => s.is_active);
    if (variants.length === 0) {
      return <Typography variant="caption" color="text.disabled">—</Typography>;
    }
    return (
      <Select
        size="small"
        variant="standard"
        value={item.rental_item_size_id ?? ""}
        onChange={(e) => {
          const sizeId = (e.target.value as string) || null;
          const v = sizeId ? variants.find((s) => s.id === sizeId) : null;
          const resolved = v ? resolveVariantRate(catalogItem!, v, null) : item.daily_rate;
          updateItem(idx, {
            rental_item_size_id: sizeId,
            size_label: v?.size_label ?? null,
            daily_rate: v ? resolved : item.daily_rate,
          });
        }}
        displayEmpty
        sx={{ minWidth: 80, fontSize: "0.875rem" }}
      >
        <MenuItem value=""><em>—</em></MenuItem>
        {variants.map((v) => (
          <MenuItem key={v.id} value={v.id}>{v.size_label}</MenuItem>
        ))}
      </Select>
    );
  })()}
</TableCell>
```

**Step 3e: Reset variant when item changes**

In the Autocomplete `onChange` (around line 698-708), the two `updateItem` calls already overwrite `rental_item_id`. Add `rental_item_size_id: null, size_label: null` to both calls:

```ts
onChange={(_, val) => {
  if (val && typeof val !== "string") {
    const catalogItem = val as RentalItemWithDetails;
    updateItem(idx, {
      item_name: catalogItem.name,
      rental_item_id: catalogItem.id,
      rental_item_size_id: null,
      size_label: null,
      daily_rate: catalogItem.default_daily_rate ?? item.daily_rate,
    });
  } else if (typeof val === "string") {
    updateItem(idx, {
      item_name: val,
      rental_item_id: null,
      rental_item_size_id: null,
      size_label: null,
    });
  }
}}
```

Same for the `onInputChange` reset (line 693-697):

```ts
onInputChange={(_, val, reason) => {
  if (reason !== "reset") {
    updateItem(idx, {
      item_name: val,
      rental_item_id: null,
      rental_item_size_id: null,
      size_label: null,
    });
  }
}}
```

**Step 3f: Import `resolveVariantRate`**

Add to the imports at the top of the file:

```ts
import { resolveVariantRate } from "@/lib/utils/rentalCatalogUtils";
```

- [ ] `npx tsc --noEmit` — expect zero new errors.
- [ ] `npm run build` — expect success.

---

## Task 4: Commit + verify

- [ ] Stage all three files:

```
git add src/types/rental.types.ts src/hooks/queries/useRentals.ts src/components/rentals/HistoricalRentalDialog.tsx
git commit -m "feat(rentals): variant picker in historical rental dialog"
```

- [ ] Move to prod (per CLAUDE.md): no new migration in this change, so just push.

```
git push origin main
```
