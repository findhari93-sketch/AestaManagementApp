# Brand × Variant Matrix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `variant_name` text field on `material_brands` with a proper join table (`material_brand_variant_links`) so brands can be linked/unlinked to material-level grade variants, carry per-combination images, and filter PO brand dropdowns.

**Architecture:** New `material_brand_variant_links(brand_id, variant_id, is_active, image_url)` table. Auto-link logic inserted into `useCreateMaterialBrand` and `useAddVariantToMaterial`. Three UI surfaces updated: `BrandsTab` in the inspect pane (group by brand + variant chips), `BrandVariantEditor` in the edit dialog (chip matrix replaces sub-variant list), and `RequestItemRow` in the PO dialog (brand dropdown filtered by linked brands when ordering a variant).

**Tech Stack:** Next.js 15, Supabase (PostgreSQL + JS client), React Query (TanStack), MUI v7, TypeScript, Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-05-12-brand-variant-matrix-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260513100000_material_brand_variant_links.sql` | Create | Table DDL + RLS + seed links from existing data |
| `src/types/material.types.ts` | Modify | Add `MaterialBrandVariantLink`, `BrandWithVariantLinks` interfaces |
| `src/hooks/queries/useMaterials.ts` | Modify | 4 new hooks; modify `useCreateMaterialBrand` + `useAddVariantToMaterial` |
| `src/components/materials/MaterialInspectPane.tsx` | Modify | BrandsTab: group by brand, show variant chips; fetch brand links |
| `src/components/materials/BrandVariantEditor.tsx` | Modify | Replace sub-variant accordion section with variant chip matrix |
| `src/components/materials/RequestItemRow.tsx` | Modify | Filter `uniqueBrandNames` by variant links when `selected_variant_id` is set |
| `src/components/materials/__tests__/BrandVariantMatrix.test.tsx` | Create | Unit tests for BrandsTab grouping + chip state |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260513100000_material_brand_variant_links.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260513100000_material_brand_variant_links.sql

-- ── 1. Create join table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS material_brand_variant_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id   uuid NOT NULL REFERENCES material_brands(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES materials(id)       ON DELETE CASCADE,
  is_active  boolean NOT NULL DEFAULT true,
  image_url  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_id, variant_id)
);

CREATE INDEX IF NOT EXISTS material_brand_variant_links_brand_id_idx
  ON material_brand_variant_links(brand_id);

CREATE INDEX IF NOT EXISTS material_brand_variant_links_variant_id_idx
  ON material_brand_variant_links(variant_id);

-- ── 2. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE material_brand_variant_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_authenticated_read_mbvl"
  ON material_brand_variant_links FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "allow_authenticated_write_mbvl"
  ON material_brand_variant_links FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ── 3. Seed: generic brand rows → all active child variants ───────────────────
-- For every brand with variant_name IS NULL, link it to every active child
-- variant (materials with parent_id = the brand's material_id).
INSERT INTO material_brand_variant_links (brand_id, variant_id, is_active)
SELECT
  mb.id    AS brand_id,
  cv.id    AS variant_id,
  true     AS is_active
FROM material_brands mb
JOIN materials cv ON cv.parent_id = mb.material_id
WHERE mb.variant_name IS NULL
  AND mb.is_active = true
  AND cv.is_active = true
ON CONFLICT (brand_id, variant_id) DO NOTHING;

-- ── 4. Sub-variant rows: best-effort match, then flag remaining ───────────────
-- Review query (run BEFORE applying migration to production):
--   SELECT mb.id, mb.brand_name, mb.variant_name, m.name AS matched_variant
--   FROM material_brands mb
--   JOIN materials cv ON cv.parent_id = mb.material_id
--      AND lower(cv.name) LIKE '%' || lower(mb.variant_name) || '%'
--   WHERE mb.variant_name IS NOT NULL AND mb.is_active = true;
--
-- Auto-seed where a confident unambiguous match exists:
INSERT INTO material_brand_variant_links (brand_id, variant_id, is_active, image_url)
SELECT DISTINCT ON (mb.id)
  mb.id          AS brand_id,
  cv.id          AS variant_id,
  true           AS is_active,
  mb.image_url   AS image_url
FROM material_brands mb
JOIN materials cv ON cv.parent_id = mb.material_id
  AND lower(cv.name) LIKE '%' || lower(mb.variant_name) || '%'
WHERE mb.variant_name IS NOT NULL
  AND mb.is_active = true
  AND cv.is_active = true
ORDER BY mb.id, cv.created_at
ON CONFLICT (brand_id, variant_id) DO NOTHING;
```

