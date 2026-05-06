# Payer Sources Registry — Slice 1 (Foundation)

**Date:** 2026-05-06
**Status:** Design — pending user review
**Scope:** Slice 1 of Phase 2. Slices 2 (settings page + management UI + delete-with-transfer wizard) and 3 (drag reorder + label/icon polish + `getPayerSourceLabel` consolidation + `payer_name` surfacing in `SettlementListRow`) are separate brainstorms.

## Goal

Replace the hardcoded 6-option payer-source list with a per-site registry table. Behavior preserved: every site shows the same 6 options today; the registry just becomes the *source of truth* so Slice 2 can add per-site custom sources without further schema work.

## Non-goals (Slices 2 / 3 backlog)

- Settings page at `/site/settings/payer-sources` (Slice 2).
- Inline "+ Add new source" in the picker (Slice 2).
- Add / edit / delete-with-transfer wizard (Slice 2).
- Drag-to-reorder, color picker, icon picker (Slice 3).
- Consolidate `SettlementsList.tsx`'s local `getPayerSourceLabel` with the canonical helper (Slice 3).
- Surface `payer_name` in `SettlementListRow` so chips show actual custom names (Slice 3).
- Migrate the 4 other consumers of `<PayerSourceSelector>` to pass `siteId` (Slice 2 — when settings page exists, all callers gain registry-driven options at once).

## Why now

