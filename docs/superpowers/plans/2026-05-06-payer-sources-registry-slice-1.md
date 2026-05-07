# Payer Sources Registry — Slice 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-site `payer_sources` registry table seeded with 6 canonical built-ins, wire `<PayerSourceSelector>` to optionally read from it, and extract `requiresPayerName` to deduplicate 5 inline guards. Behavior preserved: every site shows the same 6 options as today.

**Architecture:** Eager seed + soft registry. Single `payer_sources` table keyed by `(site_id, key)`. `settlement_groups.payer_source` stays a `text` column with a soft reference to the registry — no FK migration. Picker gains optional `siteId` prop; when provided, options come from the registry, otherwise the existing hardcoded list. `MestriSettleDialog` migrates in this slice; the other 4 callers wait for Slice 2.

**Tech Stack:** Supabase (PostgreSQL migration + trigger), React Query (TanStack Query v5), MUI v7 toggle-button picker, Vitest + @testing-library/react for unit tests, Supabase JS client.

**Spec:** [docs/superpowers/specs/2026-05-06-payer-sources-registry-slice-1-design.md](../specs/2026-05-06-payer-sources-registry-slice-1-design.md)

---

## File structure

**Create:**
- `supabase/migrations/20260506130000_payer_sources_registry.sql` — schema, index, seed, self-heal, trigger.
- `src/hooks/queries/usePayerSources.ts` — `PayerSourceRow` type, `usePayerSources(siteId)`, `useResolvePayerSource(siteId, key)`.
- `src/hooks/queries/usePayerSources.test.tsx` — Vitest tests for both hooks.
- `src/types/settlement.types.test.ts` — Vitest tests for the new `requiresPayerName` helper.

**Modify:**
- `src/types/settlement.types.ts` — add `export function requiresPayerName(source: string): boolean`.
- `src/lib/services/settlementService.ts` — replace 5 inline guards (lines 325-326, 588-589, 1007-1009, 1875-1877, 2284-2286) with `requiresPayerName(...)` calls.
- `src/components/settlement/PayerSourceSelector.tsx` — add optional `siteId?: string` prop; when provided, fetch registry and render those rows; when omitted, render today's hardcoded 6.
- `src/components/payments/MestriSettleDialog.tsx` — pass `siteId={siteId}` to `<PayerSourceSelector>`.

**Order of tasks:**
1. Helper extraction (smallest, isolated, no schema dependency).
2. Migration (local apply + verify).
3. Hooks (depend on the table existing locally).
4. Picker registry-aware change (depends on hooks).
5. Caller migration (`MestriSettleDialog`).
6. Production migration apply + count verification.
7. Move to prod (build + commit + push).

---

## Task 1: Extract `requiresPayerName` helper

**Files:**
- Modify: `src/types/settlement.types.ts`
- Modify: `src/lib/services/settlementService.ts` (5 callsites)
- Create: `src/types/settlement.types.test.ts`

- [ ] **Step 1: Write the failing test for the helper**

Create `src/types/settlement.types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { requiresPayerName } from "./settlement.types";

describe("requiresPayerName", () => {
  it("returns true for 'custom'", () => {
    expect(requiresPayerName("custom")).toBe(true);
  });

  it("returns true for 'other_site_money'", () => {
    expect(requiresPayerName("other_site_money")).toBe(true);
  });

  it("returns false for 'own_money'", () => {
    expect(requiresPayerName("own_money")).toBe(false);
  });

  it("returns false for 'amma_money'", () => {
    expect(requiresPayerName("amma_money")).toBe(false);
  });

  it("returns false for 'client_money'", () => {
    expect(requiresPayerName("client_money")).toBe(false);
  });

  it("returns false for 'trust_account'", () => {
    expect(requiresPayerName("trust_account")).toBe(false);
  });

  it("returns false for unknown / future custom keys", () => {
    expect(requiresPayerName("totally_made_up_key")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/types/settlement.types.test.ts`

Expected: FAIL with `requiresPayerName` is not a function (or "not exported").

- [ ] **Step 3: Implement the helper**

Open `src/types/settlement.types.ts`. After the `PayerSource` type definition (around line 12), add:

```ts
/**
 * True when the picker's selected source requires the user to type
 * a payer name (e.g. "Other" needs a free-text payer name; "Other Site"
 * needs a site name). Mirrors the inline guard pattern that was
 * duplicated across 5 callsites in settlementService.ts before this
 * helper existed. Slice 2 of the payer-source registry will replace
 * the hardcoded body with a registry lookup of the row's
 * `requires_name` column.
 */
export function requiresPayerName(source: string): boolean {
  return source === "custom" || source === "other_site_money";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/types/settlement.types.test.ts`

Expected: PASS, all 7 tests green.

- [ ] **Step 5: Replace the first inline guard at `settlementService.ts:325-326`**

Open `src/lib/services/settlementService.ts`. At the top of the file, find the existing imports from `@/types/settlement.types` (or add the import block if not present). Add `requiresPayerName` to the named imports:

