# Historical Rental Lockdown — Design

**Date:** 2026-05-15
**Status:** Draft, pending implementation
**Touches:** `rental_orders` schema, `useCreateHistoricalRental`, `useUpdateHistoricalRental`, `/site/rentals/[id]` detail page, `RentalOrder` type

## Problem

Historical rental records — created via the **Historical Record** button on `/site/rentals`, which opens [`HistoricalRentalDialog`](src/components/rentals/HistoricalRentalDialog.tsx) — persist into the same `rental_orders` table as live rental orders. The detail page at [`/site/rentals/[id]`](src/app/(main)/site/rentals/[id]/page.tsx) has no signal that distinguishes the two origins, so it shows the same toolbar to both:

- For `status = 'draft'` historical records → **Activate Order** button. Clicking it flips status to `active`, exposing **Record Return** + **Advance** buttons.
- The **Record Return** dialog ([`RentalReturnDialog`](src/components/rentals/RentalReturnDialog.tsx)) is per-item: engineer must pick one item, enter return date + quantity + condition, save, repeat. For a backfilled scaffolding rental where everything was returned on the same day, this is mechanical busywork.

Concrete trigger: **RNT-260515-001**. Engineer saved a historical record as Save Draft, then clicked Activate Order on the detail page expecting it to mark the record as complete. Now the order is `active` with 5 items all showing as outstanding (`quantity_returned = 0`), the cost-breakdown panel offers a Record Return button, and the only way out is to re-enter five per-item returns.

## Goals

- Tag every order created by `HistoricalRentalDialog` as historical, persisted on the order so all read paths can detect it.
- Strip the live-order action buttons (Activate, Record Return, Advance, per-item return icons) from the detail page for historical-tagged orders.
- Repair existing orders that fell through this gap (RNT-260515-001 and any siblings) in the same migration that adds the column.

## Non-goals

- **Bulk-return UX for live active orders** — deferred to a future spec. The Record Return dialog stays per-item for now.
- **Changes to the historical dialog's button set** — Save Draft, Complete — Settle Later, and Complete & Mark Settled all remain. Engineers can still half-fill an entry and resume later.
- **Legacy free-text row conversion** — out of scope; covered by the [historical rental variants design](2026-05-15-historical-rental-variants-design.md).
- **Backfill of pre-existing live-flow drafts** — only orders that smell historical get touched.

## Data Model

**New column:**

```sql
ALTER TABLE rental_orders
  ADD COLUMN is_historical BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_rental_orders_is_historical
  ON rental_orders(is_historical) WHERE is_historical = true;
```

Partial index because the column is highly skewed (most orders are live).

**Backfill heuristic** runs in the same migration. An existing order is treated as historical iff:

1. It has **zero rows** in `rental_returns` for this `rental_order_id` (live-flow returns always insert here via `useRecordRentalReturn`; the historical hooks never touch this table), **AND**
2. Either `status = 'completed'` **OR** `created_at > start_date + INTERVAL '1 day'` (an order entered after its rental period began is unmistakably a backfill).

For each matching row:

```sql
UPDATE rental_orders
SET is_historical = true,
    status = 'completed',
    actual_return_date = COALESCE(actual_return_date, expected_return_date)
WHERE <heuristic>;

UPDATE rental_order_items
SET quantity_returned = quantity
WHERE rental_order_id IN (SELECT id FROM rental_orders WHERE is_historical = true);
-- `quantity_outstanding` is a GENERATED column (`quantity - quantity_returned`)
-- so it recomputes to 0 automatically once quantity_returned is bumped.
```

This repairs RNT-260515-001 (which is currently `active` with `quantity_returned = 0`) and tags all legitimate past historical entries in one shot.

## Tagging the create path

Both historical hooks in [`src/hooks/queries/useRentals.ts`](src/hooks/queries/useRentals.ts) set the flag on every insert/update:

