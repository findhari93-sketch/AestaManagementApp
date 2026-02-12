# Group Purchase & Inter-Site Settlement - Comprehensive Plan

## Executive Summary

This document outlines the issues with the current group purchase flow and provides a comprehensive plan to fix them, along with UX recommendations inspired by best practices from Google, Microsoft, and Amazon.

---

## Part 1: Issues Identified

### Issue 1: All Site Expenses Shows Group Purchases Incorrectly (CRITICAL)

**Current Behavior:**
- The `v_all_expenses` view shows ALL material purchases where `is_paid = true OR settlement_date IS NOT NULL`
- This includes `purchase_type = 'group_stock'` purchases
- Result: Full group purchase amount (e.g., ₹10,000) shows in paying site's expenses

**Expected Behavior:**
- Group purchases should NOT appear directly in All Site Expenses
- Only the **settled allocation per site** should appear
- Example: If Site A buys ₹10,000 of cement for group, and Site A uses 40%, Site B uses 60%:
  - Site A's expenses: ₹4,000 (self-use portion after settlement)
  - Site B's expenses: ₹6,000 (from inter-site settlement)

**Root Cause:**
- `v_all_expenses` view at line 502 does not filter out `purchase_type = 'group_stock'`

**Fix Required:**
```sql
-- Add filter to exclude raw group_stock purchases
WHERE (
    (mpe.is_paid = true) OR (mpe.settlement_date IS NOT NULL)
) AND (
    mpe.purchase_type != 'group_stock' OR mpe.settlement_reference IS NOT NULL
)
```

---

### Issue 2: Inventory Page Missing Group Purchases Tab

**Current Tabs:**
1. All Stock - All items in `stock_inventory`
2. Site Stock - Items without `batch_code` (own site purchases)
3. Shared Stock - Items with `batch_code` (allocated from group)
4. Completed - Items with `current_qty = 0`

**Missing:**
- **Group Purchases** tab showing uncompleted batches from `group_stock_inventory`
- This is where group purchases live BEFORE allocation to sites

**User Confusion:**
- User creates group purchase → Can't see it in Site Stock → Thinks it's lost
- Group stock lives in `group_stock_inventory` table, not `stock_inventory`

**Fix Required:**
- Add "Group Purchases" tab that queries `group_stock_inventory`
- Show batches with status: `in_stock`, `partial_used`, `recorded`

---

### Issue 3: Amount Decimal Places Not Formatted

**Current Behavior:**
- Inventory page shows values like `₹3642.05123456789`
- Should show `₹3,642.05`

