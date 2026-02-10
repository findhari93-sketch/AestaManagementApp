-- Debug TMT Rods 16mm stock discrepancy

-- 1. Check current stock inventory
SELECT 
  'Current Stock' as source,
  si.id,
  si.batch_code,
  si.current_qty as quantity,
  si.site_id,
  s.name as site_name
FROM stock_inventory si
JOIN sites s ON s.id = si.site_id
WHERE si.material_id IN (
  SELECT id FROM materials WHERE name LIKE '%TMT%16%'
)
AND si.batch_code IS NOT NULL
ORDER BY si.created_at DESC;

-- 2. Check purchase order original quantity
SELECT 
  'Purchase Order' as source,
  mpe.ref_code as batch_code,
  mpe.original_qty,
  mpe.remaining_qty,
  mpe.total_amount,
  mpe.created_at
FROM material_purchase_expenses mpe
WHERE mpe.ref_code IN (
  SELECT DISTINCT batch_code 
  FROM stock_inventory 
  WHERE material_id IN (SELECT id FROM materials WHERE name LIKE '%TMT%16%')
  AND batch_code IS NOT NULL
)
ORDER BY mpe.created_at DESC;

-- 3. Check all batch usage records
SELECT 
  'Usage Records' as source,
  bur.usage_date,
  bur.quantity,
  bur.batch_ref_code,
  s.name as used_by_site,
  bur.created_at
FROM batch_usage_records bur
JOIN sites s ON s.id = bur.usage_site_id
WHERE bur.batch_ref_code IN (
  SELECT DISTINCT batch_code 
  FROM stock_inventory 
  WHERE material_id IN (SELECT id FROM materials WHERE name LIKE '%TMT%16%')
  AND batch_code IS NOT NULL
)
ORDER BY bur.created_at DESC;

-- 4. Calculate expected remaining
SELECT 
  'Expected Calculation' as source,
  mpe.ref_code as batch_code,
  mpe.original_qty as purchased,
  COALESCE(SUM(bur.quantity), 0) as total_used,
  mpe.original_qty - COALESCE(SUM(bur.quantity), 0) as expected_remaining,
  mpe.remaining_qty as actual_remaining,
  (mpe.original_qty - COALESCE(SUM(bur.quantity), 0)) - mpe.remaining_qty as discrepancy
FROM material_purchase_expenses mpe
LEFT JOIN batch_usage_records bur ON bur.batch_ref_code = mpe.ref_code
WHERE mpe.ref_code IN (
  SELECT DISTINCT batch_code 
  FROM stock_inventory 
  WHERE material_id IN (SELECT id FROM materials WHERE name LIKE '%TMT%16%')
  AND batch_code IS NOT NULL
)
GROUP BY mpe.ref_code, mpe.original_qty, mpe.remaining_qty;
