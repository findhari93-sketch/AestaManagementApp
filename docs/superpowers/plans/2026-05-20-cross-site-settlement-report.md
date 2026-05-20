# Cross-Site Settlement Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Settlements" tab on `/company/reports/` that pivots all contract settlements across a site or a site-group into a weekly per-site grid (with paid vs calculated sub-columns), drills down to per-day per-laborer detail via the existing InspectPane, and exports a customisable CSV / print view tailored to multi-site owner verification.

**Architecture:** One new Postgres RPC `get_multi_site_settlement_report` (templated on `get_company_daily_peek`) returns one row per `(site_id, subcontract_id, week_start)`. A React Query hook wraps it. The UI is a single tab component composed of a toolbar (scope + trade + date + view), a Wide pivot table (per-site columns), a Long chronological table (sibling tab), an export dialog (papaparse), a print view (window.print + `@media print`), and InspectPane wired for `weekly-aggregate` row clicks.

**Tech Stack:** Next.js 15 app router, Supabase RPC + RLS, MUI v7, React Query (TanStack Query), material-react-table (via existing `DataTable`), papaparse, dayjs, vitest for unit tests.

**Approved spec:** `C:\Users\Haribabu\.claude\plans\so-this-was-one-cheeky-mccarthy.md`

---

## File Structure

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260520140000_settlement_report_rpc.sql` | `get_multi_site_settlement_report(site_ids uuid[], date_from date, date_to date, category_id uuid)` Postgres function + GRANT |
| `src/types/settlementReport.types.ts` | Row, column, and dialog types shared across hook/tables/export |
| `src/hooks/queries/useSettlementReport.ts` | React Query hook calling the RPC; also `useLaborCategories` if not already exported elsewhere |
| `src/lib/utils/settlementReportPivot.ts` | Pure function: long rows → wide pivot (site columns + totals row). Unit-tested. |
| `src/lib/utils/settlementReportPivot.test.ts` | vitest unit tests for the pivot |
| `src/lib/utils/settlementReportExport.ts` | CSV builder (papaparse) + filename generator + print HTML builder. Unit-tested. |
| `src/lib/utils/settlementReportExport.test.ts` | vitest unit tests for CSV builder |
| `src/components/reports/settlements/SettlementReportToolbar.tsx` | Scope picker + trade filter + date range + view tab toggle |
| `src/components/reports/settlements/SettlementReportWideTable.tsx` | Wide pivot table via `DataTable`; emits row-click |
| `src/components/reports/settlements/SettlementReportLongTable.tsx` | Long chronological table via `DataTable`; emits row-click |
| `src/components/reports/settlements/SettlementReportExportDialog.tsx` | Modal: granularity / layout / columns / notes / download |
| `src/components/reports/settlements/SettlementReportPrintView.ts` | Helper that opens a new window with print-friendly HTML |
| `src/components/reports/settlements/SettlementReportTab.tsx` | Top-level tab body: composes toolbar + table + dialog + InspectPane |
| `src/app/(main)/company/reports/page.tsx` | **modify** — wrap existing chart UI in a tab, add new "Settlements" tab next to it |

---

## Task 1: Verify Vishal's site_group exists in production

**Files:**
- Read-only check via `mcp__supabase__execute_sql`

- [ ] **Step 1: Query site_groups for Vishal's pair**

Run via `mcp__supabase__execute_sql`:
```sql
SELECT sg.id, sg.name, sg.is_active,
       array_agg(s.name ORDER BY s.name) as member_sites
FROM site_groups sg
LEFT JOIN sites s ON s.site_group_id = sg.id
WHERE LOWER(sg.name) LIKE '%vishal%'
   OR EXISTS (
     SELECT 1 FROM sites s2
     WHERE s2.site_group_id = sg.id
       AND LOWER(s2.name) IN ('padmavati', 'padmavathy', 'srinivasan')
   )
GROUP BY sg.id, sg.name, sg.is_active;
```

Expected: at least one row whose `member_sites` array includes both Padmavati (or Padmavathy) and Srinivasan.

- [ ] **Step 2: If missing, create via the existing UI**

If the query returns zero rows, the user must create the group BEFORE the report is useful. Tell the user: "Vishal's site group isn't set up yet — go to `/company/site-groups/`, create a group (e.g. 'Vishal'), and add Padmavati + Srinivasan as members. Then I'll continue."

DO NOT create the group programmatically — the existing UI handles `is_active`, `created_by`, etc.

Once confirmed, capture the group's UUID — you'll use it in Task 16 (verification).

- [ ] **Step 3: Note the group UUID + member site UUIDs for later**

Store informally in your scratch — these are inputs for verification, not for code. Move on to Task 2.

---

## Task 2: Create the multi-site settlement report RPC

**Files:**
- Create: `supabase/migrations/20260520140000_settlement_report_rpc.sql`

- [ ] **Step 1: Confirm the timestamp slot is free**

Run via `mcp__supabase__list_migrations` and verify no migration is named `20260520140000_*`. If one exists, bump to `20260520140100_*` and use that filename consistently below.

- [ ] **Step 2: Write the migration file**

Create `supabase/migrations/20260520140000_settlement_report_rpc.sql` with this exact content:

```sql
-- Cross-site Settlement Report — per (site, subcontract, week) paid + calculated wages
-- Mirrors the get_company_daily_peek pattern: SECURITY DEFINER, RETURNS JSONB,
-- single CTE pipeline. Used by /company/reports/ → Settlements tab.
--
-- For each site in p_site_ids, for each contract subcontract on that site whose
-- category matches p_category_id (or any if NULL), for each ISO week (Sun-Sat)
-- intersecting [p_date_from, p_date_to]:
--   - paid_amount = SUM(labor_payments.amount) where the payment is linked to
--                   this subcontract and its payment_for_date falls in the week
--   - calc_amount = SUM(subcontract_mid_entries.day_total_amount) where the
--                   mid-entry's attendance_date falls in the week
--   - settlement_count, notes_concat for export
--
-- Trade is derived: contract_type='mesthri' → teams.category_id ;
--                   contract_type='specialist' → laborers.category_id.