```ts
import { type PayerSource, requiresPayerName } from "@/types/settlement.types";
```

If the existing import is type-only (`import type`), split it:

```ts
import type { PayerSource } from "@/types/settlement.types";
import { requiresPayerName } from "@/types/settlement.types";
```

Then find lines 325-326. Currently:

```ts
        p_payer_source: config.payerSource,
        p_payer_name: config.payerSource === "custom" || config.payerSource === "other_site_money"
          ? config.customPayerName
          : null,
```

Replace with:

```ts
        p_payer_source: config.payerSource,
        p_payer_name: requiresPayerName(config.payerSource) ? config.customPayerName : null,
```

- [ ] **Step 6: Replace the guard at `settlementService.ts:588-589`**

Same file, find lines 588-589. Currently identical pattern:

```ts
        p_payer_source: config.payerSource,
        p_payer_name: config.payerSource === "custom" || config.payerSource === "other_site_money"
          ? config.customPayerName
          : null,
```

Replace with:

```ts
        p_payer_source: config.payerSource,
        p_payer_name: requiresPayerName(config.payerSource) ? config.customPayerName : null,
```

- [ ] **Step 7: Replace the guard at `settlementService.ts:1007-1009`**

Same file, find lines 1007-1009. Phase 1 fixed this from a missing-branch bug, so it now reads:

```ts
        p_payer_source: config.payerSource,
        p_payer_name: config.payerSource === "custom" || config.payerSource === "other_site_money"
          ? config.customPayerName
          : null,
```

Replace with:

```ts
        p_payer_source: config.payerSource,
        p_payer_name: requiresPayerName(config.payerSource) ? config.customPayerName : null,
```

- [ ] **Step 8: Replace the guard at `settlementService.ts:1875-1877`**

Same file, find lines 1875-1877. Same pattern:

```ts
        p_payer_source: config.payerSource,
        p_payer_name: config.payerSource === "custom" || config.payerSource === "other_site_money"
          ? config.customPayerName
          : null,
```

Replace with:

```ts
        p_payer_source: config.payerSource,
        p_payer_name: requiresPayerName(config.payerSource) ? config.customPayerName : null,
```

- [ ] **Step 9: Replace the guard at `settlementService.ts:2284-2286`**

Same file, find lines 2284-2286. Same pattern:

```ts
        p_payer_source: config.payerSource,
        p_payer_name: config.payerSource === "custom" || config.payerSource === "other_site_money"
          ? config.customPayerName
          : null,
```

Replace with:

```ts
        p_payer_source: config.payerSource,
        p_payer_name: requiresPayerName(config.payerSource) ? config.customPayerName : null,
```

- [ ] **Step 10: Verify no inline guard remains**

Run: `grep -n 'payerSource === "custom"' src/lib/services/settlementService.ts`

Expected: zero matches.

Then: `grep -nc 'requiresPayerName' src/lib/services/settlementService.ts`

Expected: at least 6 (1 import + 5 callsites).

- [ ] **Step 11: Build to verify type safety**

Run: `npm run build`

Expected: pass with zero new errors and zero new warnings.

- [ ] **Step 12: Run the full test suite**

Run: `npm run test`

Expected: pass. The 7 new helper tests are green; existing tests unchanged.

- [ ] **Step 13: Commit**

```bash
git add src/types/settlement.types.ts src/types/settlement.types.test.ts src/lib/services/settlementService.ts
git commit -m "$(cat <<'EOF'
refactor(payments): extract requiresPayerName helper

DRY up the payer-source guard for "custom" / "other_site_money" that
was duplicated across 5 callsites in settlementService.ts. Phase 2
Slice 1 carryover #9 — preparation for the registry-driven body
in Slice 2 (will replace the hardcoded keys with a registry lookup
of the row's requires_name column).

Pure refactor — same boolean expression, just relocated.

Spec: docs/superpowers/specs/2026-05-06-payer-sources-registry-slice-1-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create the migration (local apply + verify)

**Files:**
- Create: `supabase/migrations/20260506130000_payer_sources_registry.sql`

This task creates the schema, seeds built-ins, self-heals existing non-canonical data, and adds the new-site trigger. It applies the migration **locally only** in this task — production migration happens in Task 6 once the app code compiles against the new schema.

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260506130000_payer_sources_registry.sql` with this exact content:

