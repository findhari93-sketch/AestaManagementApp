-- Migration: Add construction phases master data and link to sites
-- Creates master tables for construction phases and subphases
-- Adds foreign key column to sites for selected construction phase

CREATE TABLE IF NOT EXISTS public.construction_phases (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  sequence_order INT NOT NULL DEFAULT 0,
  default_payment_percentage NUMERIC(5,2) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.construction_subphases (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  phase_id UUID NOT NULL REFERENCES public.construction_phases(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  sequence_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK column to sites linking to master phase (keeps existing text column for compatibility)
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS construction_phase_id UUID NULL REFERENCES public.construction_phases(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_construction_phases_active ON public.construction_phases (is_active);
CREATE INDEX IF NOT EXISTS idx_construction_phases_sequence ON public.construction_phases (sequence_order);
CREATE INDEX IF NOT EXISTS idx_construction_subphases_phase ON public.construction_subphases (phase_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_sites_construction_phase_id ON public.sites (construction_phase_id);

-- Triggers
CREATE TRIGGER update_construction_phases_updated_at
BEFORE UPDATE ON public.construction_phases
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_construction_subphases_updated_at
BEFORE UPDATE ON public.construction_subphases
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default phases and subphases (idempotent)
-- Phases
INSERT INTO public.construction_phases (id, name, description, sequence_order, default_payment_percentage)
SELECT * FROM (VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Advance / Mobilization', 'Initial advance payment', 1, 30.0),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Foundation', 'Excavation to plinth level', 2, 30.0),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Structure / Roof Slab', 'Columns, beams, roof concrete', 3, 30.0),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'Finishing / Handover', 'Finishes and handover', 4, 10.0)
) AS seed(id, name, description, sequence_order, default_payment_percentage)
WHERE NOT EXISTS (SELECT 1 FROM public.construction_phases p WHERE p.id = seed.id);

-- Subphases
INSERT INTO public.construction_subphases (phase_id, name, description, sequence_order)
SELECT * FROM (VALUES
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Excavation', 'Excavation for footing', 1),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Footing PCC', 'Plain cement concrete base', 2),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Footing & Columns', 'Reinforcement and concrete', 3),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Plinth Beam', 'Plinth beam casting', 4),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Soil Filling', 'Plinth soil filling & compaction', 5),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Ground Floor Slab', 'Shuttering, reinforcement, concreting', 1),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'First Floor Slab', 'Shuttering, reinforcement, concreting', 2),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'Plastering & Flooring', 'Internal and external finishes', 1),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'Painting & Fixtures', 'Final finishes and fixtures', 2),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'Handover', 'Final checks and handover', 3)
) AS seed(phase_id, name, description, sequence_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.construction_subphases s
  WHERE s.phase_id = seed.phase_id AND s.name = seed.name
);
