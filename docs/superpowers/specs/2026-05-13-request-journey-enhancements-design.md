# Request Journey Enhancements — Design Spec
**Date:** 2026-05-13  
**Status:** Approved  
**Scope:** `/site/material-requests` → Request Journey drawer + persistent pill tag

---

## Context

The Request Journey drawer lets site engineers trace a material request end-to-end (Request → PO → Delivery → Vendor Payment). Currently it shows several fields as raw UUIDs or blanks, hides uploaded photos/documents, and closes when the user navigates away — forcing them to reopen it from scratch every time. This spec covers eight targeted fixes that turn the Journey into a reliable audit trail users can reference while navigating across pages.

---

## Requirements

| # | Area | Fix |
|---|------|-----|
| 1 | Material Request card | Show approver **name** (resolve `approved_by` UUID → `users.name`) |
| 2 | Material Request card | Show estimated cost as **brand avg price** from `price_history` (only when brand was selected on the request; `—` otherwise) |
| 3 | Purchase Order card | Show **brand name, variant name, and product image** (40×40 thumbnail) per item |
| 4 | Purchase Order card | Show **Group PO** or **Own Site** badge (uses `journey.isGroupPO`) |
| 5 | Delivery card | Show **delivery photos + verification photos + invoice/challan** as clickable thumbnails; open in `PhotoLightbox` in-app |
| 6 | Delivery card | Fix **"Open GR"** button to navigate to `/site/delivery-verification?grn={grn_number}` (page already handles this param) |
| 7 | Vendor Payment card | Show **payment screenshot** (`payment_screenshot_url`) as clickable thumbnail opening in `PhotoLightbox` |
| 8 | Global | Journey drawer **persists across navigation** as a collapsible right-edge pill tag |

---

## Architecture

### 8 existing files to update + 3 new files

```
src/
├── contexts/
│   └── JourneyWatchContext/           ← NEW
│       ├── JourneyWatchProvider.tsx   stores { activeJourneyId, isExpanded }
│       └── index.ts                   exports context + useJourneyWatch()
│
├── components/materials/journey/
│   ├── JourneyOverlay.tsx             ← NEW: root-level portal, renders pill or drawer
│   ├── JourneyPillTag.tsx             ← NEW: collapsed pill UI
│   │
│   ├── MaterialRequestJourney.tsx     UPDATE: call activateJourney() on mount
│   ├── JourneyPhaseCard.tsx           UPDATE: add media thumbnails section
│   ├── JourneyPhaseBar.tsx            (unchanged)
│   └── [other phase subcomponents]   (unchanged)
│
└── hooks/queries/
    └── useRequestJourney.ts           UPDATE: join users + brands + price_history avg
```

**Root layout** (`src/app/(main)/layout.tsx`) — add `<JourneyWatchProvider>` and `<JourneyOverlay>`.

---

## Component Designs

### JourneyWatchContext

```typescript
interface JourneyWatchState {
  activeJourneyId: string | null   // e.g. "MR-MLJEY3IC-4A6B9705"
  isExpanded: boolean
}

// Actions
activateJourney(id: string): void  // called when user opens Journey drawer
deactivateJourney(): void          // called when user explicitly dismisses pill (complete only)
setExpanded(val: boolean): void
```

Persists `activeJourneyId` to `sessionStorage` key `"journeyWatch:activeId"` so it survives same-tab navigation. `isExpanded` is NOT persisted (always starts collapsed when on a foreign page).

### JourneyPillTag

```
┌─────┐
│  ✕  │  ← only when overallStatus === "complete"
│─────│
│  ▶  │  ← click = setExpanded(true)
│─────│
│ MR  │  ← type label
│─────│
│  ●  │  ← green (complete) / amber (in-progress) / red (blocked)
└─────┘
```

- Fixed position: `right: 0, top: 50%, transform: translateY(-50%)`
- Width: 40px, rounded left corners
- Hidden on `/site/material-requests` when drawer is already open in page context (no duplicate)
- Z-index: 1300 (above MUI AppBar)

### JourneyOverlay

- Rendered as a MUI `Portal` targeting `document.body`
- **Renders nothing** when the current path is `/site/material-requests` — that page owns its own inline Journey drawer and the overlay would duplicate it
- Shows `<JourneyPillTag>` when `activeJourneyId != null && !isExpanded` (on all other pages)
- Shows full `<MaterialRequestJourney>` in a MUI `Drawer` (right, persistent) when `isExpanded === true`
- Clicking outside the expanded drawer → `setExpanded(false)` (collapses to pill, does NOT deactivate)

