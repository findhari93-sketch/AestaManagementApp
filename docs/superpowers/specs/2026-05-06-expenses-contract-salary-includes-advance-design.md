# /site/expenses — Salary tiles reconcile with /site/payments

**Date**: 2026-05-06
**Scope**: `Breakdown by Type` summary card on `/site/expenses` and the `v_all_expenses` view definition.
**Status**: Implemented (commits `41b5a34`, `c2e0cf1`, `629fc63`, `57500d9`).

## Why both slices live in one spec

The `/site/expenses` `Breakdown by Type` card has two reconciliation gaps with the `/site/payments` hero:

1. **Mesthri side** — `/site/payments` shows `Total Paid = waterfall + advance` as a single number; `/site/expenses` splits it across two tiles. (Slice A.)
2. **Daily/market side** — `/site/expenses` `Daily Salary` (₹2,64,099 for Srinivasan) is bigger than `/site/payments` `Paid` (₹2,17,575) because the expenses view bundles excess payments and orphan/unlinked settlements into Daily Salary. (Slice B.)

Both slices change the same component (`/site/expenses` `Breakdown by Type`), so they share spec/review even though Slice A is UI-only and Slice B requires a view migration. Slice A is independently shippable and was merged first; Slice B follows.

---

## Slice A — Contract Salary tile includes mesthri advances (UI only)

### Problem

`/site/expenses` renders `Contract Salary` and `Advance` as two separate tiles:

- `Contract Salary ₹3,35,450 · 114 rec` — settlement_groups with `payment_type = 'salary'`, contract scope.
- `Advance ₹15,000 · 2 rec` — settlement_groups with `payment_type = 'advance'` (mesthri-side advances).

`SalarySliceHero.tsx:54` already defines the meaningful aggregate as `Total Paid = settlementsTotal + advancesTotal` because both flows are money paid to the mesthri. The expenses page does not reflect that aggregate, so the user has to mentally sum two tiles.

### Goal

Fold `Advance` into the `Contract Salary` tile so the amount represents total mesthri paid. Show the advance count as a small sub-line indicator. Remove the standalone `Advance` tile.

### Source-of-truth check

Verified via `supabase/migrations/20260212100001_restore_misc_expense_type_mapping.sql:186-244`: every row that surfaces with `expense_type = 'Advance'` in `v_all_expenses` is a `settlement_groups` row with `payment_type = 'advance'`. Same source as the payments hero's `advanceCount` / `advancesTotal`.

### Visual

Before:

```
┌───────────────────┐  ┌───────────────────┐
│ Contract Salary   │  │ Advance           │
│ ₹3,35,450         │  │ ₹15,000           │
│ 114 rec           │  │ 2 rec             │
└───────────────────┘  └───────────────────┘
```

After:

```
┌────────────────────────────┐
│ Contract Salary            │
│ ₹3,50,450                  │
│ 114 rec · 2 advance        │
└────────────────────────────┘
```

- Tile **amount** = `breakdown["Contract Salary"].amount + breakdown["Advance"].amount`.
- Tile **sub-line**:
  - If `advanceCount > 0`: `{contractCount} rec · {advanceCount} advance`.
  - If `advanceCount === 0`: `{contractCount} rec` (clean for non-mesthri sites).
- Standalone `Advance` tile is no longer rendered.

### Implementation outline

Single file: `src/app/(main)/site/expenses/page.tsx`. Change confined to the `Breakdown by Type` rendering (~lines 1011-1047).

1. Just before iterating `Object.entries(stats.categoryBreakdown)`, derive a `displayBreakdown` that:
   - Reads `breakdown["Contract Salary"]` and `breakdown["Advance"]`.
   - If both: emits one combined entry under `Contract Salary` with `amount = contract.amount + advance.amount` and a new `advanceCount = advance.count`. Drops the `Advance` key.
   - If only `Advance` (defensive): keeps it standalone.
   - If only `Contract Salary`: untouched.
   - All other keys pass through.
2. Tile renderer reads optional `advanceCount` and conditionally appends `· {advanceCount} advance`.

