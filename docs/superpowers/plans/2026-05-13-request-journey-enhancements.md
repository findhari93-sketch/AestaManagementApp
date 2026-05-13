# Request Journey Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the Request Journey drawer with approver names, brand/variant/image display, delivery/payment media galleries, and a persistent cross-page pill tag that keeps the journey accessible while navigating.

**Architecture:** A new `JourneyWatchContext` (sessionStorage-backed) lives at the `MainLayout` level and owns `{ activeJourneyId, isExpanded }` state. A `JourneyOverlay` portal renders either the pill tag or the full drawer on any page except `/site/material-requests` (which owns its own inline drawer). The `useRequestJourney` hook gains three new joins (approved_by → user name, PO items → brand, brand_id → avg price). `MaterialRequestJourney` renders the enriched data and calls `activateJourney()` on mount.

**Tech Stack:** Next.js 15 App Router, React 18, MUI v7, TanStack Query v5, Vitest + React Testing Library, Supabase JS client

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/contexts/JourneyWatchContext/JourneyWatchProvider.tsx` | Context state + sessionStorage sync |
| Create | `src/contexts/JourneyWatchContext/index.ts` | Public exports + `useJourneyWatch()` hook |
| Create | `src/contexts/JourneyWatchContext/JourneyWatchProvider.test.tsx` | Unit tests for context logic |
| Create | `src/components/materials/journey/JourneyPillTag.tsx` | Collapsed pill UI (right-edge fixed) |
| Create | `src/components/materials/journey/JourneyOverlay.tsx` | Portal: shows pill or full drawer |
| Modify | `src/types/journey.types.ts` | Extend `RequestJourney` with `approved_by_user`, brand on PO items, `brandAvgPrice` |
| Modify | `src/hooks/queries/useRequestJourney.ts` | Add 3 query enhancements + new field assembly |
| Modify | `src/components/materials/journey/MaterialRequestJourney.tsx` | Render all new data + call `activateJourney` |
| Modify | `src/components/layout/MainLayout.tsx` | Add `JourneyWatchProvider` + `JourneyOverlay` |

---

## Task 1: JourneyWatchContext

**Files:**
- Create: `src/contexts/JourneyWatchContext/JourneyWatchProvider.tsx`
- Create: `src/contexts/JourneyWatchContext/index.ts`
- Create: `src/contexts/JourneyWatchContext/JourneyWatchProvider.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/contexts/JourneyWatchContext/JourneyWatchProvider.test.tsx
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { JourneyWatchProvider } from "./JourneyWatchProvider";
import { useJourneyWatch } from "./index";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <JourneyWatchProvider>{children}</JourneyWatchProvider>
);

beforeEach(() => {
  sessionStorage.clear();
});

