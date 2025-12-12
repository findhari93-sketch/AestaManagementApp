-- Migration: Add active work section functionality
-- This migration adds:
-- 1. default_section_id to sites table (for auto-filling section in forms)
-- 2. construction_phase_id to building_sections (linking sections to phases)
-- 3. Audit columns to building_sections (created_by, updated_by)

-- ============================================
-- 1. Add default_section_id to sites table
-- ============================================
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS default_section_id UUID NULL;

-- Add foreign key constraint (separate statement for IF NOT EXISTS compatibility)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sites_default_section_id_fkey'
    ) THEN
        ALTER TABLE public.sites
        ADD CONSTRAINT sites_default_section_id_fkey
        FOREIGN KEY (default_section_id)
        REFERENCES public.building_sections(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- 2. Link building_sections to construction_phases
-- ============================================
ALTER TABLE public.building_sections
ADD COLUMN IF NOT EXISTS construction_phase_id UUID NULL;

-- Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'building_sections_construction_phase_id_fkey'
    ) THEN
        ALTER TABLE public.building_sections
        ADD CONSTRAINT building_sections_construction_phase_id_fkey
        FOREIGN KEY (construction_phase_id)
        REFERENCES public.construction_phases(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- 3. Add audit columns to building_sections
-- ============================================
ALTER TABLE public.building_sections
ADD COLUMN IF NOT EXISTS created_by UUID NULL,
ADD COLUMN IF NOT EXISTS updated_by UUID NULL;

-- Add foreign key constraints for audit columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'building_sections_created_by_fkey'
    ) THEN
        ALTER TABLE public.building_sections
        ADD CONSTRAINT building_sections_created_by_fkey
        FOREIGN KEY (created_by)
        REFERENCES public.users(id)
        ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'building_sections_updated_by_fkey'
    ) THEN
        ALTER TABLE public.building_sections
        ADD CONSTRAINT building_sections_updated_by_fkey
        FOREIGN KEY (updated_by)
        REFERENCES public.users(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- 4. Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sites_default_section
ON public.sites(default_section_id);

CREATE INDEX IF NOT EXISTS idx_building_sections_phase
ON public.building_sections(construction_phase_id);

CREATE INDEX IF NOT EXISTS idx_building_sections_created_by
ON public.building_sections(created_by);

-- ============================================
-- 5. Add comments for documentation
-- ============================================
COMMENT ON COLUMN public.sites.default_section_id IS
'Default work section for this site, auto-selected in forms like attendance';

COMMENT ON COLUMN public.building_sections.construction_phase_id IS
'Links section to a construction phase (Foundation, Structure, Finishing, etc.)';

COMMENT ON COLUMN public.building_sections.created_by IS
'User who created this section (audit trail)';

COMMENT ON COLUMN public.building_sections.updated_by IS
'User who last updated this section (audit trail)';
