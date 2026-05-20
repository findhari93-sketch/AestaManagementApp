-- Defensive guard against future Studio-side misclassifications.
--
-- Rule: a contract-typed laborer's daily_attendance row can have its
-- settlement_group_id set ONLY if a matching labor_payment with
-- is_under_contract=true already exists for that (settlement_group_id,
-- laborer_id) pair.
--
-- This blocks the exact pattern Shanthi Manoharan accidentally created on
-- 2026-05-04: bulk-linking contract attendance to a settlement_group without
-- the labor_payment side-link, which routes the settlement to Daily+Market.
--
-- The trigger does NOT block:
-- - Linking daily-typed (non-contract) attendance to any settlement (the
--   common Daily+Market path stays untouched).
-- - Clearing settlement_group_id (unlink is always allowed; cleanup flows
--   shouldn't be blocked).
-- - Contract settlements that don't link daily_attendance at all (the normal
--   waterfall path — verified that recent contract settlements have
--   linked_da_cnt=0).
-- - Contract settlements where the labor_payment exists first (the order
--   used by any future flow that wants to link daily_attendance: INSERT
--   labor_payment, then UPDATE daily_attendance.settlement_group_id).

CREATE OR REPLACE FUNCTION public.check_contract_daily_settlement_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_laborer_type text;
BEGIN
  -- Skip when settlement_group_id is being cleared.
  IF NEW.settlement_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip when settlement_group_id is unchanged (idempotent UPDATEs on other
  -- columns should not trigger this check).
  IF TG_OP = 'UPDATE' AND OLD.settlement_group_id IS NOT DISTINCT FROM NEW.settlement_group_id THEN
    RETURN NEW;
  END IF;

  -- Look up the laborer's type.
  SELECT laborer_type INTO v_laborer_type
  FROM public.laborers
  WHERE id = NEW.laborer_id;

  -- Only contract-typed laborers need the check.
  IF v_laborer_type IS DISTINCT FROM 'contract' THEN
    RETURN NEW;
  END IF;

  -- For contract laborers, require a matching contract labor_payment.
  IF NOT EXISTS (
    SELECT 1
    FROM public.labor_payments lp
    WHERE lp.settlement_group_id = NEW.settlement_group_id
      AND lp.laborer_id = NEW.laborer_id
      AND lp.is_under_contract = true
      AND lp.is_archived = false
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = format(
        'Contract-typed laborer %s cannot be linked to settlement %s without a matching labor_payment (is_under_contract=true). Use the Contract Settlement waterfall flow instead.',
        NEW.laborer_id::text,
        NEW.settlement_group_id::text
      );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_contract_daily_settlement_link() IS
'Blocks linking contract-typed laborer daily_attendance to a settlement_group unless a matching contract labor_payment exists. Defends against the 2026-05-04 Shanthi/Studio misclassification pattern.';

DROP TRIGGER IF EXISTS check_contract_daily_settlement_link_trigger ON public.daily_attendance;

CREATE TRIGGER check_contract_daily_settlement_link_trigger
  BEFORE INSERT OR UPDATE OF settlement_group_id, laborer_id
  ON public.daily_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.check_contract_daily_settlement_link();
