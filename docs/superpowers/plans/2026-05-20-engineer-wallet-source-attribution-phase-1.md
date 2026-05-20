# Engineer Wallet Source Attribution — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the wallet-only UX for site engineers across every wallet-channel dialog — a new `WalletBalancePreview` card in `MiscExpenseDialog`, no more manual `PayerSourceSelector` for site engineers anywhere, no payer-type radios, no "Deduct from wallet" toggle. Attribution backend stays unchanged (spend rows still have `payer_source=NULL`); Phase 2 fills that in.

**Architecture:** Add a tiny pure-presentational component `WalletBalancePreview` (current balance → amount → after balance, red when negative, overdraft Alert below). Extract the `isSiteEngineerPayingFromWallet` predicate into a shared utility. Apply the predicate in `MiscExpenseDialog` (also wires in the preview) and 11 other wallet-channel dialogs to conditionally hide `PayerSourceSelector`. TDD throughout — Vitest + React Testing Library, mocked at the auth/wallet/site boundary.

**Tech Stack:** Next.js 15, MUI v7, React Query, Vitest, @testing-library/react, TypeScript. Tests live alongside source as `*.test.tsx`. Pre-commit runs `eslint --fix` + `vitest related --run` via lint-staged — no separate lint step needed.

**Spec:** [docs/superpowers/specs/2026-05-20-engineer-wallet-source-attribution-design.md](../specs/2026-05-20-engineer-wallet-source-attribution-design.md)

---

## File Structure

**New files (3):**
- `src/components/wallet-v2/WalletBalancePreview.tsx` — pure-presentational balance + after-balance card with overdraft alert. Used inside MiscExpenseDialog; later phases can adopt across other site-engineer dialogs.
- `src/components/wallet-v2/WalletBalancePreview.test.tsx` — unit tests for the four render states (normal, overdraft, zero-balance, loading).
- `src/components/expenses/walletPayerLock.ts` — pure predicate function `isSiteEngineerPayingFromWallet`. Plus its test file `walletPayerLock.test.ts`.

**Modified files (13):**
- `src/components/expenses/MiscExpenseDialog.tsx` — wire in `WalletBalancePreview`, hide WHO-IS-PAYING block + PayerSourceSelector for site engineers via the new predicate.
- 11 other dialogs (MaterialSettlementDialog, InitiateBatchSettlementDialog, PaymentDialog, MestriSettleDialog, ContractPaymentRecordDialog, UnifiedSettlementDialog, RentalSettlementDialog, RentalAdvanceDialog, HistoricalRentalDialog, TeaShopSettlementDialog, GroupTeaShopSettlementDialog) — same conditional wrap around `PayerSourceSelector`.
- `src/components/expenses/MiscExpenseDialog.test.tsx` — new file (the dialog has no test today) covering role-conditional UI.

**Out of scope (deferred to later phases):**
- No DB schema changes (`engineer_wallet_spend_allocations` lands in Phase 2).
- No `v_all_expenses` changes.
- No `/site/my-wallet` page changes.
- No allocator service, no backfill migration.

---

## Task 1: Create the `WalletBalancePreview` component (TDD)

**Files:**
- Create: `src/components/wallet-v2/WalletBalancePreview.tsx`
- Create: `src/components/wallet-v2/WalletBalancePreview.test.tsx`

- [ ] **Step 1: Write the failing test file**

