-- Migration: Enhance sites table for client contract management
-- Description: Add client contract details, payment milestones, and location tracking

-- Add new columns to sites table
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

-- Add comments for documentation
COMMENT ON COLUMN public.sites.client_name IS 'Name of the client who contracted the project';
COMMENT ON COLUMN public.sites.client_contact IS 'Primary contact number of the client';
COMMENT ON COLUMN public.sites.client_email IS 'Email address of the client';
COMMENT ON COLUMN public.sites.project_contract_value IS 'Total contract value agreed with the client';
COMMENT ON COLUMN public.sites.contract_document_url IS 'URL to the contract document stored in Supabase Storage';
COMMENT ON COLUMN public.sites.total_amount_received IS 'Cumulative amount received from client till date';
COMMENT ON COLUMN public.sites.last_payment_amount IS 'Amount of the most recent payment received';
COMMENT ON COLUMN public.sites.last_payment_date IS 'Date of the most recent payment';
COMMENT ON COLUMN public.sites.construction_phase IS 'Current phase of construction (e.g., Foundation, Structure, Finishing)';
COMMENT ON COLUMN public.sites.location_lat IS 'Latitude coordinate of the site';
COMMENT ON COLUMN public.sites.location_lng IS 'Longitude coordinate of the site';
COMMENT ON COLUMN public.sites.location_google_maps_url IS 'Google Maps URL for the site location';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sites_client_name ON public.sites USING btree (client_name);
CREATE INDEX IF NOT EXISTS idx_sites_construction_phase ON public.sites USING btree (construction_phase);
CREATE INDEX IF NOT EXISTS idx_sites_location ON public.sites USING btree (location_lat, location_lng);

-- Create payment milestones table
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
  CONSTRAINT site_payment_milestones_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites (id) ON DELETE CASCADE,
  CONSTRAINT milestone_percentage_check CHECK (percentage >= 0 AND percentage <= 100)
) TABLESPACE pg_default;

-- Add indexes for payment milestones
CREATE INDEX IF NOT EXISTS idx_payment_milestones_site_id ON public.site_payment_milestones USING btree (site_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_status ON public.site_payment_milestones USING btree (status);

-- Add trigger for updated_at
CREATE TRIGGER update_site_payment_milestones_updated_at 
BEFORE UPDATE ON site_payment_milestones 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for payment milestones table
COMMENT ON TABLE public.site_payment_milestones IS 'Payment milestones for client contract staged payments';
COMMENT ON COLUMN public.site_payment_milestones.milestone_name IS 'Name of the payment milestone (e.g., Advance, Foundation Complete)';
COMMENT ON COLUMN public.site_payment_milestones.percentage IS 'Percentage of total contract value';
COMMENT ON COLUMN public.site_payment_milestones.amount IS 'Actual amount to be paid for this milestone';
COMMENT ON COLUMN public.site_payment_milestones.status IS 'Status: pending, paid, overdue';
COMMENT ON COLUMN public.site_payment_milestones.sequence_order IS 'Order of milestone execution';
