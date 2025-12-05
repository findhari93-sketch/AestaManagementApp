-- =================================================================
-- SITES TABLE ENHANCEMENT - COMPLETE MIGRATION
-- =================================================================
-- Purpose: Add client contract management and payment tracking
-- Run this in Supabase SQL Editor
-- =================================================================

-- STEP 1: Add new columns to sites table
ALTER TABLE public.sites 
ADD COLUMN IF NOT EXISTS client_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS client_contact VARCHAR(20),
ADD COLUMN IF NOT EXISTS client_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS project_contract_value DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS contract_document_url TEXT,
ADD COLUMN IF NOT EXISTS total_amount_received DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_payment_amount DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS last_payment_date DATE,
ADD COLUMN IF NOT EXISTS construction_phase VARCHAR(100),
ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10,8),
ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11,8),
ADD COLUMN IF NOT EXISTS location_google_maps_url TEXT;

-- STEP 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sites_client_name ON public.sites USING btree (client_name);
CREATE INDEX IF NOT EXISTS idx_sites_construction_phase ON public.sites USING btree (construction_phase);
CREATE INDEX IF NOT EXISTS idx_sites_location ON public.sites USING btree (location_lat, location_lng);

-- STEP 3: Add column comments
COMMENT ON COLUMN public.sites.client_name IS 'Name of the client who contracted the project';
COMMENT ON COLUMN public.sites.client_contact IS 'Primary contact number of the client';
COMMENT ON COLUMN public.sites.project_contract_value IS 'Total contract value agreed with the client';
COMMENT ON COLUMN public.sites.contract_document_url IS 'URL to contract PDF in Supabase Storage';
COMMENT ON COLUMN public.sites.total_amount_received IS 'Cumulative amount received from client';
COMMENT ON COLUMN public.sites.construction_phase IS 'Current construction stage (Foundation, Structure, etc.)';

-- STEP 4: Create payment milestones table (for future use)
CREATE TABLE IF NOT EXISTS public.site_payment_milestones (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  site_id UUID NOT NULL,
  milestone_name VARCHAR(255) NOT NULL,
  milestone_description TEXT,
  percentage DECIMAL(5,2) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  expected_date DATE,
  actual_payment_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  sequence_order INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT site_payment_milestones_pkey PRIMARY KEY (id),
  CONSTRAINT site_payment_milestones_site_id_fkey FOREIGN KEY (site_id) 
    REFERENCES sites (id) ON DELETE CASCADE,
  CONSTRAINT milestone_percentage_check CHECK (percentage >= 0 AND percentage <= 100)
);

-- STEP 5: Add indexes for payment milestones
CREATE INDEX IF NOT EXISTS idx_payment_milestones_site_id 
  ON public.site_payment_milestones USING btree (site_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_status 
  ON public.site_payment_milestones USING btree (status);

-- STEP 6: Add trigger for payment milestones updated_at
CREATE TRIGGER update_site_payment_milestones_updated_at 
BEFORE UPDATE ON site_payment_milestones 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- STEP 7: Verify migration (run these queries to check)
-- Check new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sites' 
  AND column_name IN (
    'client_name', 'project_contract_value', 'construction_phase',
    'location_lat', 'contract_document_url'
  )
ORDER BY column_name;

-- Check indexes created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'sites'
  AND indexname LIKE 'idx_sites_%';

-- Check payment milestones table created
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'site_payment_milestones';

-- =================================================================
-- MIGRATION COMPLETE!
-- Next: Create Supabase Storage bucket "contract-documents"
-- See: database/storage/setup_contract_documents_bucket.sql
-- =================================================================
