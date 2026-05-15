# Historical Rental Lockdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tag every rental order created via the Historical Record dialog with a persisted `is_historical` flag, repair existing accidentally-activated drafts, and strip live-order actions (Activate, Record Return, Advance, per-item return) from the detail page for historical-tagged orders.

**Architecture:** New boolean column `rental_orders.is_historical` (default false). Historical hooks set it to true on insert/update. Migration backfills existing orders that smell historical (no rental_returns rows + (completed OR created post-start)). Detail page reads the flag and branches its toolbar + items-table action column. Live flow untouched.

**Tech Stack:** PostgreSQL (Supabase), Next.js 15, MUI v7, React Query, Vitest. Migrations live in `supabase/migrations/` and apply via `npm run db:reset` (local) and `mcp__supabase__apply_migration` (prod, by user request only).

**Spec:** [docs/superpowers/specs/2026-05-15-historical-rental-lockdown-design.md](../specs/2026-05-15-historical-rental-lockdown-design.md)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260515130000_rental_orders_is_historical.sql` | Create | Add column, partial index, backfill heuristic |
| `src/types/rental.types.ts` | Modify | Add `is_historical: boolean` field to `RentalOrder` |
| `src/hooks/queries/useRentals.ts` | Modify | Set `is_historical: true` in `useCreateHistoricalRental` and `useUpdateHistoricalRental` |
| `src/app/(main)/site/rentals/[id]/page.tsx` | Modify | Branch toolbar + items action column on `order.is_historical`; render "Historical record" chip |

---

## Task 1: Migration — add `is_historical` column with backfill

**Files:**
- Create: `supabase/migrations/20260515130000_rental_orders_is_historical.sql`

### Step 1: Write the migration file

- [ ] **Step 1: Create the migration**

Write `supabase/migrations/20260515130000_rental_orders_is_historical.sql` with the following content exactly:

```sql
-- Add `is_historical` to rental_orders so the detail page can lock down
-- live-order actions (Activate, Record Return, Advance) for backfilled records.
-- Backfill repairs orders that came out of HistoricalRentalDialog but never got tagged,
-- including those accidentally activated to status='active'.

ALTER TABLE rental_orders
  ADD COLUMN is_historical BOOLEAN NOT NULL DEFAULT false;

-- Partial index: the column is highly skewed (most rows are live).
CREATE INDEX idx_rental_orders_is_historical
  ON rental_orders (is_historical) WHERE is_historical = true;

-- Backfill: an order is historical iff it has no rental_returns rows
-- (live flow always inserts there via useRecordRentalReturn) AND either
-- it's already completed OR it was entered after its rental period began.
WITH historical_orders AS (
  SELECT ro.id
  FROM rental_orders ro
  WHERE NOT EXISTS (
    SELECT 1 FROM rental_returns rr WHERE rr.rental_order_id = ro.id
  )
  AND (
    ro.status = 'completed'
    OR ro.created_at > ro.start_date + INTERVAL '1 day'
  )
)
UPDATE rental_orders
SET is_historical = true,
    status = 'completed',
    actual_return_date = COALESCE(actual_return_date, expected_return_date)
WHERE id IN (SELECT id FROM historical_orders);

-- Items: mark everything returned. quantity_outstanding is a GENERATED column
-- (quantity - quantity_returned), so it recomputes to 0 automatically.
UPDATE rental_order_items
SET quantity_returned = quantity
WHERE rental_order_id IN (
  SELECT id FROM rental_orders WHERE is_historical = true
);
```

- [ ] **Step 2: Apply locally and verify the column exists**

Run:
```bash
npm run db:reset
```
Expected: reset completes without errors. If it fails, read the error — the most common cause is a name collision; check the partial-index name isn't taken.

Verify the column exists via Supabase MCP:
```
mcp__supabase__execute_sql with query:
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'rental_orders' AND column_name = 'is_historical';
```
Expected one row: `is_historical | boolean | NO | false`.

- [ ] **Step 3: Verify the backfill repaired RNT-260515-001**

```
mcp__supabase__execute_sql with query:
  SELECT rental_order_number, status, is_historical, actual_return_date, expected_return_date
  FROM rental_orders
  WHERE rental_order_number = 'RNT-260515-001';