- [ ] **Step 2: Apply locally and verify**

```bash
npm run db:reset
```

Expected: migration runs without error. Then verify in Supabase Studio (local):
```sql
SELECT COUNT(*) FROM material_brand_variant_links;
-- Should be > 0 if any material has both brands and variants
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260513100000_material_brand_variant_links.sql
git commit -m "feat(db): add material_brand_variant_links join table"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `src/types/material.types.ts`

- [ ] **Step 1: Write the failing type test**

Create `src/types/__tests__/materialBrandVariantLink.test.ts`:

```typescript
import { describe, it, expectTypeOf } from "vitest";
import type { MaterialBrandVariantLink, BrandWithVariantLinks } from "../material.types";

describe("MaterialBrandVariantLink types", () => {
  it("MaterialBrandVariantLink has required fields", () => {
    const link: MaterialBrandVariantLink = {
      id: "x",
      brand_id: "b",
      variant_id: "v",
      is_active: true,
      image_url: null,
      created_at: "",
    };
    expectTypeOf(link.is_active).toBeBoolean();
    expectTypeOf(link.image_url).toEqualTypeOf<string | null>();
  });

  it("BrandWithVariantLinks has nested links array", () => {
    const bwv: BrandWithVariantLinks = {
      id: "b",
      brand_name: "Ultratech",
      is_preferred: true,
      quality_rating: 5,
      notes: null,
      image_url: null,
      material_brand_variant_links: [],
    };
    expectTypeOf(bwv.material_brand_variant_links).toBeArray();
  });
});
```

- [ ] **Step 2: Run test — confirm it fails (type not found)**

```bash
npm run test -- src/types/__tests__/materialBrandVariantLink.test.ts
```

Expected: error — `MaterialBrandVariantLink` not exported from `material.types`.

- [ ] **Step 3: Add the interfaces to `src/types/material.types.ts`**

Find the block near the existing `MaterialBrand` interface and add after it:

```typescript
export interface MaterialBrandVariantLink {
  id: string;
  brand_id: string;
  variant_id: string;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
}

