-- 1. Check current stock inventory for TMT Rods 16mm
SELECT 
  'Current Stock' as source,
  si.batch_code,
  si.current_qty as quantity,
  s.name as site_name,
  m.name as material_name
FROM stock_inventory si
JOIN sites s ON s.id = si.site_id
JOIN materials m ON m.id = si.material_id
WHERE m.name ILIKE '%TMT%16%'
AND si.batch_code IS NOT NULL
ORDER BY si.created_at DESC
LIMIT 5;

-- 2. Check purchase order quantities
SELECT 
  'Purchase Order' as source,
  mpe.ref_code as batch_code,
  mpe.original_qty,
  mpe.remaining_qty,
  mpe.total_amount
FROM material_purchase_expenses mpe
WHERE EXISTS (
  SELECT 1 FROM stock_inventory si
  JOIN materials m ON m.id = si.material_id
  WHERE si.batch_code = mpe.ref_code
  AND m.name ILIKE '%TMT%16%'
)
ORDER BY mpe.created_at DESC
LIMIT 5;

-- 3. Check all batch usage records
SELECT 
  'Usage Records' as source,
  bur.usage_date,
  bur.quantity,
  bur.batch_ref_code,
  s.name as used_by_site
FROM batch_usage_records bur
JOIN sites s ON s.id = bur.usage_site_id
WHERE EXISTS (
  SELECT 1 FROM stock_inventory si
  JOIN materials m ON m.id = si.material_id
  WHERE si.batch_code = bur.batch_ref_code
  AND m.name ILIKE '%TMT%16%'
)
ORDER BY bur.created_at DESC
LIMIT 10;