Same merge applies whether `stats.categoryBreakdown` came from `scopeSummary.breakdown` (RPC, line 596) or client-side fallback (lines 606-616) — both have the same shape.

### Edge cases

| Scenario | Behavior |
|---|---|
| Both present | Merged tile with `· N advance` suffix. |
| Only `Contract Salary` | Existing behavior; tile shows just `{count} rec`. |
| Only `Advance` (defensive) | Standalone Advance tile renders. |
| Neither (e.g. `Material` tab) | No-op. |
| `loadedLimit` hit, RPC summary used | Same merge applies. |
| Cancelled SGs | Already excluded by the view. |

### What stays unchanged

- DataTable column filters (`Advance` remains filterable at row level, line 756).
- Row chips and Ref Code routing for `SS-` and other settlement refs.
- `Total Expenses` and `Subcontracts` tiles.
- All hooks, services, RPCs, database objects.

### Verification

On `/site/expenses` for **Srinivasan House & Shop, All Time**:

1. Merged tile reads `Contract Salary · ₹3,50,450 · 114 rec · 2 advance`.
2. Standalone `Advance ₹15,000` tile is gone.
3. Other tiles unchanged.
4. Table filter `Type = Advance` still shows the 2 advance rows.
5. Switch tab to `Material` — breakdown shows only material-scope tiles.
6. Console clean.

---

## Slice B — Daily Salary reconciles with /site/payments PAID (view migration + UI)

### Problem

For Srinivasan House & Shop:

| Tile | Amount | Count |
|---|---|---|
| `/site/expenses` `Daily Salary` | ₹2,64,099 | 97 dates (141 underlying SGs) |
| `/site/payments` `Daily + Market PAID` | ₹2,17,575 | 105 SGs |

The ₹46,524 / 8-row discrepancy decomposes into three structural buckets (verified by SQL against prod):

| Bucket | SGs | Amount | What it is |
|---|---|---|---|
| Intersection (in both views) | 88 | ₹1,67,875 | Standard daily/market salary settlements with attendance links |
| `/site/expenses` only | 53 | +₹96,224 | `payment_type='excess'` (19 SGs, ₹22,799) + orphan `payment_type='salary'` with no attendance link (34 SGs, ₹73,425) |
| `/site/payments` only | 17 | −₹49,700 | SGs with `daily_attendance` link AND `labor_payments.is_under_contract=true` — the expenses view classifies these as Contract Salary; the payment summary classifies them as Daily/Market based on attendance presence |

The `/site/expenses` view's definition pulls in real money that the payments hero deliberately excludes (excess and unlinked). Conversely, the 17 contract-flagged-with-attendance SGs are a residual definitional difference between the two pages.

### Goal

Reconcile the **Daily Salary** tile with the payments hero's `Daily + Market PAID` for the most common cases (excess and unlinked rows). Surface excess and unlinked rows as their own tiles so they remain visible (they are real money) but no longer inflate Daily Salary. Accept the 17-SG / ₹49,700 residual gap as a known follow-up.

### Non-goals

- **No data writes** to `settlement_groups`. The orphan rows are messy enough (mix of misclassified advances, petty-cash "selavuku" payments, and engineer-wallet rows with missing attendance links) that auto-linking would silently corrupt data. Cleanup happens manually over time using the existing `/site/payments` UI.
- **No re-classification of the 17 contract-flagged-with-attendance SGs.** Moving them out of Contract Salary would also change the Slice A tile we just shipped. Leave for a follow-up.
- **No change to `get_payment_summary` or the `/site/payments` hero.**

### Source-of-truth check

Verified queries against prod:
- 141 SGs match the current `Daily Salary` filter in `v_all_expenses` (`payment_type <> 'advance'` AND no contract `labor_payments`), aggregating to ₹2,64,099.
- 105 SGs match `get_payment_summary`'s daily/market filter (`is_archived=false` AND has `daily_attendance` or `market_laborer_attendance` link), aggregating to ₹2,17,575.
- 88 SG overlap, ₹1,67,875.
- 53 SGs in expenses only — split: 19 `payment_type='excess'` (₹22,799), 34 `payment_type='salary'` orphans (₹73,425).
- 17 SGs in payment only — all have `labor_payments.is_under_contract=true`.