export interface BrandWithVariantLinks {
  id: string;
  brand_name: string;
  is_preferred: boolean;
  quality_rating: number | null;
  notes: string | null;
  image_url: string | null;
  material_brand_variant_links: MaterialBrandVariantLink[];
}
```

- [ ] **Step 4: Run test — confirm it passes**

```bash
npm run test -- src/types/__tests__/materialBrandVariantLink.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/material.types.ts src/types/__tests__/materialBrandVariantLink.test.ts
git commit -m "feat(types): add MaterialBrandVariantLink + BrandWithVariantLinks"
```

---

## Task 3: React Query Hooks

**Files:**
- Modify: `src/hooks/queries/useMaterials.ts`

This task adds 4 new hooks and extends 2 existing mutations to auto-create links. All changes are in the same file. Add the new hooks near the existing `useMaterialBrands` block.

- [ ] **Step 1: Add `useBrandVariantLinks` — fetches brands with their links**

Locate `useMaterialBrands` in `src/hooks/queries/useMaterials.ts` and add this hook directly after it:

```typescript
export function useBrandVariantLinks(materialId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["brandVariantLinks", materialId],
    queryFn: async () => {
      if (!materialId) return [] as BrandWithVariantLinks[];

      const { data, error } = await supabase
        .from("material_brands")
        .select(
          `id, brand_name, is_preferred, quality_rating, notes, image_url,
           material_brand_variant_links(id, brand_id, variant_id, is_active, image_url, created_at)`
        )
        .eq("material_id", materialId)
        .eq("is_active", true)
        .order("brand_name");

      if (error) throw error;
      return data as BrandWithVariantLinks[];
    },
    enabled: !!materialId,
  });
}
```

Make sure `BrandWithVariantLinks` is imported at the top of `useMaterials.ts` (add to the import from `"@/types/material.types"`):
```typescript
import type {
  // ...existing imports...
  MaterialBrandVariantLink,
  BrandWithVariantLinks,
} from "@/types/material.types";
```

- [ ] **Step 2: Add `useToggleBrandVariantLink`**

Add after `useBrandVariantLinks`:

```typescript
export function useToggleBrandVariantLink() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      brandId,
      variantId,
      isActive,
      materialId,
    }: {
      brandId: string;
      variantId: string;
      isActive: boolean;
      materialId: string;
    }) => {
      await ensureFreshSession();

      const { data, error } = await supabase
        .from("material_brand_variant_links")
        .update({ is_active: isActive })
        .eq("brand_id", brandId)
        .eq("variant_id", variantId)
        .select()
        .single();

      if (error) throw error;
      return data as MaterialBrandVariantLink;
    },
    onSuccess: (_, { materialId }) => {
      queryClient.invalidateQueries({
        queryKey: ["brandVariantLinks", materialId],
      });
    },
  });
}
```

- [ ] **Step 3: Add `useUpsertBrandVariantLinkImage`**

Add after `useToggleBrandVariantLink`:

```typescript
export function useUpsertBrandVariantLinkImage() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      brandId,
      variantId,
      imageUrl,
      materialId,
    }: {
      brandId: string;
      variantId: string;
      imageUrl: string | null;
      materialId: string;
    }) => {
      await ensureFreshSession();

      const { data, error } = await supabase
        .from("material_brand_variant_links")
        .update({ image_url: imageUrl })
        .eq("brand_id", brandId)
        .eq("variant_id", variantId)
        .select()
        .single();

      if (error) throw error;
      return data as MaterialBrandVariantLink;
    },
    onSuccess: (_, { materialId }) => {
      queryClient.invalidateQueries({
        queryKey: ["brandVariantLinks", materialId],
      });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}
```

- [ ] **Step 4: Add `useBrandVariantLinkedBrandNames`** (used by RequestItemRow)

Add after `useUpsertBrandVariantLinkImage`:

```typescript
/**
 * Returns the brand names linked to a specific variant material.
 * Returns null when variantId is falsy (caller should show all brands).
 * Returns null when no links exist yet (edge case: pre-migration or new variant).
 */
export function useBrandVariantLinkedBrandNames(variantId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["brandVariantLinkedBrandNames", variantId],
    queryFn: async () => {
      if (!variantId) return null;

      const { data, error } = await supabase
        .from("material_brand_variant_links")
        .select("material_brands!brand_id(brand_name)")
        .eq("variant_id", variantId)
        .eq("is_active", true);

      if (error) throw error;
      if (!data || data.length === 0) return null; // no links → show all brands
      return data.map((r: any) => r.material_brands.brand_name as string);
    },
    enabled: !!variantId,
  });
}
```

- [ ] **Step 5: Extend `useCreateMaterialBrand` — auto-link to all variants on brand add**

Locate `useCreateMaterialBrand` in `useMaterials.ts`. Inside `mutationFn`, after the brand is inserted/reactivated (i.e., after `return result as MaterialBrand` would be reached but BEFORE the return — insert the auto-link block):

Find the section that ends with:
```typescript
      const { data: result, error } = await supabase
        .from("material_brands")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result as MaterialBrand;
```

Replace with:
```typescript
      const { data: result, error } = await supabase
        .from("material_brands")
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      // Auto-link new brand to all existing active variants of this material
      const { data: variants } = await supabase
        .from("materials")
        .select("id")
        .eq("parent_id", data.material_id)
        .eq("is_active", true);

      if (variants && variants.length > 0) {
        await supabase
          .from("material_brand_variant_links")
          .insert(
            variants.map((v) => ({
              brand_id: result.id,
              variant_id: v.id,
              is_active: true,
            }))
          )
          .throwOnError();
      }

      return result as MaterialBrand;
