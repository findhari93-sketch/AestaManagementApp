# Rental Catalog & Lifecycle — Full Design Spec

**Date:** 2026-05-12  
**Status:** Approved  
**Scope:** Company rental catalog redesign + full site rental lifecycle (request → PO → delivery → usage → returns → settlement)

---

## Context

Aesta manages shuttering equipment rentals (side sheets, props, walers, beam plates) from multiple vendors for each construction site. Currently the `/company/rentals` page and `/site/rentals` page have working database schemas and partial UI, but the catalog has no card-based view, no vendor price comparison, no estimate calculator, and the site workflow lacks delivery verification, proper return tracking, and multi-party settlement.

Shuttering rentals are the hardest to manage: multiple item types are rented together as a set, multiple vendors quote different rates per size, transport and loading/unloading are separate costs paid to different parties from different payment sources, and the daily accruing cost needs to be visible at all times.

**Goal:** A catalog that lets the team compare vendors before committing, an estimate basket that converts to a rental request, and a complete lifecycle from request to settled — simple enough for a site supervisor with no training, accurate enough for an engineer to audit every rupee.

---

## Design Decisions Made

| Decision | Choice | Reason |
|----------|--------|--------|
| Catalog structure | Both views: By Item + By Vendor (toggle) | Item view for comparison/estimation; Vendor view for managing rates |
| Item sizes | One card per type, sizes as selectable variants inside | Keeps catalog tidy; Side Sheet is one card with 6×1½, 4×1½ etc. as chips |
| Estimate calculator | Multi-item basket → converts to rental request | Shuttering requires props + sheets + walers together; per-item estimate is impractical |
| Settlement parties | 3 separate settlements (vendor, transport, loading/unloading) | Each party paid separately from different sources (company/site cash/engineer wallet); loading is skippable |
| Active order cost display | Progress bar style (Option A) with Extend Date button inline | Most readable daily check; shows spent + remaining + bar + daily burn rate |

---

## Phase 1 — Rental Catalog Redesign (`/company/rentals`)

### Page Layout

Single page with:
- **Toggle** at top: "By Item" | "By Vendor"
- **Search bar** (searches item name, local name, code, size)
- **Category filter chips**: All · Shuttering · Equipment · Scaffolding · Other
- **Amber "Estimate Basket" button** in top bar showing item count (e.g. "🧮 Estimate Basket · 3 items")
- **"+ Add Item"** button (admin/engineer role only)
- **Card grid** (main content area)
- **Inspect pane** (right side, 360px, opens on card click)

### By Item View — Card Design

Each card represents one item type (e.g. "Side Sheet"). A card shows:
- Item name (bold)
- Category + unit (small, muted)
- Size variant chips (e.g. `6×1½` `4×1½` `5×1½` — up to 3 shown, "+N" if more)
- Vendor count + lowest daily rate ("3 vendors · from ₹7/day")
- **"+ Estimate"** amber button (bottom right of card)

Clicking a card opens the inspect pane. Clicking "+ Estimate" adds the item to the estimate basket immediately (opens basket drawer if first item added).

### By Item View — Inspect Pane

Tabs: **Vendors** | Overview | Price History | Notes

**Vendors tab (default):**
- Size selector row at top (chips for each size variant; selecting a size filters the vendor rates below)
- Vendor list — each vendor shows:
  - Name + "CHEAPEST" badge on the lowest-rate vendor for the selected size
  - Daily rate for selected size
  - Transport cost note (e.g. "₹2,000 outward" or "included")
- **Qty + Days input** at bottom of pane (inline, not a dialog)
- Live cost preview: "₹ X total" updates as user types
- **"+ Add to Estimate Basket"** button

**Overview tab:** Item description, specifications (size options, weight, material), `rental_type`, `source_type`

**Price History tab:** Sparkline per vendor showing rate changes over time (reuses pattern from `VendorInspectPane`)

### By Vendor View — Card Design

Each card represents one rental vendor (filtered to `vendor_type = 'rental_store'`). Card shows:
- Vendor name + location
- Item count ("12 items")
- Primary category specialisation ("Shuttering specialist")
- Active/inactive badge

Clicking a card opens the vendor inspect pane (reuses `VendorInspectPane` with rental-specific inventory tab).

### Estimate Basket (Drawer)

Opened via the amber button in the top bar. A right-side drawer (not full page) showing:
- List of added items: name, selected size, qty, days (all editable inline)
- Per-item cost from cheapest available vendor
- **Vendor comparison section**: for the full basket, total cost if all items taken from Vendor A vs Vendor B (handles mixed-vendor scenarios)
- Cheapest single-vendor total highlighted in green
- **"Convert to Rental Request"** primary button at bottom
- **"Clear Basket"** secondary action