```sql
-- Payer Sources Registry — Slice 1 (Foundation)
-- Spec: docs/superpowers/specs/2026-05-06-payer-sources-registry-slice-1-design.md
--
-- Per-site registry of payment-source pools (Own Money, Amma Money,
-- Trust Account, etc.). Slice 1 seeds the 6 canonical built-ins for
-- every existing site and self-heals any non-canonical values already
-- in settlement_groups.payer_source by materialising them as
-- non-built-in registry rows. Read-only RLS in Slice 1; Slice 2 adds
-- INSERT/UPDATE/DELETE policies when the settings page lands.

-- 1. Schema
CREATE TABLE IF NOT EXISTS payer_sources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  key           text NOT NULL,
  label         text NOT NULL,
  icon          text,
  color         text,
  sort_order    int  NOT NULL DEFAULT 0,
  requires_name boolean NOT NULL DEFAULT false,
  is_built_in   boolean NOT NULL DEFAULT false,
  is_hidden     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, key)
);

-- 2. Index for picker reads (visible rows ordered by sort)
CREATE INDEX IF NOT EXISTS payer_sources_site_id_visible_idx
  ON payer_sources (site_id, sort_order)
  WHERE is_hidden = false;

-- 3. Seed the 6 built-ins for every existing site (idempotent)
INSERT INTO payer_sources (site_id, key, label, icon, sort_order, requires_name, is_built_in)
SELECT s.id, b.key, b.label, b.icon, b.sort_order, b.requires_name, true
FROM sites s
CROSS JOIN (VALUES
  ('own_money',        'Own Money',     'AccountBalance', 10, false),
  ('amma_money',       'Amma Money',    'Person',         20, false),
  ('client_money',     'Client Money',  'Business',       30, false),
  ('trust_account',    'Trust Account', 'Savings',        40, false),
  ('other_site_money', 'Other Site',    'LocationOn',     50, true),
  ('custom',           'Other',         'Edit',           60, true)
) AS b(key, label, icon, sort_order, requires_name)
ON CONFLICT (site_id, key) DO NOTHING;

-- 4. Self-heal: materialize any non-canonical payer_source value already
--    present in settlement_groups as a non-built-in registry row scoped
--    to its site. Padmavathy's bad rows were backfilled in Phase 1, so
--    in production this primarily picks up Srinivasan's 41 'site_cash'
--    rows from the Audit Mode reconcile work. Defensive against any
--    other latent values.
INSERT INTO payer_sources (site_id, key, label, sort_order, is_built_in)
SELECT DISTINCT
  sg.site_id,
  sg.payer_source,
  INITCAP(REPLACE(sg.payer_source, '_', ' ')) AS label,
  999 AS sort_order,
  false AS is_built_in
FROM settlement_groups sg
WHERE sg.payer_source IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM payer_sources ps
    WHERE ps.site_id = sg.site_id AND ps.key = sg.payer_source
  )
ON CONFLICT (site_id, key) DO NOTHING;

-- 5. Trigger to seed built-ins for new sites
CREATE OR REPLACE FUNCTION seed_payer_sources_for_new_site()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO payer_sources (site_id, key, label, icon, sort_order, requires_name, is_built_in)
  VALUES
    (NEW.id, 'own_money',        'Own Money',     'AccountBalance', 10, false, true),
    (NEW.id, 'amma_money',       'Amma Money',    'Person',         20, false, true),
    (NEW.id, 'client_money',     'Client Money',  'Business',       30, false, true),
    (NEW.id, 'trust_account',    'Trust Account', 'Savings',        40, false, true),
    (NEW.id, 'other_site_money', 'Other Site',    'LocationOn',     50, true,  true),
    (NEW.id, 'custom',           'Other',         'Edit',           60, true,  true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS seed_payer_sources_after_site_insert ON sites;
CREATE TRIGGER seed_payer_sources_after_site_insert
  AFTER INSERT ON sites
  FOR EACH ROW EXECUTE FUNCTION seed_payer_sources_for_new_site();

-- 6. RLS: read-only mirror of settlement_groups' read policies for Slice 1.
--    No INSERT/UPDATE/DELETE policies — the migration owns all writes
--    until Slice 2's settings page lands.
ALTER TABLE payer_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payer_sources read for site engineers and company members"
  ON payer_sources
  FOR SELECT
  USING (
    site_id IN (
      SELECT id FROM sites
      WHERE engineer_id = auth.uid()
         OR company_id IN (
           SELECT company_id FROM company_members WHERE user_id = auth.uid()
         )
    )
  );
```

- [ ] **Step 2: Apply locally**

Run: `npm run db:reset`

Expected: migration applies cleanly, no SQL errors. The full local DB is rebuilt from migrations.

- [ ] **Step 3: Verify the table exists and row count is correct**

Run:
```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "SELECT (SELECT COUNT(*) FROM sites) AS sites, (SELECT COUNT(*) FROM payer_sources WHERE is_built_in = true) AS builtins, (SELECT COUNT(*) FROM payer_sources WHERE is_built_in = false) AS custom_seeded;"
```

