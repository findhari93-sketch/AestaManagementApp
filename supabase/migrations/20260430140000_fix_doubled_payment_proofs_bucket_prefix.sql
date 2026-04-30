-- Repair payment-proofs URLs corrupted by a pre-2026-02-25 FileUploader bug
-- that wrote ".../public/payment-proofs/payment-proofs/<...>" instead of
-- ".../public/payment-proofs/<...>". The actual storage objects exist at the
-- un-doubled path (verified against storage.objects), so we just rewrite the URL.
--
-- Affected rows at time of writing:
--   settlement_groups.proof_url            : 9
--   labor_payments.proof_url               : 34
--   daily_attendance.payment_proof_url     : 1
--   market_laborer_attendance.payment_proof_url : 4

UPDATE settlement_groups
SET proof_url = REPLACE(proof_url, '/payment-proofs/payment-proofs/', '/payment-proofs/')
WHERE proof_url LIKE '%/payment-proofs/payment-proofs/%';

UPDATE labor_payments
SET proof_url = REPLACE(proof_url, '/payment-proofs/payment-proofs/', '/payment-proofs/')
WHERE proof_url LIKE '%/payment-proofs/payment-proofs/%';

UPDATE daily_attendance
SET payment_proof_url = REPLACE(payment_proof_url, '/payment-proofs/payment-proofs/', '/payment-proofs/')
WHERE payment_proof_url LIKE '%/payment-proofs/payment-proofs/%';

UPDATE market_laborer_attendance
SET payment_proof_url = REPLACE(payment_proof_url, '/payment-proofs/payment-proofs/', '/payment-proofs/')
WHERE payment_proof_url LIKE '%/payment-proofs/payment-proofs/%';