The basket persists in `localStorage` until cleared or converted.

---

## Phase 2 — Request → PO Workflow (`/site/rentals`)

### Full Status Lifecycle

```
Draft → Pending Approval → PO Confirmed → Active → Partially Returned → Fully Returned → Settled
```

### Rental Request Creation (Supervisor)

Accessible from:
1. Estimate basket → "Convert to Rental Request" (items pre-filled)
2. `/site/rentals` → "+ New Request" button (blank form)

Form fields:
- Items list (add/remove rows): item, size variant, quantity
- Start date (date picker)
- Estimated duration in days (number input) → calculates expected return date
- Notes (optional free text, e.g. "for 2nd floor slab centering")

On submit: status = `pending`. Supervisor cannot create a PO directly.

### PO Creation (Engineer, from approved request)

Engineer sees pending requests on `/site/rentals` and taps "Create PO" on an approved request.

PO form pre-fills items from request. Engineer adds:
- **Vendor selection** (autocomplete from `rental_store` vendors; shows estimated cost from basket if available, highlights cheapest)
- **Transport — Outward**: who handles (Vendor / Company / Our Laborer), estimated cost
- **Transport — Return**: who handles, estimated cost (can differ from outward)
- **Advance payment**: amount, payment mode, payer source (uses payer_sources registry)
- **Security deposit** (optional): amount, return date
- **Vendor bill / quotation photo** (optional at PO stage, required at settlement)

On confirm: status = `confirmed`. A `rental_order` row is created. Advance recorded in `rental_advances`.

Engineer can also create a PO directly without a prior request (for urgent rentals) — the request is auto-created in "approved" state.

---

## Phase 3 — Delivery Verification, Active Tracking, Returns, Date Extension

### Delivery Verification (Supervisor)

Triggered when order status = `confirmed`. Supervisor sees a "Verify Delivery" card on `/site/rentals`.

Verification form:
- Qty received per item (can be less than ordered — system records the short delivery, adjusts outstanding qty)
- Condition on arrival (Good / Minor damage)
- Actual transport cost (may differ from PO estimate)
- **Vendor slip photo** (required)
- Date of delivery (defaults to today)

On confirm: status = `active`. `rental_order.start_date` set to delivery date.

### Active Order Card

Visible on `/site/rentals` order list. Each active card prominently shows the **Daily Cost Tracker**:

```
┌─────────────────────────────────────────────────────┐
│ RNT-260520-001  A.M.M. Kalambaks     Active · Day 18 │
├──────────────┬──────────────────┬────────────────────┤
│ SPENT TODAY  │ EXPECTED REMAINING│  EXPECTED TOTAL    │
│  ₹14,220     │    ₹5,530         │    ₹19,750         │
│  18 days     │    7 days left    │    25 days         │
├─────────────────────────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░│ 72%              │
│ ₹14,220 spent                  ₹5,530 remaining     │
│ Daily burn: ₹790/day                                 │
├──────────────────────────────────┬──────────────────┤
│        Return Items              │   Extend Date     │
└──────────────────────────────────┴──────────────────┘
```

**Spent to date** calculation:
- For each item still outstanding: `qty_outstanding × daily_rate × days_elapsed`
- For each returned item: `qty_returned × daily_rate × days_used_before_return`
- Sum of all items

**Expected remaining** calculation:
- For each item still outstanding: `qty_outstanding × daily_rate × days_until_expected_return`
- Updates immediately when date is extended or items are returned

### Partial Returns

Accessible via "Return Items" button on the active card. Flow:
- Select item(s) to return
- Enter qty returning (validates ≤ qty outstanding)
- Select condition: Good / Damaged / Lost
- If Damaged or Lost: enter damage description and cost
- Return date (defaults to today)
- Optional return receipt photo
- On confirm: `rental_return` row created; `rental_order_item.quantity_returned` incremented; cost meter recalculates

If all items returned: status → `fully_returned`.

### Date Extension

Accessible via "Extend Date" button on the active card. Requires:
- New expected return date (must be after current expected date)
- Mandatory reason text (e.g. "Slab curing delayed by rain")

On confirm: `rental_order.expected_return_date` updated; "Expected Remaining" cost recalculates immediately.

### Re-Order (Order More Mid-Rental)

"+ Order More from Same Vendor" on the active card. Creates a new linked `rental_order` with `parent_order_id` reference. Both orders visible together in the site orders list, can be settled independently or linked.

---

## Phase 4 — 3-Party Settlement

Accessible once order status = `fully_returned`.

### Settlement Screen Layout

**Header:** Final cost summary bar showing Rental + Transport + Loading/Unloading + Grand Total.

