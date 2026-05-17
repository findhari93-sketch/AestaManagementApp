ALTER TABLE material_categories
  ADD COLUMN IF NOT EXISTS calculator_label TEXT;

-- Wood & Timber category shows "Quality" instead of "Brand"
UPDATE material_categories
SET calculator_label = 'Quality'
WHERE code = 'WOD';