```

Also apply the same auto-link block after the **reactivate** path (the `update` branch that reactivates an existing brand). Find:
```typescript
        const { data: result, error } = await supabase
          .from("material_brands")
          .update({
            is_active: true,
            is_preferred: data.is_preferred || false,
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return result as MaterialBrand;
```

Replace with:
```typescript
        const { data: result, error } = await supabase
          .from("material_brands")
          .update({
            is_active: true,
            is_preferred: data.is_preferred || false,
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;

        // Ensure links exist for all active variants (re-activate or create)
        const { data: variants } = await supabase
          .from("materials")
          .select("id")
          .eq("parent_id", data.material_id)
          .eq("is_active", true);

        if (variants && variants.length > 0) {
          await supabase
            .from("material_brand_variant_links")
            .upsert(
              variants.map((v) => ({
                brand_id: result.id,
                variant_id: v.id,
                is_active: true,
              })),
              { onConflict: "brand_id,variant_id" }
            )
            .throwOnError();
        }

        return result as MaterialBrand;
```

- [ ] **Step 6: Extend `useAddVariantToMaterial` — auto-link all existing brands on variant add**

Locate `useAddVariantToMaterial` in `useMaterials.ts`. Inside `mutationFn`, after `return result as Material;` — insert the auto-link block BEFORE the return:

Find:
```typescript
      if (error) throw error;
      return result as Material;
```
(the one at the end of `useAddVariantToMaterial`)

Replace with:
```typescript
      if (error) throw error;

      // Auto-link all existing active brands of the parent material to this new variant
      const { data: brands } = await supabase
        .from("material_brands")
        .select("id")
        .eq("material_id", parentId)
        .eq("is_active", true);

      if (brands && brands.length > 0) {
        await supabase
          .from("material_brand_variant_links")
          .insert(
            brands.map((b) => ({
              brand_id: b.id,
              variant_id: result.id,
              is_active: true,
            }))
          )
          .throwOnError();
      }

      return result as Material;
```

- [ ] **Step 7: Run existing tests to confirm nothing broke**

```bash
npm run test
```

Expected: all pre-existing tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/queries/useMaterials.ts src/types/material.types.ts
git commit -m "feat(hooks): brand-variant link hooks + auto-link on brand/variant add"
```

---

## Task 4: MaterialInspectPane — Brands Tab

**Files:**
- Modify: `src/components/materials/MaterialInspectPane.tsx`
- Create: `src/components/materials/__tests__/BrandVariantMatrix.test.tsx`

- [ ] **Step 1: Write failing tests for the new BrandsTab**

Create `src/components/materials/__tests__/BrandVariantMatrix.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Stub out image avatar — not needed for these tests
vi.mock("@/components/ui/EntityImageAvatar", () => ({
  EntityImageAvatar: ({ name }: { name: string }) => <span>{name}</span>,
}));
import { BrandsTabContent } from "../MaterialInspectPane";
import type { BrandWithVariantLinks } from "@/types/material.types";
import type { Material } from "@/types/material.types";

const BASE_MATERIAL: Partial<Material> = {
  id: "m1",
  name: "Test",
  code: null,
  local_name: null,
  category_id: null,
  parent_id: null,
  description: null,
  unit: "BAG",
  secondary_unit: null,
  conversion_factor: null,
  hsn_code: null,
  gst_rate: null,
  specifications: null,
  weight_per_unit: null,
  weight_unit: null,
  length_per_piece: null,
  length_unit: null,
  rods_per_bundle: null,
  min_order_qty: null,
  reorder_level: null,
  image_url: null,
  is_active: true,
  created_at: "",
  updated_at: "",
  created_by: null,
};

const mockVariants: Material[] = [
  { ...BASE_MATERIAL, id: "v1", name: "43 Grade", parent_id: "m1" } as Material,
  { ...BASE_MATERIAL, id: "v2", name: "53 Grade", parent_id: "m1" } as Material,
];

const mockBrandLinks: BrandWithVariantLinks[] = [
  {
    id: "b1",
    brand_name: "Ultratech",
    is_preferred: true,
    quality_rating: 5,
    notes: null,
    image_url: null,
    material_brand_variant_links: [
      { id: "l1", brand_id: "b1", variant_id: "v1", is_active: true, image_url: null, created_at: "" },
      { id: "l2", brand_id: "b1", variant_id: "v2", is_active: false, image_url: null, created_at: "" },
    ],
  },
  {
    id: "b2",
    brand_name: "ACC",
    is_preferred: false,
    quality_rating: 4,
    notes: null,
    image_url: null,
    material_brand_variant_links: [],
  },
];

describe("BrandsTabContent", () => {
  it("renders one card per brand", () => {
    render(<BrandsTabContent brandLinks={mockBrandLinks} variants={mockVariants} />);
    expect(screen.getAllByText("Ultratech")).toHaveLength(1);
    expect(screen.getAllByText("ACC")).toHaveLength(1);
  });

  it("shows a filled chip for linked variant (is_active=true)", () => {
    render(<BrandsTabContent brandLinks={mockBrandLinks} variants={mockVariants} />);
    const chip = screen.getByTestId("variant-chip-b1-v1");
    expect(chip).toHaveClass("MuiChip-filled");
  });

  it("shows an outlined chip for unlinked variant (is_active=false)", () => {
    render(<BrandsTabContent brandLinks={mockBrandLinks} variants={mockVariants} />);
    const chip = screen.getByTestId("variant-chip-b1-v2");
    expect(chip).toHaveClass("MuiChip-outlined");
  });

  it("shows all variant chips even when brand has no links", () => {
    render(<BrandsTabContent brandLinks={mockBrandLinks} variants={mockVariants} />);
    // ACC has no links — variants should still render as outlined (unlinked/unknown)
    expect(screen.getByTestId("variant-chip-b2-v1")).toBeInTheDocument();
    expect(screen.getByTestId("variant-chip-b2-v2")).toBeInTheDocument();
  });

  it("shows empty state when no brands", () => {
    render(<BrandsTabContent brandLinks={[]} variants={[]} />);
    expect(screen.getByText(/no brands/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npm run test -- src/components/materials/__tests__/BrandVariantMatrix.test.tsx
```

Expected: FAIL — `BrandsTabContent` not found.

- [ ] **Step 3: Export `BrandsTabContent` from MaterialInspectPane and rewrite BrandsTab**

In `src/components/materials/MaterialInspectPane.tsx`:

**3a.** Add `MaterialBrandVariantLink`, `BrandWithVariantLinks` to the type imports at the top.

**3b.** Add these new icon imports (if not already present):
```typescript
import StarBorderIcon from "@mui/icons-material/StarBorder";
```

**3c.** Replace the existing `BrandsTab` function (currently at line ~831) with a new exported `BrandsTabContent` component, and keep `BrandsTab` as a thin wrapper:

```typescript
// Exported for testing
export function BrandsTabContent({
  brandLinks,
  variants,
}: {
  brandLinks: BrandWithVariantLinks[];
  variants: Material[];
}) {
  if (brandLinks.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          No brands recorded for this material.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
      {brandLinks.map((brand) => (
        <Box
          key={brand.id}
          sx={{
            px: 1.5,
            py: 1,
            border: 1,
            borderColor: "divider",
            borderRadius: 1.5,
            display: "flex",
            gap: 1.25,
            alignItems: "flex-start",
          }}
        >
          <EntityImageAvatar
            src={brand.image_url}
            name={brand.brand_name}
            size={36}
            tint={brand.is_preferred ? "primary" : "secondary"}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {brand.is_preferred ? (
                <Tooltip title="Preferred brand" placement="top">
                  <StarIcon sx={{ fontSize: 14, color: "warning.main" }} />
                </Tooltip>
              ) : (
                <StarBorderIcon sx={{ fontSize: 14, color: "text.disabled" }} />
              )}
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                {brand.brand_name}
              </Typography>
            </Box>

            {/* Variant chips */}
            {variants.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.75 }}>
                {variants.map((variant) => {
                  const link = brand.material_brand_variant_links.find(
                    (l) => l.variant_id === variant.id
                  );
                  const isLinked = link?.is_active ?? false;
                  return (
                    <Chip
                      key={variant.id}
                      data-testid={`variant-chip-${brand.id}-${variant.id}`}
                      label={variant.name}
                      size="small"
                      variant={isLinked ? "filled" : "outlined"}
                      color={isLinked ? "primary" : "default"}
                      sx={{ height: 20, fontSize: 11, fontWeight: 600 }}
                    />
                  );
                })}
              </Box>
            )}

            {brand.notes ? (
              <Typography sx={{ fontSize: 11, color: "text.secondary", mt: 0.25 }}>
                {brand.notes}
              </Typography>
            ) : null}
          </Box>

          {brand.quality_rating != null ? (
            <Chip
              size="small"
              label={`${brand.quality_rating}/5`}
              sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
            />
          ) : null}
        </Box>
      ))}
    </Box>
  );
}

// Internal wrapper — kept so the tab switch logic in MaterialInspectPane is unchanged
function BrandsTab({
  brandLinks,
  variants,
}: {
  brandLinks: BrandWithVariantLinks[];
  variants: Material[];
}) {
  return <BrandsTabContent brandLinks={brandLinks} variants={variants} />;
}
```

**3d.** Update `MaterialInspectPane` to fetch brand links and variants, and pass them to `BrandsTab`.

In the `MaterialInspectPane` component (or wherever it calls hooks), add:

```typescript
const { data: brandLinks = [] } = useBrandVariantLinks(material?.id);
const { data: materialVariants = [] } = useMaterialVariants(material?.id);
```

Make sure `useBrandVariantLinks` and `useMaterialVariants` are imported from `@/hooks/queries/useMaterials`.

**3e.** Find the existing `<BrandsTab brands={visibleBrands} />` call and replace with:
```typescript
<BrandsTab brandLinks={brandLinks} variants={materialVariants} />
```

Also remove the `visibleBrands` variable if it was only used for this tab.

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm run test -- src/components/materials/__tests__/BrandVariantMatrix.test.tsx
```

Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/materials/MaterialInspectPane.tsx \
        src/components/materials/__tests__/BrandVariantMatrix.test.tsx
git commit -m "feat(inspect-pane): brands tab shows variant chips grouped by brand"
```

---

## Task 5: BrandVariantEditor — Chip Matrix

**Files:**
- Modify: `src/components/materials/BrandVariantEditor.tsx`

This component currently has a sub-variant accordion inside each brand accordion (manages `variant_name` rows). Replace that section with a variant chip matrix using the new link hooks.

- [ ] **Step 1: Read the current file first**

```bash
# Read BrandVariantEditor.tsx to locate the exact sub-variant JSX section
# before making any edits
```

Open `src/components/materials/BrandVariantEditor.tsx` and find:
- The `BrandVariantEditorProps` interface
- The sub-variant list rendering (looks for variant_name, "Add sub-variant" input)
- The `handleAddVariant` handler

- [ ] **Step 2: Add new props and imports**

**2a.** Add to the import section of `BrandVariantEditor.tsx`:
```typescript
import type { Material, BrandWithVariantLinks, MaterialBrandVariantLink } from "@/types/material.types";
import {
  useToggleBrandVariantLink,
  useUpsertBrandVariantLinkImage,
  useBrandVariantLinks,
  useMaterialVariants,
} from "@/hooks/queries/useMaterials";
```

**2b.** Extend `BrandVariantEditorProps` — add two optional fields:
```typescript
interface BrandVariantEditorProps {
  materialId: string;
  brands: MaterialBrand[];
  categoryName?: string;
  supabase: SupabaseClient; // keep existing
  onAddBrand: (brandName: string) => void; // keep existing
  onUpdateBrand: (id: string, updates: Partial<MaterialBrand>) => void; // keep existing
  onDeleteBrand: (id: string) => void; // keep existing
  disabled?: boolean; // keep existing
}
```

No new props are needed — the component will call the new hooks internally using `materialId`.

- [ ] **Step 3: Replace the sub-variant section inside the brand accordion**

Inside `BrandVariantEditor`, in the `return` JSX, locate the section that renders sub-variants for a brand (look for where it maps over `brandVariants` or uses `variant_name`). This is the section to replace.

Add hook calls at the top of the `BrandVariantEditor` function body:

```typescript
const { data: brandLinks = [] } = useBrandVariantLinks(materialId);
const { data: materialVariants = [] } = useMaterialVariants(materialId);
const toggleLink = useToggleBrandVariantLink();
const upsertImage = useUpsertBrandVariantLinkImage();
```

Add a helper to find a brand's link for a specific variant:
```typescript
function getLinkForVariant(
  links: BrandWithVariantLinks[],
  brandId: string,
  variantId: string
): MaterialBrandVariantLink | undefined {
  return links
    .find((b) => b.id === brandId)
    ?.material_brand_variant_links.find((l) => l.variant_id === variantId);
}
```

Replace the sub-variant accordion section for each brand with:

```typescript
{/* Variant link matrix — only shown when the material has variants */}
{materialVariants.length > 0 && (
  <Box sx={{ mt: 1, pl: 1 }}>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", mb: 0.5 }}
    >
      Variants
    </Typography>
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
      {materialVariants.map((variant) => {
        const link = getLinkForVariant(brandLinks, brand.id, variant.id);
        const isLinked = link?.is_active ?? false;
        return (
          <Chip
            key={variant.id}
            label={variant.name}
            size="small"
            variant={isLinked ? "filled" : "outlined"}
            color={isLinked ? "primary" : "default"}
            onClick={() =>
              toggleLink.mutate({
                brandId: brand.id,
                variantId: variant.id,
                isActive: !isLinked,
                materialId,
              })
            }
            disabled={disabled || toggleLink.isPending}
            sx={{ height: 24, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
          />
        );
      })}
    </Box>

    {/* Per-variant image uploads — shown for linked variants only */}
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
      {materialVariants.map((variant) => {
        const link = getLinkForVariant(brandLinks, brand.id, variant.id);
        if (!link?.is_active) return null;
        return (
          <Tooltip key={variant.id} title={`Image for ${variant.name}`}>
            <IconButton
              size="small"
              component="label"
              disabled={disabled}
              sx={{ fontSize: 10, gap: 0.25, borderRadius: 1, px: 0.5 }}
            >
              <PhotoCameraIcon sx={{ fontSize: 14 }} />
              <Typography sx={{ fontSize: 10 }}>{variant.name}</Typography>
              <input
                hidden
                accept="image/*"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  // Upload via existing image upload utility then call upsertImage
                  // (Follow the same pattern used in the material image upload in this codebase)
                  // After upload resolves to a URL:
                  // upsertImage.mutate({ brandId: brand.id, variantId: variant.id, imageUrl: url, materialId });
                }}
              />
            </IconButton>
          </Tooltip>
        );
      })}
    </Box>
  </Box>
)}
```

Add to BrandVariantEditor imports:
```typescript
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { IconButton, Tooltip } from "@mui/material"; // if not already imported
```

**Note:** The image upload `onChange` handler follows the same pattern used for material image uploads elsewhere in this file. Find the existing image upload handler in BrandVariantEditor (currently used for brand-level images) and replicate the upload-then-call pattern, replacing the final callback with `upsertImage.mutate(...)`.

**Remove** the "Add sub-variant" input and the `handleAddVariant` handler entirely.

- [ ] **Step 4: Start dev server and verify visually**

```bash
npm run dev
```

Navigate via Playwright to `http://localhost:3000/dev-login`, then go to `/company/materials`. Open PPC Cement → Edit Material → scroll to Brands section. Confirm:
- Each brand shows variant chips (33, 43, 53)
- Clicking a chip toggles it between filled/outlined
- No "Add sub-variant" input is visible

Take a screenshot to confirm.

- [ ] **Step 5: Commit**

```bash
git add src/components/materials/BrandVariantEditor.tsx
git commit -m "feat(brand-editor): replace sub-variant list with variant chip matrix"
```

---

## Task 6: RequestItemRow — PO Brand Filtering

**Files:**
- Modify: `src/components/materials/RequestItemRow.tsx`

- [ ] **Step 1: Add the hook import**

At the top of `RequestItemRow.tsx`, add to the existing imports from `useMaterials`:
```typescript
import {
  // ...existing imports from useMaterials...
  useBrandVariantLinkedBrandNames,
} from "@/hooks/queries/useMaterials";
```

- [ ] **Step 2: Add the hook call inside the component**

In `RequestItemRow`, after the `useVendorMaterialBrands` call, add:

```typescript
// When ordering a variant material, filter brands to those linked to that variant.
// item.selected_variant_id is set when user has selected a specific grade/variant.
const { data: linkedBrandNames } = useBrandVariantLinkedBrandNames(
  item.selected_variant_id ?? undefined
);
```

- [ ] **Step 3: Filter uniqueBrandNames**

Find the `uniqueBrandNames` useMemo and add the filter:

```typescript
const uniqueBrandNames = useMemo(() => {
  if (!vendorBrands || vendorBrands.length === 0) return [];
  const brandNames = new Set<string>();
  vendorBrands.forEach((b: any) => {
    if (b.brand_name) brandNames.add(b.brand_name);
  });
  const allNames = Array.from(brandNames).sort();
  // If we have link data for this variant, only show linked brands.
  // null means "no variant selected" or "no links yet" — show all.
  if (!linkedBrandNames) return allNames;
  return allNames.filter((name) => linkedBrandNames.includes(name));
}, [vendorBrands, linkedBrandNames]);
```

- [ ] **Step 4: Start dev server and verify**

Navigate to a PO (or create one) that includes a variant material (e.g., 43 Grade PPC Cement). Confirm the brand dropdown only shows brands linked to 43 Grade. Confirm a material with no variants (e.g., M Sand) shows all its brands unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/materials/RequestItemRow.tsx
git commit -m "feat(po): filter brand dropdown by variant links when ordering a variant material"
```

---

## Task 7: End-to-End Verification

- [ ] **Step 1: Start dev server and auto-login**

Open browser via Playwright, navigate to `http://localhost:3000/dev-login`.

- [ ] **Step 2: Inspect pane — brands tab**

Go to `/company/materials`. Click PPC Cement to open the inspect pane. Click the **Brands** tab. Confirm:
- Chettinad appears ONCE (not "Chettinad" + "Chettinad PPC 43 Grade" separately)
- Variant chips show for 33 Grade / 43 Grade / 53 Grade under each brand
- Chips for grades the brand is linked to are filled/colored; unlinked are outlined/gray

- [ ] **Step 3: Edit dialog — chip matrix**

Click Edit (pencil icon) on PPC Cement. Scroll to the Brands section. Confirm:
- Each brand accordion shows variant chips instead of sub-variant list
- Clicking a chip toggles it (optimistic update visible)
- No "Add sub-variant" text field

- [ ] **Step 4: Auto-link on new brand add**

In the edit dialog, add a new brand (e.g., "Birla"). Save. Reopen the edit dialog. Confirm "Birla" now has chips for all three grade variants pre-linked.

- [ ] **Step 5: PO brand filtering**

Go to a site purchase order or create a new PO. Select "PPC Cement" as the material, then select variant "43 Grade". Confirm only brands linked to 43 Grade appear in the brand dropdown.

- [ ] **Step 6: Run full test suite**

```bash
npm run test
```

Expected: all tests pass (no regressions).

- [ ] **Step 7: Check console for errors**

Use Playwright to check browser console. Confirm no errors or React warnings.

- [ ] **Step 8: Commit verification notes and close**

```bash
git add .
git commit -m "test: brand-variant matrix end-to-end verified"
```