describe("JourneyWatchContext", () => {
  it("starts with no active journey", () => {
    const { result } = renderHook(() => useJourneyWatch(), { wrapper });
    expect(result.current.activeJourneyId).toBeNull();
    expect(result.current.isExpanded).toBe(false);
  });

  it("activateJourney sets id and persists to sessionStorage", () => {
    const { result } = renderHook(() => useJourneyWatch(), { wrapper });
    act(() => result.current.activateJourney("MR-TEST-001"));
    expect(result.current.activeJourneyId).toBe("MR-TEST-001");
    expect(sessionStorage.getItem("journeyWatch:activeId")).toBe("MR-TEST-001");
  });

  it("deactivateJourney clears id and sessionStorage", () => {
    const { result } = renderHook(() => useJourneyWatch(), { wrapper });
    act(() => result.current.activateJourney("MR-TEST-001"));
    act(() => result.current.deactivateJourney());
    expect(result.current.activeJourneyId).toBeNull();
    expect(sessionStorage.getItem("journeyWatch:activeId")).toBeNull();
  });

  it("setExpanded updates isExpanded", () => {
    const { result } = renderHook(() => useJourneyWatch(), { wrapper });
    act(() => result.current.setExpanded(true));
    expect(result.current.isExpanded).toBe(true);
    act(() => result.current.setExpanded(false));
    expect(result.current.isExpanded).toBe(false);
  });

  it("reads activeJourneyId from sessionStorage on mount", () => {
    sessionStorage.setItem("journeyWatch:activeId", "MR-RESTORED-001");
    const { result } = renderHook(() => useJourneyWatch(), { wrapper });
    expect(result.current.activeJourneyId).toBe("MR-RESTORED-001");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/contexts/JourneyWatchContext/JourneyWatchProvider.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Create JourneyWatchProvider.tsx**

```tsx
// src/contexts/JourneyWatchContext/JourneyWatchProvider.tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const SESSION_KEY = "journeyWatch:activeId";

interface JourneyWatchState {
  activeJourneyId: string | null;
  isExpanded: boolean;
  activateJourney: (id: string) => void;
  deactivateJourney: () => void;
  setExpanded: (val: boolean) => void;
}

export const JourneyWatchContext = createContext<JourneyWatchState | undefined>(undefined);

export function JourneyWatchProvider({ children }: { children: React.ReactNode }) {
  const [activeJourneyId, setActiveJourneyId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(SESSION_KEY);
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const activateJourney = useCallback((id: string) => {
    sessionStorage.setItem(SESSION_KEY, id);
    setActiveJourneyId(id);
  }, []);

  const deactivateJourney = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setActiveJourneyId(null);
    setIsExpanded(false);
  }, []);

  const setExpanded = useCallback((val: boolean) => {
    setIsExpanded(val);
  }, []);

  return (
    <JourneyWatchContext.Provider
      value={{ activeJourneyId, isExpanded, activateJourney, deactivateJourney, setExpanded }}
    >
      {children}
    </JourneyWatchContext.Provider>
  );
}
```

- [ ] **Step 4: Create index.ts**

```ts
// src/contexts/JourneyWatchContext/index.ts
export { JourneyWatchProvider, JourneyWatchContext } from "./JourneyWatchProvider";

import { useContext } from "react";
import { JourneyWatchContext } from "./JourneyWatchProvider";

export function useJourneyWatch() {
  const ctx = useContext(JourneyWatchContext);
  if (!ctx) throw new Error("useJourneyWatch must be used inside JourneyWatchProvider");
  return ctx;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/contexts/JourneyWatchContext/JourneyWatchProvider.test.tsx
```
Expected: 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/contexts/JourneyWatchContext/
git commit -m "feat(journey): add JourneyWatchContext for cross-page persistence"
```

---

## Task 2: Extend journey.types.ts

**Files:**
- Modify: `src/types/journey.types.ts`

- [ ] **Step 1: Update the RequestJourney interface**

Open `src/types/journey.types.ts` and replace the `RequestJourney` interface with:

```ts
// Add this helper type near the top of the file, after the imports:
export interface JourneyApproverUser {
  id: string;
  name: string;
  display_name: string | null;
}

export interface JourneyBrand {
  id: string;
  brand_name: string;
  variant_name: string | null;
  image_url: string | null;
}

// Replace the existing RequestJourney interface:
export interface RequestJourney {
  request: MaterialRequest & {
    items: MaterialRequestItem[];
    approved_by_user: JourneyApproverUser | null;
  };

  po: (PurchaseOrder & {
    items: (PurchaseOrderItem & { brand: JourneyBrand | null })[];
  }) | null;

  deliveries: (Delivery & { items: DeliveryItem[] })[];

  expense: MaterialPurchaseExpense | null;

  batchUsage: BatchUsageRecord[];

  settlement: (InterSiteSettlement & {
    items: InterSiteSettlementItem[];
    payments: InterSiteSettlementPayment[];
  }) | null;

  overallStatus: JourneyOverallStatus;

  isGroupPO: boolean;

  /** Average unit price for the request's brand from price_history. Null when no brand or no history. */
  brandAvgPrice: number | null;
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: errors only in `useRequestJourney.ts` (not yet updated) — no new errors elsewhere

- [ ] **Step 3: Commit**

```bash
git add src/types/journey.types.ts
git commit -m "feat(journey): extend RequestJourney type with approver, brand, avg price"
```

---

## Task 3: Update useRequestJourney.ts

**Files:**
- Modify: `src/hooks/queries/useRequestJourney.ts`

- [ ] **Step 1: Add approved_by_user join to the request query**

In the request query (around line 83), change the `.select(...)` from:
```ts
`*,
items:material_request_items(*)`
```
to:
```ts
`*,
items:material_request_items(*),
approved_by_user:users!approved_by(id, name, display_name)`
```

And update the cast at line 94 from:
```ts
return data as MaterialRequest & { items: MaterialRequestItem[] };
```
to:
```ts
return data as MaterialRequest & {
  items: MaterialRequestItem[];
  approved_by_user: { id: string; name: string; display_name: string | null } | null;
};
```

- [ ] **Step 2: Add brand join to the PO query**

In the PO query (around line 130), change the `.select(...)` from:
```ts
`*,
items:purchase_order_items(*)`
```
to:
```ts
`*,
items:purchase_order_items(*, brand:material_brands!brand_id(id, brand_name, variant_name, image_url))`
```

And update the cast at line 139 from:
```ts
return data as PurchaseOrder & { items: PurchaseOrderItem[] };
```
to:
```ts
return data as PurchaseOrder & {
  items: (PurchaseOrderItem & {
    brand: { id: string; brand_name: string; variant_name: string | null; image_url: string | null } | null;
  })[];
};
```

- [ ] **Step 3: Add brand avg price query**

After the `fallbackPoIdQuery` block (around line 119), add:

```ts
// ── 1c. Fetch brand avg price for est. cost (when brand_id is set on request item) ─
const firstItemBrandId = request?.items?.[0]?.brand_id ?? null;
const firstItemMaterialId = request?.items?.[0]?.material_id ?? null;

const brandAvgPriceQuery = useQuery({
  queryKey: ["journey", "brand-avg-price", firstItemMaterialId ?? "none", firstItemBrandId ?? "none"],
  queryFn: wrapQueryFn(async () => {
    if (!firstItemBrandId || !firstItemMaterialId) return null;
    const { data, error } = await supabase
      .from("price_history")
      .select("price")
      .eq("material_id", firstItemMaterialId)
      .eq("brand_id", firstItemBrandId);
    if (error) throw error;
    if (!data || data.length === 0) return null;
    const avg = (data as { price: number }[]).reduce((sum, r) => sum + r.price, 0) / data.length;
    return avg;
  }),
  enabled: !!firstItemBrandId && !!firstItemMaterialId,
  staleTime: 300_000,
});
```

- [ ] **Step 4: Add brandAvgPrice to isLoading aggregation**

Find the `isLoading` block (around line 243) and add:
```ts
(!!firstItemBrandId && brandAvgPriceQuery.isLoading) ||
```
before the closing semicolon.

Also add to the `error` block:
```ts
(brandAvgPriceQuery.error as Error | null) ??
```

- [ ] **Step 5: Add brandAvgPrice to the journey assembly**

At the bottom of the file, update the `journey` object (around line 275):
```ts
const journey: RequestJourney = {
  request,
  po,
  deliveries,
  expense,
  batchUsage,
  settlement,
  overallStatus,
  isGroupPO,
  brandAvgPrice: brandAvgPriceQuery.data ?? null,
};
```

- [ ] **Step 6: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: errors only in `MaterialRequestJourney.tsx` (not yet updated) — no errors in the hook file itself

- [ ] **Step 7: Commit**

```bash
git add src/hooks/queries/useRequestJourney.ts
git commit -m "feat(journey): join approver name, brand/variant, and avg price in useRequestJourney"
```

---

## Task 4: JourneyPillTag Component

**Files:**
- Create: `src/components/materials/journey/JourneyPillTag.tsx`

- [ ] **Step 1: Create JourneyPillTag.tsx**

```tsx
// src/components/materials/journey/JourneyPillTag.tsx
"use client";

import { Box, IconButton, Tooltip } from "@mui/material";
import {
  ChevronLeft as OpenIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import type { JourneyOverallStatus } from "@/types/journey.types";

interface JourneyPillTagProps {
  overallStatus: JourneyOverallStatus | null;
  onOpen: () => void;
  onDismiss: () => void;
}

function statusDotColor(status: JourneyOverallStatus | null): string {
  if (!status) return "#9e9e9e";
  if (status === "complete" || status === "settlement_done") return "#4caf50";
  if (status === "pending_approval") return "#ff9800";
  return "#ff9800"; // in-progress states
}

export function JourneyPillTag({ overallStatus, onOpen, onDismiss }: JourneyPillTagProps) {
  const isComplete = overallStatus === "complete" || overallStatus === "settlement_done";
  const dotColor = statusDotColor(overallStatus);

  return (
    <Box
      sx={{
        position: "fixed",
        right: 0,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 1300,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 40,
        bgcolor: "background.paper",
        borderRadius: "8px 0 0 8px",
        border: "1px solid",
        borderRight: "none",
        borderColor: "divider",
        boxShadow: "-2px 0 8px rgba(0,0,0,0.12)",
        overflow: "hidden",
      }}
    >
      {/* Dismiss button — only when journey is complete */}
      {isComplete && (
        <Tooltip title="Close journey tracker" placement="left">
          <IconButton size="small" onClick={onDismiss} sx={{ width: 40, height: 36, borderRadius: 0 }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}

      {/* Open button */}
      <Tooltip title="View request journey" placement="left">
        <IconButton size="small" onClick={onOpen} sx={{ width: 40, height: 36, borderRadius: 0 }}>
          <OpenIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      {/* Label */}
      <Box
        sx={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          fontSize: "0.6rem",
          fontWeight: 700,
          color: "text.secondary",
          letterSpacing: "0.08em",
          py: 0.75,
          userSelect: "none",
        }}
      >
        MR
      </Box>

      {/* Status dot */}
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          bgcolor: dotColor,
          mb: 1,
          boxShadow: `0 0 0 2px ${dotColor}33`,
        }}
      />
    </Box>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "JourneyPillTag"
```
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/components/materials/journey/JourneyPillTag.tsx
git commit -m "feat(journey): add JourneyPillTag collapsed pill component"
```

---

## Task 5: JourneyOverlay Component

**Files:**
- Create: `src/components/materials/journey/JourneyOverlay.tsx`

- [ ] **Step 1: Create JourneyOverlay.tsx**

```tsx
// src/components/materials/journey/JourneyOverlay.tsx
"use client";

import { Drawer, Box, IconButton, Typography } from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { usePathname } from "next/navigation";
import { useJourneyWatch } from "@/contexts/JourneyWatchContext";
import { useRequestJourney } from "@/hooks/queries/useRequestJourney";
import { JourneyPillTag } from "./JourneyPillTag";
import { MaterialRequestJourney } from "./MaterialRequestJourney";

export function JourneyOverlay() {
  const pathname = usePathname();
  const { activeJourneyId, isExpanded, setExpanded, deactivateJourney } = useJourneyWatch();

  // Hide entirely on material-requests — that page manages its own inline drawer
  if (!activeJourneyId || pathname === "/site/material-requests") return null;

  const journeyStatus = useRequestJourney(activeJourneyId).journey?.overallStatus ?? null;

  if (!isExpanded) {
    return (
      <JourneyPillTag
        overallStatus={journeyStatus}
        onOpen={() => setExpanded(true)}
        onDismiss={deactivateJourney}
      />
    );
  }

  return (
    <Drawer
      anchor="right"
      open={isExpanded}
      onClose={() => setExpanded(false)}
      variant="temporary"
      slotProps={{ backdrop: { invisible: false } }}
      sx={{ zIndex: 1300 }}
      PaperProps={{ sx: { width: { xs: "100%", sm: 520 } } }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          Request Journey
        </Typography>
        <IconButton size="small" onClick={() => setExpanded(false)} aria-label="Collapse journey">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Journey content */}
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <MaterialRequestJourney requestId={activeJourneyId} isFullPage={false} />
      </Box>
    </Drawer>
  );
}
```

- [ ] **Step 2: Fix the hook-in-conditional lint issue**

The `useRequestJourney` call above is inside a conditional return path — React hooks can't be called after a conditional `return`. Move the hook before the first `return null`:

```tsx
// src/components/materials/journey/JourneyOverlay.tsx
"use client";

import { Drawer, Box, IconButton, Typography } from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { usePathname } from "next/navigation";
import { useJourneyWatch } from "@/contexts/JourneyWatchContext";
import { useRequestJourney } from "@/hooks/queries/useRequestJourney";
import { JourneyPillTag } from "./JourneyPillTag";
import { MaterialRequestJourney } from "./MaterialRequestJourney";

export function JourneyOverlay() {
  const pathname = usePathname();
  const { activeJourneyId, isExpanded, setExpanded, deactivateJourney } = useJourneyWatch();

  // Always call hook — hooks must not be conditional
  const { journey } = useRequestJourney(activeJourneyId);
  const journeyStatus = journey?.overallStatus ?? null;

  // Hide entirely on material-requests — that page manages its own inline drawer
  if (!activeJourneyId || pathname === "/site/material-requests") return null;

  if (!isExpanded) {
    return (
      <JourneyPillTag
        overallStatus={journeyStatus}
        onOpen={() => setExpanded(true)}
        onDismiss={deactivateJourney}
      />
    );
  }

  return (
    <Drawer
      anchor="right"
      open={isExpanded}
      onClose={() => setExpanded(false)}
      variant="temporary"
      slotProps={{ backdrop: { invisible: false } }}
      sx={{ zIndex: 1300 }}
      PaperProps={{ sx: { width: { xs: "100%", sm: 520 } } }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          Request Journey
        </Typography>
        <IconButton size="small" onClick={() => setExpanded(false)} aria-label="Collapse journey">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <MaterialRequestJourney requestId={activeJourneyId} isFullPage={false} />
      </Box>
    </Drawer>
  );
}
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "JourneyOverlay"
```
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add src/components/materials/journey/JourneyOverlay.tsx
git commit -m "feat(journey): add JourneyOverlay portal for cross-page pill/drawer"
```

---

## Task 6: Wire into MainLayout

**Files:**
- Modify: `src/components/layout/MainLayout.tsx`

- [ ] **Step 1: Add imports at the top of MainLayout.tsx**

After the existing imports in `src/components/layout/MainLayout.tsx`, add:

```ts
import { JourneyWatchProvider } from "@/contexts/JourneyWatchContext";
import { JourneyOverlay } from "@/components/materials/journey/JourneyOverlay";
```

- [ ] **Step 2: Wrap the return JSX with JourneyWatchProvider**

Make three targeted edits to `src/components/layout/MainLayout.tsx`:

**Edit A** — add `<JourneyWatchProvider>` on the line immediately before the outer `<Box` in the return (line 1084):
```tsx
// Before (line 1084):
  return (
    <Box

// After:
  return (
    <JourneyWatchProvider>
    <Box
```

**Edit B** — add `<JourneyOverlay />` immediately before `<SettlementDialogManager />` (line 1430):
```tsx
// Before:
      {/* Settlement Dialogs (managed via NotificationContext) */}
      <SettlementDialogManager />

// After:
      {/* Journey overlay — pill tag or full drawer, persists across navigation */}
      <JourneyOverlay />

      {/* Settlement Dialogs (managed via NotificationContext) */}
      <SettlementDialogManager />
```

**Edit C** — close the provider after the outer `</Box>` (line 1451) and before the closing `)`:
```tsx
// Before (lines 1451-1452):
    </Box>
  );

// After:
    </Box>
    </JourneyWatchProvider>
  );
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/MainLayout.tsx
git commit -m "feat(journey): wire JourneyWatchProvider and JourneyOverlay into MainLayout"
```

---

## Task 7: Update MaterialRequestJourney — Data Fixes + Media Galleries

**Files:**
- Modify: `src/components/materials/journey/MaterialRequestJourney.tsx`

This task is the largest. Work through it section by section.

### 7a: Activate journey on mount + add PhotoLightbox state

- [ ] **Step 1: Add imports and lightbox state**

At the top of `MaterialRequestJourney.tsx`, add to the existing imports:

```tsx
import { useEffect, useState } from "react";
import { useJourneyWatch } from "@/contexts/JourneyWatchContext";
import PhotoLightbox from "@/components/dashboard/PhotoLightbox";
import type { WorkPhoto } from "@/types/work-updates.types";
```

Inside the `MaterialRequestJourney` function, after the existing `const { journey, isLoading, error } = useRequestJourney(requestId);` line, add:

```tsx
const { activateJourney } = useJourneyWatch();
const [lightbox, setLightbox] = useState<{ photos: WorkPhoto[]; startIndex: number } | null>(null);

useEffect(() => {
  if (requestId) activateJourney(requestId);
}, [requestId, activateJourney]);
```

Also add at the end of the return JSX (before the closing `</Box>`):
```tsx
{/* Photo lightbox */}
{lightbox && (
  <PhotoLightbox
    open={!!lightbox}
    photos={lightbox.photos}
    startIndex={lightbox.startIndex}
    onClose={() => setLightbox(null)}
  />
)}
```

### 7b: Approver name fix

- [ ] **Step 2: Fix "Approved by" in requestFields**

Find line 183 in the component:
```tsx
{ label: "Approved by", value: fmt(request.approved_by) },
```

Replace with (no cast needed — `approved_by_user` is on the type after Task 2):
```tsx
{
  label: "Approved by",
  value: fmt(
    request.approved_by_user?.name ??
    request.approved_by_user?.display_name ??
    request.approved_by  // fallback to UUID if join returned null
  ),
},
```

### 7c: Estimated cost with brand avg price

- [ ] **Step 3: Fix "Est. Cost" in requestFields**

Find line 193:
```tsx
{
  label: "Est. Cost",
  value: fmtMoney(request.items?.[0]?.estimated_cost),
  variant: "amount" as const,
},
```

Replace with:
```tsx
{
  label: "Est. Cost",
  value:
    journey.brandAvgPrice != null
      ? `~${fmtMoney(journey.brandAvgPrice)}/unit`
      : fmtMoney(request.items?.[0]?.estimated_cost),
  variant: "amount" as const,
},
```

### 7d: Group PO / Own Site badge on request card

- [ ] **Step 4: Add Order Type field to requestFields**

After the "Est. Cost" entry in `requestFields`, add:
```tsx
{
  label: "Order Type",
  value: isGroupPO ? "Group PO" : "Own Site",
  variant: isGroupPO ? ("blue" as const) : ("default" as const),
},
```

### 7e: Brand image + name in PO card

- [ ] **Step 5: Add brand children to the PO JourneyPhaseCard**

The existing PO card (around line 467) passes `children` with just the GROUP STOCK chip. Replace the `children` block:

```tsx
<JourneyPhaseCard
  status={poStatus}
  title="Purchase Order"
  icon="🛒"
  statusLabel={poStatusLabel}
  fields={poFields}
  actions={poActions}
>
  {/* Brand + variant thumbnail */}
  {(() => {
    const brand = po?.items?.[0]?.brand ?? null;  // typed via RequestJourney after Task 2
    if (!brand) return isGroupPO ? <GroupStockChip /> : null;
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
        {brand.image_url ? (
          <Box
            component="img"
            src={brand.image_url}
            alt={brand.brand_name}
            sx={{ width: 40, height: 40, objectFit: "cover", borderRadius: 1, flexShrink: 0 }}
          />
        ) : (
          <Box
            sx={{
              width: 40, height: 40, borderRadius: 1, flexShrink: 0,
              bgcolor: "action.hover",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Typography variant="caption" color="text.disabled">IMG</Typography>
          </Box>
        )}
        <Box>
          <Typography variant="caption" fontWeight={600} display="block" lineHeight={1.2}>
            {brand.brand_name}
          </Typography>
          {brand.variant_name && (
            <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>
              {brand.variant_name}
            </Typography>
          )}
        </Box>
        {isGroupPO && <GroupStockChip />}
      </Box>
    );
  })()}
</JourneyPhaseCard>
```

Extract the existing GROUP STOCK chip into a small inline component at the top of the file (before `MaterialRequestJourney`):

```tsx
function GroupStockChip() {
  return (
    <Chip
      label="GROUP STOCK"
      size="small"
      sx={{
        height: 18,
        fontSize: "0.65rem",
        fontWeight: 700,
        bgcolor: "purple",
        color: "white",
        mt: 0.5,
        "& .MuiChip-label": { px: 0.75 },
      }}
    />
  );
}
```

### 7f: Delivery photos gallery

- [ ] **Step 6: Add a helper to collect delivery photos as WorkPhoto[]**

Add this helper after the `fmtMoney` function (around line 107).
Use `RequestJourney["deliveries"][0]` to avoid importing `Delivery` separately:

```tsx
function deliveryPhotos(delivery: RequestJourney["deliveries"][0]): WorkPhoto[] {
  const photos: WorkPhoto[] = [];
  const raw = delivery.delivery_photos as string[] | null;
  const verif = delivery.verification_photos as string[] | null;
  (raw ?? []).forEach((url, i) =>
    photos.push({ id: `dp-${i}`, url, description: "Delivery photo", uploadedAt: "" })
  );
  (verif ?? []).forEach((url, i) =>
    photos.push({ id: `vp-${i}`, url, description: "Verification photo", uploadedAt: "" })
  );
  if (delivery.invoice_url) {
    photos.push({ id: "invoice", url: delivery.invoice_url, description: "Invoice / Bill", uploadedAt: "" });
  }
  if (delivery.challan_url) {
    photos.push({ id: "challan", url: delivery.challan_url, description: "Delivery Challan", uploadedAt: "" });
  }
  return photos;
}
```

- [ ] **Step 7: Add photo thumbnails to the Delivery JourneyPhaseCard**

Replace the existing Delivery `JourneyPhaseCard` (around line 494):

```tsx
{/* Delivery */}
<JourneyPhaseCard
  status={deliveryStatus}
  title="Delivery"
  icon="🚛"
  statusLabel={deliveryStatusLabel}
  fields={deliveryFields}
  actions={deliveryActions}
>
  {firstDelivery && (() => {
    const photos = deliveryPhotos(firstDelivery);
    if (photos.length === 0) return null;
    return (
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.5 }}>
        {photos.map((photo, idx) => (
          <Box
            key={photo.id}
            onClick={() => setLightbox({ photos, startIndex: idx })}
            sx={{
              width: 56, height: 56, borderRadius: 1, overflow: "hidden",
              cursor: "pointer", flexShrink: 0,
              border: "1px solid", borderColor: "divider",
              "&:hover": { opacity: 0.85 },
            }}
          >
            <Box
              component="img"
              src={photo.url}
              alt={photo.description}
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Box>
        ))}
      </Box>
    );
  })()}
</JourneyPhaseCard>
```

### 7g: Vendor payment screenshot

- [ ] **Step 8: Add payment screenshot to Vendor Payment JourneyPhaseCard**

Replace the existing Vendor Payment `JourneyPhaseCard` (around line 504):

```tsx
{/* Vendor Payment */}
<JourneyPhaseCard
  status={vendorPaymentStatus}
  title="Vendor Payment"
  icon="💳"
  statusLabel={vendorPaymentStatusLabel}
  fields={vendorPaymentFields}
  actions={vendorPaymentActions}
>
  {expense?.payment_screenshot_url && (() => {
    const photos: WorkPhoto[] = [{
      id: "payment-screenshot",
      url: expense.payment_screenshot_url!,
      description: `Payment via ${expense.payment_mode ?? ""}${expense.payment_reference ? ` · ${expense.payment_reference}` : ""}`,
      uploadedAt: "",
    }];
    return (
      <Box
        onClick={() => setLightbox({ photos, startIndex: 0 })}
        sx={{
          mt: 0.5, display: "flex", alignItems: "center", gap: 1,
          cursor: "pointer",
          "&:hover": { opacity: 0.85 },
        }}
      >
        <Box
          component="img"
          src={expense.payment_screenshot_url}
          alt="Payment proof"
          sx={{ width: 72, height: 56, objectFit: "cover", borderRadius: 1, border: "1px solid", borderColor: "divider" }}
        />
        <Typography variant="caption" color="text.secondary">
          Tap to verify payment
        </Typography>
      </Box>
    );
  })()}
</JourneyPhaseCard>
```

- [ ] **Step 9: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors

- [ ] **Step 10: Commit**

```bash
git add src/components/materials/journey/MaterialRequestJourney.tsx
git commit -m "feat(journey): approver name, brand/variant/image, est cost avg, delivery gallery, payment screenshot"
```

---

## Task 8: GRN Navigation Fix Verification

**Files:**
- Verify: `src/components/materials/journey/MaterialRequestJourney.tsx` (already reviewed in exploration)

- [ ] **Step 1: Verify the "Open GRN" button already uses the ?grn= param**

Check line ~296-300 in `MaterialRequestJourney.tsx`:
```tsx
{
  label: "→ Open GRN",
  href: `/site/delivery-verification?grn=${firstDelivery.grn_number}`,
  variant: "secondary" as const,
},
```
This already uses `?grn=` — confirmed from code read. No change needed.

- [ ] **Step 2: Verify JourneyPhaseCard renders action href correctly**

```bash
grep -n "href" src/components/materials/journey/JourneyPhaseCard.tsx
```
Expected: action links render as `<a href={action.href}>` or `router.push(action.href)` — confirm it passes the full URL with query string.

- [ ] **Step 3: Manual test — open any request journey, click "→ Open GRN"**

1. Navigate to `http://localhost:3000/dev-login`
2. Open any material request with a delivery
3. Open the Journey drawer
4. Click "→ Open GRN"
5. Verify: delivery-verification page loads AND the correct GRN row is highlighted
6. Verify: the journey pill tag appears on the right edge of the delivery-verification page

---

## Task 9: End-to-End Visual Verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Auto-login via Playwright**

Navigate to `http://localhost:3000/dev-login` — auto-authenticates and redirects to dashboard.

- [ ] **Step 3: Open a material request with an approved + converted state**

Navigate to `/site/material-requests`, open a request that has:
- An approver set
- A brand selected on the item
- A PO, delivery, and expense

Open the Journey drawer and verify:
- [ ] "Approved by" shows a person's name, not a UUID
- [ ] "Est. Cost" shows `~₹X/unit` if brand has price history, otherwise `—` or the stored value
- [ ] "Order Type" shows "Group PO" or "Own Site"
- [ ] PO card shows brand thumbnail image (or placeholder) + brand name + variant
- [ ] Delivery card shows photo thumbnails if delivery has photos
- [ ] Click a delivery thumbnail → PhotoLightbox opens fullscreen
- [ ] Vendor Payment card shows payment screenshot thumbnail if set
- [ ] Click screenshot → PhotoLightbox opens

- [ ] **Step 4: Test the pill tag**

1. While the journey drawer is open, click "→ Open GRN" (or navigate to another page)
2. Verify: delivery-verification page loads
3. Verify: a pill tag appears on the right edge of the page
4. Click the pill tag
5. Verify: the full journey drawer opens over the page
6. Click the backdrop or press Escape
7. Verify: drawer collapses back to pill tag

- [ ] **Step 5: Test pill dismiss (complete journey only)**

Find a request with `overallStatus === "complete"`, open its journey, navigate away, and verify the ✕ button appears on the pill. Click it and verify the pill disappears.

- [ ] **Step 6: Check browser console**

Use Playwright MCP to read console logs. Expected: zero errors, zero hydration warnings.

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat(journey): complete request journey enhancements with persistent pill tag"
```
