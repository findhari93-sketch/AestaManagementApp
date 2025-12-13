-- Add language field to laborers table
-- Supports Hindi and Tamil laborers tracking

-- Add the language column with default value 'Tamil'
ALTER TABLE laborers ADD COLUMN IF NOT EXISTS language VARCHAR(20) DEFAULT 'Tamil';

-- Update existing Hindi laborers based on names
UPDATE laborers SET language = 'Hindi'
WHERE name IN ('Jatin', 'Bholu', 'Bhulu', 'Mama')
  AND (language IS NULL OR language = 'Tamil');

-- Add a comment to document the field
COMMENT ON COLUMN laborers.language IS 'Language spoken by the laborer (Hindi, Tamil)';
