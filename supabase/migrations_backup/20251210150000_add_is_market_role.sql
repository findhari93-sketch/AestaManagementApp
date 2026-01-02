-- Add is_market_role column to labor_roles table
-- This flag identifies roles that are available for market (daily) laborers
-- Market roles: Mason, Male Helper, Female Helper, Painter, Excavator

-- Add the column with default false
ALTER TABLE labor_roles ADD COLUMN IF NOT EXISTS is_market_role boolean DEFAULT false;

-- Update the 5 market laborer roles
UPDATE labor_roles SET is_market_role = true WHERE name IN (
  'Mason',
  'Male Helper',
  'Female Helper',
  'Painter',
  'Excavator'
);

-- Add comment for documentation
COMMENT ON COLUMN labor_roles.is_market_role IS 'True if this role is available for market (daily) laborers';
