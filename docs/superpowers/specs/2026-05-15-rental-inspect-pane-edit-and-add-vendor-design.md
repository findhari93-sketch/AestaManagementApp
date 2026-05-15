# Rental InspectPane — Edit + Add Vendor — Design

**Date:** 2026-05-15
**Status:** Draft, pending implementation
**Touches:** `RentalItemInspectPane.tsx`

## Problem

The Rental Catalog (`/company/rentals`) has no UI to edit an existing catalog item or attach a vendor to it. `RentalItemDialog` supports edit mode (via `item` prop) but is wired only for "Add" on the page. The InspectPane is read-only.

Symptom from user: opened the Roof Sheet inspect pane, can't find where to add sizes (which are in the catalog edit dialog), and can't add a vendor either ("No vendors have this item yet" with no action).

## Goals

- Edit affordance in the InspectPane header opens `RentalItemDialog` pre-filled with the current item.
- "+ Add Vendor" affordance on the Vendors tab expands an inline mini-form to upsert a `rental_store_inventory` row (vendor + `daily_rate`).
- No new dialogs, no new hooks — reuse what's there.

## Non-goals

- Editing existing vendor inventory rows from the InspectPane. Per-vendor full edit (weekly/monthly rates, transport, loading, notes) remains on the vendor profile.
- Deleting vendor rows from the InspectPane.
- Per-size rate inputs in the inline form. The variant catalog default already covers per-size pricing; vendor-specific size overrides remain in the vendor profile.

## UX

### Header

Add a pencil `EditIcon` between the item name and the close button:

```
┌─ Roof Sheet                          ✏  ✕ ─┐
```

Click → set local `editOpen = true`, which renders `<RentalItemDialog open item={item} onClose={() => setEditOpen(false)} />` at the end of the pane.

Hide the pencil when the full `item` prop is missing (the dialog needs it for edit mode).

### Vendors tab

Above the vendors list, render a header row:

```
VENDORS                                ⊕ Add Vendor
```

The button is text-style, small, right-aligned. Visible on both empty and populated states. Click toggles `addVendorOpen`.

When open, an inline form expands above the list:

```
┌─ Add vendor pricing ─────────────────────┐
│  Vendor: [VendorAutocomplete       ▾]    │
│  ₹/day:  [____]                          │
│         [Cancel]  [Save]                 │
└──────────────────────────────────────────┘
```

`VendorAutocomplete` is rendered with `slotProps={{ popper: { disablePortal: false } }}` defensively. The drawer is `variant="persistent"` (not modal), so aria-hidden conflicts should not arise, but the prop is harmless.

Save button disabled until both `vendor_id` and `daily_rate > 0` are set.

On Save:
- Call `useAddRentalStoreInventory.mutateAsync({ vendor_id, rental_item_id: itemId, daily_rate, min_rental_days: 1, long_term_discount_percentage: 0, long_term_threshold_days: 30 })`.
- React Query invalidation already covers `storeInventory.byItem(itemId)` — vendor list refreshes automatically.
- Reset form state + collapse.

On Cancel: reset state + collapse, no mutation.

Existing-vendor handling: `useAddRentalStoreInventory` upserts on `(vendor_id, rental_item_id)`. If the picked vendor already has this item, the existing row's `daily_rate` is overwritten. Acceptable — matches the vendor-profile flow.

## Files affected

| File | Change |
|---|---|
| `src/components/rentals/RentalItemInspectPane.tsx` | Add Edit icon in header; Add Vendor inline form on Vendors tab; render `RentalItemDialog` when `editOpen` |

No new hooks, no DB changes, no type changes.

## Risks

- **Stale `item` after edit**: When the user saves edits and closes the dialog, the InspectPane still shows the old `item` snapshot. `useRentalItems` invalidation refreshes the list-level data, but the InspectPane's `item` prop comes from whoever rendered it (the rentals page). Mitigation: the InspectPane re-reads `sizes` and `inventory` via React Query hooks (already does), so size changes appear immediately. For the static `item` fields (name, category, image), the parent re-renders on `useRentalItems` invalidation and passes a fresh `item`. Acceptable.
- **Vendor list refresh latency**: query invalidation is async; ~200ms before the new vendor appears. No optimistic update needed for this volume.