- `useCreateHistoricalRental` (around line 2118): add `is_historical: true` to the `rental_orders` insert payload.
- `useUpdateHistoricalRental` (around line 2299): include `is_historical: true` in the update payload so edits keep the tag (defensive — the column won't get untagged by anything else, but explicit is safer).

Live-flow hooks (`useCreateRentalOrder`, `useUpdateRentalOrderStatus`, etc.) are unchanged — `is_historical` stays at its `false` default.

## Type extension

[`src/types/rental.types.ts`](src/types/rental.types.ts) — add `is_historical: boolean` to the `RentalOrder` interface and (transitively) `RentalOrderWithDetails`. No form-data type changes needed; the flag is set hook-internally.

## Detail page lockdown

[`src/app/(main)/site/rentals/[id]/page.tsx`](src/app/(main)/site/rentals/[id]/page.tsx) reads `order.is_historical`. When `true`:

| Element | Live order behavior | Historical behavior |
|---|---|---|
| **Activate Order** button (line 158-167) | Shown when `status = 'draft'` | Hidden |
| **Record Return** button (line 187-196) | Shown when `status ∈ {active, partially_returned}` | Hidden |
| **Advance** button (line 197-203) | Shown when `status ∈ {active, partially_returned}` | Hidden |
| **Add Advance** button (line 168-176) | Shown when `status = 'completed'` | Hidden |
| **Settle** button (line 177-186) | Shown when `isCompletedUnsettled` | Kept as-is |
| **Edit Record** pencil icon | Available everywhere already | Kept |
| Per-item Action column in Rental Items table (line 431) | Per-item Record Return icon | Hidden entirely (column collapses) |

**New header indicator:** next to the existing status chip (around line 228), add:

```tsx
{order.is_historical && (
  <Chip
    label="Historical record"
    size="small"
    variant="outlined"
    icon={<HistoryIcon fontSize="small" />}
    color="default"
  />
)}
```

This signals to the engineer why the action toolbar is leaner — they're not missing buttons, the record just doesn't need them.

**Edit dialog flow:** clicking Edit Record on a historical order still opens `HistoricalRentalDialog` in edit mode with the three save buttons unchanged. Status transitions (draft → completed, or back) flow through this dialog only.

## Files Affected

| File | Change |
|---|---|
| `supabase/migrations/<ts>_rental_orders_is_historical.sql` | New — add column, add partial index, backfill heuristic |
| `src/types/rental.types.ts` | Add `is_historical: boolean` to `RentalOrder` |
| `src/hooks/queries/useRentals.ts` | `useCreateHistoricalRental` + `useUpdateHistoricalRental` set `is_historical: true` |
| `src/app/(main)/site/rentals/[id]/page.tsx` | Branch toolbar + Rental Items action column on `order.is_historical`; render historical chip |

No changes to `HistoricalRentalDialog`, `RentalReturnDialog`, `RentalCostBreakdown`, or the list page — all unaffected.

## Risks

- **Heuristic mis-classification on backfill:** A live order created with `created_at > start_date + 1 day` that never had a return recorded (e.g. order placed late, vendor delivered, items still in use today) would match and get force-completed. Likelihood is low because the "no `rental_returns` rows" condition holds only for orders that never even started the return flow. Mitigation: manual SQL flip if it happens. Acceptable trade for repairing RNT-260515-001 automatically.
- **Tests asserting the live toolbar shape** would now see hidden buttons if their fixture happens to have `is_historical = true` set (it won't — default is false), but any new test fixture should explicitly set `is_historical: false` to be safe.
- **A user wanting to convert a historical record into a live one** has no UI affordance. Acceptable — there's no real-world scenario for it, and an explicit DB update is fine.
- **A user wanting to abandon a draft historical record** keeps the Delete action from the list page (`/site/rentals`), which is unchanged.

## Verification

After applying the migration to local DB and shipping the code:

1. Reload `/site/rentals/1f4227c1-c6f3-4ac2-8958-2b7601bed92d` (RNT-260515-001):
   - Status chip shows **Completed**.
   - "Historical record" chip is visible next to status.
   - No Activate Order, Record Return, Advance, or per-item return icons.
   - Cost Breakdown shows correct planned 30 days × rates (already fixed in earlier work).
   - Edit Record pencil still opens the historical dialog.
2. Create a fresh historical record via the **Historical Record** button → Save Draft. Detail page for the new order shows Edit only, no Activate.
3. Same record → reopen → Complete — Settle Later. Detail page now shows Edit + Settle, no Record Return.
4. Create a live rental via **+ New Rental** (regular flow) → save as draft. Detail page still shows Activate Order (unchanged for live flow).
5. Activate that live draft → detail page shows Record Return + Advance (unchanged).
6. `npm run build` passes with no type errors.

## Future Work (out of scope for this spec)

- Redesigned bulk-return UX for live active orders: a single "Return all outstanding" affordance plus a multi-item return dialog that lets engineers tick rows, change return dates per-row only when needed, and commit in one transaction.
- Consider a `creation_source` enum if other backfill flows (CSV import, mobile bulk-entry) appear.
