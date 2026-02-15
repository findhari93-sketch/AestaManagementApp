-- Migration: Fix stock_inventory unique constraint to include batch_code
--
-- Root cause: The unique constraint UNIQUE(site_id, location_id, material_id, brand_id)
-- does not include batch_code. When multiple Group POs for the same material deliver
-- to the same site, the trigger/app code tries to INSERT separate rows per batch but
-- the constraint blocks it, causing all deliveries to merge into a single row.
--
-- Fix: Include batch_code in the unique constraint so each batch gets its own row.
-- Use NULLS NOT DISTINCT so non-group stock (NULL batch_code) still enforces uniqueness.
--
-- Also repairs existing merged data for Padmavathy Apartments and Srinivasan House & Shop.

-- =====================================================
-- Part A: Fix the unique constraint
-- =====================================================

-- Drop old constraint (doesn't include batch_code)
ALTER TABLE stock_inventory
DROP CONSTRAINT IF EXISTS stock_inventory_site_id_location_id_material_id_brand_id_key;

-- Add new constraint INCLUDING batch_code
-- NULLS NOT DISTINCT ensures rows with NULL batch_code are still unique per (site, location, material, brand)
ALTER TABLE stock_inventory
ADD CONSTRAINT stock_inventory_site_location_material_brand_batch_key
UNIQUE NULLS NOT DISTINCT (site_id, location_id, material_id, brand_id, batch_code);


-- =====================================================
-- Part B: Repair Padmavathy Apartments data
-- =====================================================
-- Current: 1 row (CB41=110 bags) — merged from 3 PO deliveries
-- Expected: 3 rows (CB41=50, 724F=30, 8353=30)

-- Step B1: Reduce CB41 from 110 to its correct 50 bags
UPDATE stock_inventory
SET current_qty = 50,
    last_received_date = '2025-12-13',
    updated_at = NOW()
WHERE id = '5fbbd1bc-9801-4bfd-9e89-a64c10cb351b'
  AND batch_code = 'MAT-260214-CB41';

-- Step B2: Insert MAT-260214-724F (30 bags, delivered 2025-12-26)
INSERT INTO stock_inventory (
  site_id, location_id, material_id, brand_id,
  current_qty, avg_unit_cost, last_received_date,
  pricing_mode, total_weight, batch_code
) VALUES (
  'ff893992-a276-47b7-8bd2-d2fe4f62f3b5', NULL,
  'e03e4bf1-17de-4070-8f4d-262b83d0843d',
  '76eecfa0-96b5-412d-a718-b9fee274368f',
  30, 280.00, '2025-12-26',
  'per_piece', NULL, 'MAT-260214-724F'
);

-- Step B3: Insert MAT-260214-8353 (30 bags, delivered 2025-12-31)
INSERT INTO stock_inventory (
  site_id, location_id, material_id, brand_id,
  current_qty, avg_unit_cost, last_received_date,
  pricing_mode, total_weight, batch_code
) VALUES (
  'ff893992-a276-47b7-8bd2-d2fe4f62f3b5', NULL,
  'e03e4bf1-17de-4070-8f4d-262b83d0843d',
  '76eecfa0-96b5-412d-a718-b9fee274368f',
  30, 280.00, '2025-12-31',
  'per_piece', NULL, 'MAT-260214-8353'
);


-- =====================================================
-- Part C: Repair Srinivasan House & Shop data
-- =====================================================
-- Current: 1 row (2D7D=150 bags) — merged from 5 PO deliveries (200 total - 50 used)
-- Batch 2D7D is completed (50 original, 50 used), so set to 0
-- Expected: 2D7D=0, 674E=30, 1BD3=30, B915=30, 0A47=60

-- Step C1: Set 2D7D to 0 (batch is completed, 50 bags fully consumed)
UPDATE stock_inventory
SET current_qty = 0,
    last_received_date = '2025-11-21',
    updated_at = NOW()
WHERE id = '65030228-631e-4640-a301-fbc57faa76d6'
  AND batch_code = 'MAT-260214-2D7D';

-- Step C2: Insert MAT-260214-674E (30 bags, delivered 2025-12-08)
INSERT INTO stock_inventory (
  site_id, location_id, material_id, brand_id,
  current_qty, avg_unit_cost, last_received_date,
  pricing_mode, total_weight, batch_code
) VALUES (
  '79bfcfb3-4b0d-4240-8fce-d1ab584ef972', NULL,
  'e03e4bf1-17de-4070-8f4d-262b83d0843d',
  '76eecfa0-96b5-412d-a718-b9fee274368f',
  30, 280.00, '2025-12-08',
  'per_piece', NULL, 'MAT-260214-674E'
);

-- Step C3: Insert MAT-260214-1BD3 (30 bags, delivered 2025-12-17)
INSERT INTO stock_inventory (
  site_id, location_id, material_id, brand_id,
  current_qty, avg_unit_cost, last_received_date,
  pricing_mode, total_weight, batch_code
) VALUES (
  '79bfcfb3-4b0d-4240-8fce-d1ab584ef972', NULL,
  'e03e4bf1-17de-4070-8f4d-262b83d0843d',
  '76eecfa0-96b5-412d-a718-b9fee274368f',
  30, 280.00, '2025-12-17',
  'per_piece', NULL, 'MAT-260214-1BD3'
);

-- Step C4: Insert MAT-260214-B915 (30 bags, delivered 2026-01-22)
INSERT INTO stock_inventory (
  site_id, location_id, material_id, brand_id,
  current_qty, avg_unit_cost, last_received_date,
  pricing_mode, total_weight, batch_code
) VALUES (
  '79bfcfb3-4b0d-4240-8fce-d1ab584ef972', NULL,
  'e03e4bf1-17de-4070-8f4d-262b83d0843d',
  '76eecfa0-96b5-412d-a718-b9fee274368f',
  30, 280.00, '2026-01-22',
  'per_piece', NULL, 'MAT-260214-B915'
);

-- Step C5: Insert MAT-260214-0A47 (60 bags, delivered 2026-02-07)
INSERT INTO stock_inventory (
  site_id, location_id, material_id, brand_id,
  current_qty, avg_unit_cost, last_received_date,
  pricing_mode, total_weight, batch_code
) VALUES (
  '79bfcfb3-4b0d-4240-8fce-d1ab584ef972', NULL,
  'e03e4bf1-17de-4070-8f4d-262b83d0843d',
  '76eecfa0-96b5-412d-a718-b9fee274368f',
  60, 280.00, '2026-02-07',
  'per_piece', NULL, 'MAT-260214-0A47'
);
