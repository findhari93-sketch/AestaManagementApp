-- Add is_rate_based column to contracts table
ALTER TABLE public.contracts 
ADD COLUMN is_rate_based boolean NOT NULL DEFAULT true;

-- Add comment to explain the column
COMMENT ON COLUMN public.contracts.is_rate_based IS 'Indicates if contract is rate-based (true) or lump sum (false)';

-- Create index for potential filtering
CREATE INDEX IF NOT EXISTS idx_contracts_is_rate_based 
ON public.contracts USING btree (is_rate_based) 
TABLESPACE pg_default;
