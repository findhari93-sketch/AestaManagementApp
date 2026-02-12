-- Cleanup orphan group_stock_transactions that don't have batch_ref_code
-- These were created before the fix and escaped cascade deletes

-- First, update existing usage transactions to set batch_ref_code from batch_usage_records
UPDATE group_stock_transactions gst
SET batch_ref_code = bur.batch_ref_code
FROM batch_usage_records bur
WHERE gst.id = bur.group_stock_transaction_id
  AND gst.batch_ref_code IS NULL
  AND gst.transaction_type = 'usage';

-- Delete orphan usage transactions where:
-- 1. They don't have batch_ref_code set
-- 2. AND no linked batch_usage_record exists
-- 3. These are truly orphan records from deleted batches
DELETE FROM group_stock_transactions gst
WHERE gst.transaction_type = 'usage'
  AND gst.batch_ref_code IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM batch_usage_records bur
    WHERE bur.group_stock_transaction_id = gst.id
  );