**Party 1 — Equipment Vendor** (always required):
- Rental amount (computed from actual days + returned quantities)
- Minus: total advances already paid
- Balance due
- Payer source (company account / site cash / engineer wallet)
- Payment mode
- Vendor bill photo (required)
- "Settle ₹X" button

**Party 2 — Transport** (optional, shown only if transport cost > 0):
- Total transport cost (outward + return actual costs)
- Payer source
- Optional trip receipt photo
- "Settle ₹X" button
- "Skip — vendor included" option

**Party 3 — Loading / Unloading** (optional):
- Loading/unloading cost
- Payer source
- "Settle ₹X" button
- **"Skip — our laborers"** option (most common — no payment needed when site laborers do it as part of their attendance)

### Settlement Completion

Order status → `completed` once all non-skipped parties are marked settled. The settlement reference (`RSET-YYMMDD-###`) is generated on first party settlement and shared across all 3 parties of the same order.

Each settlement payment is recorded in `rental_settlements`. The existing UNIQUE constraint on `rental_order_id` must be changed to UNIQUE on `(rental_order_id, party_type)`. A new `party_type` enum column (`vendor | transport | loading_unloading`) is added. This allows up to 3 settlement rows per order. Each row uses the payer_sources registry for source tracking and links to `engineer_transactions` or `settlement_groups` as appropriate.

---

## Data Model Notes (existing schema, no new tables needed for Phases 2–4)

| Table | Role |
|-------|------|
| `rental_items` | Master catalog items (name, category, specs, sizes via JSONB) |
| `rental_item_categories` | 4 categories: Shuttering, Equipment, Scaffolding, Other |
| `rental_store_inventory` | Vendor × item pricing (daily_rate, transport_cost, loading_cost, unloading_cost) |
| `rental_orders` | Order header with status, dates, transport details |
| `rental_order_items` | Line items with qty, rate, qty_returned (computed column) |
| `rental_returns` | Each return event with condition and damage cost |
| `rental_advances` | Advance payments recorded at PO creation |
| `rental_settlements` | Final settlement per order (vendor party) |
| `rental_price_history` | Rate change audit trail per vendor × item |

**Schema changes required across phases:**

**Phase 1:**
- Add `rental_item_sizes` table: `id`, `rental_item_id` (FK), `size_label` (e.g. "6×1½"), `display_order`, `is_active`. This is the canonical size list per item type.
- Add `size_rates` JSONB column to `rental_store_inventory` (e.g. `{ "6×1½": 8, "4×1½": 7 }`). Stores per-size daily rate per vendor. The existing `daily_rate` column becomes the default/fallback for items with no size variants.

**Phase 3:**
- Add `parent_order_id` UUID column (nullable FK to `rental_orders.id`) to `rental_orders`. Used by the "Order More" re-order flow to link a child order back to its parent.

**Phase 4:**
- Add `party_type` enum column (`vendor | transport | loading_unloading`) to `rental_settlements`.
- Change `rental_settlements` UNIQUE constraint from `(rental_order_id)` to `(rental_order_id, party_type)`.
- This allows up to 3 settlement rows per order, one per party.

---

## Implementation Phases

| Phase | Pages affected | New components | Estimated complexity |
|-------|---------------|----------------|----------------------|
| 1 | `/company/rentals` | RentalItemCard, RentalItemInspectPane, RentalVendorInspectPane, EstimateBasketDrawer | High (all new UI) |
| 2 | `/site/rentals` | RentalRequestForm, RentalPOForm, RentalOrderCard | Medium (schema exists) |
| 3 | `/site/rentals` | DeliveryVerificationForm, ActiveOrderCostMeter, ReturnItemsForm, DateExtensionDialog | Medium |
| 4 | `/site/rentals/[id]` | SettlementScreen, PartySettlementCard | Medium |

Implement in order. Phase 1 is a prerequisite for Phase 2 (estimate basket feeds request form).

---

## Verification

- **Phase 1:** Open `/company/rentals`, toggle between By Item and By Vendor, click a Side Sheet card, select 6×1½ size, see vendor rates, enter qty=50 days=25, verify cost preview updates, add to basket, add Prop, open basket drawer, verify total per vendor, click "Convert to Rental Request"
- **Phase 2:** Complete the request form, submit, log in as engineer, approve request, create PO with vendor + transport + advance, verify `rental_order` row created
- **Phase 3:** Verify delivery, confirm active status, check cost meter shows correct spent/remaining, record partial return for 20 sheets, verify cost recalculates, extend date by 7 days, verify remaining cost updates
- **Phase 4:** Return all items, open settlement screen, settle vendor party (advance deducted), skip loading (our laborers), settle transport, confirm order status = completed
