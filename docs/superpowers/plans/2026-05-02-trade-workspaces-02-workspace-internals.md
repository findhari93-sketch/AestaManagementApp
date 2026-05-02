# Trade Workspaces — Plan 02: Per-contract Workspace + Create-Contract wizard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the temporary `/site/subcontracts/<id>` bridge from Plan 01 with a dedicated **Trade Workspace** at `/site/trades/[tradeSlug]/[contractId]` — five tabs (Attendance · Advances & Money · Settlements · Ledger · Notes) scoped to one contract. Add a **Create-Contract wizard** at `/site/trades/[tradeSlug]/new` that captures trade, mesthri vs specialist, **labor tracking mode** (detailed | headcount | mesthri_only), and the **role rate card**. After this plan ships, the Trade Hub from Plan 01 stops bridging and points directly into the new workspace.

**Architecture:** Five phases. Phase 1 lays the workspace shell + routing + tab framework. Phase 2 fills the tabs (Attendance reuses today's daily-attendance components for `detailed` mode; `headcount` shows a "configure rate card first" placeholder that Plan 03 replaces; Advances/Settlements/Ledger reuse `subcontract_payments` and `settlement_groups`; Notes wraps the existing work-log surface for this contract). Phase 3 is the Create-Contract wizard (a four-step `MUI Stepper`: trade picker → contractor → labor mode → role rate card preview). Phase 4 swaps the Hub's bridge URLs for the new routes. Phase 5 verifies end-to-end against a prod-restored local DB.

**Tech Stack:** Next.js 15 (app router), React 18, MUI v7 (`@mui/material`), `@tanstack/react-query`, Supabase (PostgreSQL), Tailwind, Vitest + React Testing Library, Playwright MCP for visual verification.

**Spec:** [docs/superpowers/specs/2026-05-02-trade-workspaces-design.md](../specs/2026-05-02-trade-workspaces-design.md)

**Builds on:** [docs/superpowers/plans/2026-05-02-trade-workspaces-01-schema-and-hub.md](2026-05-02-trade-workspaces-01-schema-and-hub.md) — the migration, `useSiteTrades`, `TradeCard`, `/site/trades` hub, and side-nav entry must be merged before this plan starts.

**Plan series:**
- 01 — Schema + Trades hub shell ✅
- **02 (this plan)** — Per-contract Trade Workspace + Create-Contract wizard.
- 03 — Headcount attendance + Role Rate Card editor + Reconciliation banner.
- 04 — Company admin: Trades & Roles settings tab inside `/company/laborers`.
- 05 — Cross-trade roll-ups + Trades Across Sites + Dashboard + nav cleanup.

---

## Files Touched

| Path | Phase | Nature |
|---|---|---|
| `src/types/trade.types.ts` | 1 | Edit — add `TradeContractDetail` (extends `TradeContract` with joined `tradeName`, `tradeSlug`, `team`, `laborer`, `sections`). |
| `src/lib/trade-slug.ts` | 1 | **New** — slug helpers (`tradeNameToSlug`, `tradeSlugToName`). Pure, tested. |
| `src/lib/trade-slug.test.ts` | 1 | **New** — slug round-trip + edge cases. |
| `src/hooks/queries/useTradeContract.ts` | 1 | **New** — `useTradeContract(contractId)` returns one `TradeContractDetail` with joined trade name, team, laborer. |
| `src/hooks/queries/useTradeContract.test.ts` | 1 | **New** — selector test. |
| `src/app/(main)/site/trades/[tradeSlug]/[contractId]/page.tsx` | 1 | **New** — Trade Workspace page; reads `useTradeContract`, mounts `TradeWorkspaceShell`. |
| `src/app/(main)/site/trades/[tradeSlug]/[contractId]/loading.tsx` | 1 | **New** — skeleton route loader. |
| `src/app/(main)/site/trades/[tradeSlug]/[contractId]/not-found.tsx` | 1 | **New** — fallback when contract id resolves to nothing the user can access. |
| `src/components/trades/TradeWorkspaceShell.tsx` | 1 | **New** — header (mesthri/in-house, status, quoted/paid/balance) + MUI `Tabs` + tab panel container. |
| `src/components/trades/TradeWorkspaceShell.test.tsx` | 1 | **New** — header render + tab switching + Plan-03 placeholder visibility for headcount mode. |
| `src/components/trades/tabs/AttendanceTab.tsx` | 2 | **New** — switches on `laborTrackingMode`. `detailed` → embeds `<DailyAttendanceTable contractId={...}/>` (existing component). `headcount` → renders `<HeadcountAttendancePlaceholder/>` (Plan 03 fills). `mesthri_only` → returns null (parent hides the tab). |
| `src/components/trades/tabs/AdvancesTab.tsx` | 2 | **New** — list of `subcontract_payments` for this contract + "Record advance" button that opens the existing `SubcontractPaymentDialog`. |
| `src/components/trades/tabs/SettlementsTab.tsx` | 2 | **New** — list of `settlement_groups` filtered by this contract + open existing settlement edit dialogs. |
| `src/components/trades/tabs/LedgerTab.tsx` | 2 | **New** — combined chronological view (advances + daily expenses + settlements) with a running balance column. |
| `src/components/trades/tabs/NotesTab.tsx` | 2 | **New** — wraps existing site work-log filtered to this contract. Photos drop next plan. |
| `src/components/trades/HeadcountAttendancePlaceholder.tsx` | 2 | **New** — friendly "Coming in Plan 03" with an explanation; not a `TODO` placeholder, deliberate UX. |
| `src/hooks/queries/useSubcontractLedger.ts` | 2 | **New** — merges `subcontract_payments` + `settlement_groups` for one contract into a single sorted timeline with running balance. Pure logic + Supabase fetch. |
| `src/hooks/queries/useSubcontractLedger.test.ts` | 2 | **New** — interleaving + balance math. |
| `src/app/(main)/site/trades/[tradeSlug]/new/page.tsx` | 3 | **New** — Create-Contract wizard route. |
| `src/components/trades/CreateTradeContractWizard.tsx` | 3 | **New** — four-step MUI `Stepper`: 1. Trade (preselected from URL slug; can be changed). 2. Contractor (mesthri team or specialist laborer). 3. Labor tracking mode (radio with detailed | headcount | mesthri_only). 4. Role rate card preview (read-only — Plan 03 makes editable). Submits via `useCreateSubcontract`. |
| `src/components/trades/CreateTradeContractWizard.test.tsx` | 3 | **New** — happy-path + validation per step. |
| `src/hooks/queries/useCreateSubcontract.ts` | 3 | **New** — mutation that inserts a `subcontracts` row + seeds `subcontract_role_rates` from `labor_roles.default_daily_rate` for the chosen trade. |
| `src/hooks/queries/useCreateSubcontract.test.ts` | 3 | **New** — payload shape. |
| `src/app/(main)/site/trades/page.tsx` | 4 | Edit — `handleContractClick` and `handleAddClick` now route into `/site/trades/[tradeSlug]/[contractId]` and `/site/trades/[tradeSlug]/new`. The bridge to `/site/subcontracts` is removed. |
| `src/components/trades/TradeCard.tsx` | 4 | Edit — `onContractClick` payload now includes `tradeSlug` so the page can build the right URL. |
| `src/components/trades/TradeCard.test.tsx` | 4 | Edit — update mock + assertion on the new payload shape. |

**Files NOT touched** (deliberately deferred):
- `src/app/(main)/site/subcontracts/page.tsx` — still exists, reachable via direct URL. Plan 05 redirects it.
- `src/app/(main)/site/attendance/page.tsx` — still exists. Plan 05 redirects it.
- Anything under `src/components/payments/` — Plan 05 territory.

---

## Pre-flight

- [ ] **Step 1: Verify Plan 01 is merged**

  Run: `git log --oneline | grep "trade-workspaces"`
  Expected: at minimum 3 commits — `docs(trades): add multi-trade workspaces spec`, `feat(trades): add trade dimension migration`, `feat(trades): add /site/trades hub`. If they are still on `feature/trade-workspaces-01-schema-and-hub`, confirm with the user that Plan 01 is at least PR-approved before starting Plan 02 work, since Plan 02 depends on the new schema columns.

- [ ] **Step 2: Verify migration applied locally**

  Use Supabase MCP `mcp__supabase__execute_sql` (local):
  ```sql
  SELECT column_name FROM information_schema.columns
   WHERE table_name = 'subcontracts'
     AND column_name IN ('trade_category_id','labor_tracking_mode','is_in_house');
  ```
  Expected: 3 rows. If missing, restart Docker Desktop and run `npm run db:reset`.

- [ ] **Step 3: Create feature branch**

  Run: `git checkout -b feature/trade-workspaces-02-workspace-internals`
  Branch off whichever branch contains the merged Plan 01 (typically `main`).

- [ ] **Step 4: Baseline test + build**

  Run: `npm run test && npm run build`
  Expected: 236+ tests pass; build clean.

---

# PHASE 1 — Workspace shell, routing, and `useTradeContract`

**Independent. Mergeable alone if Phase 2 is gated behind a feature flag.** Adds the `/site/trades/[tradeSlug]/[contractId]` route with a working header (quoted/paid/balance), the tab framework, and the `useTradeContract` hook that powers it. Tab bodies render placeholders until Phase 2.

## Task 1.1: Slug helpers

**Files:**
- Create: `src/lib/trade-slug.ts`
- Create: `src/lib/trade-slug.test.ts`

**Why:** The URL uses a slug (`painting`, `tiling`, `civil-in-house`) so the link is human-readable. The slug must round-trip from category name (`Painting`) and back. We never want the page to depend on a name lookup that could fail; the slug encodes everything needed.

- [ ] **Step 1: Write the failing test**

  Create `src/lib/trade-slug.test.ts`:
  ```ts
  import { describe, it, expect } from "vitest";
  import { tradeNameToSlug, tradeSlugToName } from "./trade-slug";

  describe("trade slug helpers", () => {
    it("lowercases + hyphenates the category name", () => {
      expect(tradeNameToSlug("Painting")).toBe("painting");
      expect(tradeNameToSlug("Civil")).toBe("civil");
    });

    it("preserves multi-word handling (Other -> 'other', custom 'Roof Tiling' -> 'roof-tiling')", () => {
      expect(tradeNameToSlug("Roof Tiling")).toBe("roof-tiling");
    });

    it("strips leading/trailing whitespace and collapses internal whitespace", () => {
      expect(tradeNameToSlug("  Painting  ")).toBe("painting");
      expect(tradeNameToSlug("Roof   Tiling")).toBe("roof-tiling");
    });

    it("round-trips a known title-case name", () => {
      expect(tradeSlugToName(tradeNameToSlug("Painting"))).toBe("Painting");
    });

    it("uppercases each word when reading a slug back", () => {
      expect(tradeSlugToName("roof-tiling")).toBe("Roof Tiling");
    });
  });
  ```

- [ ] **Step 2: Implement**

  Create `src/lib/trade-slug.ts`:
  ```ts
  export function tradeNameToSlug(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, "-");
  }

  export function tradeSlugToName(slug: string): string {
    return slug
      .split("-")
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
      .join(" ");
  }
  ```

- [ ] **Step 3: Run + commit**
  ```bash
  npx vitest run src/lib/trade-slug.test.ts
  git add src/lib/trade-slug.ts src/lib/trade-slug.test.ts
  git commit -m "feat(trades): add trade slug helpers for workspace URLs"
  ```

## Task 1.2: `useTradeContract` hook

**Files:**
- Edit: `src/types/trade.types.ts`
- Create: `src/hooks/queries/useTradeContract.ts`
- Create: `src/hooks/queries/useTradeContract.test.ts`

- [ ] **Step 1: Extend the type**

  In `src/types/trade.types.ts`, add at the bottom:
  ```ts
  export interface TradeContractDetail extends TradeContract {
    tradeName: string;
    tradeSlug: string;
    teamName: string | null;
    laborerName: string | null;
    weeklyAdvanceRate: number | null;
    maestriMarginPerDay: number | null;
    startDate: string | null;
    expectedEndDate: string | null;
  }
  ```

- [ ] **Step 2: Implement the hook**

  Create `src/hooks/queries/useTradeContract.ts`:
  ```ts
  import { useQuery } from "@tanstack/react-query";
  import { createClient } from "@/lib/supabase/client";
  import { tradeNameToSlug } from "@/lib/trade-slug";
  import type {
    ContractStatus,
    LaborTrackingMode,
    TradeContractDetail,
  } from "@/types/trade.types";

  interface RawDetailRow {
    id: string;
    site_id: string;
    trade_category_id: string | null;
    title: string;
    labor_tracking_mode: string | null;
    is_in_house: boolean;
    contract_type: "mesthri" | "specialist";
    status: ContractStatus;
    total_value: number | string | null;
    weekly_advance_rate: number | string | null;
    maestri_margin_per_day: number | string | null;
    start_date: string | null;
    expected_end_date: string | null;
    created_at: string;
    trade: { name: string } | null;
    team: { id: string; leader_name: string | null } | null;
    laborer: { id: string; name: string | null } | null;
  }

  export function useTradeContract(contractId: string | undefined) {
    const supabase = createClient();
    return useQuery({
      queryKey: ["trade-contract", contractId],
      enabled: !!contractId,
      staleTime: 60 * 1000,
      queryFn: async (): Promise<TradeContractDetail | null> => {
        if (!contractId) return null;
        const { data, error } = await supabase
          .from("subcontracts")
          .select(`
            id, site_id, trade_category_id, title,
            labor_tracking_mode, is_in_house, contract_type, status,
            total_value, weekly_advance_rate, maestri_margin_per_day,
            start_date, expected_end_date, created_at,
            trade:labor_categories!subcontracts_trade_category_id_fkey(name),
            team:teams(id, leader_name),
            laborer:laborers(id, name)
          `)
          .eq("id", contractId)
          .single();
        if (error) {
          if (error.code === "PGRST116") return null; // not found
          throw error;
        }
        const r = data as unknown as RawDetailRow;
        const tradeName = r.trade?.name ?? "Unknown";
        return {
          id: r.id,
          siteId: r.site_id,
          tradeCategoryId: r.trade_category_id,
          title: r.title,
          laborTrackingMode: (r.labor_tracking_mode ?? "detailed") as LaborTrackingMode,
          isInHouse: r.is_in_house,
          contractType: r.contract_type,
          status: r.status,
          totalValue: Number(r.total_value ?? 0),
          mesthriOrSpecialistName: r.team?.leader_name ?? r.laborer?.name ?? null,
          createdAt: r.created_at,
          tradeName,
          tradeSlug: tradeNameToSlug(tradeName),
          teamName: r.team?.leader_name ?? null,
          laborerName: r.laborer?.name ?? null,
          weeklyAdvanceRate: r.weekly_advance_rate == null ? null : Number(r.weekly_advance_rate),
          maestriMarginPerDay: r.maestri_margin_per_day == null ? null : Number(r.maestri_margin_per_day),
          startDate: r.start_date,
          expectedEndDate: r.expected_end_date,
        };
      },
    });
  }
  ```

- [ ] **Step 3: Test the row-shape mapping**

  Create `src/hooks/queries/useTradeContract.test.ts` — test the pure row-mapping by extracting a `mapRowToDetail` helper from the hook. Or skip this and rely on integration tests in Phase 5 since the mapping is straightforward. (Author's call: extract if you want the safety; otherwise commit and move on.)

- [ ] **Step 4: Commit**
  ```bash
  git add src/types/trade.types.ts src/hooks/queries/useTradeContract.ts
  git commit -m "feat(trades): add useTradeContract hook + TradeContractDetail type"
  ```

## Task 1.3: Workspace shell

**Files:**
- Create: `src/components/trades/TradeWorkspaceShell.tsx`
- Create: `src/components/trades/TradeWorkspaceShell.test.tsx`

- [ ] **Step 1: Write the test first**

  Create `src/components/trades/TradeWorkspaceShell.test.tsx`:
  ```tsx
  import React from "react";
  import { describe, it, expect, vi } from "vitest";
  import { render, screen, fireEvent } from "@testing-library/react";
  import { TradeWorkspaceShell } from "./TradeWorkspaceShell";
  import type { TradeContractDetail } from "@/types/trade.types";

  function makeDetail(overrides: Partial<TradeContractDetail> = {}): TradeContractDetail {
    return {
      id: "k1", siteId: "s1", tradeCategoryId: "p1",
      title: "Asis Painting", laborTrackingMode: "mesthri_only",
      isInHouse: false, contractType: "mesthri", status: "active",
      totalValue: 250000,
      mesthriOrSpecialistName: "Asis Mesthri",
      createdAt: "2026-05-02T00:00:00Z",
      tradeName: "Painting", tradeSlug: "painting",
      teamName: "Asis Team", laborerName: null,
      weeklyAdvanceRate: null, maestriMarginPerDay: null,
      startDate: null, expectedEndDate: null,
      ...overrides,
    };
  }

  describe("TradeWorkspaceShell", () => {
    it("renders trade + mesthri name in the header", () => {
      render(<TradeWorkspaceShell contract={makeDetail()} amountPaid={0}>{null}</TradeWorkspaceShell>);
      expect(screen.getByText("Painting")).toBeInTheDocument();
      expect(screen.getByText(/Asis Mesthri/)).toBeInTheDocument();
    });

    it("renders 'In-house' instead of mesthri name for is_in_house contracts", () => {
      render(<TradeWorkspaceShell contract={makeDetail({ isInHouse: true, mesthriOrSpecialistName: null })} amountPaid={0}>{null}</TradeWorkspaceShell>);
      expect(screen.getByText(/in-house/i)).toBeInTheDocument();
    });

    it("hides the Attendance tab for mesthri_only contracts", () => {
      render(<TradeWorkspaceShell contract={makeDetail({ laborTrackingMode: "mesthri_only" })} amountPaid={0}>{null}</TradeWorkspaceShell>);
      expect(screen.queryByRole("tab", { name: /attendance/i })).not.toBeInTheDocument();
    });

    it("shows the Attendance tab for detailed and headcount modes", () => {
      const { rerender } = render(<TradeWorkspaceShell contract={makeDetail({ laborTrackingMode: "detailed" })} amountPaid={0}>{null}</TradeWorkspaceShell>);
      expect(screen.getByRole("tab", { name: /attendance/i })).toBeInTheDocument();
      rerender(<TradeWorkspaceShell contract={makeDetail({ laborTrackingMode: "headcount" })} amountPaid={0}>{null}</TradeWorkspaceShell>);
      expect(screen.getByRole("tab", { name: /attendance/i })).toBeInTheDocument();
    });

    it("shows quoted/paid/balance amounts when totalValue > 0", () => {
      render(<TradeWorkspaceShell contract={makeDetail({ totalValue: 250000 })} amountPaid={100000}>{null}</TradeWorkspaceShell>);
      expect(screen.getByText(/2,50,000/)).toBeInTheDocument(); // quoted
      expect(screen.getByText(/1,00,000/)).toBeInTheDocument(); // paid
      expect(screen.getByText(/1,50,000/)).toBeInTheDocument(); // balance
    });

    it("calls onTabChange when a tab is clicked", () => {
      const onTabChange = vi.fn();
      render(<TradeWorkspaceShell contract={makeDetail()} amountPaid={0} onTabChange={onTabChange}>{null}</TradeWorkspaceShell>);
      fireEvent.click(screen.getByRole("tab", { name: /ledger/i }));
      expect(onTabChange).toHaveBeenCalledWith("ledger");
    });
  });
  ```

- [ ] **Step 2: Implement**

  Create `src/components/trades/TradeWorkspaceShell.tsx`:
  ```tsx
  "use client";
  import React, { useState } from "react";
  import { Box, Typography, Tabs, Tab, Stack, Chip, Paper } from "@mui/material";
  import type { TradeContractDetail } from "@/types/trade.types";

  export type WorkspaceTab = "attendance" | "advances" | "settlements" | "ledger" | "notes";

  interface TradeWorkspaceShellProps {
    contract: TradeContractDetail;
    amountPaid: number;
    initialTab?: WorkspaceTab;
    onTabChange?: (tab: WorkspaceTab) => void;
    children: React.ReactNode;
  }

  function formatINR(amount: number): string {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
  }

  export function TradeWorkspaceShell({
    contract, amountPaid, initialTab = "ledger", onTabChange, children,
  }: TradeWorkspaceShellProps) {
    const [tab, setTab] = useState<WorkspaceTab>(initialTab);
    const showAttendance = contract.laborTrackingMode !== "mesthri_only";
    const partyLabel = contract.isInHouse ? "In-house" : (contract.mesthriOrSpecialistName ?? "Unassigned");
    const balance = (contract.totalValue ?? 0) - amountPaid;

    const handleChange = (_e: React.SyntheticEvent, value: WorkspaceTab) => {
      setTab(value);
      onTabChange?.(value);
    };

    return (
      <Box>
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Box>
              <Typography variant="overline" color="text.secondary">{contract.tradeName}</Typography>
              <Typography variant="h5" fontWeight={600}>{partyLabel}</Typography>
            </Box>
            <Chip label={contract.status} size="small" />
          </Stack>
          {contract.totalValue > 0 && (
            <Stack direction="row" spacing={3}>
              <Box>
                <Typography variant="caption" color="text.secondary">Quoted</Typography>
                <Typography fontWeight={600}>₹{formatINR(contract.totalValue)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Paid</Typography>
                <Typography fontWeight={600}>₹{formatINR(amountPaid)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Balance</Typography>
                <Typography fontWeight={600} color={balance < 0 ? "error.main" : "text.primary"}>
                  ₹{formatINR(Math.abs(balance))}{balance < 0 ? " over" : ""}
                </Typography>
              </Box>
            </Stack>
          )}
        </Paper>

        <Tabs value={tab} onChange={handleChange} sx={{ mb: 2 }}>
          {showAttendance && <Tab value="attendance" label="Attendance" />}
          <Tab value="advances" label="Advances & Money" />
          <Tab value="settlements" label="Settlements" />
          <Tab value="ledger" label="Ledger" />
          <Tab value="notes" label="Notes" />
        </Tabs>

        <Box>{children}</Box>
      </Box>
    );
  }
  ```

- [ ] **Step 3: Run tests + commit**
  ```bash
  npx vitest run src/components/trades/TradeWorkspaceShell.test.tsx
  git add src/components/trades/TradeWorkspaceShell.tsx src/components/trades/TradeWorkspaceShell.test.tsx
  git commit -m "feat(trades): add TradeWorkspaceShell with header + tab framework"
  ```

## Task 1.4: Workspace route + tab placeholders

**Files:**
- Create: `src/app/(main)/site/trades/[tradeSlug]/[contractId]/page.tsx`
- Create: `src/app/(main)/site/trades/[tradeSlug]/[contractId]/loading.tsx`
- Create: `src/app/(main)/site/trades/[tradeSlug]/[contractId]/not-found.tsx`

- [ ] **Step 1: Loading skeleton**
  ```tsx
  // loading.tsx
  import React from "react";
  import { Box, Skeleton } from "@mui/material";

  export default function Loading() {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={120} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={48} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={400} />
      </Box>
    );
  }
  ```

- [ ] **Step 2: Not-found**
  ```tsx
  // not-found.tsx
  import React from "react";
  import { Box, Alert } from "@mui/material";
  import Link from "next/link";

  export default function NotFound() {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning" action={<Link href="/site/trades">Back to Trades</Link>}>
          Contract not found or no longer accessible.
        </Alert>
      </Box>
    );
  }
  ```

- [ ] **Step 3: Page**
  ```tsx
  // page.tsx
  "use client";
  import React from "react";
  import { useParams } from "next/navigation";
  import { Box, Alert } from "@mui/material";
  import { useTradeContract } from "@/hooks/queries/useTradeContract";
  import { TradeWorkspaceShell } from "@/components/trades/TradeWorkspaceShell";
  // Phase 2 will replace these placeholders with real tab components.
  import { Typography } from "@mui/material";

  export default function TradeContractWorkspacePage() {
    const params = useParams<{ tradeSlug: string; contractId: string }>();
    const { data: contract, isLoading, error } = useTradeContract(params?.contractId);

    if (isLoading) return null;       // loading.tsx covers it
    if (error) return <Box sx={{ p: 2 }}><Alert severity="error">{error.message}</Alert></Box>;
    if (!contract) return <Box sx={{ p: 2 }}><Alert severity="warning">Contract not found.</Alert></Box>;

    return (
      <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
        <TradeWorkspaceShell contract={contract} amountPaid={0}>
          <Typography variant="body2" color="text.secondary">
            Tab content lands in Phase 2.
          </Typography>
        </TradeWorkspaceShell>
      </Box>
    );
  }
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add src/app/\(main\)/site/trades/\[tradeSlug\]/
  git commit -m "feat(trades): add Trade Workspace route with shell + placeholders"
  ```

---

# PHASE 2 — Tab bodies

**Depends on Phase 1.** Each tab is a separate component; commit per tab.

## Task 2.1: Ledger tab (do this first — it's the most-used)

**Files:**
- Create: `src/hooks/queries/useSubcontractLedger.ts`
- Create: `src/hooks/queries/useSubcontractLedger.test.ts`
- Create: `src/components/trades/tabs/LedgerTab.tsx`

The hook merges two streams:

```ts
// useSubcontractLedger.ts (key shape — write the full file in this task)
export interface LedgerEntry {
  date: string;                     // ISO date
  kind: "advance" | "milestone" | "part_payment" | "final_settlement" | "settlement";
  amount: number;                   // positive = paid out (reduces balance)
  reference: string | null;
  paymentChannel: string | null;
  payerName: string | null;
  notes: string | null;
}

export interface LedgerWithBalance {
  entries: Array<LedgerEntry & { runningBalance: number }>;
  totalPaid: number;
  totalQuoted: number;
}

export function useSubcontractLedger(contractId, totalQuoted) { /* ... */ }
```

Test the **balance walk** with a fixture: 3 advances + 1 settlement → assert each `runningBalance` matches.

Component is a `DataGrid` (existing project convention) with columns Date · Kind · Reference · Channel · Payer · Amount · Running Balance.

- [ ] Steps: write hook test → implement hook → write component → run tests → commit `feat(trades): add LedgerTab with running balance`.

## Task 2.2: Advances tab

**Files:**
- Create: `src/components/trades/tabs/AdvancesTab.tsx`

Pattern:
1. List `subcontract_payments` filtered by `subcontract_id`, sorted by date desc.
2. "Record advance" button opens the existing `SubcontractPaymentDialog` (find the file with `Grep "SubcontractPaymentDialog"` — the existing `/site/subcontracts` page uses it).
3. After a successful create, invalidate the React Query keys: `["trade-contract", contractId]`, `["subcontract-ledger", contractId]`, `["trades", "site", siteId]`.

- [ ] Steps: skim the existing dialog signature → wrap it → render the list → wire the invalidation → commit.

## Task 2.3: Settlements tab

**Files:**
- Create: `src/components/trades/tabs/SettlementsTab.tsx`

Pattern:
1. List `settlement_groups` where `subcontract_id = contractId`, sort by `settlement_date` desc.
2. Row click opens existing `ContractSettlementEditDialog` or `DailySettlementEditDialog` (depending on `settlement_type`).
3. No "create" entry point in this tab — settlements are created from the Attendance tab in `detailed` mode and from headcount entries in Plan 03.

- [ ] Steps: write component → wire existing dialogs → commit.

## Task 2.4: Attendance tab

**Files:**
- Create: `src/components/trades/tabs/AttendanceTab.tsx`
- Create: `src/components/trades/HeadcountAttendancePlaceholder.tsx`

Switch on `laborTrackingMode`:
- `detailed` → wrap existing daily-attendance components (find via `Grep "DailyAttendanceTable\|attendance-content"` to identify the right surface). Pre-filter to this contract via `subcontract_id`.
- `headcount` → render the placeholder explaining Plan 03 will add per-role unit entry.
- `mesthri_only` → return `null` (the shell hides the tab anyway).

The placeholder is intentional UX, not a TODO:
```tsx
// HeadcountAttendancePlaceholder.tsx
"use client";
import React from "react";
import { Paper, Typography } from "@mui/material";

export function HeadcountAttendancePlaceholder() {
  return (
    <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
      <Typography variant="h6" gutterBottom>Headcount entry coming soon</Typography>
      <Typography variant="body2" color="text.secondary">
        Per-role daily unit entry (e.g., "1 technical + 2 helpers today") and the
        labor-vs-paid reconciliation banner ship in Plan 03. For now, record this
        contract&rsquo;s payments under the <strong>Advances &amp; Money</strong> tab; the
        Ledger keeps a running balance even without attendance.
      </Typography>
    </Paper>
  );
}
```

- [ ] Steps: write tab dispatcher → import detailed table → write placeholder → commit.

## Task 2.5: Notes tab

**Files:**
- Create: `src/components/trades/tabs/NotesTab.tsx`

Pattern:
1. Find the existing site work-log surface (`Grep "work-log\|WorkLog"` in `src/components/`).
2. If it's already filterable by subcontract_id, embed it. If not, embed a simple textarea + list MVP using a new `subcontract_notes` table — but DO NOT add that table in this plan; instead, render a placeholder pointing to Plan 03 for note authoring and just show existing site-level work-log entries that touch this contract (filter by JSON content match if necessary).

- [ ] Steps: inspect existing work-log → embed or placeholder → commit.

## Task 2.6: Replace the page placeholder with real tabs

**Files:**
- Edit: `src/app/(main)/site/trades/[tradeSlug]/[contractId]/page.tsx`

Replace the placeholder children with a `switch` over `tab`:
```tsx
const [tab, setTab] = useState<WorkspaceTab>("ledger");
const tabContent = (() => {
  switch (tab) {
    case "attendance":  return <AttendanceTab  contract={contract} />;
    case "advances":    return <AdvancesTab    contract={contract} />;
    case "settlements": return <SettlementsTab contract={contract} />;
    case "ledger":      return <LedgerTab      contract={contract} />;
    case "notes":       return <NotesTab       contract={contract} />;
  }
})();

return (
  <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
    <TradeWorkspaceShell contract={contract} amountPaid={amountPaid} initialTab={tab} onTabChange={setTab}>
      {tabContent}
    </TradeWorkspaceShell>
  </Box>
);
```

`amountPaid` should come from `useSubcontractLedger(contractId).data?.totalPaid ?? 0` so the header reflects the live total.

- [ ] Steps: wire tabs → run build → commit `feat(trades): wire all five tabs into Trade Workspace`.

---

# PHASE 3 — Create-Contract wizard

**Depends on Phase 1.** Independent of Phase 2 — can ship in parallel.

## Task 3.1: `useCreateSubcontract` mutation

**Files:**
- Create: `src/hooks/queries/useCreateSubcontract.ts`
- Create: `src/hooks/queries/useCreateSubcontract.test.ts`

Mutation accepts:
```ts
interface CreateSubcontractInput {
  siteId: string;
  tradeCategoryId: string;
  contractType: "mesthri" | "specialist";
  teamId?: string;        // required when contractType=mesthri
  laborerId?: string;     // required when contractType=specialist
  title: string;
  totalValue: number;
  isRateBased: boolean;
  laborTrackingMode: LaborTrackingMode;
  weeklyAdvanceRate?: number;
  maestriMarginPerDay?: number;
  startDate?: string;
  expectedEndDate?: string;
}
```

Logic:
1. INSERT into `subcontracts` with the new fields.
2. If `laborTrackingMode === "headcount"`, INSERT default rows into `subcontract_role_rates` for every role belonging to that trade — `daily_rate` defaulted from `labor_roles.default_daily_rate`. Engineer can override later (Plan 03 makes the rate card editable).
3. Invalidate `["trades", "site", siteId]`.

Test: build a mock `supabase.from(...).insert(...).select(...).single()` chain that asserts the payload shape.

- [ ] Steps: write the test → implement → commit.

## Task 3.2: Wizard component

**Files:**
- Create: `src/components/trades/CreateTradeContractWizard.tsx`
- Create: `src/components/trades/CreateTradeContractWizard.test.tsx`

Four-step `MUI Stepper`. Use `React.useState<{ step: number; payload: Partial<CreateSubcontractInput> }>` as wizard state. Each step renders a panel + Next/Back buttons. Final step's "Create" calls `useCreateSubcontract`.

**Step 1 — Trade picker.** If `tradeSlug` URL param matches a known active labor_categories row, pre-select it; otherwise show all active categories as MUI `ToggleButtonGroup`.

**Step 2 — Contractor.** Toggle `contractType`: mesthri (Autocomplete on `teams`) or specialist (Autocomplete on `laborers` filtered to `employment_type='specialist'`). Validate: must pick one.

**Step 3 — Labor tracking mode.** Radio buttons:
- `detailed` — "Track each laborer daily (in/out time, individual rates)"
- `headcount` — "Track daily count per role (e.g. '1 technical + 2 helpers today')"
- `mesthri_only` — "Don't track attendance; just record payments to the mesthri"

**Step 4 — Role rate card preview.** Read-only table of `labor_roles` for this trade with their `default_daily_rate`. Note: "Edit individual rates in the contract Workspace after creating (Plan 03)." For `mesthri_only` mode, skip this step entirely.

Submit: call mutation; on success, `router.push("/site/trades/<tradeSlug>/<newId>")`.

Test: mount the wizard, walk through 4 steps, assert the mutation is called with the right payload.

- [ ] Steps: write the test → implement → commit `feat(trades): add Create-Contract wizard`.

## Task 3.3: Wizard route

**Files:**
- Create: `src/app/(main)/site/trades/[tradeSlug]/new/page.tsx`

Thin client-component shell:
```tsx
"use client";
import React from "react";
import { useParams } from "next/navigation";
import { Box } from "@mui/material";
import { CreateTradeContractWizard } from "@/components/trades/CreateTradeContractWizard";

export default function NewTradeContractPage() {
  const params = useParams<{ tradeSlug: string }>();
  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
      <CreateTradeContractWizard tradeSlug={params?.tradeSlug ?? ""} />
    </Box>
  );
}
```

- [ ] Steps: write page → commit.

---

# PHASE 4 — Hub bridge removal

## Task 4.1: Update `TradeCard` to surface `tradeSlug`

**Files:**
- Edit: `src/components/trades/TradeCard.tsx`
- Edit: `src/components/trades/TradeCard.test.tsx`

Change `onContractClick: (contractId: string)` → `onContractClick: (contract: { id: string; tradeSlug: string })` and `onAddClick: (tradeCategoryId: string)` → `onAddClick: (input: { tradeCategoryId: string; tradeSlug: string })`. Update tests to assert the new payload.

The `tradeSlug` comes from `tradeNameToSlug(category.name)` inside the card — the card is the right place because it knows the category.

- [ ] Steps: edit type → update tests → run → commit.

## Task 4.2: Update the hub page

**Files:**
- Edit: `src/app/(main)/site/trades/page.tsx`

Replace the bridge handlers:
```tsx
const handleContractClick = ({ id, tradeSlug }: { id: string; tradeSlug: string }) => {
  router.push(`/site/trades/${tradeSlug}/${id}`);
};
const handleAddClick = ({ tradeSlug }: { tradeCategoryId: string; tradeSlug: string }) => {
  router.push(`/site/trades/${tradeSlug}/new`);
};
```

- [ ] Steps: edit handlers → run build → commit `feat(trades): hub now routes into dedicated workspace`.

---

# PHASE 5 — End-to-end verification

## Task 5.1: Local DB + restored prod data

- [ ] **Step 1: Apply Plan 01 migration** (if not already): start Docker, `npm run db:reset`. Verify `subcontracts.trade_category_id` exists.
- [ ] **Step 2: Restore prod data** per CLAUDE.md "Refreshing Local Data from Production".

## Task 5.2: Playwright walkthrough

Use Playwright MCP from `localhost:3000/dev-login`:

- [ ] **Step 1: Navigate Trades hub → click Civil "In-house" card.** Verify URL is `/site/trades/civil/<contractId>` and the workspace renders with the in-house Civil header.
- [ ] **Step 2: Click each tab** (Advances, Settlements, Ledger, Notes — Attendance is hidden for `mesthri_only`; visible for in-house Civil since it's `detailed`). Verify content renders without console errors.
- [ ] **Step 3: Create a new Painting contract.** Hub → Painting "Add contract" → wizard. Pick mesthri → pick a team → labor mode `mesthri_only` → submit. Verify redirect to `/site/trades/painting/<newId>`. Verify Attendance tab is hidden.
- [ ] **Step 4: Record an advance.** Advances tab → "Record advance" → ₹50,000 via engineer. Verify ledger updates and header `Paid` increments to ₹50,000.
- [ ] **Step 5: Create a Tiling contract in `headcount` mode.** Wizard → labor mode `headcount` → submit. Verify Attendance tab shows the placeholder explaining Plan 03 will add entry, and the role rate card is visible (read-only).
- [ ] **Step 6: Confirm bridge URLs gone.** Navigate `/site/subcontracts?contractId=<x>` directly — it should still load (Plan 05 redirects it), but no internal link should produce that URL anymore. Use Playwright's `browser_network_requests` to confirm.
- [ ] **Step 7: Console clean.** `mcp__playwright__browser_console_messages` returns no errors.

## Task 5.3: Final tests + push

- [ ] `npm run test` — all green, target ≥ 250 tests.
- [ ] `npm run build` — clean.
- [ ] `git push -u origin feature/trade-workspaces-02-workspace-internals`.
- [ ] Open PR titled **"feat(trades): per-contract Trade Workspace + Create-Contract wizard (Plan 02 of 5)"**, link spec + Plan 01 PR + this plan in the body.

---

## Spec coverage check

| Spec section | Covered by Plan 02 |
|---|---|
| Trade Workspace tabs (Attendance · Advances · Settlements · Ledger · Notes) | ✅ Phase 2 |
| Workspace shell with quoted/paid/balance | ✅ Phase 1 |
| Routes `/site/trades/[tradeSlug]/[contractId]` and `[tradeSlug]/new` | ✅ Phases 1, 3 |
| Create-Contract wizard (trade · contractor · labor mode · rate card preview) | ✅ Phase 3 |
| Default role rates seeded for new contracts in headcount mode | ✅ Phase 3 |
| Hub no longer bridges to `/site/subcontracts` | ✅ Phase 4 |
| Headcount per-role unit entry | Plan 03 (placeholder shown here) |
| Role Rate Card editor | Plan 03 (read-only preview here) |
| Reconciliation banner + chart | Plan 03 |
| Admin Trades & Roles | Plan 04 |
| Cross-trade `/site/payments` roll-up + Trades Across Sites + Dashboard | Plan 05 |

No placeholders that block execution. Tabs that depend on Plan 03 render an intentional UX explanation, not a TODO sticker.