```
Expected: `status = 'completed'`, `is_historical = true`, `actual_return_date = '2026-05-09'` (matches expected_return_date).

```
mcp__supabase__execute_sql with query:
  SELECT roi.id, ri.name, roi.quantity, roi.quantity_returned, roi.quantity_outstanding
  FROM rental_order_items roi
  LEFT JOIN rental_items ri ON ri.id = roi.rental_item_id
  WHERE roi.rental_order_id = (
    SELECT id FROM rental_orders WHERE rental_order_number = 'RNT-260515-001'
  );
```
Expected: every row shows `quantity_returned = quantity` and `quantity_outstanding = 0`.

- [ ] **Step 4: Sanity-check the heuristic didn't over-tag**

```
mcp__supabase__execute_sql with query:
  SELECT COUNT(*) AS tagged_count,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count
  FROM rental_orders WHERE is_historical = true;
```
Expected: `tagged_count > 0`, `completed_count = tagged_count` (every tagged row is completed because the UPDATE forces it).

Spot-check live orders are still live:
```
mcp__supabase__execute_sql with query:
  SELECT rental_order_number, status, is_historical
  FROM rental_orders
  WHERE is_historical = false AND status IN ('active', 'partially_returned')
  LIMIT 5;
```
Expected: rows returned (active live orders), all with `is_historical = false`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260515130000_rental_orders_is_historical.sql
git commit -m "feat(rentals): add is_historical column with backfill of accidentally-activated drafts"
```

---

## Task 2: Extend `RentalOrder` type

**Files:**
- Modify: `src/types/rental.types.ts` (around line 207-211, in the `RentalOrder` interface)

- [ ] **Step 1: Add the field to the interface**

Open `src/types/rental.types.ts`. Find the `RentalOrder` interface (it starts around line 197). Add `is_historical: boolean;` immediately after the `actual_total: number | null;` line. The relevant block should look like:

```ts
  estimated_total: number;
  actual_total: number | null;
  is_historical: boolean;

  // Transport outward
```

