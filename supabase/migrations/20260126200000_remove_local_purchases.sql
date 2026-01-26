-- Migration: Remove Local Purchases Feature
-- This migration drops all database objects related to the local_purchases feature

-- Drop views first (they depend on tables)
DROP VIEW IF EXISTS v_pending_reimbursements;
DROP VIEW IF EXISTS v_local_purchases_details;

-- Drop triggers (use actual trigger names from DB)
DROP TRIGGER IF EXISTS trg_set_local_purchase_number ON local_purchases;
DROP TRIGGER IF EXISTS trg_process_local_purchase_stock ON local_purchases;
DROP TRIGGER IF EXISTS set_local_purchase_number ON local_purchases;
DROP TRIGGER IF EXISTS process_local_purchase_stock ON local_purchases;

-- Drop functions with CASCADE to handle any remaining dependencies
DROP FUNCTION IF EXISTS generate_local_purchase_number() CASCADE;
DROP FUNCTION IF EXISTS set_local_purchase_number() CASCADE;
DROP FUNCTION IF EXISTS process_local_purchase_stock() CASCADE;
DROP FUNCTION IF EXISTS trigger_process_local_purchase_stock() CASCADE;
DROP FUNCTION IF EXISTS create_local_purchase_reimbursement(uuid, uuid, numeric, text) CASCADE;

-- Drop tables (local_purchase_items will cascade due to FK)
DROP TABLE IF EXISTS local_purchase_items CASCADE;
DROP TABLE IF EXISTS local_purchases CASCADE;
