# Mesthri Settle Dialog — Payer Source Parity (Phase 1)

**Date:** 2026-05-06
**Status:** Design — pending user review
**Scope:** Phase 1 only. Phase 2 (per-site registry + management UI) is a separate brainstorm.

## Problem

The "Record mesthri payment" dialog on `/site/payments` ([MestriSettleDialog.tsx](../../../src/components/payments/MestriSettleDialog.tsx)) shipped with a locally-defined 4-option "Paid by" list:

```ts
const PAYER_SOURCES = [
  { value: "company",       label: "Company" },
  { value: "site_cash",     label: "Site cash" },
  { value: "engineer_own",  label: "Engineer (own funds)" },
  { value: "custom",        label: "Custom payer" },
];
```

Two consequences:

1. **Feature gap.** The user runs Padmavathy and Mathur sites with multiple real money pools (Amma Money, Trust Account, Client Money, Other Site, etc.). The 4-option list cannot represent any of them. The user must currently lie about the source or pick "Custom payer" and re-type the same name every time.

2. **Latent data inconsistency.** The rest of the app — `DateSettlementsEditDialog` on the same page, the attendance settlement dialogs, the settlement-detail rendering — uses the canonical `PayerSource` union from `src/types/settlement.types.ts`:
   ```ts
   type PayerSource = "own_money" | "amma_money" | "client_money"
                    | "other_site_money" | "custom" | "mothers_money"
                    | "trust_account";
   ```
   The new dialog's values (`"company"`, `"site_cash"`, `"engineer_own"`) are not part of this union and have no display mapping in `getPayerSourceLabel` / `getPayerSourceColor`. Any mesthri settlement created since the dialog shipped renders with the raw string in lists/exports.

A canonical reusable picker — `src/components/settlement/PayerSourceSelector.tsx` — already exists and is used by every other settlement entry point. The new dialog simply doesn't use it.

## Goal

Restore feature parity by wiring the new dialog to the existing canonical picker, and one-shot backfill the inconsistent records already in production.

Non-goals (deferred to Phase 2):
- Per-site management UI (add/edit/delete-with-transfer).
- New schema, new tables, new RPCs.
- Quick-add inline in the picker.

## Design

### UI change

In [MestriSettleDialog.tsx](../../../src/components/payments/MestriSettleDialog.tsx):

1. **Delete** the local `PAYER_SOURCES` constant (lines 70–75).
2. **Replace** the "Paid by" `<TextField select>` block plus the conditional custom-payer-name `TextField` (lines 498–523) with a single `<PayerSourceSelector>`:
   ```tsx
   <PayerSourceSelector
     value={payerSource}
     customName={customPayerName}
     onChange={setPayerSource}
     onCustomNameChange={setCustomPayerName}
     compact
   />
   ```
   The selector already handles the inline name field for both `custom` and `other_site_money` via `Collapse`, so the conditional `TextField` block becomes redundant.
3. **Re-type** `payerSource` state from `string` to `PayerSource` (import from `@/types/settlement.types`).
4. **Change default** from `"site_cash"` to `"own_money"`. Two reasons: (a) it matches the convention every other settlement dialog in the app uses, so the picker default is consistent wherever the user records a settlement; (b) `"site_cash"` will not exist in the canonical union after this change.
5. **Update reset logic** in the `useEffect` at line 141 to use the new default.

No other changes to the component. The submit path already forwards `payerSource` and `customPayerName` to `processContractPayment`, which forwards them verbatim to `create_settlement_group(p_payer_source, p_payer_name)`. Both already accept the full `PayerSource` union (proven by `processSettlement` at `settlementService.ts:322` and `:585`).

### Backfill

Records written by the broken dialog have `payer_source` ∈ `{"company", "site_cash", "engineer_own"}`. Mapping to canonical values:

| Bad value | Canonical value | Rationale |
|---|---|---|
| `company` | `client_money` | "Company" in the new dialog meant "money from the company/client" — same semantics as `client_money` everywhere else. |
| `site_cash` | `own_money` | Site cash on these projects is the engineer's own funds operating on-site. |
| `engineer_own` | `own_money` | Direct synonym. |

Execution:

1. Run a count + breakdown query first so the user sees scope:
   ```sql
   SELECT site_id, payer_source, COUNT(*), SUM(total_amount)
   FROM settlement_groups
   WHERE payer_source IN ('company', 'site_cash', 'engineer_own')
   GROUP BY site_id, payer_source
   ORDER BY site_id, payer_source;
   ```
2. Get user approval of the count and the mapping.
3. Run the UPDATE under MCP, scoped only to the three bad values:
   ```sql
   UPDATE settlement_groups
   SET payer_source = CASE payer_source
     WHEN 'company' THEN 'client_money'
     WHEN 'site_cash' THEN 'own_money'
     WHEN 'engineer_own' THEN 'own_money'
   END
   WHERE payer_source IN ('company', 'site_cash', 'engineer_own');
   ```
4. Verify the same SELECT returns zero rows.

If `site_engineer_transactions.money_source` has the same bad values for any rows linked to these groups (the `engineer_wallet` channel path), apply the equivalent mapping. Check during execution.

### Type safety guard

After this change, the dialog's local types match the canonical union. There is currently no DB-level CHECK constraint on `payer_source` (which is how the bad values slipped through in the first place). Adding one is **out of scope for Phase 1** because it'd block Phase 2's user-defined custom values. Phase 2 will handle the constraint story (likely an FK to a registry table).

## Testing

1. `npm run build` passes with no new TypeScript errors.
2. Playwright on `http://localhost:3000/dev-login` → `/site/payments`:
   - Open "Record mesthri payment".
   - Confirm 6 toggle buttons render with icons (Own / Amma / Client / Trust / Site / Other).
   - Pick "Amma Money", record a small test settlement on a test site.
   - Verify in DB: `settlement_groups.payer_source = 'amma_money'`.
   - Pick "Other Site" → name field appears → enter site name → save → verify `payer_name` populated.
   - Console clean, no warnings.
3. Visual check: the row appears in the same page's "By settlement" list with the correct source label and chip color (since it now flows through `getPayerSourceLabel` / `getPayerSourceColor`).
4. After backfill: spot-check one previously-broken row in the UI and confirm it now renders with a real label instead of a raw string.

## Risk

- **Reversibility:** UI change is reverted with a single `git revert`. Backfill is reverted with a SELECT of the affected IDs (capture before the UPDATE) and a per-id restore — but the bad values were never canonical to begin with, so this is unlikely to be needed.
- **No schema change, no migration.** Production deploy is the standard "Move to Prod" flow (build, commit, push). The Cloudflare Worker is unaffected.
- **Other callers of `processContractPayment`:** grep confirms `MestriSettleDialog` is the only caller. No other surface to update.

## Out of scope (Phase 2 backlog)

- Per-site registry of payer sources (table, seed, FK, CHECK).
- Settings page for managing the list under each site context.
- Inline "+ Add new source" in the picker dropdown.
- Delete-with-transfer wizard for retiring sources that have historical settlements.
- Drag-to-reorder, icon picker, color picker.