### Database migration

New migration `supabase/migrations/20260506120000_split_daily_salary_excess_unlinked.sql` that recreates `v_all_expenses` with three changes to the salary settlement branches. Everything else (tea shop, misc expense, subcontract payment, material purchase, regular expense branches) is preserved verbatim.

**Branch 1 — `Daily Salary` (UPDATED).** Add the same daily/market predicate the payment summary uses:

```
WHERE sg.is_cancelled = false
  AND sg.is_archived  = false
  AND COALESCE(sg.payment_type, 'salary') = 'salary'
  AND NOT EXISTS (SELECT 1 FROM labor_payments lp
                   WHERE lp.settlement_group_id = sg.id AND lp.is_under_contract = true)
  AND (
    EXISTS (SELECT 1 FROM daily_attendance da
             WHERE da.settlement_group_id = sg.id AND da.is_archived = false)
    OR EXISTS (SELECT 1 FROM market_laborer_attendance ma
                WHERE ma.settlement_group_id = sg.id)
  )
GROUP BY sg.site_id, sg.settlement_date
```

**Branch 2 — `Excess` (NEW).** Same shape as the existing `Advance` branch; emits one row per SG with `expense_type = 'Excess'`. Filter:

```
WHERE sg.is_cancelled = false
  AND sg.is_archived  = false
  AND sg.payment_type = 'excess'
```

**Branch 3 — `Unlinked Salary` (NEW).** One row per SG. Filter:

```
WHERE sg.is_cancelled = false
  AND sg.is_archived  = false
  AND COALESCE(sg.payment_type, 'salary') = 'salary'
  AND NOT EXISTS (SELECT 1 FROM labor_payments lp
                   WHERE lp.settlement_group_id = sg.id)
  AND NOT EXISTS (SELECT 1 FROM daily_attendance da
                   WHERE da.settlement_group_id = sg.id)
  AND NOT EXISTS (SELECT 1 FROM market_laborer_attendance ma
                   WHERE ma.settlement_group_id = sg.id)
```

Notes on the migration:
- The `is_archived = false` filter on the salary branches matches what `get_payment_summary` does for Mode B reconcile compatibility. Today the view doesn't apply this filter at all — adding it is intentional.
- Mutual exclusivity: a SG with `payment_type='advance'` only matches the existing Advance branch; `payment_type='excess'` only the new Excess branch; `payment_type='salary'` matches at most one of Daily Salary / Unlinked Salary / Contract Salary depending on attendance/labor_payment links. No SG should appear twice.
- `Contract Salary` and `Advance` branches are unchanged.
- Sum invariant: the total ₹ across all expense_types after the migration equals the total ₹ before (no money lost or added; rows just move between buckets).

The migration is recoverable: if it breaks anything, reverting to `20260212100001_restore_misc_expense_type_mapping.sql`'s view definition is a one-line `DROP VIEW ... ; CREATE VIEW ... AS ...`.

### Frontend changes

`src/app/(main)/site/expenses/page.tsx`:

1. **Color map for new types** (line 759, `colorMap` in the `expense_type` column `Cell`): add entries for `Excess` and `Unlinked Salary`.
2. **Filter dropdown** (line 756, `filterSelectOptions`): add `Excess` and `Unlinked Salary` to the type filter list.
3. **`Unlinked Salary` tile gets a warning chip / tooltip.** Render a small `WarningAmber` icon (or similar) next to the tile label with a tooltip: `"These payments aren't linked to attendance. Filter the table by 'Unlinked Salary' to investigate."` Clicking the tile sets the table type filter to `Unlinked Salary`.
4. The breakdown loop already iterates `Object.entries(stats.categoryBreakdown)` and renders any expense_type, so the new `Excess` and `Unlinked Salary` tiles appear automatically. The warning chip is the only conditional render.

`get_expense_summary` RPC: no change. It groups by `expense_type` already, so it returns the new types automatically.

