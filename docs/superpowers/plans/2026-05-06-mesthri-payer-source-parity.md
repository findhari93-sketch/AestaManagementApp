# Mesthri Payer-Source Parity (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mesthri payment dialog's local 4-option "Paid by" list with the canonical 6-option `<PayerSourceSelector>`, and backfill the production rows the broken dialog wrote with non-canonical values.

**Architecture:** Swap one local block for an existing reusable component. Re-type one state variable. Change one default. Run one preview SQL → confirm → one UPDATE.

**Tech Stack:** React + MUI v7 (existing `<PayerSourceSelector>` ToggleButtonGroup), TypeScript (canonical `PayerSource` union), Supabase (production DB via MCP for backfill).

**Spec:** [docs/superpowers/specs/2026-05-06-mesthri-payer-source-parity-design.md](../specs/2026-05-06-mesthri-payer-source-parity-design.md)

---

## Files

- **Modify:** [src/components/payments/MestriSettleDialog.tsx](../../../src/components/payments/MestriSettleDialog.tsx) — single-file UI change.
- **No new files.** No new types. No migration.
- **Production data:** `settlement_groups.payer_source` and (conditionally) `site_engineer_transactions.money_source` rows containing `'company' | 'site_cash' | 'engineer_own'`.

## Testing strategy

This codebase has **no existing unit test** for `MestriSettleDialog` (verified: `Glob src/components/payments/**/*.test.*` returns only AdvancesList, SalarySliceHero, SalaryWaterfallList tests). The component swapped IN — `PayerSourceSelector` — is already battle-tested via `DateSettlementsEditDialog` and the attendance dialogs.

Per the project's CLAUDE.md "After UI Changes — REQUIRED" section, verification is **Playwright + console + visual**, which is what we'll do. We are intentionally **not** adding a Vitest unit test for this dialog because:
1. The change is structural (swap component, retype state, change default), not behavioral logic that warrants a test.
2. Adding the codebase's first MestriSettleDialog test now is scope creep and a precedent that should be set deliberately, not as a side-effect of a parity fix.
3. TypeScript's type narrowing on `PayerSource` is the unit-level safety net here — the build will fail if the default or any handler doesn't match the union.

If you (the executing engineer) disagree, raise it before starting — don't silently add tests.

---

## Task 1: Wire `<PayerSourceSelector>` into MestriSettleDialog

**Files:**
- Modify: `src/components/payments/MestriSettleDialog.tsx` (lines 1–32 imports, 70–75 constant, 124 state, 141 reset, 498–523 JSX)

- [ ] **Step 1: Read the current file to confirm line numbers**

Run: read `src/components/payments/MestriSettleDialog.tsx` end-to-end so you have the full layout in context before editing. The patches below are anchored on exact strings, but a full read first prevents tunnel vision on the wrong block.

- [ ] **Step 2: Add the new imports**

In the import block at the top of the file (currently ends at line 32 with the `PaymentMode` import), add the two new imports below `PaymentMode`:

```tsx
import type {
  ContractPaymentType,
  PaymentChannel,
  PaymentMode,
} from "@/types/payment.types";
import type { PayerSource } from "@/types/settlement.types";
import PayerSourceSelector from "@/components/settlement/PayerSourceSelector";
```

The `PayerSourceSelector` export is the **default** export of that file (verified: `export default function PayerSourceSelector` at `src/components/settlement/PayerSourceSelector.tsx:42`). Use the default-import form shown.

- [ ] **Step 3: Delete the local `PAYER_SOURCES` constant**

Remove the entire block at lines 70–75:

```tsx
const PAYER_SOURCES: { value: string; label: string }[] = [
  { value: "company", label: "Company" },
  { value: "site_cash", label: "Site cash" },
  { value: "engineer_own", label: "Engineer (own funds)" },
  { value: "custom", label: "Custom payer" },
];
```

This constant is the **only** consumer of the bad string values in the codebase (grep confirmed). Removing it makes the rest of the change type-enforced — TypeScript will reject any leftover reference.

- [ ] **Step 4: Re-type the `payerSource` state**

In the form-state block, change:

```tsx
const [payerSource, setPayerSource] = useState<string>("site_cash");
```

to:

```tsx
const [payerSource, setPayerSource] = useState<PayerSource>("own_money");
```