Create `src/components/wallet-v2/WalletBalancePreview.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import WalletBalancePreview from "./WalletBalancePreview";

describe("WalletBalancePreview", () => {
  it("renders current balance, amount, and after-balance when there is headroom", () => {
    render(
      <WalletBalancePreview
        engineerName="Ajith"
        siteName="Padmavathy"
        currentBalance={10000}
        amount={330}
      />
    );
    expect(screen.getByText(/Your wallet · Padmavathy/i)).toBeInTheDocument();
    expect(screen.getByText("₹10,000")).toBeInTheDocument();
    expect(screen.getByText("−₹330")).toBeInTheDocument();
    expect(screen.getByText("₹9,670")).toBeInTheDocument();
    expect(screen.queryByText(/Wallet overdraft/i)).not.toBeInTheDocument();
  });

  it("renders overdraft warning when after-balance goes negative", () => {
    render(
      <WalletBalancePreview
        engineerName="Ajith"
        siteName="Srinivasan"
        currentBalance={500}
        amount={1000}
      />
    );
    expect(screen.getByText("−₹500")).toBeInTheDocument(); // after-balance
    expect(screen.getByText(/Wallet overdraft/i)).toBeInTheDocument();
    expect(screen.getByText(/company will owe you ₹500/i)).toBeInTheDocument();
  });

  it("treats a zero-balance + any spend as overdraft", () => {
    render(
      <WalletBalancePreview
        engineerName="Ajith"
        siteName="Test"
        currentBalance={0}
        amount={100}
      />
    );
    expect(screen.getByText(/Wallet overdraft/i)).toBeInTheDocument();
  });

  it("renders skeleton when isLoading is true", () => {
    const { container } = render(
      <WalletBalancePreview
        engineerName="Ajith"
        siteName="Padmavathy"
        currentBalance={0}
        amount={0}
        isLoading
      />
    );
    expect(container.querySelector(".MuiSkeleton-root")).toBeInTheDocument();
    expect(screen.queryByText(/Current balance/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/wallet-v2/WalletBalancePreview.test.tsx`
Expected: FAIL with `Cannot find module './WalletBalancePreview'` (or equivalent).

- [ ] **Step 3: Write the implementation**

Create `src/components/wallet-v2/WalletBalancePreview.tsx`:

```tsx
"use client";

import React from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { AccountBalanceWallet, WarningAmber } from "@mui/icons-material";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Math.round(Math.abs(n))
  );

export interface WalletBalancePreviewProps {
  engineerName: string;
  siteName: string;
  currentBalance: number;
  amount: number;
  isLoading?: boolean;
}

export default function WalletBalancePreview({
  engineerName: _engineerName,
  siteName,
  currentBalance,
  amount,
  isLoading = false,
}: WalletBalancePreviewProps) {
  const afterBalance = currentBalance - amount;
  const willOverdraft = afterBalance < 0;

  if (isLoading) {
    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Skeleton variant="text" width="60%" height={28} />
          <Skeleton variant="text" width="40%" height={48} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Card variant="outlined" sx={{ bgcolor: "action.hover" }}>
        <CardContent sx={{ "&:last-child": { pb: 2 } }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ mb: 1.5 }}
          >
            <AccountBalanceWallet fontSize="small" color="primary" />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
            >
              Your wallet · {siteName}
            </Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Row label="Current balance" value={`₹${fmt(currentBalance)}`} />
            <Row label="This expense" value={`−₹${fmt(amount)}`} />
            <Box sx={{ borderTop: 1, borderColor: "divider", my: 0.5 }} />
            <Row
              label="After this expense"
              value={`${willOverdraft ? "−" : ""}₹${fmt(afterBalance)}`}
              bold
              negative={willOverdraft}
            />
          </Stack>
        </CardContent>
      </Card>

      {willOverdraft && (
        <Alert
          severity="warning"
          icon={<WarningAmber fontSize="inherit" />}
          sx={{ mt: 1, "& .MuiAlert-message": { fontSize: "0.85rem" } }}
        >
          Wallet overdraft — company will owe you ₹{fmt(afterBalance)} after this expense.
          Future deposits will settle the negative first.
        </Alert>
      )}
    </Box>
  );
}

function Row({
  label,
  value,
  bold,
  negative,
}: {
  label: string;
  value: string;
  bold?: boolean;
  negative?: boolean;
}) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline">
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontWeight: bold ? 600 : 400 }}
      >
        {label}
      </Typography>
      <Typography
        variant={bold ? "h6" : "body2"}
        sx={{
          fontWeight: bold ? 700 : 500,
          color: negative ? "error.main" : "text.primary",
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/wallet-v2/WalletBalancePreview.test.tsx`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/wallet-v2/WalletBalancePreview.tsx src/components/wallet-v2/WalletBalancePreview.test.tsx
git commit -m "feat(wallet-v2): WalletBalancePreview — current → amount → after-balance card with overdraft alert"
```

---

## Task 2: Extract `isSiteEngineerPayingFromWallet` predicate (TDD)

**Files:**
- Create: `src/components/expenses/walletPayerLock.ts`
- Create: `src/components/expenses/walletPayerLock.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/expenses/walletPayerLock.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isSiteEngineerPayingFromWallet } from "./walletPayerLock";