---

## Data Layer Changes (`useRequestJourney.ts`)

### 1. Approver name
```sql
-- Add to material_requests select:
approved_by_user:users!approved_by(id, name)
```

### 2. Brand avg price (estimated cost)
```sql
-- Only when request item has brand_id set (no vendor filter — brand-wide avg):
SELECT AVG(price) FROM price_history
WHERE material_id = :materialId AND brand_id = :brandId
```
Column name is `price` (confirmed from useVendorInventory.ts). Fetched via Supabase
`.select('price').eq('material_id', ...).eq('brand_id', ...)` and averaged client-side,
or via a dedicated RPC if preferred.
Show as `~₹{avg}/unit`. If brand_id is null or no history rows → `—`.

### 3. Brand / variant / image in PO items
```sql
-- Add to purchase_order_items select:
brand:material_brands!brand_id(
  id, brand_name, variant_name, image_url
)
```

### 4. Delivery photos
`deliveries` already returns `delivery_photos` (JSONB array) and `verification_photos` (TEXT[]) and `invoice_url` + `challan_url`. Just need to render them — no query change needed.

### 5. Vendor payment screenshot
`material_purchase_expenses` already returns `payment_screenshot_url`. Render only — no query change.

---

## Media Thumbnails Pattern

Reuse the existing `PhotoLightbox` component (shipped with Daily Site Peek, `src/components/common/PhotoLightbox.tsx`).

```
PHOTOS & DOCUMENTS
┌────┐ ┌────┐ ┌────┐ ┌──────────┐
│img │ │img │ │img │ │ 📄 Bill  │
└────┘ └────┘ └────┘ └──────────┘
delivery_photos[]    invoice_url / challan_url
```

- Image thumbnails: 56×56px, `object-fit: cover`, rounded corners
- Document pill (non-image): icon + label, click → open URL in new tab (PDFs) or PhotoLightbox (images)
- Empty state: hide the section entirely (no "No photos" label)

---

## Navigation Fixes

### "Open GR" button
```typescript
// Current (broken — just opens delivery page with no context):
router.push('/site/delivery-verification')

// Fixed:
router.push(`/site/delivery-verification?grn=${delivery.grn_number}`)
```
The delivery-verification page already handles `?grn=` to switch tab and highlight the row.

### "Open PO" button (verify it uses highlight param)
```typescript
router.push(`/site/purchase-orders?highlight=${po.po_number}`)
```

---

## Pill Tag Lifecycle

```
1. User opens Journey drawer on /site/material-requests
   → activateJourney(requestId) called
   → activeJourneyId stored in sessionStorage

2. User clicks "Open GR" → navigates to /site/delivery-verification
   → JourneyOverlay detects foreign page, renders <JourneyPillTag>
   → Drawer is closed (isExpanded = false)

3. User clicks pill tag
   → setExpanded(true)
   → Full drawer slides in from right, overlays page

4. User clicks page content
   → setExpanded(false) → back to pill

5. User finishes review, overallStatus === "complete"
   → ✕ button appears on pill
   → User clicks ✕ → deactivateJourney() → clears sessionStorage → pill disappears

6. User navigates back to /site/material-requests
   → Page's local drawer is open (Journey data re-fetched)
   → JourneyOverlay hides pill (avoid duplicate)
```

---

## Verification Plan

1. **Dev server** — `npm run dev`
2. **Playwright auto-login** — navigate to `http://localhost:3000/dev-login`
3. **Open an approved material request** → verify Journey drawer shows:
   - Approver name (not UUID)
   - Est. cost `~₹X/unit` if brand was set, `—` otherwise
   - Brand + variant + thumbnail in PO card
   - Group PO / Own Site badge
4. **Delivery card** — verify photo thumbnails render, click opens PhotoLightbox
5. **Vendor Payment card** — verify UPI screenshot thumbnail renders + opens in-app
6. **"Open GR"** — click, verify delivery-verification page highlights correct GRN row
7. **Navigate away while drawer is open** — verify pill tag appears on right edge
8. **Click pill** — verify drawer expands over the foreign page
9. **Click away** — verify drawer collapses back to pill
10. **Complete journey** — verify ✕ appears, click dismisses pill permanently (within session)
11. **Console check** — zero errors/warnings