Phase 1 restored the 6 canonical options to `MestriSettleDialog`. Padmavathy and Mathur sites need real money pools (Amma Money, Trust Account, Brother's Money, etc.) that vary per-site. Slice 1 is the schema + read-side foundation; Slice 2 is where the user-facing value lands.

## Architecture

**Approach: Eager seed + soft registry.**

- Single `payer_sources` table keyed by `(site_id, key)`.
- Migration seeds 6 built-in rows per existing site; new sites get seeded by trigger.
- `settlement_groups.payer_source` stays a `text` column referencing `(site_id, key)` softly. **No FK, no migration of existing data.**
- `<PayerSourceSelector>` gains an optional `siteId` prop. When provided, options come from the registry; when absent, fall back to the hardcoded 6 (callers migrate one-by-one).
- A small runtime helper `requiresPayerName(source)` replaces the 5 inline guards in `settlementService.ts`. Body stays hardcoded in Slice 1; Slice 2 switches to registry-driven.

Approaches considered and rejected:
- **Built-ins in code, custom-only table** — rejected: splits the picker between code constants and DB rows; renaming a built-in needs a special "override" mechanism; Slice 2's settings page becomes more complex.
- **Hard FK with `payer_source_id`** — rejected: large data migration, dual-column period, every settlement-write codepath touched. Referential-integrity benefit is small for an indie solo project where the registry has tens of rows.

## Schema

```sql
CREATE TABLE payer_sources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  key           text NOT NULL,                              -- written to settlement_groups.payer_source
  label         text NOT NULL,                              -- "Amma Money"
  icon          text,                                       -- MUI icon name (e.g. "Person", "Savings")
  color         text,                                       -- MUI palette key or hex (nullable in Slice 1; Slice 3 polish)
  sort_order    int  NOT NULL DEFAULT 0,
  requires_name boolean NOT NULL DEFAULT false,             -- true for "other_site_money" and "custom"
  is_built_in   boolean NOT NULL DEFAULT false,             -- can't be deleted; key is locked (Slice 2 enforces)
  is_hidden     boolean NOT NULL DEFAULT false,             -- hide from picker; historical refs still render
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, key)
);

CREATE INDEX payer_sources_site_id_visible_idx
  ON payer_sources (site_id, sort_order)
  WHERE is_hidden = false;
```

**Why per-site (not per-company / global):** confirmed in 2026-05-06 brainstorm. Different sites have different real-world money pools; the same user runs multiple sites with different pool structures.

**No CHECK constraint on `settlement_groups.payer_source`** in Slice 1. Adding one would require canonicalizing Srinivasan's 41 `site_cash` rows first — and step 4 of the migration handles those by self-healing into registry rows rather than rewriting them.

### Built-in seed values

| key | label | icon | requires_name | sort_order |
|---|---|---|---|---|
| `own_money` | Own Money | `AccountBalance` | false | 10 |
| `amma_money` | Amma Money | `Person` | false | 20 |
| `client_money` | Client Money | `Business` | false | 30 |
| `trust_account` | Trust Account | `Savings` | false | 40 |
| `other_site_money` | Other Site | `LocationOn` | true | 50 |
| `custom` | Other | `Edit` | true | 60 |

Icon names match MUI icon export names verbatim — `<PayerSourceSelector>` already imports them under those identifiers ([PayerSourceSelector.tsx:15-21](../../../src/components/settlement/PayerSourceSelector.tsx#L15-L21)).

## Migration order

`supabase/migrations/<timestamp>_payer_sources_registry.sql` runs five idempotent steps:

1. `CREATE TABLE payer_sources …` (schema above).
2. `CREATE INDEX payer_sources_site_id_visible_idx …`.
3. **Seed built-ins per existing site:**
   ```sql
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
   ```
4. **Self-healing for non-canonical existing data** (Srinivasan's `site_cash`):
   ```sql
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
   ```
   For Srinivasan, this materializes a `site_cash` row with label `"Site Cash"`. The 41 existing rows now resolve to a registry row and render with a real label everywhere. Defensive against any other latent non-canonical values we haven't found yet.

5. **Trigger for new sites:**
   ```sql
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

   CREATE TRIGGER seed_payer_sources_after_site_insert
     AFTER INSERT ON sites
     FOR EACH ROW EXECUTE FUNCTION seed_payer_sources_for_new_site();
   ```
   Trigger over app-code seeding because it's belt-and-suspenders (covers any insert path including direct SQL).

### RLS

Mirror `settlement_groups`' read policies. Site-engineer reads via `sites.engineer_id`, company admins via the company chain. **Read-only policies in Slice 1** — no app-code writes; the migration owns all data. Slice 2 adds INSERT / UPDATE / DELETE when the settings page lands.

## Service layer

### Hook: `usePayerSources(siteId)`

`src/hooks/queries/usePayerSources.ts`:

```ts
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

export function usePayerSources(siteId: string | undefined) { /* … */ }
```

- Returns rows filtered to `is_hidden = false`, ordered by `sort_order`.
- 5-minute `staleTime` (matches `useSiteSubcontracts`).
- Listens on `BroadcastChannel("payer-sources-changed")` to invalidate (mirrors the pattern at [MestriSettleDialog.tsx:179-189](../../../src/components/payments/MestriSettleDialog.tsx#L179-L189)). Slice 2's settings page will post on this channel after writes.

### Resolver hook: `useResolvePayerSource(siteId, key)`

Same file. Returns `{ label, icon, color, requires_name }` for a given `(siteId, key)`. Falls back to a humanized `key` when no match is found:

```ts
{ label: humanizeKey(key), icon: null, color: null, requires_name: false }
```

`humanizeKey("site_cash") === "Site Cash"`. The fallback only triggers in transient states (e.g., key was deleted on another tab, registry not yet loaded). Slice 1's self-healing migration (step 4) ensures all live data has a matching row, so the fallback should never fire in practice — it's defensive.

### Picker change

`src/components/settlement/PayerSourceSelector.tsx`:

- New optional prop: `siteId?: string`.
- When provided: fetches via `usePayerSources(siteId)`. Renders one `<ToggleButton>` per row. Loading state shows the existing toggle skeleton. Empty state (shouldn't happen post-migration) falls back to the hardcoded 6.
- When omitted: today's behavior — render the hardcoded 6.
- All other props (`value`, `customName`, `onChange`, `onCustomNameChange`, `disabled`, `compact`) unchanged.

### Caller migration

Only `MestriSettleDialog` migrates in Slice 1:

```tsx
<PayerSourceSelector
  siteId={siteId}                    // NEW
  value={payerSource}
  customName={customPayerName}
  onChange={setPayerSource}
  onCustomNameChange={setCustomPayerName}
  compact
/>
```

The other 4 callers (`DateSettlementsEditDialog`, `UnifiedSettlementDialog`, `SettlementFormDialog`, plus the two attendance dialogs that use `PayerSourceSelector` indirectly) keep the hardcoded fallback. They migrate in Slice 2 when the settings page exists — at that point, every caller gaining registry-driven options at once is the simpler change.

## Carryover #9 — `requiresPayerName` helper extraction

Add to `src/types/settlement.types.ts`:

```ts
export function requiresPayerName(source: string): boolean {
  return source === "custom" || source === "other_site_money";
}
```

Replace the 5 inline guards in `src/lib/services/settlementService.ts`:

| Line | Currently |
|---|---|
| 325-326 | `config.payerSource === "custom" \|\| config.payerSource === "other_site_money"` |
| 588-589 | same |
| 1007-1009 | same (Phase 1 fixed this from a missing-branch bug) |
| 1875-1877 | same |
| 2284-2286 | same |

All five become:

```ts
p_payer_name: requiresPayerName(config.payerSource) ? config.customPayerName : null,
```

Pure refactor. Slice 2 swaps the helper body for a registry lookup once user-defined sources can have their own `requires_name` flag.

## Carryover #8 — dropped from Slice 1, deferred indefinitely

The original carryover (narrow `ContractPaymentConfig.payerSource` from `string` to `PayerSource`) is wrong-direction once the registry allows custom keys. The type stays `string`. The runtime guard is `requiresPayerName`. Memory file `payer_sources_registry_phase2.md` updated to reflect this.

## Testing

**Migration:**
- Apply locally with `npm run db:reset`. Verify `SELECT COUNT(*) FROM payer_sources` equals 6 × number of sites (plus any self-healed rows for non-canonical data).
- Verify Srinivasan's site has a `site_cash` row created by step 4.
- Insert a test site via SQL; verify trigger seeded its 6 rows.

**Hook (Vitest unit):**
- `usePayerSources` returns rows ordered by `sort_order`, filtered to `is_hidden = false`.
- `useResolvePayerSource` returns the row for a known key; returns humanized fallback for an unknown key.

**Helper (Vitest unit):**
- `requiresPayerName("custom") === true`.
- `requiresPayerName("other_site_money") === true`.
- `requiresPayerName("own_money") === false`.
- `requiresPayerName("amma_money") === false`.
- `requiresPayerName("totally_made_up") === false`.

**Picker (manual Playwright on local dev):**
- Open `/site/payments` → "Record mesthri payment" dialog.
- Confirm 6 toggle buttons render exactly as before, identical icons and labels.
- Confirm console has no errors related to `usePayerSources` or registry fetch.
- (Skip if dev-login is still broken from Phase 1 — verification happens on production after deploy.)

**Service-layer build/type check:**
- `npm run build` passes with the 5 inlined guards replaced by `requiresPayerName(...)` calls.
- `npm run test` (project's Vitest suite) passes with the new unit tests added.

## Risk and reversibility

- **Migration:** idempotent and additive. `ON CONFLICT DO NOTHING` everywhere. Rollback: `DROP TRIGGER seed_payer_sources_after_site_insert ON sites; DROP FUNCTION seed_payer_sources_for_new_site; DROP TABLE payer_sources;`. No data lost in `settlement_groups` (no schema or value change there).
- **Picker fallback:** the new `siteId` prop is optional and the component falls back to the hardcoded 6 if `usePayerSources` returns empty or errors. Slice 1 keeps both code paths alive intentionally; Slice 2 may remove the fallback once all callers migrate.
- **Helper refactor:** pure equivalence — same boolean expression, just relocated. Build catches any miss.

## Out of scope

Restating for clarity: this slice does not add INSERT/UPDATE/DELETE policies, does not add a settings page, does not add inline quick-add, does not migrate the 4 other `PayerSourceSelector` callers, does not add drag-reorder, does not add a color or icon picker, does not consolidate `SettlementsList.tsx`'s local label helper, does not surface `payer_name` in `SettlementListRow`. All of those are tracked for Slices 2 and 3 in `payer_sources_registry_phase2.md`.