describe("isSiteEngineerPayingFromWallet", () => {
  it("returns true when role + payerType + wallet flag all align", () => {
    expect(
      isSiteEngineerPayingFromWallet({
        userRole: "site_engineer",
        payerType: "site_engineer",
        createWalletTransaction: true,
      })
    ).toBe(true);
  });

  it("returns false for admin paying via a site engineer's wallet (admin keeps the picker)", () => {
    expect(
      isSiteEngineerPayingFromWallet({
        userRole: "admin",
        payerType: "site_engineer",
        createWalletTransaction: true,
      })
    ).toBe(false);
  });

  it("returns false when wallet transaction toggle is off", () => {
    expect(
      isSiteEngineerPayingFromWallet({
        userRole: "site_engineer",
        payerType: "site_engineer",
        createWalletTransaction: false,
      })
    ).toBe(false);
  });

  it("returns false when payer type is company_direct (shouldn't happen for engineers, defensive)", () => {
    expect(
      isSiteEngineerPayingFromWallet({
        userRole: "site_engineer",
        payerType: "company_direct",
        createWalletTransaction: true,
      })
    ).toBe(false);
  });

  it("returns false for office role", () => {
    expect(
      isSiteEngineerPayingFromWallet({
        userRole: "office",
        payerType: "site_engineer",
        createWalletTransaction: true,
      })
    ).toBe(false);
  });

  it("returns false when role is undefined (auth still loading)", () => {
    expect(
      isSiteEngineerPayingFromWallet({
        userRole: undefined,
        payerType: "site_engineer",
        createWalletTransaction: true,
      })
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/expenses/walletPayerLock.test.ts`
Expected: FAIL with `Cannot find module './walletPayerLock'`.

- [ ] **Step 3: Write the implementation**

Create `src/components/expenses/walletPayerLock.ts`:

```ts
/**
 * Predicate: hide the manual PayerSourceSelector when a logged-in site
 * engineer is paying from their own wallet.
 *
 * Phase 1 doesn't yet derive the source automatically (Phase 2 will,
 * via engineer_wallet_spend_allocations). But the manual picker is
 * already redundant for engineers — deposits carry payer_source, and
 * the engineer just spends from the pool. Stripping the picker now
 * removes a confusing input and prevents the historical bug where the
 * engineer's manual pick contradicts the actual wallet composition.
 *
 * Admins and office users keep the picker — they have legitimate
 * reasons to attribute manually (recording an out-of-wallet company
 * purchase, or editorial correction on a retroactive row).
 */
export interface WalletPayerLockArgs {
  userRole: string | undefined;
  payerType: "site_engineer" | "company_direct" | undefined;
  createWalletTransaction: boolean | undefined;
}

export function isSiteEngineerPayingFromWallet(
  args: WalletPayerLockArgs
): boolean {
  return (
    args.userRole === "site_engineer" &&
    args.payerType === "site_engineer" &&
    args.createWalletTransaction === true
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/expenses/walletPayerLock.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/expenses/walletPayerLock.ts src/components/expenses/walletPayerLock.test.ts
git commit -m "feat(expenses): isSiteEngineerPayingFromWallet predicate (shared utility for the 12 wallet-channel dialogs)"
```

---

## Task 3: MiscExpenseDialog — wire in WalletBalancePreview, strip payer-source for engineers (TDD)

**Files:**
- Modify: `src/components/expenses/MiscExpenseDialog.tsx`
- Create: `src/components/expenses/MiscExpenseDialog.test.tsx`

- [ ] **Step 1: Write the failing integration test**

Create `src/components/expenses/MiscExpenseDialog.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MiscExpenseDialog from "./MiscExpenseDialog";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));
vi.mock("@/contexts/SiteContext", () => ({
  useSite: vi.fn(() => ({
    selectedSite: { id: "site-1", name: "Padmavathy" },
  })),
}));
vi.mock("@/hooks/queries/useEngineerWalletV2", () => ({
  useEngineerWalletBalance: vi.fn(() => ({
    data: { balance: 10000 },
    isLoading: false,
  })),
}));
vi.mock("@/hooks/queries/useVendors", () => ({
  useVendors: () => ({ data: [] }),
}));
vi.mock("@/hooks/queries/useLaborers", () => ({
  useLaborers: () => ({ data: [] }),
}));
vi.mock("@/hooks/queries/usePayerSources", () => ({
  usePayerSources: () => ({ data: [] }),
}));
// Supabase client — stub all queries to empty results so the dialog renders.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return {
      from: () => chain,
    };
  },
}));
vi.mock("@tanstack/react-query", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import { useAuth } from "@/contexts/AuthContext";

describe("MiscExpenseDialog — site_engineer view", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      userProfile: { id: "u-1", name: "Ajith Kumar", role: "site_engineer" },
    } as any);
  });

  it("hides WHO IS PAYING radios for site engineers", () => {
    render(<MiscExpenseDialog open onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.queryByText(/who is paying/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/company direct/i)).not.toBeInTheDocument();
  });

  it("renders WalletBalancePreview for site engineers", () => {
    render(<MiscExpenseDialog open onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText(/Your wallet · Padmavathy/i)).toBeInTheDocument();
    expect(screen.getByText("₹10,000")).toBeInTheDocument();
  });

  it("hides the Payment Source chip row for site engineers", () => {
    render(<MiscExpenseDialog open onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.queryByText(/^Payment Source$/i)).not.toBeInTheDocument();
  });
});