**Affected Locations:**
- [inventory/page.tsx:347](src/app/(main)/site/inventory/page.tsx#L347) - Value column
- [inventory/page.tsx:707](src/app/(main)/site/inventory/page.tsx#L707) - Stock value summary

**Fix Required:**
- Format all currency values with `.toFixed(2)` or `.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`

---

### Issue 4: Material Expenses Page Missing Group Settlement Portion

**Current Categorization:**
1. Own Site - Direct purchases
2. From Group - Allocated from inter-site settlement
3. Self Use - Your portion of group purchases you paid for

**Issue:**
- "Self Use" portion only shows AFTER batch is completed
- Users don't see their self-use portion until full settlement

---

## Part 2: Current Flow Analysis

### How Group Purchases Currently Work

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        GROUP PURCHASE FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. CREATE GROUP PO                                                     │
│     └─► Site A creates PO with purchase_type = "group_stock"            │
│     └─► PO marked with site_group_id                                    │
│                                                                         │
│  2. DELIVERY VERIFICATION                                               │
│     └─► Delivery received at Site A                                     │
│     └─► Creates material_purchase_expense with ref_code (batch)         │
│     └─► Creates group_stock_inventory entry                             │
│                                                                         │
│  3. RECORD USAGE (Inter-Site Settlement Page)                           │
│     └─► Site A records usage: 40 bags for Site A                        │
│     └─► Site A records usage: 60 bags for Site B                        │
│     └─► Creates batch_usage_records entries                             │
│                                                                         │
│  4. PROCESS SETTLEMENT                                                  │
│     └─► For each debtor site (Site B):                                  │
│         └─► Create inter_site_material_settlements                      │
│         └─► Create material_purchase_expense for debtor                 │
│         └─► Mark usage records as "settled"                             │
│                                                                         │
│  5. COMPLETE BATCH (When stock depleted)                                │
│     └─► Batch status → "completed"                                      │
│     └─► Self-use portion attributed to paying site                      │
│     └─► Now appears in Material Expenses                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Tables Involved

| Table | Purpose |
|-------|---------|
| `material_purchase_expenses` | Stores both own_site and group_stock purchases |
| `material_purchase_expense_items` | Line items for purchases |
| `group_stock_inventory` | Group-level stock tracking |
| `stock_inventory` | Site-level stock (includes allocated group stock with batch_code) |
| `batch_usage_records` | Tracks who used what from each batch |
| `inter_site_material_settlements` | Settlement records between sites |
| `settlement_expense_allocations` | Links settlements to expenses |

---

## Part 3: Solution Plan

### Phase 1: Fix All Site Expenses View (Priority: HIGH)

**Migration: `20260205000000_fix_group_stock_in_all_expenses.sql`**

```sql
-- Drop and recreate v_all_expenses to exclude raw group_stock purchases
-- Group stock purchases should only appear after:
-- 1. The paying site's self-use portion is settled (settlement_reference = 'SELF-USE')
-- 2. Other sites' portions are settled via inter-site settlement

DROP VIEW IF EXISTS "public"."v_all_expenses";

CREATE VIEW "public"."v_all_expenses" AS
-- ... (existing unions) ...

UNION ALL

-- Settled Material Purchases
-- EXCLUDES raw group_stock purchases (those go through inter-site settlement)
SELECT
    "mpe"."id",
    "mpe"."site_id",
    COALESCE("mpe"."settlement_date", "mpe"."purchase_date") AS "date",
    -- ... other columns ...
FROM "public"."material_purchase_expenses" "mpe"
WHERE (
    ("mpe"."is_paid" = true) OR ("mpe"."settlement_date" IS NOT NULL)
) AND (
    -- Exclude raw group_stock purchases
    -- Only include group_stock if it has settlement_reference (meaning settled)
    "mpe"."purchase_type" != 'group_stock'
    OR "mpe"."settlement_reference" IS NOT NULL
);
```

---

### Phase 2: Add Group Purchases Tab to Inventory (Priority: HIGH)

**Changes Required:**

1. **New Hook**: Add `useGroupStockInventory(siteGroupId)` in `useStockInventory.ts`

```typescript
export const useGroupStockInventory = (siteGroupId: string | undefined) => {
  return useQuery({
    queryKey: ['group-stock-inventory', siteGroupId],
    queryFn: async () => {
      if (!siteGroupId) return [];
      const { data, error } = await supabase
        .from('group_stock_inventory')
        .select(`
          *,
          material:materials(id, name, code, unit),
          brand:material_brands(id, brand_name)
        `)
        .eq('site_group_id', siteGroupId)
        .gt('current_qty', 0)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!siteGroupId,
  });
};
```

2. **UI Update**: Add tab in `inventory/page.tsx`

```tsx
// Add new tab type
type StockTabType = "all" | "site" | "shared" | "group" | "completed";

// Add Group Purchases tab
<Tab
  label={`Group Purchases${groupStock.length > 0 ? ` (${groupStock.length})` : ""}`}
  value="group"
  icon={<GroupsIcon />}
  iconPosition="start"
/>
```

3. **Group Stock Table**: New table showing batches from `group_stock_inventory`
   - Material name
   - Batch code
   - Current quantity / Original quantity
   - Paid by (site name)
   - Status (In Stock / Partial Used)
   - Actions: Record Usage, View Details

---

### Phase 3: Fix Decimal Place Formatting (Priority: MEDIUM)

**Utility Function:**

```typescript
// In src/lib/formatters.ts
export const formatCurrencyValue = (value: number): string => {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
```

**Apply to:**
- [inventory/page.tsx:331](src/app/(main)/site/inventory/page.tsx#L331) - Avg Cost
- [inventory/page.tsx:347](src/app/(main)/site/inventory/page.tsx#L347) - Value column
- [inventory/page.tsx:707](src/app/(main)/site/inventory/page.tsx#L707) - Total stock value
- All other currency displays in inventory

---

### Phase 4: Improve Material Expenses Flow (Priority: MEDIUM)

**Current Gap:**
- Self-use portion only shows after batch completion
- Users can't see their spending until end

**Solution: Progressive Self-Use Attribution**

Add a new query to show "In-Progress Self Use":

```typescript
export const useInProgressSelfUse = (siteId: string | undefined) => {
  return useQuery({
    queryKey: ['in-progress-self-use', siteId],
    queryFn: async () => {
      // Query batch_usage_records where:
      // - usage_site_id = siteId (this site used it)
      // - settlement_status = 'self_use' (marked as self-use)
      // - The batch is not yet completed
      // ...
    },
  });
};
```

**UI Enhancement:**
- Add "In Progress" section in Material Expenses
- Show self-use amounts as "Pending Attribution"
- Clear visual distinction from settled expenses

---

## Part 4: UX Recommendations

### Principle 1: Progressive Disclosure (Google)

**Current Issue:** Users must navigate multiple pages to understand group purchase status.

**Recommendation:**
- Add status indicators on Purchase Order cards showing group allocation progress
- Use expandable cards (like Google Drive) to show usage breakdown inline

```
┌──────────────────────────────────────────────────────────────┐
│ 📦 PO-2602-001 - Group Stock                      ▼ Expand  │
├──────────────────────────────────────────────────────────────┤
│ Cement - 100 bags @ ₹350/bag = ₹35,000                      │
│                                                              │
│ Usage Progress: ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 70%     │
│                                                              │
│ ┌─────────────┬──────────┬──────────┬──────────┐            │
│ │ Site        │ Used     │ Amount   │ Status   │            │
│ ├─────────────┼──────────┼──────────┼──────────┤            │
│ │ Site A (You)│ 40 bags  │ ₹14,000  │ Self-Use │            │
│ │ Site B      │ 30 bags  │ ₹10,500  │ Settled  │            │
│ │ Remaining   │ 30 bags  │ ₹10,500  │ -        │            │
│ └─────────────┴──────────┴──────────┴──────────┘            │
└──────────────────────────────────────────────────────────────┘
```

### Principle 2: Contextual Navigation (Microsoft)

**Current Issue:** Jumping between Inventory → Inter-Site Settlement → Material Expenses

**Recommendation:**
- Add quick-action buttons on batch cards
- Context menu with relevant actions

```
Right-click batch → [Record Usage] [View in Settlement] [See Expenses]
```

### Principle 3: Visual Clarity (Amazon)

**Current Issue:** Hard to distinguish stock types at a glance

**Recommendation:**
- Color-coded stock type badges
- Visual hierarchy for amounts

```tsx
// Stock Type Visual System
const STOCK_TYPE_COLORS = {
  site: { bg: '#E3F2FD', text: '#1565C0', icon: '🏠' },      // Blue
  shared: { bg: '#E8F5E9', text: '#2E7D32', icon: '👥' },     // Green
  group: { bg: '#FFF3E0', text: '#E65100', icon: '📦' },      // Orange
  completed: { bg: '#F5F5F5', text: '#616161', icon: '✓' },   // Gray
};
```

### Principle 4: Clear Financial Flow (Accounting Best Practice)

**Add Visual Money Flow Diagram:**

```
┌─────────────────────────────────────────────────────────────────┐
│               MATERIAL EXPENSE ATTRIBUTION FLOW                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ₹35,000 Paid by Site A                                        │
│      │                                                          │
│      ▼                                                          │
│  ┌───────────────────────────────────────────────────┐         │
│  │              GROUP STOCK BATCH                     │         │
│  │              (100 bags cement)                     │         │
│  └───────────────────────────────────────────────────┘         │
│      │                    │                    │                │
│      ▼                    ▼                    ▼                │
│  ┌─────────┐        ┌─────────┐         ┌──────────┐           │
│  │ Site A  │        │ Site B  │         │ Remaining │           │
│  │ 40 bags │        │ 30 bags │         │  30 bags  │           │
│  │ ₹14,000 │        │ ₹10,500 │         │  ₹10,500  │           │
│  │Self-Use │        │ Settled │         │  Pending  │           │
│  └─────────┘        └─────────┘         └──────────┘           │
│      │                    │                                     │
│      │                    │                                     │
│      ▼                    ▼                                     │
│  ┌─────────────────────────────────────────────────┐           │
│  │           MATERIAL EXPENSES                      │           │
│  │  Site A: ₹14,000 (Self-Use)                     │           │
│  │  Site B: ₹10,500 (From Settlement)              │           │
│  └─────────────────────────────────────────────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Implementation Checklist

### Database Changes

- [ ] Fix `v_all_expenses` view to exclude raw group_stock purchases
- [ ] Add index on `material_purchase_expenses.purchase_type`
- [ ] Add index on `material_purchase_expenses.settlement_reference`

### Frontend Changes

**Inventory Page:**
- [ ] Add Group Purchases tab
- [ ] Create `useGroupStockInventory` hook
- [ ] Format all amounts to 2 decimal places
- [ ] Add batch status progress indicator

**Material Expenses Page:**
- [ ] Add "In Progress" section for self-use tracking
- [ ] Show group batch link for allocated expenses

**Inter-Site Settlement Page:**
- [ ] Add quick-settle action for self-use
- [ ] Improve batch card with usage visualization

**All Site Expenses Page:**
- [ ] Verify group purchases don't show before settlement
- [ ] Add filter for expense source (Own/Group/Settlement)

### Testing

- [ ] Create group purchase → Verify NOT in All Site Expenses
- [ ] Record usage → Verify batch_usage_records created
- [ ] Settle debtor → Verify debtor expense created
- [ ] Complete batch → Verify self-use expense created
- [ ] Verify correct amounts in each site's expenses

---

## Part 6: Timeline Estimate

| Phase | Description | Complexity |
|-------|-------------|------------|
| 1 | Fix v_all_expenses view | Low |
| 2 | Add Group Purchases tab | Medium |
| 3 | Fix decimal formatting | Low |
| 4 | Improve Material Expenses UX | Medium |

---

## Appendix: Key File References

| File | Purpose |
|------|---------|
| [src/hooks/queries/useMaterialPurchases.ts](src/hooks/queries/useMaterialPurchases.ts) | Material purchase queries |
| [src/hooks/queries/useInterSiteSettlements.ts](src/hooks/queries/useInterSiteSettlements.ts) | Settlement logic |
| [src/hooks/queries/useStockInventory.ts](src/hooks/queries/useStockInventory.ts) | Inventory queries |
| [src/app/(main)/site/inventory/page.tsx](src/app/(main)/site/inventory/page.tsx) | Inventory UI |
| [src/app/(main)/site/material-expenses/page.tsx](src/app/(main)/site/material-expenses/page.tsx) | Material expenses UI |
| [src/app/(main)/site/inter-site-settlement/page.tsx](src/app/(main)/site/inter-site-settlement/page.tsx) | Settlement UI |
| [supabase/migrations/20260204160000_fix_material_expense_amount_in_view.sql](supabase/migrations/20260204160000_fix_material_expense_amount_in_view.sql) | Recent view fix |