### Visual (after migration)

For Srinivasan House & Shop, All Time:

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│ Contract Salary  │  │ Material         │  │ Daily Salary     │  │ Unlinked Salary  ⚠   │
│ ₹3,50,450        │  │ ₹2,85,825        │  │ ₹1,67,875        │  │ ₹73,425              │
│ 114 rec · 2 adv  │  │ 27 rec           │  │ 88 rec           │  │ 34 rec               │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Excess           │  │ Miscellaneous    │  │ Tea & Snacks     │
│ ₹22,799          │  │ ₹5,425           │  │ ₹4,327           │
│ 19 rec           │  │ 7 rec            │  │ 11 rec           │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

`Daily Salary ₹1,67,875` matches the intersection with `/site/payments` PAID. The 17-SG / ₹49,700 residual is acknowledged in the spec but not chased here.

### Edge cases

| Scenario | Behavior |
|---|---|
| Site has no excess SGs | `Excess` tile not rendered (key absent from breakdown). |
| Site has no orphan SGs | `Unlinked Salary` tile not rendered. |
| Mode B archived SGs | Filtered out everywhere — same as `/site/payments`. |
| `payment_type='salary'` with `daily_attendance.settlement_group_id` set but `da.is_archived=true` | Goes to `Unlinked Salary` (by design — matches payment summary's archived-attendance handling). |
| User clicks `Unlinked Salary` tile | Table filter applies; user sees only those rows for hands-on cleanup. |
| Migration applied but UI not yet deployed | New rows surface as their own tile via the existing breakdown loop; warning chip just doesn't appear yet. Acceptable interim state. |

### What stays unchanged

- `Contract Salary`, `Advance`, `Material`, `Miscellaneous`, `Tea & Snacks` branches in `v_all_expenses`.
- All `get_payment_summary` and `/site/payments` behaviors.
- The DataTable below the breakdown — same row data flows through; it just gets two more `expense_type` values to display.
- Slice A's Contract Salary merge (already specced above).

### Verification

After migration applied + UI deployed, on `/site/expenses` for **Srinivasan House & Shop, All Time**:

1. `Daily Salary` tile = ₹1,67,875 (88 rec). Matches the intersection between the two views.
2. `Excess` tile = ₹22,799 (19 rec). Renders with no warning chip.
3. `Unlinked Salary` tile = ₹73,425 (34 rec). Renders with warning icon and tooltip.
4. Sum of all tiles still equals `Total Expenses` (no money lost).
5. Filter table by `Type = Excess` — shows the 19 rows.
6. Filter table by `Type = Unlinked Salary` — shows the 34 rows.
7. Compare against `/site/payments` `Daily + Market PAID`: ₹2,17,575 = ₹1,67,875 (Daily Salary tile) + ₹49,700 (the 17 known contract-flagged SGs) — explainable gap.
8. Run the same comparison on a second site (e.g. Padmavathy) to make sure no regression for sites without excess/orphans.
9. Console clean.

### Acknowledged residual

The 17 contract-flagged-with-attendance SGs (₹49,700 on Srinivasan) remain in `Contract Salary` on `/site/expenses` but are counted in `Daily + Market PAID` on `/site/payments`. Closing this gap would require either:
- Re-classifying these in the view (changes Contract Salary tile, conflicts with Slice A), or
- Re-classifying them in `get_payment_summary` (changes the payments hero), or
- Data investigation per-row.

This is documented in the spec but explicitly out of scope. Open as a follow-up issue if the gap matters.

---

## Cross-slice notes

- **Order of merging**: Slice A (UI only) shipped first; Slice B (view migration + UI) ships second. Slice A's merge logic doesn't touch the `Daily Salary` / `Excess` / `Unlinked Salary` keys, so no conflict.
- **Migration safety**: The Slice B view migration is reversible by re-running the previous migration's view definition. No `settlement_groups` rows are touched.
- **Move-to-prod**: Slice B requires a Supabase migration; the `npm run build` + push pattern from `CLAUDE.md` covers this once the migration file is checked in. No Cloudflare Worker changes.
