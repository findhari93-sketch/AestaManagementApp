# /site/expenses Salary Tiles Reconcile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the `/site/expenses` `Breakdown by Type` tiles with `/site/payments` aggregates. Slice A folds `Advance` into `Contract Salary` (UI only). Slice B splits `Daily Salary` into three tiles (`Daily Salary`, `Excess`, `Unlinked Salary`) by updating `v_all_expenses` (DDL only — no `settlement_groups` writes).

**Architecture:** Slice A is a tiny rendering merge in `src/app/(main)/site/expenses/page.tsx` plus a unit-tested helper. Slice B introduces one new Supabase migration that recreates `v_all_expenses` with three changed/new branches, then updates the same page to surface the new types with a warning chip on `Unlinked Salary`. Both slices are independently deployable; ship Slice A first.

**Tech Stack:** Next.js 15, MUI v7, React Query, Vitest + RTL, Supabase (PostgreSQL views), Playwright MCP for visual verification.

**Spec:** [docs/superpowers/specs/2026-05-06-expenses-contract-salary-includes-advance-design.md](../specs/2026-05-06-expenses-contract-salary-includes-advance-design.md)

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `src/lib/utils/expenseBreakdown.ts` | **Create** | Pure helper: `mergeContractSalaryWithAdvance(breakdown)` returns the breakdown map with `Advance` folded into `Contract Salary` (annotates with `advanceCount`). |
| `src/lib/utils/expenseBreakdown.test.ts` | **Create** | Vitest unit tests for the merge helper covering the four cases in the spec's edge-case table. |
| `src/app/(main)/site/expenses/page.tsx` | **Modify** | (Slice A) Use the helper; render `· N advance` sub-line conditionally. (Slice B) Add `Excess` + `Unlinked Salary` to `colorMap`, `filterSelectOptions`; render warning chip on `Unlinked Salary` tile. |
| `supabase/migrations/<timestamp>_split_daily_salary_excess_unlinked.sql` | **Create** | Drop + recreate `v_all_expenses`. Daily Salary branch gets the same `EXISTS daily_attendance OR market_laborer_attendance` + `is_archived=false` predicate the payment-summary RPC uses. New `Excess` branch (per-SG) and `Unlinked Salary` branch (per-SG). All other branches preserved verbatim. |

The merge helper lives in `src/lib/utils/` (matches existing utility pattern next to `weekUtils.ts`, `holidayUtils.ts`). The existing migration `20260212100001_restore_misc_expense_type_mapping.sql` is the source of truth for the current view definition — copy its contents and modify only the salary branches.

---

# SLICE A — Contract Salary tile includes mesthri advances (UI only)

### Task 1: Create the merge helper with a failing test

**Files:**
- Create: `src/lib/utils/expenseBreakdown.ts`
- Create: `src/lib/utils/expenseBreakdown.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/utils/expenseBreakdown.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  mergeContractSalaryWithAdvance,
  type ExpenseBreakdownEntry,
} from "./expenseBreakdown";

type Breakdown = Record<string, ExpenseBreakdownEntry>;

describe("mergeContractSalaryWithAdvance", () => {
  it("folds Advance into Contract Salary when both are present", () => {
    const input: Breakdown = {
      "Contract Salary": { amount: 335450, count: 114 },
      Advance: { amount: 15000, count: 2 },
      Material: { amount: 285825, count: 27 },
    };
    const out = mergeContractSalaryWithAdvance(input);
    expect(out["Contract Salary"]).toEqual({
      amount: 350450,
      count: 114,
      advanceCount: 2,
    });
    expect(out.Advance).toBeUndefined();
    expect(out.Material).toEqual({ amount: 285825, count: 27 });
  });

  it("leaves Contract Salary untouched when no Advance is present", () => {
    const input: Breakdown = {
      "Contract Salary": { amount: 335450, count: 114 },
      Material: { amount: 285825, count: 27 },
    };
    const out = mergeContractSalaryWithAdvance(input);
    expect(out["Contract Salary"]).toEqual({ amount: 335450, count: 114 });
    expect((out["Contract Salary"] as ExpenseBreakdownEntry).advanceCount).toBeUndefined();
    expect(out.Advance).toBeUndefined();
  });

  it("keeps Advance standalone when Contract Salary is absent (defensive)", () => {
    const input: Breakdown = {
      Advance: { amount: 15000, count: 2 },
      Material: { amount: 285825, count: 27 },
    };
    const out = mergeContractSalaryWithAdvance(input);
    expect(out.Advance).toEqual({ amount: 15000, count: 2 });
    expect(out["Contract Salary"]).toBeUndefined();
  });

  it("returns an empty object when input has no salary keys", () => {
    const input: Breakdown = {
      Material: { amount: 285825, count: 27 },
      "Tea & Snacks": { amount: 4327, count: 11 },
    };
    const out = mergeContractSalaryWithAdvance(input);
    expect(out.Material).toEqual({ amount: 285825, count: 27 });
    expect(out["Tea & Snacks"]).toEqual({ amount: 4327, count: 11 });
    expect(out["Contract Salary"]).toBeUndefined();
    expect(out.Advance).toBeUndefined();
  });

  it("does not mutate the input object", () => {
    const input: Breakdown = {
      "Contract Salary": { amount: 100, count: 1 },
      Advance: { amount: 50, count: 1 },
    };
    const inputCopy = JSON.parse(JSON.stringify(input));
    mergeContractSalaryWithAdvance(input);
    expect(input).toEqual(inputCopy);
  });
});
```