Expected: `builtins = sites × 6`. `custom_seeded` is the count of self-healed rows (will depend on what local DB seed data exists; can be 0 in a clean local dev — that's fine).

- [ ] **Step 4: Verify the trigger seeds new sites**

Run:
```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
INSERT INTO sites (id, name, company_id, engineer_id) VALUES
  (gen_random_uuid(), 'Trigger Test Site', (SELECT id FROM companies LIMIT 1), (SELECT id FROM auth.users LIMIT 1))
RETURNING id;
"
```

Capture the returned `id` (call it `<test_id>`), then run:
```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "SELECT key FROM payer_sources WHERE site_id = '<test_id>' ORDER BY sort_order;"
```

Expected output (6 rows, in this order):
```
own_money
amma_money
client_money
trust_account
other_site_money
custom
```

Then clean up the test site:
```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "DELETE FROM sites WHERE id = '<test_id>';"
```

(The CASCADE on the FK auto-deletes the 6 payer_sources rows — verify with the SELECT again expecting zero rows.)

- [ ] **Step 5: Verify the index exists**

Run:
```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "\d payer_sources"
```

Expected: output includes `payer_sources_site_id_visible_idx` with `WHERE is_hidden = false`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260506130000_payer_sources_registry.sql
git commit -m "$(cat <<'EOF'
feat(db): payer_sources registry table + seed + trigger

Slice 1 of Phase 2. Per-site registry of payment-source pools, seeded
with the 6 canonical built-ins for every existing site. Self-heals
any non-canonical settlement_groups.payer_source values into
non-built-in registry rows (catches Srinivasan's 41 site_cash audit
entries). Read-only RLS in Slice 1.

Spec: docs/superpowers/specs/2026-05-06-payer-sources-registry-slice-1-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create the React Query hooks

**Files:**
- Create: `src/hooks/queries/usePayerSources.ts`
- Create: `src/hooks/queries/usePayerSources.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/queries/usePayerSources.test.tsx` with this content:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { usePayerSources, useResolvePayerSource } from "./usePayerSources";

const mockOrder = vi.fn();
const mockEq2 = vi.fn(() => ({ order: mockOrder }));
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mockFrom }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockFrom.mockClear();
  mockSelect.mockClear();
  mockEq1.mockClear();
  mockEq2.mockClear();
  mockOrder.mockReset();
});

