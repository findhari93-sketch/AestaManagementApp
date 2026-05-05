-- Backfill tea_shop_entry_allocations.amount_paid / is_fully_paid for historical
-- group entries where the parent entry is fully paid but allocations were never synced.
--
-- Context: TeaShopSettlementDialog only updated entry-level amount_paid / is_fully_paid
-- on tea_shop_entries when settlements were saved. Per-site allocation rows still showed
-- amount_paid=0 / is_fully_paid=false, causing them to reappear in the Pay Shop dialog's
-- "Allocation Preview (Oldest First)" FIFO list even though the entry was fully settled.
--
-- Diagnostic on 2026-05-05: 76 of 148 fully-paid group entries had unpaid allocations.
-- Partial-paid entries showed zero drift (allocation sums matched entry-level paid),
-- so we only touch fully-paid entries here. Idempotent.

UPDATE tea_shop_entry_allocations a
SET
  amount_paid = a.allocated_amount,
  is_fully_paid = true
FROM tea_shop_entries e
WHERE a.entry_id = e.id
  AND e.is_fully_paid = true
  AND (a.is_fully_paid IS NOT TRUE OR a.amount_paid < a.allocated_amount);