- [ ] **Step 2: Verify the build still type-checks**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -E "useRentals|rentalService|site/rentals|rental\.types" | head -20
```
Expected: no output (no type errors in any rental-related file).

- [ ] **Step 3: Commit**

```bash
git add src/types/rental.types.ts
git commit -m "feat(rentals): add is_historical to RentalOrder type"
```

---

## Task 3: Set the flag in both historical hooks

**Files:**
- Modify: `src/hooks/queries/useRentals.ts` around line 2118 (`useCreateHistoricalRental`) and line 2299 (`useUpdateHistoricalRental`)

- [ ] **Step 1: Locate the create hook's insert payload**

Open `src/hooks/queries/useRentals.ts`. Find `useCreateHistoricalRental` (around line 2118). Scroll to the `.insert(` call that writes to `rental_orders` — it includes the line `status: isDraft ? "draft" : "completed",` at approximately line 2149. Add `is_historical: true,` on the line immediately after it. The block should read:

```ts
          actual_return_date: isDraft ? null : (data.end_date || null),
          status: isDraft ? "draft" : "completed",
          is_historical: true,
```

- [ ] **Step 2: Locate the update hook's update payload**

In the same file, find `useUpdateHistoricalRental` (around line 2299). Scroll to the `.update(` call on `rental_orders` — it has the line `status: updStatus,` at approximately line 2318. Add `is_historical: true,` immediately after:

```ts
          actual_return_date: updStatus === "draft" ? null : (data.end_date || null),
          status: updStatus,
          is_historical: true,
```

This is defensive — the column would never get untagged by any other code path, but explicit is safer and survives future refactors.

- [ ] **Step 3: Type-check and confirm no errors**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -E "useRentals" | head -10
```
Expected: no output.

- [ ] **Step 4: Smoke-test by creating a fresh historical record**

Start the dev server if not already running:
```bash
npm run dev
```

Open the browser to `http://localhost:3000/dev-login`. Once redirected to the dashboard, navigate to `/site/rentals`, click **Historical Record**, fill in any vendor + 1 item, click **Save Draft**.

Verify via Supabase MCP:
```
mcp__supabase__execute_sql with query:
  SELECT rental_order_number, status, is_historical
  FROM rental_orders
  WHERE site_id = '<your test site id>'
  ORDER BY created_at DESC LIMIT 1;
```
Expected: the newly-created row has `is_historical = true`.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/queries/useRentals.ts
git commit -m "feat(rentals): tag historical-dialog orders with is_historical=true on create + update"
```

---

## Task 4: Lock down the detail page toolbar for historical orders

**Files:**
- Modify: `src/app/(main)/site/rentals/[id]/page.tsx` (toolbar block around line 152-218, items-table action column around line 431)

- [ ] **Step 1: Add a derived `isHistorical` constant near the existing computed flags**

Find the block around line 126-129 where `isSettled`, `showReadyToSettle`, `isCompletedUnsettled` are computed. Add immediately after:

```ts
  const isHistorical = order?.is_historical ?? false;
```

- [ ] **Step 2: Branch the toolbar buttons on `isHistorical`**

Find the `<PageHeader actions={...}>` block (starts at line 154). Replace the inner `<Box display="flex" gap={1}>` toolbar contents so the live-order branches are gated by `!isHistorical`. The full replacement for the actions Box body:

```tsx
          <Box display="flex" gap={1}>
            {!isHistorical && order.status === "draft" && (
              <Button
                variant="contained"
                color="primary"
                onClick={handleActivateOrder}
                disabled={updateStatus.isPending}
              >
                Activate Order
              </Button>
            )}
            {!isHistorical && order.status === "completed" && (
              <Button
                variant="outlined"
                startIcon={<PaymentIcon />}
                onClick={() => setAdvanceDialogOpen(true)}
              >
                Add Advance
              </Button>
            )}
            {isCompletedUnsettled && (
              <Button
                variant="contained"
                color="success"
                startIcon={<SettleIcon />}
                onClick={() => setMultiSettlementDialogOpen(true)}
              >
                Settle
              </Button>
            )}
            {!isHistorical && ["active", "partially_returned"].includes(order.status) && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<ReturnIcon />}
                  onClick={() => handleRecordReturn()}
                  disabled={allItemsReturned}
                >
                  Record Return
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PaymentIcon />}
                  onClick={() => setAdvanceDialogOpen(true)}
                >
                  Advance
                </Button>
                {allItemsReturned && (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<SettleIcon />}
                    onClick={() => setSettlementDialogOpen(true)}
                  >
                    Settle
                  </Button>
                )}
              </>
            )}
          </Box>
```

The **Settle** button (when `isCompletedUnsettled`) intentionally stays — historical records can still need settlement.

- [ ] **Step 3: Add a "Historical record" chip next to the status chip**

Find the existing `<Chip label={RENTAL_ORDER_STATUS_LABELS[order.status]} ... />` (around line 228). Add an `HistoryIcon` import at the top alongside the other `@mui/icons-material` imports — add `History as HistoryIcon` to the import block (which already imports `Edit as EditIcon`, `DeleteOutline as DeleteIcon`, etc., around line 24-38).

The new import line should sit alongside existing icon imports:

```tsx
  Edit as EditIcon,
  DeleteOutline as DeleteIcon,
  History as HistoryIcon,
```

Then, immediately after the status Chip, add the historical chip. The block becomes:

```tsx
                  <Chip
                    label={RENTAL_ORDER_STATUS_LABELS[order.status]}
                    color={getStatusColor(order.status)}
                  />
                  {isHistorical && (
                    <Chip
                      label="Historical record"
                      size="small"
                      variant="outlined"
                      icon={<HistoryIcon fontSize="small" />}
                    />
                  )}
```

- [ ] **Step 4: Hide the per-item Action column when historical**

Two edits in the Rental Items table.

**Edit 4a — header at line 372.** Replace:

```tsx
                  <TableCell align="center">Action</TableCell>
```

with:

```tsx
                  {!isHistorical && <TableCell align="center">Action</TableCell>}