CREATE OR REPLACE FUNCTION public.get_multi_site_settlement_report(
  p_site_ids UUID[],
  p_date_from DATE,
  p_date_to DATE,
  p_category_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_site_ids IS NULL OR cardinality(p_site_ids) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH scope_subs AS (
    SELECT
      sc.id              AS subcontract_id,
      sc.site_id,
      sc.title           AS subcontract_title,
      sc.contract_type::text AS contract_type,
      COALESCE(
        CASE WHEN sc.contract_type = 'mesthri'    THEN t.category_id END,
        CASE WHEN sc.contract_type = 'specialist' THEN l.category_id END
      ) AS category_id
    FROM public.subcontracts sc
    LEFT JOIN public.teams t     ON t.id = sc.team_id
    LEFT JOIN public.laborers l  ON l.id = sc.laborer_id
    WHERE sc.site_id = ANY(p_site_ids)
      AND sc.contract_type IN ('mesthri'::contract_type, 'specialist'::contract_type)
  ),
  scope_filtered AS (
    SELECT s.*
    FROM scope_subs s
    WHERE p_category_id IS NULL OR s.category_id = p_category_id
  ),
  -- All ISO weeks (Sun-Sat) overlapping [date_from, date_to].
  -- date_trunc('week', d) returns the Monday — we shift to Sunday by -1 day.
  week_series AS (
    SELECT
      (date_trunc('week', g)::date - INTERVAL '1 day')::date AS week_start,
      (date_trunc('week', g)::date + INTERVAL '5 days')::date AS week_end
    FROM generate_series(
           date_trunc('week', p_date_from::timestamp)::date - INTERVAL '1 day',
           p_date_to::date,
           INTERVAL '7 days'
         ) g
  ),
  paid AS (
    SELECT
      sf.subcontract_id,
      sf.site_id,
      ws.week_start,
      ws.week_end,
      COALESCE(SUM(lp.amount), 0)::numeric(14,2) AS paid_amount,
      COUNT(DISTINCT lp.settlement_group_id) FILTER (WHERE lp.settlement_group_id IS NOT NULL) AS settlement_count
    FROM scope_filtered sf
    CROSS JOIN week_series ws
    LEFT JOIN public.labor_payments lp
      ON lp.subcontract_id = sf.subcontract_id
     AND lp.payment_for_date BETWEEN ws.week_start AND ws.week_end
     AND lp.is_under_contract = true
    GROUP BY sf.subcontract_id, sf.site_id, ws.week_start, ws.week_end
  ),
  calc AS (
    SELECT
      sf.subcontract_id,
      sf.site_id,
      ws.week_start,
      ws.week_end,
      COALESCE(SUM(sme.day_total_amount), 0)::numeric(14,2) AS calc_amount
    FROM scope_filtered sf
    CROSS JOIN week_series ws
    LEFT JOIN public.subcontract_mid_entries sme
      ON sme.subcontract_id = sf.subcontract_id
     AND sme.attendance_date BETWEEN ws.week_start AND ws.week_end
    GROUP BY sf.subcontract_id, sf.site_id, ws.week_start, ws.week_end
  ),
  notes AS (
    SELECT
      sg.subcontract_id,
      sg.site_id,
      ws.week_start,
      ws.week_end,
      string_agg(NULLIF(sg.notes, ''), ' | ' ORDER BY sg.settlement_date) AS notes_concat
    FROM public.settlement_groups sg
    CROSS JOIN week_series ws
    WHERE sg.is_cancelled = false
      AND sg.settlement_date BETWEEN ws.week_start AND ws.week_end
      AND sg.subcontract_id IS NOT NULL
      AND sg.site_id = ANY(p_site_ids)
    GROUP BY sg.subcontract_id, sg.site_id, ws.week_start, ws.week_end
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'site_id',           sf.site_id,
      'site_name',         si.name,
      'subcontract_id',    sf.subcontract_id,
      'subcontract_title', sf.subcontract_title,
      'contract_type',     sf.contract_type,
      'category_id',       sf.category_id,
      'category_name',     lc.name,
      'week_start',        p.week_start,
      'week_end',          p.week_end,
      'paid_amount',       p.paid_amount,
      'calc_amount',       c.calc_amount,
      'settlement_count',  p.settlement_count,
      'notes_concat',      n.notes_concat
    )
    ORDER BY si.name, sf.subcontract_title, p.week_start
  )
  INTO v_result
  FROM scope_filtered sf
  JOIN paid p
    ON p.subcontract_id = sf.subcontract_id
   AND p.site_id = sf.site_id
  LEFT JOIN calc c
    ON c.subcontract_id = sf.subcontract_id
   AND c.site_id = sf.site_id
   AND c.week_start = p.week_start
  LEFT JOIN notes n
    ON n.subcontract_id = sf.subcontract_id
   AND n.site_id = sf.site_id
   AND n.week_start = p.week_start
  LEFT JOIN public.sites si        ON si.id = sf.site_id
  LEFT JOIN public.labor_categories lc ON lc.id = sf.category_id
  -- Drop rows with no paid AND no calc (subcontract didn't touch this week)
  WHERE (p.paid_amount > 0 OR c.calc_amount > 0);

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_multi_site_settlement_report(UUID[], DATE, DATE, UUID) TO authenticated;

COMMENT ON FUNCTION public.get_multi_site_settlement_report IS
  'Returns one JSON row per (site, subcontract, week) for contract settlements across the given sites and date range. Weeks are Sun-Sat. paid_amount comes from labor_payments; calc_amount from subcontract_mid_entries. Used by /company/reports/ Settlements tab.';
```

- [ ] **Step 3: Apply migration to LOCAL Supabase**

Run:
```
npm run db:reset
```

Expected output: lists applied migrations including `20260520140000_settlement_report_rpc.sql`. No errors.

If `db:reset` was already running or the local stack isn't up, run `npm run db:start` first.

- [ ] **Step 4: Smoke-test the RPC against local Supabase**

In a new shell:
```
npx supabase db dump -f /tmp/check.sql --schema public > $null 2>&1; echo ok
```

Then via `mcp__supabase__execute_sql` (against the local instance, or you can use psql directly), run:
```sql
-- Replace with any two real local site UUIDs
SELECT public.get_multi_site_settlement_report(
  ARRAY[(SELECT id FROM sites WHERE status='active' ORDER BY name LIMIT 1)]::uuid[],
  '2026-04-01'::date,
  '2026-05-31'::date,
  NULL
);
```

Expected: returns a JSONB array (possibly empty) — NO error. If it errors with "column does not exist" or "relation does not exist", the schema differs from what this RPC assumes; investigate and fix the RPC.

- [ ] **Step 5: Apply migration to PRODUCTION**

Per CLAUDE.md "Move to Prod" Rule 3 — apply migrations BEFORE any code that depends on them. Even though this RPC isn't called yet, applying now keeps prod in sync.

Use `mcp__supabase__apply_migration`:
- `name`: `20260520140000_settlement_report_rpc`
- `query`: the full SQL from Step 2

Expected: success. Re-run `mcp__supabase__list_migrations` to confirm it's listed.

- [ ] **Step 6: Commit the migration**

```bash
git add supabase/migrations/20260520140000_settlement_report_rpc.sql
git commit -m "feat(reports): add get_multi_site_settlement_report RPC"
```

---

## Task 3: Type definitions

**Files:**
- Create: `src/types/settlementReport.types.ts`

- [ ] **Step 1: Write the types file**

Create `src/types/settlementReport.types.ts`:

```typescript
// Row shape returned by get_multi_site_settlement_report RPC.
// One row per (site_id, subcontract_id, week_start).
export interface SettlementReportRow {
  site_id: string;
  site_name: string;
  subcontract_id: string;
  subcontract_title: string;
  contract_type: "mesthri" | "specialist";
  category_id: string | null;
  category_name: string | null;
  week_start: string; // YYYY-MM-DD (Sunday)
  week_end: string;   // YYYY-MM-DD (Saturday)
  paid_amount: number;
  calc_amount: number;
  settlement_count: number;
  notes_concat: string | null;
}

// Scope is either "single site" or "group of sites". The group case carries
// the resolved member site ids so the hook doesn't need to re-resolve them.
export type SettlementReportScope =
  | { mode: "site"; siteId: string; siteName: string }
  | { mode: "group"; groupId: string; groupName: string; siteIds: string[]; siteNames: string[] };

// Wide layout pivot — one row per week with site sub-columns.
export interface WidePivotCell {
  paid: number;
  calc: number;
  hasDiff: boolean; // paid !== calc
}

export interface WidePivotRow {
  week_start: string;
  week_end: string;
  // keyed by site_id
  bySite: Record<string, WidePivotCell>;
  // totals across sites for this week
  totalPaid: number;
  totalCalc: number;
}

export interface WidePivot {
  // Order matters — used to render columns left-to-right.
  sites: { id: string; name: string }[];
  rows: WidePivotRow[];
  totalsRow: WidePivotRow; // bySite totals + grand total
}

// Export dialog state
export interface ExportConfig {
  granularity: "daily" | "weekly";
  layout: "wide" | "long";
  columns: ExportColumnKey[];
  includeLaborerBreakdown: boolean;
}

export type ExportColumnKey =
  | "date"        // date (daily) OR week range (weekly)
  | "site"
  | "trade"
  | "subcontract"
  | "paid"
  | "calc"
  | "diff"
  | "notes"
  | "payer_source"
  | "payment_mode"
  | "created_by";

export const DEFAULT_EXPORT_COLUMNS: ExportColumnKey[] = [
  "date", "site", "trade", "subcontract", "paid", "calc", "diff", "notes",
];
```

- [ ] **Step 2: Commit**

```bash
git add src/types/settlementReport.types.ts
git commit -m "feat(reports): settlement report type definitions"
```

---

## Task 4: useSettlementReport hook

**Files:**
- Create: `src/hooks/queries/useSettlementReport.ts`

- [ ] **Step 1: Add query-keys entry**

In `src/lib/cache/keys.ts`, locate the existing `queryKeys` object. Find the section where keys like `siteGroups`, `payments` live. Add (alphabetically near the bottom of the keys object — do NOT modify other keys):

```typescript
settlementReport: {
  all: ["settlement-report"] as const,
  byScope: (siteIds: string[], dateFrom: string, dateTo: string, categoryId: string | null) =>
    [...queryKeys.settlementReport.all, { siteIds: [...siteIds].sort(), dateFrom, dateTo, categoryId }] as const,
},
```

If `keys.ts` uses a different style (e.g. flat strings), match it — read the file first to see the local convention. The shape above mirrors how `queryKeys.siteGroups` is structured.

- [ ] **Step 2: Write the hook**

Create `src/hooks/queries/useSettlementReport.ts`:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import { wrapQueryFn } from "@/lib/utils/timeout";
import type { SettlementReportRow } from "@/types/settlementReport.types";

export interface UseSettlementReportArgs {
  siteIds: string[];
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  categoryId: string | null;
}

export function useSettlementReport(args: UseSettlementReportArgs) {
  const supabase = createClient();
  const { siteIds, dateFrom, dateTo, categoryId } = args;

  return useQuery({
    queryKey: queryKeys.settlementReport.byScope(siteIds, dateFrom, dateTo, categoryId),
    enabled: siteIds.length > 0 && !!dateFrom && !!dateTo,
    queryFn: wrapQueryFn(async () => {
      const { data, error } = await (supabase as any).rpc("get_multi_site_settlement_report", {
        p_site_ids: siteIds,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_category_id: categoryId,
      });
      if (error) throw error;
      return (data ?? []) as SettlementReportRow[];
    }, { operationName: "useSettlementReport" }),
  });
}

// Lightweight labor-categories hook for the trade filter. If a similar hook
// already exists elsewhere, prefer that one and delete this fallback.
export function useLaborCategoriesForReport() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["labor-categories", "active"] as const,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("labor_categories")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

// Active sites that are NOT in any site_group. Used by the report toolbar so
// the user can pick a single ungrouped site (e.g. a one-off site that has
// not been clustered yet).
export function useUngroupedActiveSites() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["sites", "active", "ungrouped"] as const,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sites")
        .select("id, name")
        .eq("status", "active")
        .is("site_group_id", null)
        .order("name");
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 3: Check for existing useLaborCategories**

Before committing, search the repo:

Use Grep with pattern `useLaborCategor` (output_mode: files_with_matches). If a hook already exports labor categories (likely in `src/hooks/queries/useAttendance.ts` or similar), DELETE the `useLaborCategoriesForReport` from the file you just wrote and import the existing one from its current location instead. Don't add a duplicate.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cache/keys.ts src/hooks/queries/useSettlementReport.ts
git commit -m "feat(reports): useSettlementReport hook"
```

---

## Task 5: Wide pivot utility (TDD)

**Files:**
- Create: `src/lib/utils/settlementReportPivot.ts`
- Create: `src/lib/utils/settlementReportPivot.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/utils/settlementReportPivot.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { pivotToWide } from "./settlementReportPivot";
import type { SettlementReportRow } from "@/types/settlementReport.types";

function row(partial: Partial<SettlementReportRow>): SettlementReportRow {
  return {
    site_id: "site-A",
    site_name: "Site A",
    subcontract_id: "sc-1",
    subcontract_title: "Mesthri team",
    contract_type: "mesthri",
    category_id: "cat-civil",
    category_name: "Civil",
    week_start: "2026-04-26",
    week_end: "2026-05-02",
    paid_amount: 0,
    calc_amount: 0,
    settlement_count: 0,
    notes_concat: null,
    ...partial,
  };
}

describe("pivotToWide", () => {
  it("returns empty pivot when no rows", () => {
    const result = pivotToWide([]);
    expect(result.sites).toEqual([]);
    expect(result.rows).toEqual([]);
    expect(result.totalsRow.totalPaid).toBe(0);
  });

  it("groups rows by week and pivots site amounts", () => {
    const rows = [
      row({ site_id: "padma", site_name: "Padmavati", week_start: "2026-04-26", week_end: "2026-05-02", paid_amount: 12200, calc_amount: 12200 }),
      row({ site_id: "srini", site_name: "Srinivasan", week_start: "2026-04-26", week_end: "2026-05-02", paid_amount: 8400, calc_amount: 8400 }),
      row({ site_id: "padma", site_name: "Padmavati", week_start: "2026-05-03", week_end: "2026-05-09", paid_amount: 9800, calc_amount: 9800 }),
      row({ site_id: "srini", site_name: "Srinivasan", week_start: "2026-05-03", week_end: "2026-05-09", paid_amount: 10500, calc_amount: 10800 }),
    ];

    const result = pivotToWide(rows);

    expect(result.sites.map((s) => s.id)).toEqual(["padma", "srini"]);
    expect(result.rows).toHaveLength(2);

    expect(result.rows[0].bySite["padma"].paid).toBe(12200);
    expect(result.rows[0].bySite["srini"].paid).toBe(8400);
    expect(result.rows[0].totalPaid).toBe(20600);
    expect(result.rows[0].bySite["srini"].hasDiff).toBe(false);

    expect(result.rows[1].bySite["srini"].paid).toBe(10500);
    expect(result.rows[1].bySite["srini"].calc).toBe(10800);
    expect(result.rows[1].bySite["srini"].hasDiff).toBe(true);

    expect(result.totalsRow.totalPaid).toBe(40900);
    expect(result.totalsRow.totalCalc).toBe(41200);
    expect(result.totalsRow.bySite["padma"].paid).toBe(22000);
    expect(result.totalsRow.bySite["srini"].paid).toBe(18900);
  });

  it("sums multiple subcontracts within the same (site, week)", () => {
    const rows = [
      row({ site_id: "padma", site_name: "Padmavati", subcontract_id: "sc-1", paid_amount: 5000, calc_amount: 5000 }),
      row({ site_id: "padma", site_name: "Padmavati", subcontract_id: "sc-2", paid_amount: 3000, calc_amount: 3000 }),
    ];
    const result = pivotToWide(rows);
    expect(result.rows[0].bySite["padma"].paid).toBe(8000);
  });

  it("orders sites alphabetically by name", () => {
    const rows = [
      row({ site_id: "z-site", site_name: "Zebra" }),
      row({ site_id: "a-site", site_name: "Alpha" }),
    ];
    const result = pivotToWide(rows);
    expect(result.sites.map((s) => s.name)).toEqual(["Alpha", "Zebra"]);
  });

  it("orders weeks chronologically", () => {
    const rows = [
      row({ week_start: "2026-05-10", week_end: "2026-05-16" }),
      row({ week_start: "2026-04-26", week_end: "2026-05-02" }),
      row({ week_start: "2026-05-03", week_end: "2026-05-09" }),
    ];
    const result = pivotToWide(rows);
    expect(result.rows.map((r) => r.week_start)).toEqual([
      "2026-04-26", "2026-05-03", "2026-05-10",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
npx vitest run src/lib/utils/settlementReportPivot.test.ts
```

Expected: FAIL with "Cannot find module './settlementReportPivot'" or equivalent.

- [ ] **Step 3: Implement the pivot**

Create `src/lib/utils/settlementReportPivot.ts`:

```typescript
import type {
  SettlementReportRow,
  WidePivot,
  WidePivotCell,
  WidePivotRow,
} from "@/types/settlementReport.types";

const emptyCell = (): WidePivotCell => ({ paid: 0, calc: 0, hasDiff: false });

export function pivotToWide(rows: SettlementReportRow[]): WidePivot {
  if (rows.length === 0) {
    return {
      sites: [],
      rows: [],
      totalsRow: {
        week_start: "",
        week_end: "",
        bySite: {},
        totalPaid: 0,
        totalCalc: 0,
      },
    };
  }

  // Collect unique sites and weeks
  const siteMap = new Map<string, string>(); // id → name
  const weekKeys = new Set<string>();
  const weekMeta = new Map<string, { week_start: string; week_end: string }>();
  for (const r of rows) {
    siteMap.set(r.site_id, r.site_name);
    const key = r.week_start;
    weekKeys.add(key);
    if (!weekMeta.has(key)) {
      weekMeta.set(key, { week_start: r.week_start, week_end: r.week_end });
    }
  }

  const sites = Array.from(siteMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const weeks = Array.from(weekKeys).sort();

  // Build per-week pivot rows
  const pivotRows: WidePivotRow[] = weeks.map((weekStart) => {
    const meta = weekMeta.get(weekStart)!;
    const bySite: Record<string, WidePivotCell> = {};
    for (const s of sites) bySite[s.id] = emptyCell();
    return {
      week_start: meta.week_start,
      week_end: meta.week_end,
      bySite,
      totalPaid: 0,
      totalCalc: 0,
    };
  });

  // Index pivot rows by week_start for fast lookup
  const rowIndex = new Map<string, WidePivotRow>();
  pivotRows.forEach((row) => rowIndex.set(row.week_start, row));

  // Sum amounts into the pivot
  for (const r of rows) {
    const pivot = rowIndex.get(r.week_start);
    if (!pivot) continue;
    const cell = pivot.bySite[r.site_id];
    cell.paid += Number(r.paid_amount) || 0;
    cell.calc += Number(r.calc_amount) || 0;
  }

  // Finalize diff + week totals
  for (const row of pivotRows) {
    let totalPaid = 0;
    let totalCalc = 0;
    for (const s of sites) {
      const cell = row.bySite[s.id];
      cell.hasDiff = Math.abs(cell.paid - cell.calc) > 0.005;
      totalPaid += cell.paid;
      totalCalc += cell.calc;
    }
    row.totalPaid = totalPaid;
    row.totalCalc = totalCalc;
  }

  // Build totals row
  const totalsBySite: Record<string, WidePivotCell> = {};
  let grandPaid = 0;
  let grandCalc = 0;
  for (const s of sites) {
    let p = 0;
    let c = 0;
    for (const row of pivotRows) {
      p += row.bySite[s.id].paid;
      c += row.bySite[s.id].calc;
    }
    totalsBySite[s.id] = {
      paid: p,
      calc: c,
      hasDiff: Math.abs(p - c) > 0.005,
    };
    grandPaid += p;
    grandCalc += c;
  }

  return {
    sites,
    rows: pivotRows,
    totalsRow: {
      week_start: "",
      week_end: "",
      bySite: totalsBySite,
      totalPaid: grandPaid,
      totalCalc: grandCalc,
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```
npx vitest run src/lib/utils/settlementReportPivot.test.ts
```

Expected: PASS — all 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/settlementReportPivot.ts src/lib/utils/settlementReportPivot.test.ts
git commit -m "feat(reports): pivotToWide util + tests"
```

---

## Task 6: CSV export utility (TDD)

**Files:**
- Create: `src/lib/utils/settlementReportExport.ts`
- Create: `src/lib/utils/settlementReportExport.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/utils/settlementReportExport.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildCsvRows, buildExportFilename } from "./settlementReportExport";
import type { SettlementReportRow } from "@/types/settlementReport.types";

const padma: SettlementReportRow = {
  site_id: "padma",
  site_name: "Padmavati",
  subcontract_id: "sc-1",
  subcontract_title: "Padma Civil Mesthri",
  contract_type: "mesthri",
  category_id: "cat-civil",
  category_name: "Civil",
  week_start: "2026-04-26",
  week_end: "2026-05-02",
  paid_amount: 12200,
  calc_amount: 12200,
  settlement_count: 2,
  notes_concat: "advance | balance",
};

describe("buildCsvRows — weekly long", () => {
  it("produces one row per input row with default columns", () => {
    const csv = buildCsvRows([padma], {
      granularity: "weekly",
      layout: "long",
      columns: ["date", "site", "trade", "subcontract", "paid", "calc", "diff", "notes"],
      includeLaborerBreakdown: false,
    });
    expect(csv).toHaveLength(1);
    expect(csv[0]).toMatchObject({
      "Week": "2026-04-26 to 2026-05-02",
      "Site": "Padmavati",
      "Trade": "Civil",
      "Subcontract": "Padma Civil Mesthri",
      "Paid": 12200,
      "Calculated": 12200,
      "Diff": 0,
      "Notes": "advance | balance",
    });
  });

  it("omits unchecked columns", () => {
    const csv = buildCsvRows([padma], {
      granularity: "weekly",
      layout: "long",
      columns: ["date", "site", "paid"],
      includeLaborerBreakdown: false,
    });
    expect(Object.keys(csv[0])).toEqual(["Week", "Site", "Paid"]);
  });
});

describe("buildCsvRows — weekly wide", () => {
  it("pivots site amounts into columns", () => {
    const srini: SettlementReportRow = {
      ...padma,
      site_id: "srini",
      site_name: "Srinivasan",
      paid_amount: 8400,
      calc_amount: 8400,
    };
    const csv = buildCsvRows([padma, srini], {
      granularity: "weekly",
      layout: "wide",
      columns: ["date", "paid", "calc"],
      includeLaborerBreakdown: false,
    });
    expect(csv).toHaveLength(1);
    expect(csv[0]).toMatchObject({
      "Week": "2026-04-26 to 2026-05-02",
      "Padmavati Paid": 12200,
      "Padmavati Calc": 12200,
      "Srinivasan Paid": 8400,
      "Srinivasan Calc": 8400,
      "Total Paid": 20600,
      "Total Calc": 20600,
    });
  });
});

describe("buildExportFilename", () => {
  it("builds a filename from scope and date range", () => {
    expect(
      buildExportFilename({
        scopeLabel: "Vishal sites",
        dateFrom: "2026-04-01",
        dateTo: "2026-05-31",
      })
    ).toBe("settlements-vishal-sites-2026-04-01-to-2026-05-31.csv");
  });

  it("sanitises unsafe filename characters", () => {
    expect(
      buildExportFilename({
        scopeLabel: "Vishal/Padma & Srini",
        dateFrom: "2026-04-01",
        dateTo: "2026-05-31",
      })
    ).toBe("settlements-vishal-padma-srini-2026-04-01-to-2026-05-31.csv");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
npx vitest run src/lib/utils/settlementReportExport.test.ts
```

Expected: FAIL with "Cannot find module" or similar.

- [ ] **Step 3: Implement the utility**

Create `src/lib/utils/settlementReportExport.ts`:

```typescript
import Papa from "papaparse";
import type {
  ExportColumnKey,
  ExportConfig,
  SettlementReportRow,
} from "@/types/settlementReport.types";

const COLUMN_LABELS_LONG: Record<ExportColumnKey, string> = {
  date: "Week",          // weekly long uses "Week"; for daily we swap below
  site: "Site",
  trade: "Trade",
  subcontract: "Subcontract",
  paid: "Paid",
  calc: "Calculated",
  diff: "Diff",
  notes: "Notes",
  payer_source: "Payer Source",
  payment_mode: "Payment Mode",
  created_by: "Created By",
};

function formatWeek(weekStart: string, weekEnd: string): string {
  return `${weekStart} to ${weekEnd}`;
}

// Long layout — one CSV row per input row. Daily granularity is handled by the
// caller passing daily-granularity rows; this function just maps row → CSV row.
function buildLongRow(
  row: SettlementReportRow,
  columns: ExportColumnKey[],
  granularity: "daily" | "weekly"
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const c of columns) {
    switch (c) {
      case "date":
        out[granularity === "weekly" ? "Week" : "Date"] =
          granularity === "weekly" ? formatWeek(row.week_start, row.week_end) : row.week_start;
        break;
      case "site":
        out["Site"] = row.site_name;
        break;
      case "trade":
        out["Trade"] = row.category_name ?? "";
        break;
      case "subcontract":
        out["Subcontract"] = row.subcontract_title;
        break;
      case "paid":
        out["Paid"] = row.paid_amount;
        break;
      case "calc":
        out["Calculated"] = row.calc_amount;
        break;
      case "diff":
        out["Diff"] = Number((row.paid_amount - row.calc_amount).toFixed(2));
        break;
      case "notes":
        out["Notes"] = row.notes_concat ?? "";
        break;
      case "payer_source":
      case "payment_mode":
      case "created_by":
        // These come from settlement_groups directly; for v1 we leave the
        // column blank in the export since the RPC doesn't return them yet.
        // Future enhancement: extend the RPC to surface these.
        out[COLUMN_LABELS_LONG[c]] = "";
        break;
    }
  }
  return out;
}

// Wide layout — one CSV row per week with site sub-columns.
function buildWideRows(
  rows: SettlementReportRow[],
  columns: ExportColumnKey[],
  granularity: "daily" | "weekly"
): Record<string, string | number>[] {
  // Group by date-key
  const dateKey = (r: SettlementReportRow) =>
    granularity === "weekly" ? r.week_start : r.week_start;
  const groups = new Map<string, SettlementReportRow[]>();
  for (const r of rows) {
    const k = dateKey(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  // Unique site names (alphabetical)
  const siteNames = Array.from(new Set(rows.map((r) => r.site_name))).sort();

  const includePaid = columns.includes("paid");
  const includeCalc = columns.includes("calc");

  const out: Record<string, string | number>[] = [];
  const sortedKeys = Array.from(groups.keys()).sort();
  for (const k of sortedKeys) {
    const groupRows = groups.get(k)!;
    const sample = groupRows[0];
    const csvRow: Record<string, string | number> = {};
    if (columns.includes("date")) {
      csvRow[granularity === "weekly" ? "Week" : "Date"] =
        granularity === "weekly" ? formatWeek(sample.week_start, sample.week_end) : sample.week_start;
    }
    let totalPaid = 0;
    let totalCalc = 0;
    for (const site of siteNames) {
      const siteRows = groupRows.filter((r) => r.site_name === site);
      const paid = siteRows.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
      const calc = siteRows.reduce((s, r) => s + Number(r.calc_amount || 0), 0);
      if (includePaid) csvRow[`${site} Paid`] = paid;
      if (includeCalc) csvRow[`${site} Calc`] = calc;
      totalPaid += paid;
      totalCalc += calc;
    }
    if (includePaid) csvRow["Total Paid"] = totalPaid;
    if (includeCalc) csvRow["Total Calc"] = totalCalc;
    if (columns.includes("notes")) {
      csvRow["Notes"] = groupRows.map((r) => r.notes_concat || "").filter(Boolean).join(" | ");
    }
    out.push(csvRow);
  }
  return out;
}

export function buildCsvRows(
  rows: SettlementReportRow[],
  config: ExportConfig
): Record<string, string | number>[] {
  if (config.layout === "wide") {
    return buildWideRows(rows, config.columns, config.granularity);
  }
  return rows.map((r) => buildLongRow(r, config.columns, config.granularity));
}

export interface FilenameArgs {
  scopeLabel: string;
  dateFrom: string;
  dateTo: string;
}

export function buildExportFilename(args: FilenameArgs): string {
  const slug = args.scopeLabel
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `settlements-${slug}-${args.dateFrom}-to-${args.dateTo}.csv`;
}

export function downloadCsv(
  rows: Record<string, string | number>[],
  filename: string
): void {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```
npx vitest run src/lib/utils/settlementReportExport.test.ts
```

Expected: PASS — all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/settlementReportExport.ts src/lib/utils/settlementReportExport.test.ts
git commit -m "feat(reports): CSV export builder + filename + tests"
```

---

## Task 7: SettlementReportToolbar

**Files:**
- Create: `src/components/reports/settlements/SettlementReportToolbar.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/reports/settlements/SettlementReportToolbar.tsx`:

```typescript
"use client";

import {
  Box,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
  Typography,
  Button,
} from "@mui/material";
import { Download as DownloadIcon, Print as PrintIcon } from "@mui/icons-material";
import { useSiteGroupsWithSites } from "@/hooks/queries/useSiteGroups";
import { useLaborCategoriesForReport, useUngroupedActiveSites } from "@/hooks/queries/useSettlementReport";
import type { SettlementReportScope } from "@/types/settlementReport.types";

export interface SettlementReportToolbarProps {
  scope: SettlementReportScope | null;
  onScopeChange: (scope: SettlementReportScope | null) => void;
  categoryId: string | null;
  onCategoryChange: (id: string | null) => void;
  dateFrom: string;
  onDateFromChange: (d: string) => void;
  dateTo: string;
  onDateToChange: (d: string) => void;
  view: "wide" | "long";
  onViewChange: (v: "wide" | "long") => void;
  onExportClick: () => void;
  onPrintClick: () => void;
  exportDisabled?: boolean;
}

export default function SettlementReportToolbar(props: SettlementReportToolbarProps) {
  const {
    scope, onScopeChange,
    categoryId, onCategoryChange,
    dateFrom, onDateFromChange,
    dateTo, onDateToChange,
    view, onViewChange,
    onExportClick, onPrintClick, exportDisabled,
  } = props;

  const { data: groups = [], isLoading: groupsLoading } = useSiteGroupsWithSites();
  const { data: ungrouped = [] } = useUngroupedActiveSites();
  const { data: categories = [] } = useLaborCategoriesForReport();

  // Scope dropdown value: "group:<id>" or "site:<id>"
  const scopeValue = scope
    ? scope.mode === "group" ? `group:${scope.groupId}` : `site:${scope.siteId}`
    : "";

  const handleScopeChange = (raw: string) => {
    if (!raw) { onScopeChange(null); return; }
    if (raw.startsWith("group:")) {
      const groupId = raw.slice(6);
      const g = groups.find((x) => x.id === groupId);
      if (!g) return;
      onScopeChange({
        mode: "group",
        groupId: g.id,
        groupName: g.name,
        siteIds: g.sites.map((s) => s.id),
        siteNames: g.sites.map((s) => s.name),
      });
    } else if (raw.startsWith("site:")) {
      const siteId = raw.slice(5);
      // Try ungrouped first, then group members
      let siteName = ungrouped.find((s) => s.id === siteId)?.name;
      if (!siteName) {
        for (const g of groups) {
          const found = g.sites.find((s) => s.id === siteId);
          if (found) { siteName = found.name; break; }
        }
      }
      onScopeChange({ mode: "site", siteId, siteName: siteName ?? "Site" });
    }
  };

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      alignItems={{ xs: "stretch", md: "center" }}
      sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: "background.paper", border: 1, borderColor: "divider" }}
    >
      <FormControl size="small" sx={{ minWidth: 240 }}>
        <InputLabel>Scope</InputLabel>
        <Select
          label="Scope"
          value={scopeValue}
          onChange={(e) => handleScopeChange(e.target.value)}
          disabled={groupsLoading}
        >
          {groups.map((g) => [
            <MenuItem key={`g-${g.id}`} value={`group:${g.id}`}>
              <Typography component="span" fontWeight={600}>Group: {g.name}</Typography>
              <Typography component="span" variant="caption" sx={{ ml: 1, color: "text.secondary" }}>
                ({g.sites.length} sites)
              </Typography>
            </MenuItem>,
            ...g.sites.map((s) => (
              <MenuItem key={`s-${s.id}`} value={`site:${s.id}`} sx={{ pl: 4 }}>
                {s.name}
              </MenuItem>
            )),
          ])}
          {ungrouped.length > 0 && (
            <MenuItem disabled value="" sx={{ opacity: 1, fontStyle: "italic", fontSize: "0.75rem", color: "text.secondary" }}>
              — Ungrouped sites —
            </MenuItem>
          )}
          {ungrouped.map((s) => (
            <MenuItem key={`us-${s.id}`} value={`site:${s.id}`} sx={{ pl: 4 }}>
              {s.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Trade</InputLabel>
        <Select
          label="Trade"
          value={categoryId ?? ""}
          onChange={(e) => onCategoryChange(e.target.value || null)}
        >
          <MenuItem value=""><em>All trades</em></MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        size="small"
        type="date"
        label="From"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ minWidth: 160 }}
      />
      <TextField
        size="small"
        type="date"
        label="To"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ minWidth: 160 }}
      />

      <ToggleButtonGroup
        size="small"
        exclusive
        value={view}
        onChange={(_, v) => v && onViewChange(v)}
      >
        <ToggleButton value="wide">Weekly per-site</ToggleButton>
        <ToggleButton value="long">Settlement log</ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ flexGrow: 1 }} />

      <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onExportClick} disabled={exportDisabled}>
        Export
      </Button>
      <Button variant="outlined" startIcon={<PrintIcon />} onClick={onPrintClick} disabled={exportDisabled}>
        Print
      </Button>
    </Stack>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/reports/settlements/SettlementReportToolbar.tsx
git commit -m "feat(reports): SettlementReportToolbar (scope/trade/date/view)"
```

---

## Task 8: SettlementReportWideTable

**Files:**
- Create: `src/components/reports/settlements/SettlementReportWideTable.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/reports/settlements/SettlementReportWideTable.tsx`:

```typescript
"use client";

import { useMemo } from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import { Warning as WarningIcon } from "@mui/icons-material";
import DataTable from "@/components/common/DataTable";
import type { MRT_ColumnDef } from "material-react-table";
import type { SettlementReportRow, WidePivotRow } from "@/types/settlementReport.types";
import { pivotToWide } from "@/lib/utils/settlementReportPivot";

const fmt = (n: number) =>
  n === 0 ? "" : new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

export interface SettlementReportWideTableProps {
  rows: SettlementReportRow[];
  isLoading?: boolean;
  onRowClick: (row: WidePivotRow, siteId: string | null) => void;
}

export default function SettlementReportWideTable(props: SettlementReportWideTableProps) {
  const { rows, isLoading, onRowClick } = props;

  const pivot = useMemo(() => pivotToWide(rows), [rows]);

  const columns = useMemo<MRT_ColumnDef<WidePivotRow>[]>(() => {
    const cols: MRT_ColumnDef<WidePivotRow>[] = [
      {
        accessorKey: "week_start",
        header: "Week",
        size: 160,
        Cell: ({ row }) => `${row.original.week_start} → ${row.original.week_end}`,
      },
    ];
    for (const site of pivot.sites) {
      cols.push({
        accessorKey: `bySite.${site.id}.paid`,
        header: `${site.name} Paid`,
        size: 110,
        Cell: ({ row }) => {
          const cell = row.original.bySite[site.id];
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <span>{fmt(cell.paid)}</span>
              {cell.hasDiff && (
                <Tooltip title={`Calc ${fmt(cell.calc)} ≠ Paid ${fmt(cell.paid)}`}>
                  <WarningIcon fontSize="inherit" color="warning" />
                </Tooltip>
              )}
            </Box>
          );
        },
        muiTableBodyCellProps: { align: "right" },
      });
      cols.push({
        accessorKey: `bySite.${site.id}.calc`,
        header: `${site.name} Calc`,
        size: 110,
        Cell: ({ row }) => fmt(row.original.bySite[site.id].calc),
        muiTableBodyCellProps: { align: "right" },
      });
    }
    cols.push({
      accessorKey: "totalPaid",
      header: "Total Paid",
      size: 110,
      Cell: ({ row }) => <Typography fontWeight={600}>{fmt(row.original.totalPaid)}</Typography>,
      muiTableBodyCellProps: { align: "right" },
    });
    cols.push({
      accessorKey: "totalCalc",
      header: "Total Calc",
      size: 110,
      Cell: ({ row }) => <Typography fontWeight={600}>{fmt(row.original.totalCalc)}</Typography>,
      muiTableBodyCellProps: { align: "right" },
    });
    return cols;
  }, [pivot.sites]);

  const data = useMemo(() => {
    if (pivot.rows.length === 0) return [];
    // Append a totals row at the bottom.
    return [...pivot.rows, pivot.totalsRow];
  }, [pivot]);

  return (
    <DataTable<WidePivotRow>
      columns={columns}
      data={data}
      isLoading={isLoading}
      enablePagination={false}
      muiTableBodyRowProps={({ row }) => ({
        onClick: () => {
          // Skip clicks on the totals row (week_start === "").
          if (!row.original.week_start) return;
          onRowClick(row.original, null);
        },
        sx: row.original.week_start
          ? { cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }
          : { fontWeight: 700, bgcolor: "action.selected" },
      })}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/reports/settlements/SettlementReportWideTable.tsx
git commit -m "feat(reports): SettlementReportWideTable (per-site columns, totals, diff)"
```

---

## Task 9: SettlementReportLongTable

**Files:**
- Create: `src/components/reports/settlements/SettlementReportLongTable.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/reports/settlements/SettlementReportLongTable.tsx`:

```typescript
"use client";

import { useMemo } from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import { Warning as WarningIcon } from "@mui/icons-material";
import DataTable from "@/components/common/DataTable";
import type { MRT_ColumnDef } from "material-react-table";
import type { SettlementReportRow } from "@/types/settlementReport.types";

const fmt = (n: number) =>
  n === 0 ? "" : new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

export interface SettlementReportLongTableProps {
  rows: SettlementReportRow[];
  isLoading?: boolean;
  onRowClick: (row: SettlementReportRow) => void;
}

export default function SettlementReportLongTable(props: SettlementReportLongTableProps) {
  const { rows, isLoading, onRowClick } = props;

  const sorted = useMemo(
    () => [...rows].sort((a, b) =>
      a.week_start.localeCompare(b.week_start) ||
      a.site_name.localeCompare(b.site_name) ||
      a.subcontract_title.localeCompare(b.subcontract_title)
    ),
    [rows]
  );

  const columns = useMemo<MRT_ColumnDef<SettlementReportRow>[]>(() => [
    {
      accessorKey: "week_start",
      header: "Week",
      Cell: ({ row }) => `${row.original.week_start} → ${row.original.week_end}`,
      size: 160,
    },
    { accessorKey: "site_name", header: "Site", size: 140 },
    { accessorKey: "category_name", header: "Trade", size: 110, Cell: ({ row }) => row.original.category_name ?? "—" },
    { accessorKey: "subcontract_title", header: "Subcontract", size: 200 },
    {
      accessorKey: "paid_amount",
      header: "Paid",
      size: 100,
      Cell: ({ row }) => fmt(row.original.paid_amount),
      muiTableBodyCellProps: { align: "right" },
    },
    {
      accessorKey: "calc_amount",
      header: "Calc",
      size: 100,
      Cell: ({ row }) => {
        const r = row.original;
        const diff = Math.abs(r.paid_amount - r.calc_amount) > 0.005;
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, justifyContent: "flex-end" }}>
            <span>{fmt(r.calc_amount)}</span>
            {diff && (
              <Tooltip title={`Diff: ${fmt(r.paid_amount - r.calc_amount)}`}>
                <WarningIcon fontSize="inherit" color="warning" />
              </Tooltip>
            )}
          </Box>
        );
      },
      muiTableBodyCellProps: { align: "right" },
    },
    { accessorKey: "notes_concat", header: "Notes", Cell: ({ row }) => row.original.notes_concat ?? "" },
  ], []);

  return (
    <DataTable<SettlementReportRow>
      columns={columns}
      data={sorted}
      isLoading={isLoading}
      muiTableBodyRowProps={({ row }) => ({
        onClick: () => onRowClick(row.original),
        sx: { cursor: "pointer", "&:hover": { bgcolor: "action.hover" } },
      })}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/reports/settlements/SettlementReportLongTable.tsx
git commit -m "feat(reports): SettlementReportLongTable (chronological)"
```

---

## Task 10: SettlementReportExportDialog

**Files:**
- Create: `src/components/reports/settlements/SettlementReportExportDialog.tsx`

- [ ] **Step 1: Write the dialog**

Create `src/components/reports/settlements/SettlementReportExportDialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, FormControl, FormControlLabel, FormGroup, FormLabel,
  Checkbox, RadioGroup, Radio, Stack, Typography, TextField,
} from "@mui/material";
import type {
  ExportColumnKey, ExportConfig, SettlementReportRow,
} from "@/types/settlementReport.types";
import { DEFAULT_EXPORT_COLUMNS } from "@/types/settlementReport.types";
import { buildCsvRows, buildExportFilename, downloadCsv } from "@/lib/utils/settlementReportExport";

const COLUMN_OPTIONS: { key: ExportColumnKey; label: string }[] = [
  { key: "date",         label: "Date / Week range" },
  { key: "site",         label: "Site name" },
  { key: "trade",        label: "Trade / Category" },
  { key: "subcontract",  label: "Subcontract title" },
  { key: "paid",         label: "Paid amount" },
  { key: "calc",         label: "Calculated amount" },
  { key: "diff",         label: "Diff (Paid - Calc)" },
  { key: "notes",        label: "Settlement notes" },
  { key: "payer_source", label: "Payer source (blank until RPC extended)" },
  { key: "payment_mode", label: "Payment mode (blank until RPC extended)" },
  { key: "created_by",   label: "Created by / at (blank until RPC extended)" },
];

export interface SettlementReportExportDialogProps {
  open: boolean;
  onClose: () => void;
  rows: SettlementReportRow[];
  scopeLabel: string;
  dateFrom: string;
  dateTo: string;
}

export default function SettlementReportExportDialog(props: SettlementReportExportDialogProps) {
  const { open, onClose, rows, scopeLabel, dateFrom, dateTo } = props;

  const [config, setConfig] = useState<ExportConfig>({
    granularity: "weekly",
    layout: "wide",
    columns: [...DEFAULT_EXPORT_COLUMNS],
    includeLaborerBreakdown: false,
  });

  const filename = buildExportFilename({ scopeLabel, dateFrom, dateTo });

  const toggleColumn = (key: ExportColumnKey) => {
    setConfig((prev) => ({
      ...prev,
      columns: prev.columns.includes(key)
        ? prev.columns.filter((k) => k !== key)
        : [...prev.columns, key],
    }));
  };

  const handleDownload = () => {
    const csvRows = buildCsvRows(rows, config);
    downloadCsv(csvRows, filename);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Export Settlement Report</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={4}>
            <FormControl>
              <FormLabel>Granularity</FormLabel>
              <RadioGroup
                row
                value={config.granularity}
                onChange={(e) => setConfig((p) => ({ ...p, granularity: e.target.value as "daily" | "weekly" }))}
              >
                <FormControlLabel value="weekly" control={<Radio />} label="Weekly" />
                <FormControlLabel
                  value="daily"
                  control={<Radio />}
                  disabled
                  label={<span>Daily <Typography component="span" variant="caption" sx={{ color: "text.secondary" }}>(needs daily RPC — Phase 2)</Typography></span>}
                />
              </RadioGroup>
            </FormControl>

            <FormControl>
              <FormLabel>Layout</FormLabel>
              <RadioGroup
                row
                value={config.layout}
                onChange={(e) => setConfig((p) => ({ ...p, layout: e.target.value as "wide" | "long" }))}
              >
                <FormControlLabel value="wide" control={<Radio />} label="Wide (per-site cols)" />
                <FormControlLabel value="long" control={<Radio />} label="Long (chronological)" />
              </RadioGroup>
            </FormControl>
          </Stack>

          <FormControl component="fieldset">
            <FormLabel>Columns</FormLabel>
            <FormGroup row sx={{ mt: 1 }}>
              {COLUMN_OPTIONS.map((opt) => (
                <FormControlLabel
                  key={opt.key}
                  control={
                    <Checkbox
                      checked={config.columns.includes(opt.key)}
                      onChange={() => toggleColumn(opt.key)}
                    />
                  }
                  label={opt.label}
                  sx={{ width: { xs: "100%", sm: "48%" } }}
                />
              ))}
            </FormGroup>
          </FormControl>

          {/* Per-laborer daily breakdown deferred to Phase 2 with the daily RPC. */}

          <TextField
            label="Filename"
            value={filename}
            slotProps={{ input: { readOnly: true } }}
            size="small"
          />

          <Typography variant="caption" color="text.secondary">
            {rows.length} settlement row(s) match your filters.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleDownload} disabled={rows.length === 0}>
          Download CSV
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/reports/settlements/SettlementReportExportDialog.tsx
git commit -m "feat(reports): SettlementReportExportDialog (granularity/layout/columns)"
```

---

## Task 11: Print view helper

**Files:**
- Create: `src/components/reports/settlements/SettlementReportPrintView.ts`

- [ ] **Step 1: Write the print helper**

Create `src/components/reports/settlements/SettlementReportPrintView.ts`:

```typescript
import type { SettlementReportRow } from "@/types/settlementReport.types";
import { pivotToWide } from "@/lib/utils/settlementReportPivot";

const fmt = (n: number) =>
  n === 0 ? "" : new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

export interface PrintArgs {
  rows: SettlementReportRow[];
  scopeLabel: string;
  categoryLabel: string;
  dateFrom: string;
  dateTo: string;
}

export function openSettlementReportPrintView(args: PrintArgs): void {
  const { rows, scopeLabel, categoryLabel, dateFrom, dateTo } = args;
  const pivot = pivotToWide(rows);

  const siteHeaderCells = pivot.sites
    .map((s) => `<th colspan="2" style="text-align:center">${s.name}</th>`)
    .join("");
  const siteSubHeaderCells = pivot.sites
    .map(() => `<th style="text-align:right">Paid</th><th style="text-align:right">Calc</th>`)
    .join("");

  const bodyRows = pivot.rows.map((r) => {
    const siteCells = pivot.sites.map((s) => {
      const cell = r.bySite[s.id];
      const warn = cell.hasDiff ? ' style="background:#fff3e0;text-align:right"' : ' style="text-align:right"';
      return `<td style="text-align:right">${fmt(cell.paid)}</td><td${warn}>${fmt(cell.calc)}</td>`;
    }).join("");
    return `<tr>
      <td>${r.week_start} → ${r.week_end}</td>
      ${siteCells}
      <td style="text-align:right"><strong>${fmt(r.totalPaid)}</strong></td>
      <td style="text-align:right"><strong>${fmt(r.totalCalc)}</strong></td>
    </tr>`;
  }).join("");

  const totalsCells = pivot.sites.map((s) => {
    const cell = pivot.totalsRow.bySite[s.id];
    return `<td style="text-align:right"><strong>${fmt(cell.paid)}</strong></td><td style="text-align:right"><strong>${fmt(cell.calc)}</strong></td>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Settlement Report — ${scopeLabel}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 1100px; margin: 0 auto; color:#222 }
    h1 { color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 8px; margin: 0 0 10px }
    .meta { font-size: 13px; color: #555; margin-bottom: 16px }
    table { width: 100%; border-collapse: collapse; font-size: 13px }
    th, td { border: 1px solid #ddd; padding: 6px 8px }
    th { background: #f5f5f5; font-weight: 600 }
    tfoot td { border-top: 2px solid #999; background: #fafafa }
    @media print {
      body { padding: 0; max-width: none }
      .no-print { display: none }
    }
  </style>
</head>
<body>
  <h1>Settlement Verification Report</h1>
  <div class="meta">
    <strong>Scope:</strong> ${scopeLabel}<br>
    <strong>Trade:</strong> ${categoryLabel}<br>
    <strong>Period:</strong> ${dateFrom} → ${dateTo}<br>
    <strong>Generated:</strong> ${new Date().toLocaleString("en-IN")}
  </div>
  <table>
    <thead>
      <tr><th rowspan="2">Week</th>${siteHeaderCells}<th colspan="2" style="text-align:center">Total</th></tr>
      <tr>${siteSubHeaderCells}<th style="text-align:right">Paid</th><th style="text-align:right">Calc</th></tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr>
        <td><strong>Totals</strong></td>
        ${totalsCells}
        <td style="text-align:right"><strong>${fmt(pivot.totalsRow.totalPaid)}</strong></td>
        <td style="text-align:right"><strong>${fmt(pivot.totalsRow.totalCalc)}</strong></td>
      </tr>
    </tfoot>
  </table>
  <div class="no-print" style="margin-top:20px;text-align:center">
    <button onclick="window.print()" style="padding:8px 24px;font-size:14px;cursor:pointer">Print / Save as PDF</button>
  </div>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/reports/settlements/SettlementReportPrintView.ts
git commit -m "feat(reports): print view (window.print + @media print)"
```

---

## Task 12: SettlementReportTab — composes everything + InspectPane drill-down

**Files:**
- Create: `src/components/reports/settlements/SettlementReportTab.tsx`

- [ ] **Step 1: Write the tab component**

Create `src/components/reports/settlements/SettlementReportTab.tsx`:

```typescript
"use client";

import { useMemo, useState } from "react";
import { Box, Alert, CircularProgress, Stack } from "@mui/material";
import dayjs from "dayjs";
import SettlementReportToolbar from "./SettlementReportToolbar";
import SettlementReportWideTable from "./SettlementReportWideTable";
import SettlementReportLongTable from "./SettlementReportLongTable";
import SettlementReportExportDialog from "./SettlementReportExportDialog";
import { openSettlementReportPrintView } from "./SettlementReportPrintView";
import { useSettlementReport, useLaborCategoriesForReport } from "@/hooks/queries/useSettlementReport";
import { InspectPane } from "@/components/common/InspectPane/InspectPane";
import type {
  InspectEntity, InspectTabKey,
} from "@/components/common/InspectPane/types";
import type { SettlementReportScope, SettlementReportRow } from "@/types/settlementReport.types";

export default function SettlementReportTab() {
  const [scope, setScope] = useState<SettlementReportScope | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(dayjs().startOf("month").subtract(1, "month").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [view, setView] = useState<"wide" | "long">("wide");
  const [exportOpen, setExportOpen] = useState(false);

  // InspectPane state — driven by row click
  const [inspectEntity, setInspectEntity] = useState<InspectEntity | null>(null);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectPinned, setInspectPinned] = useState(false);
  const [inspectTab, setInspectTab] = useState<InspectTabKey>("attendance");

  const siteIds = scope?.mode === "site" ? [scope.siteId] : scope?.mode === "group" ? scope.siteIds : [];

  const { data: rows = [], isLoading, error } = useSettlementReport({
    siteIds,
    dateFrom,
    dateTo,
    categoryId,
  });

  const { data: categories = [] } = useLaborCategoriesForReport();
  const categoryLabel = categoryId
    ? (categories.find((c) => c.id === categoryId)?.name ?? "Unknown")
    : "All trades";

  const scopeLabel = scope
    ? scope.mode === "group" ? `${scope.groupName}` : scope.siteName
    : "no scope";

  const handleWideRowClick = (weekStart: string, weekEnd: string) => {
    // Open InspectPane in weekly-aggregate kind, scoped across the chosen sites.
    // For a single-site scope: open with that siteId.
    // For a group scope: open with the FIRST site of the group; the user can
    // navigate via the pane. (v1: drill-down is single-site per the existing
    // InspectPane shape. Multi-site stacked drill-down is a Phase 2 idea.)
    if (!scope) return;
    const targetSiteId = scope.mode === "site" ? scope.siteId : scope.siteIds[0];
    setInspectEntity({
      kind: "weekly-aggregate",
      siteId: targetSiteId,
      subcontractId: null,   // all subcontracts on that site for the week
      weekStart,
      weekEnd,
      scopeFrom: dateFrom,
      scopeTo: dateTo,
    });
    setInspectOpen(true);
    setInspectTab("attendance");
  };

  const handleLongRowClick = (row: SettlementReportRow) => {
    setInspectEntity({
      kind: "weekly-aggregate",
      siteId: row.site_id,
      subcontractId: row.subcontract_id,
      weekStart: row.week_start,
      weekEnd: row.week_end,
      scopeFrom: dateFrom,
      scopeTo: dateTo,
    });
    setInspectOpen(true);
    setInspectTab("attendance");
  };

  const handlePrint = () => {
    openSettlementReportPrintView({
      rows,
      scopeLabel: scope ? `${scope.mode === "group" ? "Group: " : ""}${scopeLabel}` : "(no scope)",
      categoryLabel,
      dateFrom,
      dateTo,
    });
  };

  return (
    <Box>
      <SettlementReportToolbar
        scope={scope}
        onScopeChange={setScope}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        view={view}
        onViewChange={setView}
        onExportClick={() => setExportOpen(true)}
        onPrintClick={handlePrint}
        exportDisabled={rows.length === 0}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(error as Error).message}
        </Alert>
      )}

      {!scope && (
        <Alert severity="info">Pick a scope (site or group) to load the report.</Alert>
      )}

      {scope && isLoading && (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress />
        </Stack>
      )}

      {scope && !isLoading && rows.length === 0 && (
        <Alert severity="info">No settlements found for the selected filters.</Alert>
      )}

      {scope && !isLoading && rows.length > 0 && (
        view === "wide" ? (
          <SettlementReportWideTable
            rows={rows}
            isLoading={isLoading}
            onRowClick={(pivotRow) => handleWideRowClick(pivotRow.week_start, pivotRow.week_end)}
          />
        ) : (
          <SettlementReportLongTable
            rows={rows}
            isLoading={isLoading}
            onRowClick={handleLongRowClick}
          />
        )
      )}

      <SettlementReportExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        rows={rows}
        scopeLabel={scopeLabel}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />

      <InspectPane
        entity={inspectEntity}
        isOpen={inspectOpen}
        isPinned={inspectPinned}
        activeTab={inspectTab}
        onTabChange={setInspectTab}
        onClose={() => setInspectOpen(false)}
        onTogglePin={() => setInspectPinned((p) => !p)}
        onOpenInPage={(e) => {
          // For Phase 1: just close the pane. Cross-page nav is a follow-up.
          setInspectOpen(false);
        }}
      />
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/reports/settlements/SettlementReportTab.tsx
git commit -m "feat(reports): SettlementReportTab composes toolbar/tables/dialog/InspectPane"
```

---

## Task 13: Mount the tab on /company/reports/page.tsx

**Files:**
- Modify: `src/app/(main)/company/reports/page.tsx`

- [ ] **Step 1: Read the current page** (already done in research — line numbers stable: see `src/app/(main)/company/reports/page.tsx:294-558` for the existing JSX return).

- [ ] **Step 2: Wrap existing UI in a Tabs container and add the new tab**

Edit `src/app/(main)/company/reports/page.tsx`. Find the line:

```typescript
  return (
    <Box>
      <PageHeader
        title="Company Reports"
        subtitle="Analytics and reports across all sites"
      />
```

Replace the entire return body (down through the closing `</Box>`) with a Tabs-based layout. Use this exact change — old `return ( ... )` becomes:

```typescript
import { Tabs, Tab } from "@mui/material";
// ... existing imports ...
import SettlementReportTab from "@/components/reports/settlements/SettlementReportTab";

// inside the component, near other useState calls:
const [activeTab, setActiveTab] = useState<"overview" | "settlements">("overview");

// in the return:
return (
  <Box>
    <PageHeader
      title="Company Reports"
      subtitle="Analytics and reports across all sites"
    />

    <Tabs
      value={activeTab}
      onChange={(_, v) => setActiveTab(v)}
      sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
    >
      <Tab value="overview" label="Overview" />
      <Tab value="settlements" label="Settlements" />
    </Tabs>

    {activeTab === "overview" && (
      <>
        {/* ALL existing content from the previous return goes here verbatim:
            error Alert, filters Paper, stats Grid, charts Grid, etc. */}
      </>
    )}

    {activeTab === "settlements" && <SettlementReportTab />}
  </Box>
);
```

CRITICAL: when you actually edit the file, do NOT replace the existing JSX with a comment. Move ALL of the existing JSX (from `{error && (` down through the bottom `)}` of the chart grids) into the `{activeTab === "overview" && (<> ... </>)}` slot. The Edit tool's `old_string`/`new_string` is the safest way — read the file fresh, then do a single targeted Edit that wraps the chart UI in the conditional.

- [ ] **Step 3: Verify the page compiles**

Run:
```
npm run build
```

Expected: build succeeds. If TS errors come up (e.g. unused imports), fix them inline.

If the build is slow, an alternative quick check is:
```
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(main)/company/reports/page.tsx
git commit -m "feat(reports): mount Settlements tab on /company/reports"
```

---

## Task 14: End-to-end verification (Playwright + manual)

**Files:**
- No file changes — purely verification.

This is the gate before declaring done. Follow CLAUDE.md "After UI Changes" exactly.

- [ ] **Step 1: Start dev server**

If `npm run dev:cloud` isn't already running, start it in a background shell. Wait until the "Ready in" log appears.

- [ ] **Step 2: Auto-login + screenshot the new tab**

Use Playwright MCP:
1. `mcp__playwright__browser_navigate` to `http://localhost:3000/dev-login` — auto-signs in.
2. `mcp__playwright__browser_navigate` to `http://localhost:3000/company/reports`.
3. Click the "Settlements" tab.
4. `mcp__playwright__browser_take_screenshot` — file: `reports-settlements-empty.png`. Confirm the tab toolbar renders and the "Pick a scope" alert is visible.

- [ ] **Step 3: Pick Vishal's group + a known week**

1. Use `mcp__playwright__browser_fill_form` or `mcp__playwright__browser_click` to select Vishal's group from the Scope dropdown.
2. Set From=`2026-04-01`, To=`2026-05-19`.
3. Optionally pick a Trade.
4. `mcp__playwright__browser_take_screenshot` — file: `reports-settlements-wide.png`.

Expected: the Wide table renders with one row per week, one Paid + Calc pair per site, plus Totals. The weekly numbers should match what you can independently verify by visiting `/site/payments` for each site individually and summing settlement amounts week-by-week.

- [ ] **Step 4: Click a row → InspectPane drill-down**

1. Click any row in the Wide table.
2. `mcp__playwright__browser_take_screenshot` — file: `reports-settlements-inspect.png`.

Expected: the InspectPane drawer opens on the right with the Attendance tab showing the weekly aggregate for the first site of the group. Switching to Settlement tab shows the settlement_groups rows for that week.

- [ ] **Step 5: Switch to Long view**

1. Click "Settlement log" toggle.
2. Screenshot: `reports-settlements-long.png`.

Expected: one row per settlement, all sites interleaved by date.

- [ ] **Step 6: Export CSV**

1. Click Export button.
2. Verify dialog opens with sensible defaults.
3. Click "Download CSV".
4. Open the file in a spreadsheet (or read it from the Downloads folder).
5. Confirm columns match what was checked in the dialog and totals row matches the Wide table.

- [ ] **Step 7: Print view**

1. Click Print button.
2. New window opens with the print-formatted table.
3. Screenshot: `reports-settlements-print.png`.
4. Confirm `@media print` strips chrome (the "Print / Save as PDF" button is hidden in print preview).

- [ ] **Step 8: Switch scope to single site**

1. Pick a single site from the Scope dropdown.
2. Confirm the table collapses to one Paid+Calc pair plus Total. Export filename adjusts.
3. Screenshot: `reports-settlements-single-site.png`.

- [ ] **Step 9: Edge cases**

1. Pick a date range with NO settlements → expect "No settlements found" alert.
2. Pick a week with a known Paid ≠ Calc discrepancy → confirm ⚠ icon renders on that cell.
3. Resize browser to tablet width (768px) → confirm toolbar wraps cleanly and table scrolls horizontally.

- [ ] **Step 10: Console check + fix**

Run `mcp__playwright__browser_console_messages` after each step above. Treat any errors or warnings as failures — fix and re-verify until clean.

- [ ] **Step 11: Close browser**

`mcp__playwright__browser_close`.

---

## Task 15: Final cleanup and unified commit history

- [ ] **Step 1: Run the full test suite**

```
npm run test
```

Expected: all tests pass, including the two new files (`settlementReportPivot.test.ts`, `settlementReportExport.test.ts`).

- [ ] **Step 2: Production build**

```
npm run build
```

Expected: success, no TS errors.

- [ ] **Step 3: Check git status**

```
git status
```

Should be clean — every change committed across Tasks 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13.

- [ ] **Step 4: Skim the diff against main**

```
git log --oneline main..HEAD
git diff main..HEAD --stat
```

Confirm:
- One migration file under `supabase/migrations/`
- New files under `src/components/reports/settlements/`, `src/hooks/queries/`, `src/lib/utils/`, `src/types/`
- One modification to `src/app/(main)/company/reports/page.tsx`
- One modification to `src/lib/cache/keys.ts`

- [ ] **Step 5: Hand off to user**

Tell the user:
1. Tab is live at `/company/reports/` → Settlements.
2. RPC `get_multi_site_settlement_report` is applied on prod (Task 2 Step 5).
3. If Vishal's `site_groups` row doesn't exist yet, create it via `/company/site-groups/`.
4. Suggested follow-ups (NOT in this PR):
   - **Daily granularity export** — add `get_multi_site_settlement_daily` RPC + `useSettlementReportDaily` hook + enable the Daily radio in the dialog (currently disabled with a "Phase 2" tooltip);
   - **Per-laborer daily breakdown** — extend the daily RPC to return per-laborer rows for the export;
   - `payer_source` / `payment_mode` / `created_by` columns in the RPC (currently blank in export options);
   - Multi-site stacked drill-down in InspectPane (currently picks the first site of the group in Wide-view drill-down);
   - Custom multi-site checkbox picker (deferred to Phase 2 per spec).

DO NOT push to remote in this PR — let the user run "move to prod" when they're ready (per CLAUDE.md, that flow handles the prod migration check, build, and worker deploy).

---

## Self-review (mandatory before declaring done)

Run these checks on your own work:

1. **Spec coverage:** every locked decision from the spec is implemented:
   - [x] Wide default + Long sibling tab — Task 7, 8, 12
   - [x] Scope: Site / Group — Task 7 (toolbar)
   - [x] Paid + Calc sub-columns + ⚠ — Task 8 (wide table)
   - [x] Mesthri + Specialist contracts, filter by labor_category — Task 2 (RPC)
   - [x] /company/reports/ Settlements tab — Task 13
   - [x] Export dialog: granularity, layout, columns, notes — Task 10
   - [x] Drill-down via InspectPane — Task 12 (uses existing `weekly-aggregate` entity)
   - [x] Print view — Task 11
2. **No placeholders:** every code block is complete. The only "TODO" allowed is the `payer_source/payment_mode/created_by` columns being blank in export — explicitly called out to the user in Task 15 Step 5.
3. **Type consistency:** `SettlementReportRow` shape matches the RPC's `jsonb_build_object` keys (snake_case) one-for-one. `WidePivot` matches what `pivotToWide` returns. `ExportConfig` matches dialog state.
4. **Out-of-scope guarded:** no daily-market labor, no editing-from-report, no arbitrary multi-site checkbox, no owner login.