describe("usePayerSources", () => {
  it("returns visible rows ordered by sort_order for the given site", async () => {
    mockOrder.mockResolvedValue({
      data: [
        { id: "1", site_id: "site-1", key: "own_money", label: "Own Money", icon: "AccountBalance", color: null, sort_order: 10, requires_name: false, is_built_in: true, is_hidden: false },
        { id: "2", site_id: "site-1", key: "amma_money", label: "Amma Money", icon: "Person", color: null, sort_order: 20, requires_name: false, is_built_in: true, is_hidden: false },
      ],
      error: null,
    });

    const { result } = renderHook(() => usePayerSources("site-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].key).toBe("own_money");
    expect(result.current.data?.[1].key).toBe("amma_money");
    expect(mockFrom).toHaveBeenCalledWith("payer_sources");
    expect(mockEq1).toHaveBeenCalledWith("site_id", "site-1");
    expect(mockEq2).toHaveBeenCalledWith("is_hidden", false);
    expect(mockOrder).toHaveBeenCalledWith("sort_order", { ascending: true });
  });

  it("is disabled when siteId is undefined", () => {
    const { result } = renderHook(() => usePayerSources(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("propagates supabase errors", async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { result } = renderHook(() => usePayerSources("site-1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useResolvePayerSource", () => {
  it("returns the matching registry row label/icon/color/requires_name when found", async () => {
    mockOrder.mockResolvedValue({
      data: [
        { id: "1", site_id: "site-1", key: "amma_money", label: "Amma Money", icon: "Person", color: null, sort_order: 20, requires_name: false, is_built_in: true, is_hidden: false },
      ],
      error: null,
    });

    const { result } = renderHook(() => useResolvePayerSource("site-1", "amma_money"), { wrapper });

    await waitFor(() => expect(result.current.label).toBe("Amma Money"));
    expect(result.current.icon).toBe("Person");
    expect(result.current.color).toBe(null);
    expect(result.current.requires_name).toBe(false);
  });

  it("returns humanized fallback for unknown key", async () => {
    mockOrder.mockResolvedValue({
      data: [
        { id: "1", site_id: "site-1", key: "own_money", label: "Own Money", icon: "AccountBalance", color: null, sort_order: 10, requires_name: false, is_built_in: true, is_hidden: false },
      ],
      error: null,
    });

    const { result } = renderHook(() => useResolvePayerSource("site-1", "site_cash"), { wrapper });

    await waitFor(() => expect(result.current.label).toBe("Site Cash"));
    expect(result.current.icon).toBe(null);
    expect(result.current.requires_name).toBe(false);
  });

  it("returns empty fallback when key is null", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useResolvePayerSource("site-1", null), { wrapper });
    await waitFor(() => expect(result.current.label).toBe(""));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/queries/usePayerSources.test.tsx`

Expected: FAIL — module `./usePayerSources` not found.

- [ ] **Step 3: Implement the hooks file**

Create `src/hooks/queries/usePayerSources.ts` with this exact content:

```ts
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface PayerSourceRow {
  id: string;
  site_id: string;
  key: string;
  label: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  requires_name: boolean;
  is_built_in: boolean;
  is_hidden: boolean;
}

export interface ResolvedPayerSource {
  label: string;
  icon: string | null;
  color: string | null;
  requires_name: boolean;
}

function humanizeKey(key: string): string {
  // "site_cash" -> "Site Cash", "amma_money" -> "Amma Money"
  return key
    .split("_")
    .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join(" ");
}

/**
 * Fetch the visible payer sources for a site, ordered by sort_order.
 * 5-minute staleTime; invalidates on the BroadcastChannel
 * "payer-sources-changed" so cross-tab edits (Slice 2 settings page)
 * propagate without a hard refresh. Disabled when siteId is undefined.
 */
export function usePayerSources(siteId: string | undefined) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Cross-tab invalidation. Slice 2's settings page will post
  // BroadcastChannel("payer-sources-changed") after writes.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel("payer-sources-changed");
    bc.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ["payer-sources"] });
    };
    return () => bc.close();
  }, [queryClient]);

  return useQuery<PayerSourceRow[]>({
    queryKey: ["payer-sources", siteId],
    enabled: Boolean(siteId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payer_sources")
        .select("*")
        .eq("site_id", siteId as string)
        .eq("is_hidden", false)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PayerSourceRow[];
    },
  });
}

/**
 * Resolve a (siteId, key) pair to display metadata. Returns the
 * matching registry row's label/icon/color/requires_name when found;
 * falls back to a humanized form of the key otherwise. The fallback
 * only fires for transient states (registry not yet loaded, key
 * deleted on another tab). Slice 1's self-healing migration ensures
 * all live data has a matching row in steady state.
 */
export function useResolvePayerSource(
  siteId: string | undefined,
  key: string | null,
): ResolvedPayerSource {
  const { data: rows } = usePayerSources(siteId);

  if (!key) {
    return { label: "", icon: null, color: null, requires_name: false };
  }

  const match = rows?.find((r) => r.key === key);
  if (match) {
    return {
      label: match.label,
      icon: match.icon,
      color: match.color,
      requires_name: match.requires_name,
    };
  }

  return {
    label: humanizeKey(key),
    icon: null,
    color: null,
    requires_name: false,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/queries/usePayerSources.test.tsx`

Expected: PASS, all 6 tests green (3 for `usePayerSources`, 3 for `useResolvePayerSource`).

- [ ] **Step 5: Build to verify type safety**

Run: `npm run build`

Expected: pass with no new errors or warnings.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/queries/usePayerSources.ts src/hooks/queries/usePayerSources.test.tsx
git commit -m "$(cat <<'EOF'
feat(payments): usePayerSources + useResolvePayerSource hooks

Read-side React Query hooks for the payer_sources registry. Returns
visible rows ordered by sort_order, with 5-min staleTime matching
useSiteSubcontracts. BroadcastChannel "payer-sources-changed"
invalidation hook is in place for Slice 2's settings page to use.

useResolvePayerSource returns label/icon/color/requires_name for
chip rendering, with a humanized-key fallback for transient unknowns.

Spec: docs/superpowers/specs/2026-05-06-payer-sources-registry-slice-1-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Make `<PayerSourceSelector>` registry-aware

**Files:**
- Modify: `src/components/settlement/PayerSourceSelector.tsx`

The picker keeps today's behavior when `siteId` is omitted. When `siteId` is provided, it fetches from the registry and renders one toggle per row, mapping `icon` strings to MUI icon components via a small lookup.

- [ ] **Step 1: Read the current file end-to-end**

Run: read `src/components/settlement/PayerSourceSelector.tsx` so you have all 173 lines in context. The change only touches the toggle-button group rendering; the props API, the `Collapse` for the custom-name field, and the exported `getPayerSourceLabel` / `getPayerSourceColor` helpers stay unchanged.

- [ ] **Step 2: Add the `siteId` prop and the icon-name lookup**

Find the `interface PayerSourceSelectorProps` (lines 24–31) and add `siteId`:

```tsx
interface PayerSourceSelectorProps {
  value: PayerSource;
  customName: string;
  onChange: (source: PayerSource) => void;
  onCustomNameChange: (name: string) => void;
  disabled?: boolean;
  compact?: boolean;
  /**
   * When provided, render options from the per-site payer_sources
   * registry instead of the hardcoded 6. Falls back to hardcoded if
   * the registry returns empty (defensive — shouldn't fire post-
   * Slice 1 migration). The 4 other callers of this component will
   * migrate in Slice 2 when the settings page lands.
   */
  siteId?: string;
}
```

After the existing icon imports (lines 14–21), add a name → component lookup constant just below them, before the `interface`:

```tsx
const ICON_BY_NAME: Record<string, React.ReactNode> = {
  AccountBalance: <OwnMoneyIcon fontSize="small" />,
  Business: <ClientIcon fontSize="small" />,
  Person: <PersonIcon fontSize="small" />,
  Edit: <CustomIcon fontSize="small" />,
  LocationOn: <SiteIcon fontSize="small" />,
  Savings: <TrustIcon fontSize="small" />,
};
```

This maps the string values stored in `payer_sources.icon` (e.g., `"AccountBalance"`) to the existing MUI icon imports already aliased at the top of the file.

- [ ] **Step 3: Add the registry fetch + option-list selection**

Add an import at the top of the file (after the existing imports):

```tsx
import { usePayerSources } from "@/hooks/queries/usePayerSources";
```

Inside the `PayerSourceSelector` component body, **before** the `return (`, add the registry fetch and option-list selection. Find the existing first line of the function body (around `const theme = useTheme();`):

```tsx
export default function PayerSourceSelector({
  value,
  customName,
  onChange,
  onCustomNameChange,
  disabled = false,
  compact = false,
  siteId,
}: PayerSourceSelectorProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Registry-aware option list. When siteId is provided and the
  // registry has rows, prefer those; otherwise fall back to the
  // hardcoded 6. The fallback covers (a) legacy callers that don't
  // pass siteId, (b) the brief loading window on a fresh fetch, and
  // (c) defensive recovery if the registry is somehow empty.
  const { data: registryRows } = usePayerSources(siteId);
  const options =
    siteId && registryRows && registryRows.length > 0
      ? registryRows.map((r) => ({
          value: r.key as PayerSource,
          label: r.label,
          shortLabel: r.label.split(" ")[0] ?? r.label,
          icon: r.icon ? ICON_BY_NAME[r.icon] ?? null : null,
        }))
      : PAYER_OPTIONS;
```

Then in the JSX, replace the `{PAYER_OPTIONS.map(...)}` block with `{options.map(...)}`. The full updated map JSX (around lines 92-108):

```tsx
        {options.map((opt) => (
          <ToggleButton
            key={opt.value}
            value={opt.value}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              textTransform: "none",
            }}
          >
            {opt.icon}
            <Typography variant="caption" fontWeight={500}>
              {isMobile || compact ? opt.shortLabel : opt.label}
            </Typography>
          </ToggleButton>
        ))}
```

This is a one-line change inside the existing JSX (`PAYER_OPTIONS.map` → `options.map`). Don't restructure the surrounding `<ToggleButtonGroup>` or its `sx` prop.

- [ ] **Step 4: Build to verify type safety**

Run: `npm run build`

Expected: pass. The `value` from registry rows is `string` cast to `PayerSource` — known acceptable widening for now (Slice 2 will refine).

- [ ] **Step 5: Run the existing test suite**

Run: `npm run test`

Expected: all tests still pass — no behavioral change for callers that don't pass `siteId`.

- [ ] **Step 6: Commit**

```bash
git add src/components/settlement/PayerSourceSelector.tsx
git commit -m "$(cat <<'EOF'
feat(payments): PayerSourceSelector reads registry when siteId given

Optional siteId prop. When provided and the registry returns rows,
the picker renders those options instead of the hardcoded 6. Falls
back to hardcoded for legacy callers, loading state, and defensive
recovery. Behavior unchanged for the 4 callers that don't pass
siteId — they migrate in Slice 2 alongside the settings page.

Spec: docs/superpowers/specs/2026-05-06-payer-sources-registry-slice-1-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Migrate `MestriSettleDialog` to pass `siteId`

**Files:**
- Modify: `src/components/payments/MestriSettleDialog.tsx`

- [ ] **Step 1: Read the dialog's `<PayerSourceSelector>` invocation**

Run: read `src/components/payments/MestriSettleDialog.tsx` lines 490-510 to confirm the current invocation. Phase 1 left it as:

```tsx
<PayerSourceSelector
  value={payerSource}
  customName={customPayerName}
  onChange={setPayerSource}
  onCustomNameChange={setCustomPayerName}
  compact
/>
```

- [ ] **Step 2: Add `siteId={siteId}` to the invocation**

Modify the JSX block to:

```tsx
<PayerSourceSelector
  siteId={siteId}
  value={payerSource}
  customName={customPayerName}
  onChange={setPayerSource}
  onCustomNameChange={setCustomPayerName}
  compact
/>
```

`siteId` is already a required prop on `MestriSettleDialogProps` (line 37 of the file), so it's in scope. No new import. No new state. No new effect.

- [ ] **Step 3: Build**

Run: `npm run build`

Expected: pass.

- [ ] **Step 4: Run tests**

Run: `npm run test`

Expected: pass — no test file references this prop.

- [ ] **Step 5: Manual local smoke test**

Start the dev server in the background (per the project's normal pattern):

```bash
npm run dev > dev-server.log 2>&1 &
```

Wait until `tail dev-server.log` shows `Ready in <Ns>`.

Then drive Playwright via MCP:
- `mcp__playwright__browser_navigate` to `http://localhost:3000/dev-login`. If dev-login auto-auth succeeds, navigate to `/site/payments`. If dev-login is still broken (Phase 1 noted a pre-existing JS parse error blocking it), skip this step and rely on production verification after Task 7.
- Open "Record mesthri payment" dialog.
- Confirm 6 toggle buttons render with the same icons and labels as before.
- Pick "Amma Money", confirm the inline name field is hidden.
- Pick "Other Site", confirm the inline name field appears with placeholder "Enter site name".
- Pick "Other", confirm the placeholder changes to "Enter payer name".
- `mcp__playwright__browser_console_messages` level=error — confirm zero new errors related to `payer_sources` or registry fetch.
- `mcp__playwright__browser_close`.

Stop the dev server: `taskkill //F //IM node.exe` (Windows; use `pkill node` on POSIX). If any other node process is running, use the more targeted PID from the dev-server.log Next.js startup line.

If dev-login is broken: explicitly note "Playwright skipped — dev-login still has the pre-existing JS error from Phase 1; will verify on production after deploy." and proceed.

- [ ] **Step 6: Commit**

```bash
git add src/components/payments/MestriSettleDialog.tsx
git commit -m "$(cat <<'EOF'
feat(payments): MestriSettleDialog reads payer sources from registry

Passes siteId to <PayerSourceSelector>, which fetches from the
per-site payer_sources registry and renders those options.
Falls back to hardcoded 6 if the registry is empty (shouldn't
happen post-migration). The 4 other callers stay on hardcoded
until Slice 2.

Spec: docs/superpowers/specs/2026-05-06-payer-sources-registry-slice-1-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Apply migration to production

**Files:** none (production DB write via Supabase MCP).

This task only runs after Tasks 1-5 are committed and the build passes locally. Do not push to git yet — Task 7 handles the push and Vercel deploy.

- [ ] **Step 1: Surface the prod migration plan to the user**

Tell the user explicitly: "About to apply migration `20260506130000_payer_sources_registry.sql` to production. This creates the `payer_sources` table, seeds 6 rows for every site, materializes a `site_cash` row for Srinivasan, and adds the new-site trigger. Confirm to proceed."

Wait for explicit user approval. **Do not skip this gate.**

- [ ] **Step 2: Apply the migration via MCP**

Use `mcp__supabase__apply_migration` with `name = "payer_sources_registry"` and `query` set to the full SQL body from Task 2 Step 1. (Re-paste the entire SQL from the migration file — MCP applies the literal SQL.)

Expected: success.

- [ ] **Step 3: Verify row counts on production**

Use `mcp__supabase__execute_sql`:

```sql
SELECT
  (SELECT COUNT(*) FROM sites) AS sites,
  (SELECT COUNT(*) FROM payer_sources WHERE is_built_in = true) AS builtins,
  (SELECT COUNT(*) FROM payer_sources WHERE is_built_in = false) AS custom_seeded;
```

Expected:
- `sites` = whatever the prod sites count is.
- `builtins` = `sites × 6`.
- `custom_seeded` = at least 1 (the `site_cash` row for Srinivasan).

Also verify the Srinivasan `site_cash` row exists:

```sql
SELECT key, label, sort_order, is_built_in
FROM payer_sources
WHERE site_id = '79bfcfb3-4b0d-4240-8fce-d1ab584ef972'
ORDER BY sort_order;
```

Expected: 7 rows total (6 built-ins sort_order 10-60 + 1 self-healed `site_cash` at sort_order 999, `is_built_in = false`).

- [ ] **Step 4: Verify the Padmavathy site has only the 6 built-ins**

```sql
SELECT key, label, sort_order, is_built_in
FROM payer_sources
WHERE site_id = 'ff893992-a276-47b7-8bd2-d2fe4f62f3b5'
ORDER BY sort_order;
```

Expected: exactly 6 rows, all `is_built_in = true`. (Padmavathy's bad rows were backfilled to `own_money` in Phase 1, so there's nothing for the self-heal step to materialize.)

- [ ] **Step 5: Verify the trigger exists**

```sql
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname = 'seed_payer_sources_after_site_insert';
```

Expected: 1 row, `tgrelid = sites`, `tgenabled = O` (enabled).

If any verification fails, surface the failure to the user before proceeding to Task 7.

---

## Task 7: Move to prod

**Files:** all changes from Tasks 1, 3, 4, 5 (Task 2's local migration file is already committed; Task 6 applied it to prod via MCP).

- [ ] **Step 1: Confirm `cloudflare-proxy/` is untouched**

Run: `git diff --name-only HEAD~5..HEAD | grep -i cloudflare-proxy || echo "no cloudflare-proxy files"`

Expected: "no cloudflare-proxy files". Per CLAUDE.md, no Worker deploy needed.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: pass. Re-runs verify cleanness post-Task 5.

- [ ] **Step 3: `git status` and stage any remaining tracked changes**

Per CLAUDE.md "Move to Prod" the rule is "all pending changes must be included." The expected pending set is:

- The plan file: `docs/superpowers/plans/2026-05-06-payer-sources-registry-slice-1.md` (this file).

Stage and commit:

```bash
git add docs/superpowers/plans/2026-05-06-payer-sources-registry-slice-1.md
git commit -m "$(cat <<'EOF'
docs(plan): payer sources registry Slice 1 implementation plan

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If `git status` shows other untracked files unrelated to this work (the screenshot/log noise from earlier sessions still lingering), surface them to the user and ask whether to include them. Per CLAUDE.md the rule is "all pending changes," but the user has the final say on noise.

- [ ] **Step 4: Push to main**

```bash
git push
```

This triggers the Vercel pipeline. Watch the output for the deploy URL.

- [ ] **Step 5: Save the post-ship memory note**

Update `MEMORY.md` at `C:\Users\Haribabu\.claude\projects\c--Users-Haribabu-Documents-AppsCopilot-AestaManagementApp\memory\` with a new entry. Suggested name: `payer_sources_registry_slice1_2026_05_06.md`. Index line:

```
- [Payer sources registry Slice 1 shipped 2026-05-06](payer_sources_registry_slice1_2026_05_06.md) — payer_sources table + seed + self-heal of Srinivasan site_cash; MestriSettleDialog reads via registry; 4 other callers stay on hardcoded until Slice 2
```

Body should record: commits in the push, prod migration applied via MCP (with row counts), `site_cash` Srinivasan row materialized, `requiresPayerName` helper extracted, `payer_sources_registry_phase2.md` Slice 2/3 carryovers still pending. Write it in the same shape as the existing post-ship memory entries in that directory.

Also update `payer_sources_registry_phase2.md` to remove the "narrow `ContractPaymentConfig.payerSource`" carryover (decided dropped per the spec) and to note Slice 1 is shipped, leaving Slice 2 (settings page + management UI + 4-caller migration + delete-with-transfer) and Slice 3 (drag reorder + label-helper consolidation + payer_name in list rows) as the remaining work.

---

## Self-review

Walked the spec → plan check:

- [x] **Spec § Schema** — Task 2 Step 1 is the migration with the exact schema, index, and seed values from the spec table.
- [x] **Spec § Migration order** — Task 2's migration file has all 5 numbered steps from the spec (table, index, seed, self-heal, trigger). RLS read policy added at the end.
- [x] **Spec § Service layer (`usePayerSources`)** — Task 3 implements both hooks with the broadcast-channel invalidation, 5-minute staleTime, ordered + visible-only filter.
- [x] **Spec § Service layer (`useResolvePayerSource`)** — Task 3 covers the humanized fallback with explicit unit tests for unknown keys.
- [x] **Spec § Picker change** — Task 4 adds the optional `siteId` prop, registry-driven option list with hardcoded fallback, and the icon-name lookup. Existing API unchanged.
- [x] **Spec § Caller migration** — Task 5 migrates only `MestriSettleDialog`. The 4 other callers explicitly stay on hardcoded fallback per the spec.
- [x] **Spec § Carryover #9 (`requiresPayerName`)** — Task 1 implements the helper with full TDD and replaces all 5 inline guards in `settlementService.ts`.
- [x] **Spec § Carryover #8 (dropped)** — not in the plan; will be reflected in the Phase 2 memory note via Task 7 Step 5.
- [x] **Spec § Testing** — every Vitest test described in the spec is in Tasks 1 and 3. Migration verification SQL is in Tasks 2 and 6. Manual Playwright is in Task 5 with the explicit fallback to skip if dev-login is broken (acknowledged Phase 1 issue).
- [x] **Spec § Risk and reversibility** — migration is idempotent (Task 2), picker fallback preserved (Task 4), helper refactor is pure (Task 1).
- [x] **Out-of-scope items** — Slice 2 (settings page, INSERT/UPDATE/DELETE policies, 4-caller migration, delete-with-transfer wizard, inline quick-add) and Slice 3 (drag reorder, color picker, `getPayerSourceLabel` consolidation, `payer_name` in list rows) appear in zero tasks. ✓
- [x] **No placeholders** — searched plan for "TBD", "TODO", "fill in", "similar to", "appropriate" — none found.
- [x] **Type consistency** — `PayerSourceRow` shape is identical in Task 3 (definition), Task 3 tests, and Task 4 (consumption). `requiresPayerName(source: string): boolean` is the same signature in Task 1's helper, Task 1's tests, and Task 1's 5 callsite replacements.
- [x] **Move-to-prod compliance** — Task 7 follows the CLAUDE.md sequence (build, status, commit, push). Cloudflare Worker explicitly checked and skipped.
- [x] **Production migration gate** — Task 6 has an explicit user-approval gate before the prod write, mirroring Phase 1 Task 2's pattern.