```

**Edit 4b — per-row cell at lines 429-440.** Replace:

```tsx
                      <TableCell align="center">
                        {outstanding > 0 && (
                          <Tooltip title="Record Return">
                            <IconButton
                              size="small"
                              onClick={() => handleRecordReturn(item)}
                            >
                              <ReturnIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
```

with:

```tsx
                      {!isHistorical && (
                        <TableCell align="center">
                          {outstanding > 0 && (
                            <Tooltip title="Record Return">
                              <IconButton
                                size="small"
                                onClick={() => handleRecordReturn(item)}
                              >
                                <ReturnIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      )}
```

- [ ] **Step 5: Type-check**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "site/rentals" | head -10
```
Expected: no output.

- [ ] **Step 6: Visual verification via Playwright**

Make sure dev server is running on port 3000.

Open the browser to `http://localhost:3000/dev-login`, wait for the auto-login redirect, then navigate to `/site/rentals/1f4227c1-c6f3-4ac2-8958-2b7601bed92d` (RNT-260515-001).

Expected:
- Status chip reads **Completed**.
- A small outlined chip "Historical record" with a clock icon appears next to it.
- **No** Activate Order button, **no** Record Return button, **no** Advance button in the top-right toolbar.
- The Rental Items table has no Action column.
- The Cost Breakdown panel shows ₹19,710 items subtotal + ₹1,400 transport = ₹21,110 Gross (Final Amt should match `/site/rentals?tab=all`).
- Edit pencil icon in the page header / list still opens `HistoricalRentalDialog`.

Take a screenshot to confirm. If anything looks off, fix and re-check.

- [ ] **Step 7: Verify live orders still have the full toolbar**

Navigate to `/site/rentals` → find an order with status `active` or `partially_returned` (any non-historical order) → click View. Confirm Record Return + Advance buttons appear. If no active live order exists locally, create one via **+ New Rental**, save as draft, navigate to its detail page, confirm **Activate Order** appears.

- [ ] **Step 8: Commit**

```bash
git add src/app/(main)/site/rentals/[id]/page.tsx
git commit -m "feat(rentals): lock down detail-page toolbar + items action column for historical records"
```

---

## Task 5: End-to-end verification & sign-off

- [ ] **Step 1: Run the production build**

```bash
npm run build
```
Expected: build completes with no errors. (Pre-existing test-file type errors in `ScopePill.test.tsx`, `InventoryCardGrid.test.tsx`, and `BrandVariantMatrix.test.tsx` are unrelated and can be ignored — verify the build itself passes.)

- [ ] **Step 2: Run the rental-related Vitest specs**

```bash
npm run test -- src/hooks/queries/__tests__/rentalDuration.test.ts src/lib/utils/__tests__/rentalCostUtils.test.ts src/lib/utils/__tests__/rentalCatalogUtils.test.ts
```
Expected: all pass. These don't directly cover the new code, but a regression here would indicate something broke in shared utilities.

- [ ] **Step 3: Manual cross-check that list and detail show the same totals**

Open `/site/rentals?tab=all` for the Padmavathy Apartments site. For RNT-260515-001:
- Vendor column = ₹19,710
- Inbound column = ₹700
- Outbound column = ₹700
- Paid = ₹0
- Balance = ₹21,110

Open the detail page. Cost Breakdown should match:
- Items Subtotal = ₹19,710
- Transport (Outward) = ₹700
- Transport (Return) = ₹700
- Gross Total = ₹21,110

Both should show 30 days per item, not 37.

- [ ] **Step 4: Report status to the user**

Summarize the changes, the verified state of RNT-260515-001, and ask for explicit approval before running "move to prod" (which will apply the migration to production via `mcp__supabase__apply_migration` per CLAUDE.md).

---

## Notes for the executing engineer

- **Migration ordering:** Per CLAUDE.md, when this lands in production the migration must be applied to prod BEFORE the code is pushed, since the code at `[id]/page.tsx` will reference `order.is_historical` which doesn't exist in prod yet.
- **Don't touch `quantity_outstanding`:** It's a `GENERATED ALWAYS AS (quantity - quantity_returned) STORED` column. Bumping `quantity_returned` is enough.
- **Don't unify with the live-order toolbar code:** keep the historical/live branches separate via simple `!isHistorical &&` guards. Tempting to refactor toward a more abstract pattern, but YAGNI — one fork is enough.
- **No new tests for the detail page UI:** the project doesn't have RTL coverage for the rentals detail page; Playwright is the verification path. Don't manufacture tests just to satisfy TDD ritual.
