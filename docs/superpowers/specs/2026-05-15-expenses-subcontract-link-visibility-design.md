# Expenses — Subcontract Link Visibility & Inline Linking

**Date:** 2026-05-15
**Target page:** `src/app/(main)/site/expenses/page.v2.tsx` (All Site Expenses, V2)

---

## Problem

On **All Site Expenses**, an engineer cannot tell at a glance:

1. Which expense rows are tied to a **subcontract** (and which one).
2. Which expense rows are **unlinked** — they should have been tagged to a subcontract but were not.

There is also no way to filter to just the unlinked rows so they can be verified and fixed. Some unlinked rows are legitimate (site-wide tea/snacks, general material) but some are bugs or stale data that need correction.

---

## Goals

- Show subcontract link state inline on every row.
- Make it trivial to filter the table down to **only unlinked** rows.
- Provide an inline action to attach a subcontract to an unlinked row, where the underlying data model supports it safely.

---

## Non-goals

- Reworking how the unified `v_all_expenses` view is composed.
- Building a new bulk-link UI or a "verify all" wizard.
- Inline linking for labor-settlement expense types (Daily Salary, Contract Salary, Excess, etc.) — these route through their dedicated pages via the existing Edit action.

---

## Design

### 1. Combined Trade + Subcontract column

Replace the existing **Trade** column in the All Expenses table with a two-line **Trade / Subcontract** column.

```
[●] Civil                       ← trade name, existing styling
    Plumbing — Block A          ← subcontract name, 11px, text.secondary
```

When unlinked:

```
[●] Civil
    [ Unlinked ]                ← warning-tone chip, clickable when supported
```

When trade is also unresolved (rare; `contract_id` null and no derivable trade):

```
[●] —
    [ Unlinked ]
```

**Data sources** (already in `page.v2.tsx`):
- `contractToTrade: Map<contract_id, {name, id}>` — built from `siteTrades[].contracts`. Already exists.
- **New:** `contractToSubcontract: Map<contract_id, {title}>` — built in the same `useMemo` as `contractToTrade`, walking the same `siteTrades[].contracts[]` array (each contract carries its `title`).

**Dense mode behaviour:** in dense mode the subcontract row is hidden (matches how the description sub-row is hidden today). The Unlinked chip stays visible.

### 2. Trade filter — new "Unlinked" option

The existing **Trade** select gets one new option pinned at the top, between **All trades** and the trade list:

```
All trades
Unlinked
─────────────
Civil
Plumbing
...
Site-wide
```

When picked, `filteredRows` filters to rows where `contract_id === null`. Combinable with the Search, Kind, and Status filters (those filters stay independent).

**URL sync:** existing `?trade=` query param accepts a sentinel value `__unlinked__` in addition to a trade UUID and `__site_wide__`.

### 3. Inline link action

Clicking the **Unlinked** chip opens an MUI `Popper` (anchored to the chip) containing:

- A label `Link to subcontract`
- An `Autocomplete` listing all subcontracts on the site, grouped by trade name
- `Cancel` and `Link` buttons

On **Link**, the row is mutated through the appropriate React Query mutation for that expense type, then the popper closes and the row re-renders with the new subcontract name.

**Supported expense types in v1** (chip is clickable):

| Expense type | Update target | Existing hook |
|---|---|---|
| `Miscellaneous` | `misc_expenses.subcontract_id` | `useUpdateMiscExpense` |
| `Material` | `material_purchases.subcontract_id` *(verify column exists during implementation; if absent, drop Material/Machinery from v1 and keep them read-only)* | `useUpdateMaterialPurchase` (or equivalent) |
| `Machinery` | same table as Material | same as Material |

**Read-only chip in v1** (chip is rendered but not clickable; tooltip: *"Use Edit to link"*):

- `Daily Salary`, `Contract Salary`, `Advance`, `Tea & Snacks`, `Direct Payment`, `Excess`, `Unlinked Salary` — these belong to settlement-group tables with multi-row implications; inline linking is out of scope.

For read-only chips the existing **Edit** action (overflow menu → `RedirectDialog`) still routes to the right page, where the user can edit the link as today.

---

## Implementation outline

| File | Change |
|---|---|
| `src/app/(main)/site/expenses/page.v2.tsx` | Build `contractToSubcontract` map; render new combined column; add `__unlinked__` to Trade select; add URL-sync sentinel; render `Unlinked` chip + Popper; wire mutations |
| `src/components/expenses/UnlinkedLinkPopper.tsx` *(new)* | Self-contained popper with subcontract autocomplete + Link/Cancel buttons. Props: `expense`, `siteTrades`, `anchorEl`, `onClose`, `onLinked` |
| `src/types/expense.types.ts` | No change — `contract_id` is already nullable; no schema work |
| Existing mutation hooks | Reuse; no changes |

No database migrations. No new RPCs.

---

## Behavioural details

- The new column header reads **Trade / Subcontract**.
- Search continues to match across ref + vendor + description only (no subcontract title match for now — out of scope).
- The Group-by `Trade` option still groups by trade (not subcontract). Unlinked rows fall into a `— Unlinked —` group header.
- The sticky footer's Labor / Building subtotal logic does not change.
- Optimistic update: the popper calls the mutation, awaits success, then closes. No optimistic UI in v1 — keep it simple, fast enough for one-off fixes.

---

## Edge cases

- **Subcontract list empty for site:** the popper Autocomplete shows the standard `No options` message and the Link button is disabled.
- **User cancels mid-mutation:** mutation is allowed to complete in the background; the popper closes immediately.
- **Mutation error:** snackbar via existing `useSnackbar()`. Chip stays as `Unlinked`.
- **`contract_id` already set but no matching contract in `siteTrades`** (stale data): treat as Unlinked for display, since trade can't be derived either. Edit (via overflow menu) is the only path to fix.

---

## Verification

1. With **Trade = Unlinked** filter on, the table shows only `contract_id IS NULL` rows; record count + sticky footer total update accordingly.
2. Combine `Unlinked` + Search + Kind = Building — filters compose correctly.
3. Click `Unlinked` chip on a `Miscellaneous` row → popper opens → pick subcontract → Link → row updates inline → if filter is still `Unlinked`, the row disappears from view.
4. Read-only chip on a `Daily Salary` row is not clickable and tooltip reads `Use Edit to link`.
5. URL `?trade=__unlinked__` deep-links into the filtered view.
6. Dense mode hides the second-line subcontract name but keeps the chip.
7. Group-by Trade shows a `— Unlinked —` group header when any unlinked rows are visible.
