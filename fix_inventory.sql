-- Check all transactions for Fly Ash Bricks
SELECT
  id,
  transaction_type,
  transaction_date,
  quantity,
  unit_cost,
  total_cost,
  reference_type,
  reference_id,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM group_stock_transactions
WHERE material_id = '3c7c1d28-6e8d-40a5-9f98-2d0f669233a0'
  AND site_group_id = '0ecc1c2f-e198-4918-bee2-b56128523b01'
ORDER BY created_at;

-- Check current inventory
SELECT
  id,
  current_qty,
  available_qty,
  avg_unit_cost,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at,
  TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at
FROM group_stock_inventory
WHERE material_id = '3c7c1d28-6e8d-40a5-9f98-2d0f669233a0'
  AND site_group_id = '0ecc1c2f-e198-4918-bee2-b56128523b01';

-- Calculate what the correct quantity should be
SELECT
  COALESCE(SUM(quantity), 0) as calculated_current_qty
FROM group_stock_transactions
WHERE material_id = '3c7c1d28-6e8d-40a5-9f98-2d0f669233a0'
  AND site_group_id = '0ecc1c2f-e198-4918-bee2-b56128523b01';