- [ ] **Step 2: Run the test — expect failure (module not found)**

Run: `npx vitest run src/lib/utils/expenseBreakdown.test.ts`

Expected: FAIL with `Cannot find module './expenseBreakdown'` (or similar import error).

- [ ] **Step 3: Implement the helper**

Create `src/lib/utils/expenseBreakdown.ts`:

```typescript
export interface ExpenseBreakdownEntry {
  amount: number;
  count: number;
  /** Number of Advance records folded into this Contract Salary entry. */
  advanceCount?: number;
}

export type ExpenseBreakdown = Record<string, ExpenseBreakdownEntry>;

/**
 * Folds the `Advance` expense_type into `Contract Salary` so the page renders
 * a single "total mesthri paid" tile. Mirrors the SalarySliceHero's
 * Total Paid = settlementsTotal + advancesTotal aggregate.
 */
export function mergeContractSalaryWithAdvance(
  breakdown: ExpenseBreakdown,
): ExpenseBreakdown {
  const out: ExpenseBreakdown = { ...breakdown };
  const contract = out["Contract Salary"];
  const advance = out.Advance;

  if (contract && advance) {
    out["Contract Salary"] = {
      amount: contract.amount + advance.amount,
      count: contract.count,
      advanceCount: advance.count,
    };
    delete out.Advance;
  }

  return out;
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run src/lib/utils/expenseBreakdown.test.ts`

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/expenseBreakdown.ts src/lib/utils/expenseBreakdown.test.ts
git commit -m "feat(expenses): add Contract Salary + Advance merge helper"
```

---

### Task 2: Wire the helper into the expenses page breakdown render

**Files:**
- Modify: `src/app/(main)/site/expenses/page.tsx` (~lines 1011-1047 — the breakdown rendering loop)

- [ ] **Step 1: Add the import**

In `src/app/(main)/site/expenses/page.tsx`, add to the existing imports near the top (after the other `@/lib/utils/...` import):

```typescript
import {
  mergeContractSalaryWithAdvance,
  type ExpenseBreakdownEntry,
} from "@/lib/utils/expenseBreakdown";
```

- [ ] **Step 2: Apply the merge before the tile loop**

Find the rendering block (around line 1011) that starts with:

```tsx
{Object.entries(stats.categoryBreakdown)
  .sort(([, a], [, b]) => b.amount - a.amount)
  .map(([type, data]) => (
```

Replace the `Object.entries(stats.categoryBreakdown)` expression so it operates on the merged map. The cleanest way is to introduce a `displayBreakdown` value just above the JSX that renders the middle column (around line 996, before the `{Object.keys(stats.categoryBreakdown).length > 0 && (...)}` conditional):

```tsx
const displayBreakdown = mergeContractSalaryWithAdvance(stats.categoryBreakdown);
```

Then inside the JSX, change the existing iteration to:

```tsx
{Object.keys(displayBreakdown).length > 0 && (
  <Box sx={{ flex: 1 }}>
    {/* ...existing "Breakdown by Type" caption... */}
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
      {Object.entries(displayBreakdown)
        .sort(([, a], [, b]) => b.amount - a.amount)
        .map(([type, data]) => (
          // ...existing tile JSX, but updated count line (next step)...
        ))}
    </Box>
  </Box>
)}
```

Note: `displayBreakdown` must be declared **inside** the component function body so it has access to `stats`. Place it just above the `return` JSX, alongside the existing variables.

- [ ] **Step 3: Update the sub-line to render `· N advance` when present**

Inside the tile JSX, the existing count line is:

```tsx
<Typography variant="caption" color="text.disabled">
  {data.count} rec
</Typography>
```

Replace with:

```tsx
<Typography variant="caption" color="text.disabled">
  {data.count} rec
  {(data as ExpenseBreakdownEntry).advanceCount != null && (
    <> · {(data as ExpenseBreakdownEntry).advanceCount} advance</>
  )}
</Typography>
```

The cast is needed because the existing local type for `categoryBreakdown` is inline `Record<string, { amount: number; count: number }>`. Either widen that type to `ExpenseBreakdownEntry` (preferred) or use the cast above. If widening: change the relevant type annotations on `ScopeSummary.breakdown`, the inline reduce `acc` type, and the `categoryBreakdown` field on `stats` to use `ExpenseBreakdownEntry`. The widening is preferred — it's three small changes:

1. `scopeSummary` interface (line 148-149): `breakdown: Record<string, ExpenseBreakdownEntry>;`
2. The fallback reduce's accumulator type (around line 616): `as Record<string, ExpenseBreakdownEntry>`
3. The `stats.categoryBreakdown` annotation derives automatically.

- [ ] **Step 4: Run typecheck and unit tests**

Run: `npx tsc --noEmit`

Expected: No errors.

Run: `npx vitest run src/lib/utils/expenseBreakdown.test.ts`

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/(main)/site/expenses/page.tsx
git commit -m "feat(expenses): fold Advance into Contract Salary tile"
```

---

### Task 3: Visual verify Slice A on Srinivasan

**Files:** None modified — verification only.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

Wait until you see `Ready in ...ms`. Note the port (usually 3000 or 3001).

- [ ] **Step 2: Auto-login via Playwright MCP**

Navigate browser to `http://localhost:3000/dev-login` (adjust port if different). The page auto-authenticates with the test credentials and redirects to the dashboard.

- [ ] **Step 3: Open Srinivasan House & Shop, /site/expenses, All Time**

In the site picker, choose "Srinivasan House & Shop". Then navigate to `/site/expenses`. Make sure the date scope is set to "All Time".

- [ ] **Step 4: Take a screenshot of the Breakdown panel**

Use the Playwright MCP screenshot tool. The screenshot should show:
- `Contract Salary` tile reads `₹3,50,450` with sub-line `114 rec · 2 advance`.
- The standalone `Advance ₹15,000` tile is **gone**.
- Other tiles (`Daily Salary`, `Material`, `Miscellaneous`, `Tea & Snacks`) unchanged from the pre-Slice-A baseline screenshot.

- [ ] **Step 5: Verify console is clean**

Use `playwright_console_logs` to retrieve all messages. Expected: no React warnings or errors related to the breakdown render.

- [ ] **Step 6: Verify the table filter still works**

Open the column filter dropdown for `Type`, select `Advance`, confirm the table shows the 2 advance rows. Then clear the filter.

- [ ] **Step 7: Switch to a tab without salary types and verify no regression**

Click the `Material` tab on the lower tabs row. The `Breakdown by Type` should show only `Material` (no Contract Salary, no Advance).

- [ ] **Step 8: Close the browser**

Use `playwright_close`. No commit needed — verification only.

---

# SLICE B — Daily Salary reconciliation (view migration + UI)

### Task 4: Read the existing view and prepare the new migration file

**Files:**
- Read: `supabase/migrations/20260212100001_restore_misc_expense_type_mapping.sql`
- Create: `supabase/migrations/<timestamp>_split_daily_salary_excess_unlinked.sql`

- [ ] **Step 1: Read the entire current view definition**

Run: `Read supabase/migrations/20260212100001_restore_misc_expense_type_mapping.sql`

This file is 521 lines. The view definition starts at line 7 (`DROP VIEW IF EXISTS ... ; CREATE VIEW ... AS`) and ends at line 519. Verify the structure: 8 UNION ALL branches in this order — Regular expenses, Daily Salary (lines 52-118), Contract Salary (122-181), Advance (186-244), Tea Shop (248-305), Misc (309-391), Subcontract direct payments (395-460), Material Purchases (464-519).

- [ ] **Step 2: Pick the migration timestamp**

Use today's UTC timestamp in the format `YYYYMMDDHHMMSS`. E.g. `20260506120000`. Filename: `supabase/migrations/20260506120000_split_daily_salary_excess_unlinked.sql`.

- [ ] **Step 3: Create the migration file with the leading comment block**

```sql
-- Migration: Split Daily Salary into Daily Salary + Excess + Unlinked Salary
--
-- /site/expenses Breakdown by Type previously bucketed three different
-- settlement_groups patterns into a single "Daily Salary" tile, which made
-- it diverge from /site/payments Daily+Market PAID. This migration:
--
--   * Tightens the Daily Salary branch to require the same
--     daily_attendance / market_laborer_attendance link the
--     get_payment_summary RPC already uses, plus is_archived=false
--     for Mode B reconcile compatibility.
--   * Adds a new Excess branch for settlement_groups with
--     payment_type='excess' (one row per SG, mirrors the Advance branch).
--   * Adds a new Unlinked Salary branch for orphan settlement_groups
--     (payment_type='salary' with no attendance and no labor_payments
--     link). These are visible to the user via a dedicated tile so they
--     can be cleaned up over time.
--
-- No settlement_groups data is rewritten. The total ₹ across all
-- expense_types is preserved (sum invariant).
--
-- Spec: docs/superpowers/specs/2026-05-06-expenses-contract-salary-includes-advance-design.md
-- Reversible: re-run 20260212100001_restore_misc_expense_type_mapping.sql

DROP VIEW IF EXISTS "public"."v_all_expenses";

CREATE VIEW "public"."v_all_expenses" AS
```

After this, paste the existing branch list from the prior migration with the modifications described in Tasks 5 / 6 / 7.

---

### Task 5: Update the Daily Salary branch in the new migration

**Files:**
- Modify: `supabase/migrations/20260506120000_split_daily_salary_excess_unlinked.sql` (in progress)

- [ ] **Step 1: Copy the Regular expenses branch (lines 9-50 of the prior migration) verbatim**

Including the trailing `UNION ALL`. No edits.

- [ ] **Step 2: Copy the Daily Salary branch (lines 54-118) and modify the WHERE clause**

The original WHERE clause (lines 115-117) is:

```sql
WHERE (("sg"."is_cancelled" = false)
   AND (COALESCE("sg"."payment_type", 'salary'::"text") <> 'advance'::"text")
   AND (NOT (EXISTS ( SELECT 1
              FROM "public"."labor_payments" "lp"
             WHERE (("lp"."settlement_group_id" = "sg"."id")
                AND ("lp"."is_under_contract" = true))))))
GROUP BY "sg"."site_id", "sg"."settlement_date"
```

Replace with:

```sql
WHERE ("sg"."is_cancelled" = false)
  AND ("sg"."is_archived" = false)
  AND (COALESCE("sg"."payment_type", 'salary'::"text") = 'salary'::"text")
  AND (NOT EXISTS (
        SELECT 1 FROM "public"."labor_payments" "lp"
         WHERE "lp"."settlement_group_id" = "sg"."id"
           AND "lp"."is_under_contract" = true))
  AND (
        EXISTS (
          SELECT 1 FROM "public"."daily_attendance" "da"
           WHERE "da"."settlement_group_id" = "sg"."id"
             AND "da"."is_archived" = false)
        OR EXISTS (
          SELECT 1 FROM "public"."market_laborer_attendance" "ma"
           WHERE "ma"."settlement_group_id" = "sg"."id")
       )
GROUP BY "sg"."site_id", "sg"."settlement_date"
```

Keep everything else (the SELECT list, the FROM/JOIN, the GROUP BY) identical to the prior branch. Add the trailing `UNION ALL`.

The change in semantics: `<> 'advance'` becomes `= 'salary'` (excludes `'excess'`, which now goes to its own branch); add `is_archived=false`; add the daily_attendance OR market_laborer_attendance link requirement.

- [ ] **Step 3: Copy the Contract Salary branch (lines 122-181) verbatim**

Including the trailing `UNION ALL`. No edits.

- [ ] **Step 4: Copy the Advance branch (lines 186-244) verbatim**

Including the trailing `UNION ALL`. No edits.

---

### Task 6: Add the Excess branch (NEW)

**Files:**
- Modify: `supabase/migrations/20260506120000_split_daily_salary_excess_unlinked.sql` (continuing)

- [ ] **Step 1: Append the new Excess branch**

After the Advance branch's trailing `UNION ALL`, append. The shape mirrors the Advance branch — one row per SG — with two changes: WHERE filters on `payment_type='excess'`, and `expense_type` is `'Excess'`. Description prefix is `'Excess payment'` instead of `'Advance payment'`.

```sql
-- Excess / Overpayment settlements (NEW — split from Daily Salary)
SELECT "sg"."id",
    "sg"."site_id",
    "sg"."settlement_date" AS "date",
    COALESCE("sg"."actual_payment_date", ("sg"."created_at")::"date") AS "recorded_date",
    "sg"."total_amount" AS "amount",
        CASE
            WHEN (("sg"."notes" IS NOT NULL) AND ("sg"."notes" <> ''::"text"))
                 THEN ((('Excess payment ('::"text" || "sg"."laborer_count") || ' laborers) - '::"text") || "sg"."notes")
            ELSE (('Excess payment ('::"text" || "sg"."laborer_count") || ' laborers)'::"text")
        END AS "description",
    ( SELECT "expense_categories"."id"
           FROM "public"."expense_categories"
          WHERE (("expense_categories"."name")::"text" = 'Salary Settlement'::"text")
         LIMIT 1) AS "category_id",
    'Salary Settlement'::character varying AS "category_name",
    'labor'::"text" AS "module",
    'Excess'::"text" AS "expense_type",
        CASE
            WHEN ("sg"."payment_channel" = 'direct'::"text") THEN true
            WHEN ("sg"."engineer_transaction_id" IS NOT NULL)
                 THEN COALESCE(( SELECT "site_engineer_transactions"."is_settled"
                    FROM "public"."site_engineer_transactions"
                   WHERE ("site_engineer_transactions"."id" = "sg"."engineer_transaction_id")), false)
            ELSE false
        END AS "is_cleared",
        CASE
            WHEN ("sg"."payment_channel" = 'direct'::"text") THEN "sg"."settlement_date"
            WHEN ("sg"."engineer_transaction_id" IS NOT NULL)
                 THEN ( SELECT ("site_engineer_transactions"."confirmed_at")::"date"
                    FROM "public"."site_engineer_transactions"
                   WHERE (("site_engineer_transactions"."id" = "sg"."engineer_transaction_id")
                      AND ("site_engineer_transactions"."is_settled" = true)))
            ELSE NULL::"date"
        END AS "cleared_date",
    "sg"."subcontract_id" AS "contract_id",
    "sc"."title" AS "subcontract_title",
    NULL::"uuid" AS "site_payer_id",
        CASE
            WHEN ("sg"."payer_source" IS NULL) THEN 'Own Money'::"text"
            WHEN ("sg"."payer_source" = 'own_money'::"text") THEN 'Own Money'::"text"
            WHEN ("sg"."payer_source" = 'amma_money'::"text") THEN 'Amma Money'::"text"
            WHEN ("sg"."payer_source" = 'client_money'::"text") THEN 'Client Money'::"text"
            WHEN ("sg"."payer_source" = 'other_site_money'::"text") THEN COALESCE("sg"."payer_name", 'Other Site'::"text")
            WHEN ("sg"."payer_source" = 'custom'::"text") THEN COALESCE("sg"."payer_name", 'Other'::"text")
            ELSE COALESCE("sg"."payer_name", 'Own Money'::"text")
        END AS "payer_name",
    "sg"."payment_mode",
    NULL::"text" AS "vendor_name",
    "sg"."proof_url" AS "receipt_url",
    "sg"."created_by" AS "paid_by",
    "sg"."created_by_name" AS "entered_by",
    "sg"."created_by" AS "entered_by_user_id",
    "sg"."settlement_reference",
    "sg"."id" AS "settlement_group_id",
    "sg"."engineer_transaction_id",
    'settlement'::"text" AS "source_type",
    "sg"."id" AS "source_id",
    "sg"."created_at",
    "sg"."is_cancelled" AS "is_deleted"
FROM ("public"."settlement_groups" "sg"
    LEFT JOIN "public"."subcontracts" "sc" ON (("sg"."subcontract_id" = "sc"."id")))
WHERE ("sg"."is_cancelled" = false)
  AND ("sg"."is_archived" = false)
  AND ("sg"."payment_type" = 'excess'::"text")

UNION ALL
```

---

### Task 7: Add the Unlinked Salary branch (NEW)

**Files:**
- Modify: `supabase/migrations/20260506120000_split_daily_salary_excess_unlinked.sql` (continuing)

- [ ] **Step 1: Append the new Unlinked Salary branch**

After the Excess branch's `UNION ALL`, append. Same shape as the Excess branch (per-SG); change `expense_type` to `'Unlinked Salary'`, the description prefix to `'Unlinked salary'`, and the WHERE to filter for orphan rows.

```sql
-- Unlinked Salary settlements (NEW — split from Daily Salary)
-- These are payment_type='salary' SGs with no attendance and no labor_payment
-- link. Visible as a dedicated tile so users can investigate / clean up.
SELECT "sg"."id",
    "sg"."site_id",
    "sg"."settlement_date" AS "date",
    COALESCE("sg"."actual_payment_date", ("sg"."created_at")::"date") AS "recorded_date",
    "sg"."total_amount" AS "amount",
        CASE
            WHEN (("sg"."notes" IS NOT NULL) AND ("sg"."notes" <> ''::"text"))
                 THEN ((('Unlinked salary ('::"text" || "sg"."laborer_count") || ' laborers) - '::"text") || "sg"."notes")
            ELSE (('Unlinked salary ('::"text" || "sg"."laborer_count") || ' laborers)'::"text")
        END AS "description",
    ( SELECT "expense_categories"."id"
           FROM "public"."expense_categories"
          WHERE (("expense_categories"."name")::"text" = 'Salary Settlement'::"text")
         LIMIT 1) AS "category_id",
    'Salary Settlement'::character varying AS "category_name",
    'labor'::"text" AS "module",
    'Unlinked Salary'::"text" AS "expense_type",
        CASE
            WHEN ("sg"."payment_channel" = 'direct'::"text") THEN true
            WHEN ("sg"."engineer_transaction_id" IS NOT NULL)
                 THEN COALESCE(( SELECT "site_engineer_transactions"."is_settled"
                    FROM "public"."site_engineer_transactions"
                   WHERE ("site_engineer_transactions"."id" = "sg"."engineer_transaction_id")), false)
            ELSE false
        END AS "is_cleared",
        CASE
            WHEN ("sg"."payment_channel" = 'direct'::"text") THEN "sg"."settlement_date"
            WHEN ("sg"."engineer_transaction_id" IS NOT NULL)
                 THEN ( SELECT ("site_engineer_transactions"."confirmed_at")::"date"
                    FROM "public"."site_engineer_transactions"
                   WHERE (("site_engineer_transactions"."id" = "sg"."engineer_transaction_id")
                      AND ("site_engineer_transactions"."is_settled" = true)))
            ELSE NULL::"date"
        END AS "cleared_date",
    "sg"."subcontract_id" AS "contract_id",
    "sc"."title" AS "subcontract_title",
    NULL::"uuid" AS "site_payer_id",
        CASE
            WHEN ("sg"."payer_source" IS NULL) THEN 'Own Money'::"text"
            WHEN ("sg"."payer_source" = 'own_money'::"text") THEN 'Own Money'::"text"
            WHEN ("sg"."payer_source" = 'amma_money'::"text") THEN 'Amma Money'::"text"
            WHEN ("sg"."payer_source" = 'client_money'::"text") THEN 'Client Money'::"text"
            WHEN ("sg"."payer_source" = 'other_site_money'::"text") THEN COALESCE("sg"."payer_name", 'Other Site'::"text")
            WHEN ("sg"."payer_source" = 'custom'::"text") THEN COALESCE("sg"."payer_name", 'Other'::"text")
            ELSE COALESCE("sg"."payer_name", 'Own Money'::"text")
        END AS "payer_name",
    "sg"."payment_mode",
    NULL::"text" AS "vendor_name",
    "sg"."proof_url" AS "receipt_url",
    "sg"."created_by" AS "paid_by",
    "sg"."created_by_name" AS "entered_by",
    "sg"."created_by" AS "entered_by_user_id",
    "sg"."settlement_reference",
    "sg"."id" AS "settlement_group_id",
    "sg"."engineer_transaction_id",
    'settlement'::"text" AS "source_type",
    "sg"."id" AS "source_id",
    "sg"."created_at",
    "sg"."is_cancelled" AS "is_deleted"
FROM ("public"."settlement_groups" "sg"
    LEFT JOIN "public"."subcontracts" "sc" ON (("sg"."subcontract_id" = "sc"."id")))
WHERE ("sg"."is_cancelled" = false)
  AND ("sg"."is_archived" = false)
  AND (COALESCE("sg"."payment_type", 'salary'::"text") = 'salary'::"text")
  AND (NOT EXISTS (
        SELECT 1 FROM "public"."labor_payments" "lp"
         WHERE "lp"."settlement_group_id" = "sg"."id"))
  AND (NOT EXISTS (
        SELECT 1 FROM "public"."daily_attendance" "da"
         WHERE "da"."settlement_group_id" = "sg"."id"))
  AND (NOT EXISTS (
        SELECT 1 FROM "public"."market_laborer_attendance" "ma"
         WHERE "ma"."settlement_group_id" = "sg"."id"))

UNION ALL
```

- [ ] **Step 2: Append the remaining branches verbatim**

After the Unlinked Salary `UNION ALL`, copy the four remaining branches from the prior migration in order: Tea Shop (lines 248-305), Misc expenses (lines 309-391), Subcontract direct payments (lines 395-460), Settled Material Purchases (lines 464-519). The last branch ends with `);` (closing the CREATE VIEW) — keep that.

- [ ] **Step 3: Append the COMMENT statement**

```sql
COMMENT ON VIEW "public"."v_all_expenses" IS
  'Unified expense view. Salary settlement_groups split into four expense_types: Daily Salary (per-date aggregate, requires daily_attendance or market_laborer_attendance link, is_archived=false), Contract Salary (per-SG, requires labor_payments.is_under_contract=true), Advance (payment_type=advance), Excess (payment_type=excess), Unlinked Salary (payment_type=salary with no attendance and no labor_payment link — surfaces orphan SGs for cleanup). Material purchases use amount_paid (bargained) when available; group_stock excluded until settled.';
```

---

### Task 8: Apply the migration locally and verify the view

**Files:** None modified — local DB verification only.

- [ ] **Step 1: Start local Supabase if not already running**

Run: `npm run db:start`

Wait for the container output. If already running, this is a no-op.

- [ ] **Step 2: Reset the local DB to apply the new migration**

Run: `npm run db:reset`

Expected: All migrations re-apply cleanly, including the new `20260506120000_split_daily_salary_excess_unlinked.sql`. No SQL errors.

If a SQL error appears, fix it and re-run. Common gotchas: missing comma in SELECT list, mismatched paren count, missing `UNION ALL` separator.

- [ ] **Step 3: Verify the view returns rows for all five salary expense_types**

Connect via psql:

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres
```

Run:

```sql
SELECT expense_type, COUNT(*) AS rows, SUM(amount) AS total
FROM v_all_expenses
WHERE module = 'labor'
GROUP BY expense_type
ORDER BY expense_type;
```

Expected: rows for `Advance`, `Contract Salary`, `Daily Salary`, `Direct Payment`. The new `Excess` and `Unlinked Salary` rows may or may not appear depending on whether the local seed data contains those SG patterns. The key check is that the query runs without error.

- [ ] **Step 4: Verify the view definition looks right**

```sql
\d+ v_all_expenses
```

Expected: column list matches the prior view (id, site_id, date, recorded_date, amount, description, category_id, category_name, module, expense_type, is_cleared, cleared_date, contract_id, subcontract_title, site_payer_id, payer_name, payment_mode, vendor_name, receipt_url, paid_by, entered_by, entered_by_user_id, settlement_reference, settlement_group_id, engineer_transaction_id, source_type, source_id, created_at, is_deleted). 29 columns total.

- [ ] **Step 5: Commit the migration**

```bash
git add supabase/migrations/20260506120000_split_daily_salary_excess_unlinked.sql
git commit -m "feat(expenses): split Daily Salary into Daily/Excess/Unlinked Salary in v_all_expenses"
```

---

### Task 9: Run prod assertions via Supabase MCP (read-only) before UI changes

**Files:** None modified — read-only verification.

- [ ] **Step 1: Confirm the migration is NOT yet applied to prod**

Use Supabase MCP: list the most recent migrations. The new `20260506120000_*` should NOT appear in the prod `supabase_migrations.schema_migrations` table yet. (The migration ships to prod via the standard "move to prod" workflow when the user is ready.)

- [ ] **Step 2: Dry-run the assertion SQL against the existing prod view**

Run via `mcp__supabase__execute_sql` (read-only):

```sql
-- Baseline: prod has only the OLD branches. This snapshot freezes the
-- expected post-migration totals.
SELECT
  '79bfcfb3-4b0d-4240-8fce-d1ab584ef972'::uuid AS site_id,
  -- post-migration Daily Salary (intersection): 88 SGs, ₹1,67,875
  (SELECT SUM(sg.total_amount) FROM settlement_groups sg
    WHERE sg.site_id = '79bfcfb3-4b0d-4240-8fce-d1ab584ef972'
      AND sg.is_cancelled = false AND sg.is_archived = false
      AND COALESCE(sg.payment_type, 'salary') = 'salary'
      AND NOT EXISTS (SELECT 1 FROM labor_payments lp
                       WHERE lp.settlement_group_id = sg.id AND lp.is_under_contract = true)
      AND (EXISTS (SELECT 1 FROM daily_attendance da
                    WHERE da.settlement_group_id = sg.id AND da.is_archived = false)
        OR EXISTS (SELECT 1 FROM market_laborer_attendance ma
                    WHERE ma.settlement_group_id = sg.id))) AS expected_daily_salary_amt,
  -- post-migration Excess: 19 SGs, ₹22,799
  (SELECT SUM(sg.total_amount) FROM settlement_groups sg
    WHERE sg.site_id = '79bfcfb3-4b0d-4240-8fce-d1ab584ef972'
      AND sg.is_cancelled = false AND sg.is_archived = false
      AND sg.payment_type = 'excess') AS expected_excess_amt,
  -- post-migration Unlinked Salary: 34 SGs, ₹73,425
  (SELECT SUM(sg.total_amount) FROM settlement_groups sg
    WHERE sg.site_id = '79bfcfb3-4b0d-4240-8fce-d1ab584ef972'
      AND sg.is_cancelled = false AND sg.is_archived = false
      AND COALESCE(sg.payment_type, 'salary') = 'salary'
      AND NOT EXISTS (SELECT 1 FROM labor_payments lp
                       WHERE lp.settlement_group_id = sg.id)
      AND NOT EXISTS (SELECT 1 FROM daily_attendance da
                       WHERE da.settlement_group_id = sg.id)
      AND NOT EXISTS (SELECT 1 FROM market_laborer_attendance ma
                       WHERE ma.settlement_group_id = sg.id)) AS expected_unlinked_amt;
```

Expected values for Srinivasan (validated during spec investigation): `expected_daily_salary_amt = 167875`, `expected_excess_amt = 22799`, `expected_unlinked_amt = 73425`. Sum = 264099, matching the current Daily Salary total.

If the numbers diverge from the spec, stop and re-investigate before deploying — the data may have shifted since the spec was written.

- [ ] **Step 3: Handle drift if numbers moved**

If the spec snapshot is stale and the user is OK with whatever the current numbers are, that's fine — record the new values and proceed. The plan's correctness doesn't depend on the exact ₹ — just that the three buckets sum to the prior Daily Salary total.

---

### Task 10: Update colorMap and filterSelectOptions for new expense_types

**Files:**
- Modify: `src/app/(main)/site/expenses/page.tsx` (lines ~756 and ~759)

- [ ] **Step 1: Add `Excess` and `Unlinked Salary` to filterSelectOptions**

Find (around line 756):

```tsx
filterSelectOptions: [
  "Daily Salary",
  "Contract Salary",
  "Advance",
  "Direct Payment",
  "Material",
  "Machinery",
  "General",
  "Miscellaneous",
  "Tea & Snacks",
],
```

Replace with (alphabetical insertion):

```tsx
filterSelectOptions: [
  "Daily Salary",
  "Contract Salary",
  "Advance",
  "Excess",
  "Unlinked Salary",
  "Direct Payment",
  "Material",
  "Machinery",
  "General",
  "Miscellaneous",
  "Tea & Snacks",
],
```

- [ ] **Step 2: Add color mappings**

Find the colorMap (around line 759):

```tsx
const colorMap: Record<string, "primary" | "secondary" | "warning" | "info" | "success" | "default" | "error"> = {
  "Daily Salary": "primary",
  "Contract Salary": "secondary",
  "Advance": "warning",
  "Direct Payment": "secondary",
  "Material": "info",
  "Machinery": "success",
  "General": "default",
  "Miscellaneous": "error",
  "Tea & Snacks": "warning",
};
```

Add two entries:

```tsx
const colorMap: Record<string, "primary" | "secondary" | "warning" | "info" | "success" | "default" | "error"> = {
  "Daily Salary": "primary",
  "Contract Salary": "secondary",
  "Advance": "warning",
  "Excess": "warning",
  "Unlinked Salary": "error",
  "Direct Payment": "secondary",
  "Material": "info",
  "Machinery": "success",
  "General": "default",
  "Miscellaneous": "error",
  "Tea & Snacks": "warning",
};
```

`Excess` shares warning (similar to Advance — it's a separate-from-wages payment). `Unlinked Salary` uses error to draw attention to the data hygiene issue.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(main)/site/expenses/page.tsx
git commit -m "feat(expenses): register Excess and Unlinked Salary in type filters and colors"
```

---

### Task 11: Add warning chip + tooltip on the Unlinked Salary tile

**Files:**
- Modify: `src/app/(main)/site/expenses/page.tsx` (the breakdown tile rendering loop)

- [ ] **Step 1: Add `WarningAmber` to the existing `@mui/icons-material` import**

Find the icon import block near the top of the file (around line 33-43) and add `WarningAmber` if not present:

```tsx
import {
  Add,
  Delete,
  Edit,
  AttachMoney,
  OpenInNew,
  Close,
  ChevronRight,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  WarningAmber,
} from "@mui/icons-material";
```

- [ ] **Step 2: Render the warning icon next to the type label inside the tile**

Inside the breakdown tile JSX (the part that currently renders `<Typography>{type}</Typography>` for the type label, around line 1032-1038), wrap with a flex row that conditionally adds the icon when `type === "Unlinked Salary"`:

```tsx
<Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.25 }}>
  <Typography
    variant="caption"
    color="text.secondary"
    noWrap
  >
    {type}
  </Typography>
  {type === "Unlinked Salary" && (
    <Tooltip title="These salary settlements aren't linked to any attendance row. Filter the table by 'Unlinked Salary' to investigate and clean up.">
      <WarningAmber sx={{ fontSize: 14, color: "warning.main" }} />
    </Tooltip>
  )}
</Box>
```

(Replaces the existing single `<Typography>{type}</Typography>` that wraps the type label.)

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`

Expected: No errors. (`Tooltip` is already imported; `WarningAmber` was just added.)

- [ ] **Step 4: Commit**

```bash
git add src/app/(main)/site/expenses/page.tsx
git commit -m "feat(expenses): add warning chip + tooltip on Unlinked Salary tile"
```

---

### Task 12: Visual verify Slice B locally

**Files:** None modified — verification only.

- [ ] **Step 1: Confirm dev server is running on local DB**

Either keep the dev server from Task 3 running, or start fresh: `npm run dev:local` (uses local Supabase from Task 8). Note the port.

- [ ] **Step 2: Auto-login + open Srinivasan, /site/expenses, All Time**

Same as Task 3 Steps 2-3, but only if the local DB has Srinivasan-equivalent fixture data. If local data is empty, skip to Step 5 and rely on prod-deployed verification.

- [ ] **Step 3: Verify the breakdown shows new tiles (if local data permits)**

Expected new tiles for Srinivasan-like fixture:
- `Daily Salary` ₹1,67,875 (88 rec) — down from ₹2,64,099.
- `Excess` ₹22,799 (19 rec) with warning color (no chip).
- `Unlinked Salary` ₹73,425 (34 rec) **with warning icon and tooltip on hover**.

If local data doesn't have prod-like SG patterns, you'll see the page render without errors but with different/missing tiles. That's still useful — verify it doesn't crash.

- [ ] **Step 4: Verify table filter dropdown**

Open the `Type` column filter — `Excess` and `Unlinked Salary` should appear in the dropdown options.

- [ ] **Step 5: Verify console clean**

Use `playwright_console_logs`. Expected: no errors or warnings related to the breakdown changes.

- [ ] **Step 6: Close browser**

Use `playwright_close`. No commit — verification only.

---

### Task 13: Deploy migration + UI to prod and verify against Srinivasan

**Files:** None modified — production verification.

- [ ] **Step 1: Move to prod**

The user will trigger this with "move to prod". Per `CLAUDE.md`, that runs `npm run build`, commits, pushes (triggers Next.js pipeline), and applies the new Supabase migration via the standard pipeline.

- [ ] **Step 2: Wait for deploy to complete**

Watch the deploy pipeline. The Cloudflare Worker does NOT need redeployment (no `cloudflare-proxy/` changes).

- [ ] **Step 3: Verify v_all_expenses on prod via Supabase MCP**

Run via `mcp__supabase__execute_sql`:

```sql
SELECT expense_type, COUNT(*) AS rows, SUM(amount) AS total
FROM v_all_expenses
WHERE site_id = '79bfcfb3-4b0d-4240-8fce-d1ab584ef972'
  AND module = 'labor'
GROUP BY expense_type
ORDER BY expense_type;
```

Expected rows include:
- `Daily Salary` total ≈ ₹1,67,875 (88 rec aggregated by date may show fewer rows than 88 — count is per-date)
- `Excess` total ≈ ₹22,799 (19 rec)
- `Unlinked Salary` total ≈ ₹73,425 (34 rec)
- `Contract Salary` total ≈ ₹3,35,450 (114 rec, unchanged)
- `Advance` total ≈ ₹15,000 (2 rec, unchanged)

Sum of all labor rows should be unchanged from before deploy (run a snapshot query before deploy if you want a hard before/after compare).

- [ ] **Step 4: Visual verify against the live app**

Auto-login at the prod app URL (or just have the user verify). On `/site/expenses` for Srinivasan, All Time:
- `Contract Salary` tile reads `₹3,50,450 · 114 rec · 2 advance` (Slice A).
- `Daily Salary` tile reads `₹1,67,875` with around 88 rec.
- `Excess` tile reads `₹22,799 · 19 rec`.
- `Unlinked Salary` tile reads `₹73,425 · 34 rec` with warning icon + tooltip.
- Sum of all tiles equals `Total Expenses` — no money lost.

- [ ] **Step 5: Spot-check a non-Srinivasan site**

Switch to **Padmavathy** or **Mathur** site. Verify:
- Page renders without console errors.
- If those sites have no excess/unlinked rows, the corresponding tiles simply don't appear (no empty/zero tiles).
- Other tiles unchanged from before deploy.

- [ ] **Step 6: Compare /site/expenses Daily Salary against /site/payments Daily+Market PAID**

Open both pages side-by-side for Srinivasan, All Time:
- `/site/expenses Daily Salary` ≈ ₹1,67,875.
- `/site/payments Daily+Market PAID` ≈ ₹2,17,575.
- The residual ₹49,700 / 17-SG gap is the documented out-of-scope difference (contract-flagged-with-attendance SGs). Acceptable.

---

## Self-review (run at end of plan execution)

1. **Spec coverage check** (mentally walk through each spec section):
   - Slice A goal — covered by Tasks 1-3.
   - Slice A visual — verified in Task 3 Step 4.
   - Slice A edge cases — exercised in unit tests (Task 1) and tab-switch verification (Task 3 Step 7).
   - Slice B database migration — Tasks 4-7.
   - Slice B local verify — Task 8.
   - Slice B prod assertion — Task 9 (pre-deploy) and Task 13 Step 3 (post-deploy).
   - Slice B UI changes — Tasks 10-11.
   - Slice B residual gap — explicitly verified as expected in Task 13 Step 6.

2. **Placeholder scan**: confirm no "TODO", "TBD", or hand-wavy steps exist in the executed work.

3. **Type / name consistency**: confirm `mergeContractSalaryWithAdvance`, `ExpenseBreakdownEntry`, and the `displayBreakdown` variable name match across Tasks 1, 2.

4. **Move-to-prod readiness**: a single "move to prod" run will deploy both slices and the migration in one go. No Cloudflare Worker changes needed.