Two changes here: the generic narrows from `string` to `PayerSource`, and the default flips from `"site_cash"` (a value that won't exist after this change) to `"own_money"` (matches every other settlement entry in the app).

- [ ] **Step 5: Update the reset logic**

In the `useEffect` reset block (around line 141), find:

```tsx
setPayerSource("site_cash");
```

and change to:

```tsx
setPayerSource("own_money");
```

- [ ] **Step 6: Replace the "Paid by" JSX**

Find the block that currently renders the "Paid by" `TextField` plus the conditional custom-payer-name `TextField` (lines 498–523):

```tsx
{/* Payer source */}
<TextField
  id="mestri-payer-source"
  name="mestri-payer-source"
  label="Paid by"
  size="small"
  select
  value={payerSource}
  onChange={(e) => setPayerSource(e.target.value)}
>
  {PAYER_SOURCES.map((p) => (
    <MenuItem key={p.value} value={p.value}>
      {p.label}
    </MenuItem>
  ))}
</TextField>

{payerSource === "custom" && (
  <TextField
    id="mestri-custom-payer"
    name="mestri-custom-payer"
    label="Custom payer name"
    size="small"
    value={customPayerName}
    onChange={(e) => setCustomPayerName(e.target.value)}
  />
)}
```

Replace the **entire** block (both the picker and the conditional name field) with:

```tsx
{/* Payer source — canonical 6-option selector with collapse for custom/other-site name */}
<PayerSourceSelector
  value={payerSource}
  customName={customPayerName}
  onChange={setPayerSource}
  onCustomNameChange={setCustomPayerName}
  compact
/>
```

The `compact` prop matches the small dialog real estate. The selector internally renders a `Collapse` for both `custom` AND `other_site_money` and shows an appropriate placeholder + helperText for each — that's why the conditional `TextField` block is no longer needed.

- [ ] **Step 7: Run TypeScript build to verify type safety**

Run: `npm run build`

Expected: build passes. The `setPayerSource` prop on `<PayerSourceSelector>` is typed `(source: PayerSource) => void` — if any wiring is wrong (wrong default, wrong type), the build fails here. **Do not proceed if the build fails.** Read the error and fix.

- [ ] **Step 8: Manual smoke test via Playwright**

Per the CLAUDE.md UI-verification flow:

1. Start dev server: `npm run dev` (background) — wait for it to print "Ready".
2. Use Playwright MCP to navigate to `http://localhost:3000/dev-login` (auto-authenticates).
3. Navigate to `/site/payments` for any test site.
4. Open "Record mesthri payment" dialog.
5. Verify: 6 toggle buttons render with icons (Own, Amma, Client, Trust, Site, Other). Default selected is "Own Money".
6. Click "Other Site". Verify: an inline name field appears below with placeholder "Enter site name".
7. Click "Other" (custom). Verify: the inline field's placeholder changes to "Enter payer name".
8. Click "Amma Money". Verify: inline name field disappears.
9. Read browser console via `playwright_console_logs`. Verify: no errors, no new warnings about hydration/aria/keys.
10. (Optional but encouraged) Record one tiny test settlement (e.g., ₹1) on a non-production site, then check the row in `settlement_groups`: `payer_source` should be the canonical value (`amma_money`, `own_money`, etc.), not the old strings.
11. Close the browser via `playwright_close`.

If any step fails, fix before proceeding.

- [ ] **Step 9: Commit the UI change**

```bash
git add src/components/payments/MestriSettleDialog.tsx
git commit -m "$(cat <<'EOF'
fix(payments): restore canonical 6 payer-source options to mesthri dialog

The dialog had been writing non-canonical values (company/site_cash/
engineer_own) to settlement_groups.payer_source, breaking display in lists
and exports because the rest of the app uses the PayerSource union from
settlement.types.ts. Swap the local 4-option select for the existing
<PayerSourceSelector> toggle-button picker that every other settlement
dialog already uses, retype state to PayerSource, and default to own_money
to match app-wide convention.

Phase 1 of payer-source work — Phase 2 (per-site registry + management UI)
deferred to a separate brainstorm.

Spec: docs/superpowers/specs/2026-05-06-mesthri-payer-source-parity-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Do **not** push yet. Backfill happens before the move-to-prod step.

---

## Task 2: Preview the bad data

This task is a **read-only reconnaissance**. It changes nothing. Goal: surface the count and breakdown to the user so they approve the mapping before we modify production rows.

**Files:** none (production DB read via Supabase MCP).

- [ ] **Step 1: Count bad rows in `settlement_groups`**

Use `mcp__supabase__execute_sql` with:

```sql
SELECT
  s.name AS site_name,
  sg.site_id,
  sg.payer_source AS bad_value,
  COUNT(*) AS row_count,
  SUM(sg.total_amount) AS total_inr,
  MIN(sg.settlement_date) AS earliest,
  MAX(sg.settlement_date) AS latest
FROM settlement_groups sg
LEFT JOIN sites s ON s.id = sg.site_id
WHERE sg.payer_source IN ('company', 'site_cash', 'engineer_own')
GROUP BY s.name, sg.site_id, sg.payer_source
ORDER BY s.name, sg.payer_source;
```

If the schema's `total_amount` column is named differently, fall back to `*` and aggregate manually — but the column name is verified at `settlementService.ts` callsites.

- [ ] **Step 2: Count bad rows in `site_engineer_transactions`**

Same MCP, second query. The engineer-wallet path also writes a `money_source` field that mirrors `payer_source` — if any rows used `payment_channel = 'engineer_wallet'`, they need backfilling too:

```sql
SELECT
  set_table.money_source AS bad_value,
  COUNT(*) AS row_count,
  SUM(set_table.amount) AS total_inr
FROM site_engineer_transactions set_table
WHERE set_table.money_source IN ('company', 'site_cash', 'engineer_own')
GROUP BY set_table.money_source
ORDER BY set_table.money_source;
```

- [ ] **Step 3: Present results to user and request mapping approval**

Show the user the two result sets and the mapping table from the spec:

| Bad value | Maps to | |
|---|---|---|
| `company` | `client_money` | "from the company/client" |
| `site_cash` | `own_money` | engineer's own on-site cash |
| `engineer_own` | `own_money` | direct synonym |

Ask: **"OK to apply this mapping to N rows across both tables?"** Wait for explicit approval before Task 3. **Do not skip this gate.**

If the count is zero everywhere, skip Task 3 entirely and jump to Task 4.

---

## Task 3: Backfill the bad rows

**Run only after the user approves the count + mapping in Task 2.**

**Files:** none (production DB write via Supabase MCP — destructive; one-shot UPDATE).

- [ ] **Step 1: Snapshot the affected IDs (rollback safety)**

Capture the IDs before the UPDATE so you can produce a per-row rollback if anything goes sideways. Use MCP:

```sql
SELECT id, payer_source FROM settlement_groups
WHERE payer_source IN ('company', 'site_cash', 'engineer_own')
ORDER BY id;
```

```sql
SELECT id, money_source FROM site_engineer_transactions
WHERE money_source IN ('company', 'site_cash', 'engineer_own')
ORDER BY id;
```

Save both result sets to scratch (paste them into the conversation for the record). These are the rollback set.

- [ ] **Step 2: UPDATE `settlement_groups`**

Use `mcp__supabase__execute_sql`:

```sql
UPDATE settlement_groups
SET payer_source = CASE payer_source
  WHEN 'company' THEN 'client_money'
  WHEN 'site_cash' THEN 'own_money'
  WHEN 'engineer_own' THEN 'own_money'
END
WHERE payer_source IN ('company', 'site_cash', 'engineer_own')
RETURNING id, payer_source;
```

The `RETURNING` clause echoes the new state for the conversation log.

- [ ] **Step 3: UPDATE `site_engineer_transactions` (only if Step 2 of Task 2 returned rows)**

```sql
UPDATE site_engineer_transactions
SET money_source = CASE money_source
  WHEN 'company' THEN 'client_money'
  WHEN 'site_cash' THEN 'own_money'
  WHEN 'engineer_own' THEN 'own_money'
END
WHERE money_source IN ('company', 'site_cash', 'engineer_own')
RETURNING id, money_source;
```

If the count was zero in Task 2 Step 2, **skip this step entirely** — running an UPDATE with zero matches is harmless but adds noise.

- [ ] **Step 4: Verify zero bad rows remain**

Re-run the two count queries from Task 2. Both should return zero rows.

- [ ] **Step 5: Visual spot-check in the running app**

If the dev server is still running from Task 1, open one previously-broken settlement in the UI (e.g., on Padmavathy's `/site/payments`, click a recent mesthri payment row). Confirm the payer-source label now renders as a real label (e.g., "Own Money" with the bank icon) instead of a raw string like `site_cash`.

If the dev server is stopped, skip this step — the SQL verify in Step 4 is sufficient evidence.

---

## Task 4: Move to prod

**Files:** all changes from Task 1, plus this plan + spec docs.

- [ ] **Step 1: Confirm `cloudflare-proxy/` is untouched**

Run: `git log -1 --name-only`

Expected: only `src/components/payments/MestriSettleDialog.tsx` is listed. **No** files under `cloudflare-proxy/`. Per CLAUDE.md, the Worker only needs redeploying when its directory changes — so we skip the `wrangler deploy` step.

- [ ] **Step 2: Run the production build one final time**

Run: `npm run build`

Expected: passes. (Already verified in Task 1 Step 7, but per CLAUDE.md "Move to Prod" we re-run as the final gate.)

- [ ] **Step 3: Stage and commit any remaining tracked changes**

Per CLAUDE.md: "Move to Prod" requires committing **all** pending changes, not selectively. Run `git status` and review. The expected pending set:

- The plan file: `docs/superpowers/plans/2026-05-06-mesthri-payer-source-parity.md` (this file).

Stage and commit:

```bash
git add docs/superpowers/plans/2026-05-06-mesthri-payer-source-parity.md
git commit -m "$(cat <<'EOF'
docs(plan): mesthri payer-source parity Phase 1 implementation plan

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If `git status` shows other untracked or modified files unrelated to this work (screenshots from the session, dev-server.log, etc.), surface them to the user and ask whether to include them. Per CLAUDE.md the rule is "all pending changes", but the user has the final say on noise files.

- [ ] **Step 4: Push to main**

```bash
git push
```

This triggers the Vercel pipeline. Watch the output for the deploy URL.

- [ ] **Step 5: Save the post-ship memory note**

Update `MEMORY.md` at `C:\Users\Haribabu\.claude\projects\c--Users-Haribabu-Documents-AppsCopilot-AestaManagementApp\memory\` with a new entry summarizing what shipped, the backfill row count, and the open Phase 2. Also create the linked file. Format follows the existing entries in that index.

Suggested name: `payer_source_parity_phase1_2026_05_06.md`. Index line:

```
- [Mesthri payer-source parity Phase 1 shipped 2026-05-06](payer_source_parity_phase1_2026_05_06.md) — restored 6 canonical options + backfilled N rows; Phase 2 (per-site registry) still pending
```

Replace `N` with the actual backfill count from Task 3.

---

## Self-review

Walked the spec → plan check:

- [x] **Spec UI change** — Task 1 covers all 5 sub-changes (imports, delete constant, retype state, reset logic, JSX swap) with exact code.
- [x] **Spec backfill preview** — Task 2 runs the count query verbatim from the spec, plus the parallel `site_engineer_transactions` query the spec mentions in passing.
- [x] **Spec backfill mapping** — Task 3 uses the same CASE expression as the spec, with the rollback-snapshot step the spec mentions under "Reversibility".
- [x] **Spec testing plan** — Task 1 Step 8 covers the Playwright verification (6 toggles, custom collapse, other-site collapse, console clean), Task 3 Step 5 covers the post-backfill visual spot-check.
- [x] **Spec out-of-scope items** — none of Phase 2 (registry, settings page, delete-with-transfer wizard, CHECK constraint) appears in any task. ✓
- [x] **No placeholders** — searched plan for "TBD", "TODO", "fill in", "similar to" — none found.
- [x] **Type consistency** — `PayerSource` import path is `@/types/settlement.types` everywhere. `PayerSourceSelector` import path is `@/components/settlement/PayerSourceSelector` everywhere. State default is `"own_money"` in both Task 1 Step 4 and Step 5.
- [x] **Move-to-prod compliance** — Task 4 follows the CLAUDE.md "Move to Prod" sequence: build, status, commit-all, push. Cloudflare Worker explicitly checked and skipped (no `cloudflare-proxy/` changes).