describe("MiscExpenseDialog — admin view (regression)", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      userProfile: { id: "u-admin", name: "Hari Admin", role: "admin" },
    } as any);
  });

  it("shows WHO IS PAYING radios for admin", () => {
    render(<MiscExpenseDialog open onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText(/who is paying/i)).toBeInTheDocument();
    expect(screen.getByText(/company direct/i)).toBeInTheDocument();
  });

  it("shows the Payment Source chip row for admin", () => {
    render(<MiscExpenseDialog open onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText(/^Payment Source$/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/expenses/MiscExpenseDialog.test.tsx`
Expected: FAIL — site_engineer tests fail because the dialog still renders WHO IS PAYING / Payment Source / does NOT render WalletBalancePreview.

- [ ] **Step 3: Modify `MiscExpenseDialog.tsx` — add imports + balance hook + predicate**

In `src/components/expenses/MiscExpenseDialog.tsx`, top of file, add:

```tsx
import WalletBalancePreview from "@/components/wallet-v2/WalletBalancePreview";
import { useEngineerWalletBalance } from "@/hooks/queries/useEngineerWalletV2";
import { isSiteEngineerPayingFromWallet } from "./walletPayerLock";
```

Inside the component, after the existing `const isSiteEngineer = userProfile?.role === "site_engineer";` line, add:

```tsx
const balanceQuery = useEngineerWalletBalance(
  isSiteEngineer ? userProfile?.id : undefined,
  selectedSite?.id
);
const walletOnlyView = isSiteEngineerPayingFromWallet({
  userRole: userProfile?.role,
  payerType,
  createWalletTransaction,
});
```

- [ ] **Step 4: Modify `MiscExpenseDialog.tsx` — replace the engineer-side WHO-IS-PAYING / source picker block**

Find the existing `{/* Who is Paying */}` Paper block (currently around lines 451–532 in the file) and the `{/* Payment Source */}` block (currently around lines 534–541). Wrap them in `{!walletOnlyView && (...)}`. Right BEFORE that wrap, add the preview render:

```tsx
{walletOnlyView && selectedSite && (
  <WalletBalancePreview
    engineerName={userProfile?.name ?? "You"}
    siteName={selectedSite.name}
    currentBalance={balanceQuery.data?.balance ?? 0}
    amount={amount}
    isLoading={balanceQuery.isLoading}
  />
)}

{!walletOnlyView && (
  <>
    {/* Who is Paying */}
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      ... existing Paper content unchanged ...
    </Paper>

    {/* Payment Source */}
    <PayerSourceSelector
      value={payerSource}
      customName={customPayerName}
      onChange={setPayerSource}
      onCustomNameChange={setCustomPayerName}
      compact
    />
  </>
)}
```

The Payment Mode select, Subcontract select, and Notes textarea stay OUTSIDE the conditional — engineers still pick those.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/expenses/MiscExpenseDialog.test.tsx`
Expected: 5 tests pass (3 site_engineer + 2 admin regression).

- [ ] **Step 6: Run the full file-related tests + build**

Run: `npx vitest run src/components/expenses src/components/wallet-v2`
Expected: All pass.

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/expenses/MiscExpenseDialog.tsx src/components/expenses/MiscExpenseDialog.test.tsx
git commit -m "feat(expenses): wallet-only MiscExpenseDialog for site engineers — balance preview replaces payer-source picker"
```

---

## Task 4: Strip PayerSourceSelector from the other 11 wallet-channel dialogs

Pattern for every dialog: import the predicate, derive a boolean, wrap the existing `<PayerSourceSelector>` render in `{!walletOnly && (...)}`. The exact local variable name for `payerType` and `createWalletTransaction` differs per dialog — fill in from the dialog's existing state.

Most of these dialogs only need a 3-line change. Some don't have `payerType` at all (rental advance) — for those the predicate degenerates to `userRole === "site_engineer"`; pass `payerType: "site_engineer"` and `createWalletTransaction: true` literals to the predicate to keep the predicate's signature uniform.

- [ ] **Step 1: MaterialSettlementDialog**

Open `src/components/materials/MaterialSettlementDialog.tsx`.

Add the import block at the top with the other component imports:

```tsx
import { isSiteEngineerPayingFromWallet } from "@/components/expenses/walletPayerLock";
```

Inside the component, near where `userProfile` / `payerType` / `createWalletTransaction` are derived, add:

```tsx
const walletOnly = isSiteEngineerPayingFromWallet({
  userRole: userProfile?.role,
  payerType,
  createWalletTransaction,
});
```

Find the `<PayerSourceSelector ... />` JSX and wrap it:

```tsx
{!walletOnly && (
  <PayerSourceSelector
    value={payerSource}
    customName={customPayerName}
    onChange={setPayerSource}
    onCustomNameChange={setCustomPayerName}
    compact
  />
)}
```

If `MaterialSettlementDialog` doesn't expose `createWalletTransaction` as state, but the dialog routes site-engineer payments through the wallet unconditionally, pass `createWalletTransaction: true` literal:

```tsx
const walletOnly = isSiteEngineerPayingFromWallet({
  userRole: userProfile?.role,
  payerType,
  createWalletTransaction: true,
});
```

- [ ] **Step 2: InitiateBatchSettlementDialog**

Same pattern in `src/components/materials/InitiateBatchSettlementDialog.tsx`.

- [ ] **Step 3: PaymentDialog**

Same pattern in `src/components/payments/PaymentDialog.tsx`.

- [ ] **Step 4: MestriSettleDialog**

Same pattern in `src/components/payments/MestriSettleDialog.tsx`.

- [ ] **Step 5: ContractPaymentRecordDialog**

Same pattern in `src/components/payments/ContractPaymentRecordDialog.tsx`.

- [ ] **Step 6: UnifiedSettlementDialog**

Same pattern in `src/components/settlement/UnifiedSettlementDialog.tsx`.

- [ ] **Step 7: RentalSettlementDialog**

Same pattern in `src/components/rentals/RentalSettlementDialog.tsx`.

- [ ] **Step 8: RentalAdvanceDialog**

This one likely lacks both `payerType` and `createWalletTransaction`. Apply the predicate with literal defaults:

```tsx
const walletOnly = isSiteEngineerPayingFromWallet({
  userRole: userProfile?.role,
  payerType: "site_engineer",
  createWalletTransaction: true,
});
```

Same wrap around `<PayerSourceSelector>`.

- [ ] **Step 9: HistoricalRentalDialog**

Same pattern (literal defaults if needed) in `src/components/rentals/HistoricalRentalDialog.tsx`.

- [ ] **Step 10: TeaShopSettlementDialog**

Same pattern in `src/components/tea-shop/TeaShopSettlementDialog.tsx`.

- [ ] **Step 11: GroupTeaShopSettlementDialog**

Same pattern in `src/components/tea-shop/GroupTeaShopSettlementDialog.tsx`.

- [ ] **Step 12: Run full test suite**

Run: `npm run test`
Expected: All tests pass. Pre-existing failures (unrelated to this work) are acceptable but log them.

- [ ] **Step 13: Build**

Run: `npm run build`
Expected: Production build succeeds with no type errors. Bundle for `/site/expenses/miscellaneous` should stay roughly the same size (~30 kB).

- [ ] **Step 14: Commit**

```bash
git add src/components/materials/MaterialSettlementDialog.tsx \
  src/components/materials/InitiateBatchSettlementDialog.tsx \
  src/components/payments/PaymentDialog.tsx \
  src/components/payments/MestriSettleDialog.tsx \
  src/components/payments/ContractPaymentRecordDialog.tsx \
  src/components/settlement/UnifiedSettlementDialog.tsx \
  src/components/rentals/RentalSettlementDialog.tsx \
  src/components/rentals/RentalAdvanceDialog.tsx \
  src/components/rentals/HistoricalRentalDialog.tsx \
  src/components/tea-shop/TeaShopSettlementDialog.tsx \
  src/components/tea-shop/GroupTeaShopSettlementDialog.tsx
git commit -m "feat(wallet): strip PayerSourceSelector across 11 wallet-channel dialogs for site engineers

Uniform pattern: each dialog now uses isSiteEngineerPayingFromWallet to
conditionally render the manual payer-source picker. Admins / office
users still see it — only logged-in site engineers paying from their own
wallet get the stripped view. Phase 2 will add the engineer_wallet_spend_allocations
table so the source is derived from deposits, but stripping the manual
picker now closes the redundant-input bug and matches the spec."
```

---

## Task 5: Ship to prod (move-to-prod sequence per CLAUDE.md)

- [ ] **Step 1: Confirm working tree contains only intended files**

Run: `git status` and `git diff --stat origin/main`.
Expected files modified:
- `src/components/wallet-v2/WalletBalancePreview.tsx` (new)
- `src/components/wallet-v2/WalletBalancePreview.test.tsx` (new)
- `src/components/expenses/walletPayerLock.ts` (new)
- `src/components/expenses/walletPayerLock.test.ts` (new)
- `src/components/expenses/MiscExpenseDialog.tsx` (modified)
- `src/components/expenses/MiscExpenseDialog.test.tsx` (new)
- 11 other dialog files (modified)

If anything else is staged, stop and investigate.

- [ ] **Step 2: Final build + test gate**

Run: `npm run build && npm run test`
Both must pass clean.

- [ ] **Step 3: Push**

```bash
git push origin main
```

Expected: Vercel pipeline picks up and deploys within ~2 minutes.

No Supabase migrations needed (this phase is UI-only).
No Cloudflare Worker deploy needed (no `cloudflare-proxy/` files changed).

- [ ] **Step 4: Verify in prod via Playwright**

Wait ~2 minutes for the Vercel deploy. Then:

```bash
# In a separate shell or via the Playwright MCP:
# 1. Navigate to https://app.aesta.co.in/site/expenses/miscellaneous
# 2. Confirm new chunk hash loaded (rotates from current 6179-6118f1bcaba0fda5.js
#    to a new hash because MiscExpenseDialog source changed)
# 3. Confirm chunk contains string "Your wallet · " (the new WalletBalancePreview header)
```

JS-eval probe to run in the browser console (or via `playwright_evaluate`):

```js
async () => {
  const chunks = performance.getEntriesByType("resource")
    .map(r => r.name)
    .filter(n => /_next\/static\/chunks\/.*\.js/.test(n));
  for (const src of chunks) {
    const txt = await (await fetch(src)).text();
    if (txt.includes("Your wallet ·") && txt.includes("Wallet overdraft")) {
      return { found: true, chunk: src.split("/").pop() };
    }
  }
  return { found: false };
}
```

Expected: `{ found: true, chunk: "<new-hash>.js" }`.

- [ ] **Step 5: Smoke test as admin (regression)**

Logged in as Hari Admin on Srinivasan, open Add Expense.
Expected:
- "WHO IS PAYING?" radios visible (Company Direct + Via Site Engineer)
- "Payment Source" chip row visible (Own/Amma/Client/Trust/Site/Other)
- No "Your wallet · " card visible

- [ ] **Step 6: Smoke test as site engineer**

If Ajith's password is known to the user, have them log in OR use the user's session in production. Expected when Ajith opens Add Expense:
- "WHO IS PAYING?" radios NOT visible
- "Payment Source" chip row NOT visible
- "Your wallet · Padmavathy" card visible at top
- Entering an amount > 10,000 should turn the After-this-expense row red and reveal the "Wallet overdraft" Alert
- Submit button enabled even at overdraft

If you don't have Ajith's login: skip Step 6 and rely on the test suite + chunk-content probe; the test suite already covers the site_engineer code path.

---

## Self-review

**Spec coverage:**

| Spec requirement | Task that implements it |
|---|---|
| Strip manual payer-source from wallet-channel dialogs for site engineers | Task 4 (11 dialogs) + Task 3 (MiscExpenseDialog) |
| `WalletBalancePreview` component (current → amount → after) | Task 1 |
| `isSiteEngineerPayingFromWallet` predicate | Task 2 |
| Negative-balance: red after-balance, overdraft Alert, submit stays enabled | Task 1 (component) + Task 3 (wired into dialog, submit unaffected) |
| No payer-type radio / no checkbox for site engineers in MiscExpenseDialog | Task 3 step 4 (entire Paper hidden) |
| Admin view unchanged (regression check) | Task 3 test suite + Task 5 step 5 |
| Phase 1 does NOT touch DB, allocator, v_all_expenses, /site/my-wallet | Out-of-scope section + no DB tasks in plan |

No gaps.

**Placeholder scan:** No "TBD" / "TODO" / "implement later" in this plan. Tasks 4 step 1–11 use a uniform pattern with the full code snippet shown in Step 1 — repeated mentions reference back to that snippet rather than re-pasting (acceptable per writing-plans guidance since the snippet is in the same file 50 lines up; the engineer reading sequentially will have it in view).

**Type consistency:**
- `WalletBalancePreviewProps` defined in Task 1 step 3; used identically in Task 3 step 4 ✓
- `WalletPayerLockArgs` interface defined in Task 2 step 3; used identically across all 12 dialog modifications ✓
- `userProfile?.role` typed as `string | undefined` matches predicate's `userRole: string | undefined` ✓
- `useEngineerWalletBalance(userId, siteId)` signature matches existing usage in `/site/my-wallet/page.tsx` (verified during plan drafting) ✓

**Scope check:** This plan covers exactly Phase 1 of the spec. Phase 2 (allocations) gets its own plan once Phase 1 ships clean.
