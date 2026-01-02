


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";

ALTER SCHEMA "public" OWNER TO "pg_database_owner";

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."audit_action" AS ENUM (
    'create',
    'update',
    'delete',
    'soft_delete',
    'restore'
);


ALTER TYPE "public"."audit_action" OWNER TO "postgres";


CREATE TYPE "public"."contract_payment_type" AS ENUM (
    'weekly_advance',
    'milestone',
    'part_payment',
    'final_settlement'
);


ALTER TYPE "public"."contract_payment_type" OWNER TO "postgres";


CREATE TYPE "public"."contract_status" AS ENUM (
    'draft',
    'active',
    'on_hold',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."contract_status" OWNER TO "postgres";


CREATE TYPE "public"."contract_type" AS ENUM (
    'mesthri',
    'specialist'
);


ALTER TYPE "public"."contract_type" OWNER TO "postgres";


CREATE TYPE "public"."deduction_status" AS ENUM (
    'pending',
    'partial',
    'deducted',
    'written_off'
);


ALTER TYPE "public"."deduction_status" OWNER TO "postgres";


CREATE TYPE "public"."deletion_request_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."deletion_request_status" OWNER TO "postgres";


CREATE TYPE "public"."delivery_status" AS ENUM (
    'pending',
    'in_transit',
    'partial',
    'delivered',
    'rejected'
);


ALTER TYPE "public"."delivery_status" OWNER TO "postgres";


CREATE TYPE "public"."delivery_verification_status" AS ENUM (
    'pending',
    'verified',
    'disputed',
    'rejected'
);


ALTER TYPE "public"."delivery_verification_status" OWNER TO "postgres";


CREATE TYPE "public"."employment_type" AS ENUM (
    'daily_wage',
    'contract',
    'specialist'
);


ALTER TYPE "public"."employment_type" OWNER TO "postgres";


CREATE TYPE "public"."expense_module" AS ENUM (
    'labor',
    'material',
    'machinery',
    'general'
);


ALTER TYPE "public"."expense_module" OWNER TO "postgres";


CREATE TYPE "public"."inter_site_settlement_status" AS ENUM (
    'draft',
    'pending',
    'approved',
    'settled',
    'cancelled'
);


ALTER TYPE "public"."inter_site_settlement_status" OWNER TO "postgres";


CREATE TYPE "public"."laborer_status" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "public"."laborer_status" OWNER TO "postgres";


CREATE TYPE "public"."material_request_status" AS ENUM (
    'draft',
    'pending',
    'approved',
    'rejected',
    'ordered',
    'partial_fulfilled',
    'fulfilled',
    'cancelled'
);


ALTER TYPE "public"."material_request_status" OWNER TO "postgres";


CREATE TYPE "public"."material_unit" AS ENUM (
    'kg',
    'g',
    'ton',
    'liter',
    'ml',
    'piece',
    'bag',
    'bundle',
    'sqft',
    'sqm',
    'cft',
    'cum',
    'nos',
    'rmt',
    'box',
    'set'
);


ALTER TYPE "public"."material_unit" OWNER TO "postgres";


CREATE TYPE "public"."measurement_unit" AS ENUM (
    'sqft',
    'rft',
    'nos',
    'lumpsum',
    'per_point'
);


ALTER TYPE "public"."measurement_unit" OWNER TO "postgres";


CREATE TYPE "public"."milestone_status" AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'paid'
);


ALTER TYPE "public"."milestone_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_mode" AS ENUM (
    'cash',
    'upi',
    'bank_transfer',
    'cheque',
    'other'
);


ALTER TYPE "public"."payment_mode" OWNER TO "postgres";


CREATE TYPE "public"."po_status" AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'ordered',
    'partial_delivered',
    'delivered',
    'cancelled'
);


ALTER TYPE "public"."po_status" OWNER TO "postgres";


CREATE TYPE "public"."salary_status" AS ENUM (
    'draft',
    'calculated',
    'partial',
    'paid'
);


ALTER TYPE "public"."salary_status" OWNER TO "postgres";


CREATE TYPE "public"."section_status" AS ENUM (
    'not_started',
    'in_progress',
    'completed'
);


ALTER TYPE "public"."section_status" OWNER TO "postgres";


CREATE TYPE "public"."site_status" AS ENUM (
    'planning',
    'active',
    'on_hold',
    'completed'
);


ALTER TYPE "public"."site_status" OWNER TO "postgres";


CREATE TYPE "public"."site_type" AS ENUM (
    'single_client',
    'multi_client',
    'personal'
);


ALTER TYPE "public"."site_type" OWNER TO "postgres";


CREATE TYPE "public"."stock_transaction_type" AS ENUM (
    'purchase',
    'usage',
    'transfer_in',
    'transfer_out',
    'adjustment',
    'return',
    'wastage',
    'initial'
);


ALTER TYPE "public"."stock_transaction_type" OWNER TO "postgres";


CREATE TYPE "public"."team_status" AS ENUM (
    'active',
    'inactive',
    'completed'
);


ALTER TYPE "public"."team_status" OWNER TO "postgres";


CREATE TYPE "public"."transaction_type" AS ENUM (
    'advance',
    'extra'
);


ALTER TYPE "public"."transaction_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'office',
    'site_engineer'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."user_status" AS ENUM (
    'active',
    'inactive',
    'suspended'
);


ALTER TYPE "public"."user_status" OWNER TO "postgres";


CREATE TYPE "public"."vendor_type" AS ENUM (
    'shop',
    'dealer',
    'manufacturer',
    'individual'
);


ALTER TYPE "public"."vendor_type" OWNER TO "postgres";


CREATE TYPE "public"."work_days_value" AS ENUM (
    '0.5',
    '1',
    '1.5',
    '2'
);


ALTER TYPE "public"."work_days_value" OWNER TO "postgres";


CREATE TYPE "public"."work_variance" AS ENUM (
    'overtime',
    'standard',
    'undertime'
);


ALTER TYPE "public"."work_variance" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_deletion"("p_request_id" "uuid", "p_reviewed_by" "uuid", "p_review_notes" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_request RECORD;
BEGIN
    -- Get the request
    SELECT * INTO v_request FROM deletion_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Deletion request not found';
    END IF;
    
    IF v_request.status != 'pending' THEN
        RAISE EXCEPTION 'Request already processed';
    END IF;
    
    -- Update request status
    UPDATE deletion_requests
    SET 
        status = 'approved',
        reviewed_by = p_reviewed_by,
        reviewed_at = NOW(),
        review_notes = p_review_notes,
        executed_at = NOW()
    WHERE id = p_request_id;
    
    -- Perform soft delete on the actual record
    CASE v_request.table_name
        WHEN 'laborers' THEN
            UPDATE laborers SET 
                status = 'inactive', 
                deactivation_date = CURRENT_DATE,
                deactivation_reason = 'Deleted: ' || COALESCE(v_request.reason, 'Admin approved')
            WHERE id = v_request.record_id;
        WHEN 'daily_attendance' THEN
            UPDATE daily_attendance SET 
                is_deleted = TRUE, 
                deleted_at = NOW(), 
                deleted_by = p_reviewed_by 
            WHERE id = v_request.record_id;
        WHEN 'advances' THEN
            UPDATE advances SET 
                is_deleted = TRUE, 
                deleted_at = NOW(), 
                deleted_by = p_reviewed_by 
            WHERE id = v_request.record_id;
        WHEN 'expenses' THEN
            UPDATE expenses SET 
                is_deleted = TRUE, 
                deleted_at = NOW(), 
                deleted_by = p_reviewed_by 
            WHERE id = v_request.record_id;
        ELSE
            RAISE EXCEPTION 'Unsupported table for deletion: %', v_request.table_name;
    END CASE;
    
    -- Create audit log
    PERFORM create_audit_log(
        v_request.table_name,
        v_request.record_id,
        'delete',
        NULL,
        NULL,
        p_reviewed_by,
        'Deletion approved: ' || COALESCE(p_review_notes, 'No notes')
    );
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."approve_deletion"("p_request_id" "uuid", "p_reviewed_by" "uuid", "p_review_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."approve_deletion"("p_request_id" "uuid", "p_reviewed_by" "uuid", "p_review_notes" "text") IS 'Admin function to approve and execute deletion';



CREATE OR REPLACE FUNCTION "public"."approve_settlement"("p_settlement_id" "uuid", "p_approved_by" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE inter_site_material_settlements
  SET status = 'approved',
      approved_by = p_approved_by,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_settlement_id
    AND status IN ('draft', 'pending');

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."approve_settlement"("p_settlement_id" "uuid", "p_approved_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_create_site_sections"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Copy default sections to new site
    PERFORM copy_default_sections_to_site(NEW.id);
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_create_site_sections"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_material_weight"("p_material_id" "uuid", "p_quantity" numeric) RETURNS TABLE("total_weight" numeric, "weight_unit" "text", "weight_per_unit" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN m.weight_per_unit IS NOT NULL
         THEN p_quantity * m.weight_per_unit
         ELSE NULL
    END as total_weight,
    m.weight_unit,
    m.weight_per_unit
  FROM materials m
  WHERE m.id = p_material_id;
END;
$$;


ALTER FUNCTION "public"."calculate_material_weight"("p_material_id" "uuid", "p_quantity" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_milestone_amount"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    contract_total DECIMAL(14,2);
BEGIN
    -- If percentage is set but amount is not, calculate amount
    IF NEW.percentage IS NOT NULL AND (NEW.amount IS NULL OR NEW.amount = 0) THEN
        SELECT total_value INTO contract_total
        FROM contracts
        WHERE id = NEW.contract_id;
        
        NEW.amount := (contract_total * NEW.percentage / 100);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_milestone_amount"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_salary_period"("p_laborer_id" "uuid", "p_week_ending" "date", "p_calculated_by" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_salary_period_id UUID;
    v_week_start DATE;
    v_total_days DECIMAL(4,1);
    v_total_hours DECIMAL(6,2);
    v_gross DECIMAL(12,2);
    v_advances DECIMAL(10,2);
    v_extras DECIMAL(10,2);
    v_net DECIMAL(12,2);
    v_site_breakdown JSONB;
BEGIN
    -- Calculate week start
    v_week_start := p_week_ending - INTERVAL '6 days';
    
    -- Get attendance totals
    SELECT 
        COALESCE(SUM(work_days), 0),
        COALESCE(SUM(hours_worked), 0),
        COALESCE(SUM(daily_earnings), 0)
    INTO v_total_days, v_total_hours, v_gross
    FROM daily_attendance
    WHERE laborer_id = p_laborer_id
        AND date BETWEEN v_week_start AND p_week_ending
        AND is_deleted = FALSE;
    
    -- Get site breakdown
    SELECT COALESCE(
        jsonb_object_agg(
            site_id::TEXT,
            jsonb_build_object(
                'days', days,
                'earnings', earnings,
                'site_name', site_name
            )
        ),
        '{}'::JSONB
    )
    INTO v_site_breakdown
    FROM (
        SELECT 
            da.site_id,
            s.name as site_name,
            SUM(da.work_days) as days,
            SUM(da.daily_earnings) as earnings
        FROM daily_attendance da
        JOIN sites s ON da.site_id = s.id
        WHERE da.laborer_id = p_laborer_id
            AND da.date BETWEEN v_week_start AND p_week_ending
            AND da.is_deleted = FALSE
        GROUP BY da.site_id, s.name
    ) site_totals;
    
    -- Get pending advances
    SELECT COALESCE(SUM(amount - deducted_amount), 0)
    INTO v_advances
    FROM advances
    WHERE laborer_id = p_laborer_id
        AND transaction_type = 'advance'
        AND deduction_status IN ('pending', 'partial')
        AND is_deleted = FALSE;
    
    -- Get extras for this week
    SELECT COALESCE(SUM(amount), 0)
    INTO v_extras
    FROM advances
    WHERE laborer_id = p_laborer_id
        AND transaction_type = 'extra'
        AND date BETWEEN v_week_start AND p_week_ending
        AND is_deleted = FALSE;
    
    -- Calculate net
    v_net := v_gross - v_advances + v_extras;
    
    -- Insert or update with proper enum casting
    INSERT INTO salary_periods (
        laborer_id, week_ending, week_start, total_days_worked, total_hours_worked,
        gross_earnings, advance_deductions, total_deductions, extras, total_additions,
        net_payable, balance_due, status, site_breakdown, calculated_at, calculated_by
    ) VALUES (
        p_laborer_id, p_week_ending, v_week_start, v_total_days, v_total_hours,
        v_gross, v_advances, v_advances, v_extras, v_extras,
        v_net, v_net, 'calculated'::salary_status, v_site_breakdown, NOW(), p_calculated_by
    )
    ON CONFLICT (laborer_id, week_ending) DO UPDATE SET
        week_start = v_week_start,
        total_days_worked = v_total_days,
        total_hours_worked = v_total_hours,
        gross_earnings = v_gross,
        advance_deductions = v_advances,
        total_deductions = v_advances,
        extras = v_extras,
        total_additions = v_extras,
        net_payable = v_net,
        balance_due = v_net - salary_periods.amount_paid,
        status = CASE 
            WHEN salary_periods.amount_paid >= v_net THEN 'paid'::salary_status
            WHEN salary_periods.amount_paid > 0 THEN 'partial'::salary_status
            ELSE 'calculated'::salary_status
        END,
        site_breakdown = v_site_breakdown,
        calculated_at = NOW(),
        calculated_by = p_calculated_by,
        updated_at = NOW()
    RETURNING id INTO v_salary_period_id;
    
    RETURN v_salary_period_id;
END;
$$;


ALTER FUNCTION "public"."calculate_salary_period"("p_laborer_id" "uuid", "p_week_ending" "date", "p_calculated_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_site"("p_site_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_record RECORD;
BEGIN
    SELECT role, assigned_sites INTO v_user_record
    FROM users
    WHERE auth_id = auth.uid();
    
    -- Admin can access all sites
    IF v_user_record.role = 'admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Others can only access assigned sites
    RETURN p_site_id = ANY(v_user_record.assigned_sites);
END;
$$;


ALTER FUNCTION "public"."can_access_site"("p_site_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_access_site"("p_site_id" "uuid") IS 'Checks if current user can access a specific site';



CREATE OR REPLACE FUNCTION "public"."can_site_use_batch"("p_site_id" "uuid", "p_inventory_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_is_dedicated BOOLEAN;
  v_dedicated_site_id UUID;
  v_site_group_id UUID;
  v_inventory_group_id UUID;
BEGIN
  -- Get batch details
  SELECT is_dedicated, dedicated_site_id, site_group_id
  INTO v_is_dedicated, v_dedicated_site_id, v_inventory_group_id
  FROM group_stock_inventory
  WHERE id = p_inventory_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Get site's group
  SELECT site_group_id INTO v_site_group_id
  FROM sites
  WHERE id = p_site_id;

  -- Site must be in the same group
  IF v_site_group_id IS NULL OR v_site_group_id != v_inventory_group_id THEN
    RETURN false;
  END IF;

  -- If dedicated, only the dedicated site can use it
  IF v_is_dedicated AND v_dedicated_site_id != p_site_id THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."can_site_use_batch"("p_site_id" "uuid", "p_inventory_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_settlement"("p_settlement_id" "uuid", "p_cancelled_by" "uuid", "p_reason" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE inter_site_material_settlements
  SET status = 'cancelled',
      cancelled_by = p_cancelled_by,
      cancelled_at = NOW(),
      cancellation_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_settlement_id
    AND status NOT IN ('settled', 'cancelled');

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."cancel_settlement"("p_settlement_id" "uuid", "p_cancelled_by" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_low_stock_alerts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_reorder_level DECIMAL;
  v_material_name TEXT;
  v_site_name TEXT;
  v_user_record RECORD;
BEGIN
  -- Only check if quantity decreased
  IF NEW.current_qty >= OLD.current_qty THEN
    RETURN NEW;
  END IF;

  -- Get reorder level (use inventory-specific or material default)
  SELECT COALESCE(NEW.reorder_level, m.reorder_level, 0), m.name
  INTO v_reorder_level, v_material_name
  FROM materials m WHERE m.id = NEW.material_id;

  -- Get site name
  SELECT name INTO v_site_name FROM sites WHERE id = NEW.site_id;

  -- If stock is below reorder level and we just crossed it
  IF NEW.current_qty <= v_reorder_level
     AND OLD.current_qty > v_reorder_level
     AND v_reorder_level > 0 THEN

    -- Create notification for admins and site engineers
    FOR v_user_record IN
      SELECT u.id
      FROM users u
      WHERE u.role IN ('admin', 'office')
        AND u.status = 'active'
      UNION
      SELECT u.id
      FROM users u
      WHERE u.role = 'site_engineer'
        AND u.status = 'active'
        AND NEW.site_id = ANY(u.assigned_sites)
    LOOP
      INSERT INTO notifications (
        user_id, title, message, notification_type,
        related_id, related_table, action_url, site_id
      ) VALUES (
        v_user_record.id,
        'Low Stock Alert: ' || v_material_name,
        'Stock for ' || v_material_name || ' at ' || v_site_name ||
          ' is low (' || ROUND(NEW.current_qty::numeric, 2) || ' remaining, reorder level: ' ||
          ROUND(v_reorder_level::numeric, 2) || ')',
        'stock_low',
        NEW.id,
        'stock_inventory',
        '/site/stock',
        NEW.site_id
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_low_stock_alerts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_material_parent_level"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If setting a parent_id, ensure the parent is not itself a variant
  IF NEW.parent_id IS NOT NULL THEN
    -- Check if the proposed parent has a parent (is a variant)
    IF EXISTS (
      SELECT 1 FROM materials
      WHERE id = NEW.parent_id AND parent_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Cannot create nested variants. A variant cannot have sub-variants.';
    END IF;
  END IF;

  -- If this material has variants, it cannot become a variant
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM materials WHERE parent_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cannot make this material a variant because it already has variants.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_material_parent_level"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."copy_default_sections_to_site"("p_site_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_count INT := 0;
BEGIN
    INSERT INTO building_sections (site_id, name, description, sequence_order)
    SELECT p_site_id, name, description, sequence_order
    FROM default_building_sections
    WHERE is_active = TRUE
    ORDER BY sequence_order;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."copy_default_sections_to_site"("p_site_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."copy_default_sections_to_site"("p_site_id" "uuid") IS 'Copies default building sections to a site';



CREATE OR REPLACE FUNCTION "public"."create_audit_log"("p_table_name" character varying, "p_record_id" "uuid", "p_action" "public"."audit_action", "p_old_data" "jsonb" DEFAULT NULL::"jsonb", "p_new_data" "jsonb" DEFAULT NULL::"jsonb", "p_changed_by" "uuid" DEFAULT NULL::"uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO audit_log (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_by,
        notes
    ) VALUES (
        p_table_name,
        p_record_id,
        p_action,
        p_old_data,
        p_new_data,
        p_changed_by,
        p_notes
    )
    RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$;


ALTER FUNCTION "public"."create_audit_log"("p_table_name" character varying, "p_record_id" "uuid", "p_action" "public"."audit_action", "p_old_data" "jsonb", "p_new_data" "jsonb", "p_changed_by" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_local_purchase_reimbursement"("p_purchase_id" "uuid", "p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_purchase RECORD;
  v_transaction_id UUID;
BEGIN
  SELECT * INTO v_purchase FROM local_purchases WHERE id = p_purchase_id;

  IF v_purchase IS NULL OR NOT v_purchase.needs_reimbursement THEN
    RETURN NULL;
  END IF;

  IF v_purchase.reimbursement_transaction_id IS NOT NULL THEN
    RETURN v_purchase.reimbursement_transaction_id;
  END IF;

  -- Create reimbursement transaction in engineer wallet
  INSERT INTO site_engineer_transactions (
    site_id, engineer_id, transaction_type, amount,
    description, related_expense_type, status, created_by
  ) VALUES (
    v_purchase.site_id,
    v_purchase.engineer_id,
    'reimbursement',
    v_purchase.total_amount,
    'Reimbursement for local purchase ' || v_purchase.purchase_number,
    'materials',
    'pending',
    p_user_id
  )
  RETURNING id INTO v_transaction_id;

  -- Update local purchase with transaction reference
  UPDATE local_purchases
  SET
    reimbursement_transaction_id = v_transaction_id,
    reimbursement_status = 'processed',
    updated_at = NOW()
  WHERE id = p_purchase_id;

  RETURN v_transaction_id;
END;
$$;


ALTER FUNCTION "public"."create_local_purchase_reimbursement"("p_purchase_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_weekly_settlement"("p_site_group_id" "uuid", "p_from_site_id" "uuid", "p_to_site_id" "uuid", "p_year" integer, "p_week" integer, "p_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_settlement_id UUID;
  v_settlement_code TEXT;
  v_week_start DATE;
  v_week_end DATE;
  v_total_amount DECIMAL;
  v_transaction RECORD;
BEGIN
  -- Calculate week dates
  v_week_start := DATE_TRUNC('week', MAKE_DATE(p_year, 1, 1) + (p_week - 1) * INTERVAL '1 week')::DATE;
  v_week_end := (v_week_start + INTERVAL '6 days')::DATE;

  -- Check if settlement already exists
  SELECT id INTO v_settlement_id
  FROM inter_site_material_settlements
  WHERE site_group_id = p_site_group_id
    AND from_site_id = p_from_site_id
    AND to_site_id = p_to_site_id
    AND year = p_year
    AND week_number = p_week;

  IF v_settlement_id IS NOT NULL THEN
    RAISE EXCEPTION 'Settlement already exists for this week';
  END IF;

  -- Calculate total amount from transactions
  SELECT COALESCE(SUM(ABS(gst.total_cost)), 0)
  INTO v_total_amount
  FROM group_stock_transactions gst
  WHERE gst.site_group_id = p_site_group_id
    AND gst.payment_source_site_id = p_from_site_id
    AND gst.usage_site_id = p_to_site_id
    AND gst.transaction_type = 'usage'
    AND EXTRACT(YEAR FROM gst.transaction_date) = p_year
    AND EXTRACT(WEEK FROM gst.transaction_date) = p_week;

  IF v_total_amount = 0 THEN
    RAISE EXCEPTION 'No transactions found for this period';
  END IF;

  -- Generate settlement code
  v_settlement_code := generate_settlement_code(p_year, p_week);

  -- Create settlement record
  INSERT INTO inter_site_material_settlements (
    settlement_code, site_group_id, from_site_id, to_site_id,
    year, week_number, period_start, period_end,
    total_amount, status, created_by
  ) VALUES (
    v_settlement_code, p_site_group_id, p_from_site_id, p_to_site_id,
    p_year, p_week, v_week_start, v_week_end,
    v_total_amount, 'draft', p_created_by
  )
  RETURNING id INTO v_settlement_id;

  -- Create settlement items from transactions
  FOR v_transaction IN
    SELECT
      gst.material_id,
      gst.brand_id,
      gst.batch_code,
      ABS(gst.quantity) as quantity,
      m.unit,
      gst.unit_cost,
      ABS(gst.total_cost) as total_cost,
      gst.id as transaction_id,
      gst.transaction_date as usage_date
    FROM group_stock_transactions gst
    JOIN materials m ON m.id = gst.material_id
    WHERE gst.site_group_id = p_site_group_id
      AND gst.payment_source_site_id = p_from_site_id
      AND gst.usage_site_id = p_to_site_id
      AND gst.transaction_type = 'usage'
      AND EXTRACT(YEAR FROM gst.transaction_date) = p_year
      AND EXTRACT(WEEK FROM gst.transaction_date) = p_week
  LOOP
    INSERT INTO inter_site_settlement_items (
      settlement_id, material_id, brand_id, batch_code,
      quantity_used, unit, unit_cost, total_cost,
      transaction_id, usage_date
    ) VALUES (
      v_settlement_id, v_transaction.material_id, v_transaction.brand_id, v_transaction.batch_code,
      v_transaction.quantity, v_transaction.unit, v_transaction.unit_cost, v_transaction.total_cost,
      v_transaction.transaction_id, v_transaction.usage_date
    );
  END LOOP;

  RETURN v_settlement_id;
END;
$$;


ALTER FUNCTION "public"."create_weekly_settlement"("p_site_group_id" "uuid", "p_from_site_id" "uuid", "p_to_site_id" "uuid", "p_year" integer, "p_week" integer, "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dedicate_batch_to_site"("p_inventory_id" "uuid", "p_site_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_site_group_id UUID;
  v_inventory_group_id UUID;
BEGIN
  -- Get site's group
  SELECT site_group_id INTO v_site_group_id
  FROM sites
  WHERE id = p_site_id;

  -- Get inventory's group
  SELECT site_group_id INTO v_inventory_group_id
  FROM group_stock_inventory
  WHERE id = p_inventory_id;

  -- Site must be in the same group
  IF v_site_group_id IS NULL OR v_site_group_id != v_inventory_group_id THEN
    RETURN false;
  END IF;

  UPDATE group_stock_inventory
  SET is_dedicated = true,
      dedicated_site_id = p_site_id,
      updated_at = NOW()
  WHERE id = p_inventory_id;

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."dedicate_batch_to_site"("p_inventory_id" "uuid", "p_site_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_engineer_transaction"("p_transaction_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_deleted BOOLEAN := false;
BEGIN
  -- Step 1: Delete batch usage records that reference this transaction
  DELETE FROM engineer_wallet_batch_usage
  WHERE transaction_id = p_transaction_id
     OR batch_transaction_id = p_transaction_id;

  -- Step 2: Unlink daily_attendance records
  UPDATE daily_attendance
  SET engineer_transaction_id = NULL
  WHERE engineer_transaction_id = p_transaction_id;

  -- Step 3: Unlink market_laborer_attendance records
  UPDATE market_laborer_attendance
  SET engineer_transaction_id = NULL
  WHERE engineer_transaction_id = p_transaction_id;

  -- Step 4: Unlink expenses records
  UPDATE expenses
  SET engineer_transaction_id = NULL
  WHERE engineer_transaction_id = p_transaction_id;

  -- Step 5: Unlink local_purchases reimbursement records
  UPDATE local_purchases
  SET reimbursement_transaction_id = NULL
  WHERE reimbursement_transaction_id = p_transaction_id;

  -- Step 6: Unlink settlement_groups records
  UPDATE settlement_groups
  SET engineer_transaction_id = NULL
  WHERE engineer_transaction_id = p_transaction_id;

  -- Step 7: Delete the transaction itself
  DELETE FROM site_engineer_transactions
  WHERE id = p_transaction_id;

  -- Check if deletion happened
  IF FOUND THEN
    v_deleted := true;
  END IF;

  RETURN v_deleted;
END;
$$;


ALTER FUNCTION "public"."delete_engineer_transaction"("p_transaction_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_engineer_transaction"("p_transaction_id" "uuid") IS 'Safely deletes a transaction by first unlinking all FK references';



CREATE OR REPLACE FUNCTION "public"."generate_batch_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  year_part TEXT;
  next_seq INT;
  new_code TEXT;
BEGIN
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');

  -- Get next sequence for this year
  SELECT COALESCE(MAX(
    CASE
      WHEN batch_code ~ ('^BATCH-' || year_part || '-\d{4}$')
      THEN CAST(SUBSTRING(batch_code FROM 12 FOR 4) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_seq
  FROM group_stock_inventory
  WHERE batch_code LIKE 'BATCH-' || year_part || '-%';

  new_code := 'BATCH-' || year_part || '-' || LPAD(next_seq::TEXT, 4, '0');

  RETURN new_code;
END;
$_$;


ALTER FUNCTION "public"."generate_batch_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_batch_code"("p_payer_source" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_prefix TEXT;
  v_date_code TEXT;
  v_sequence INT;
  v_code TEXT;
BEGIN
  -- Map payer_source to prefix
  v_prefix := CASE p_payer_source
    WHEN 'trust_account' THEN 'TRUST'
    WHEN 'amma_money' THEN 'AMMA'
    WHEN 'mothers_money' THEN 'AMMA'  -- Legacy support
    WHEN 'client_money' THEN 'CLIENT'
    WHEN 'own_money' THEN 'OWN'
    WHEN 'other_site_money' THEN 'SITE'
    WHEN 'custom' THEN 'OTHER'
    ELSE 'MISC'
  END;

  -- Get current date in YYMMDD format (was YYYYMM)
  v_date_code := TO_CHAR(NOW(), 'YYMMDD');

  -- Get next sequence for this prefix+date combination
  SELECT COALESCE(MAX(
    CASE
      WHEN batch_code ~ ('^' || v_prefix || '-' || v_date_code || '-[0-9]+$')
      THEN CAST(SPLIT_PART(batch_code, '-', 3) AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO v_sequence
  FROM site_engineer_transactions
  WHERE batch_code LIKE v_prefix || '-' || v_date_code || '-%';

  -- Format: PREFIX-YYMMDD-NNN (padded to 3 digits)
  v_code := v_prefix || '-' || v_date_code || '-' || LPAD(v_sequence::TEXT, 3, '0');

  RETURN v_code;
END;
$_$;


ALTER FUNCTION "public"."generate_batch_code"("p_payer_source" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_batch_code"("p_payer_source" "text") IS 'Generates unique batch code for wallet deposits like TRUST-241225-001. Sequence resets daily.';



CREATE OR REPLACE FUNCTION "public"."generate_grn_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  new_number TEXT;
  year_month TEXT;
  seq_num INTEGER;
BEGIN
  year_month := TO_CHAR(NOW(), 'YYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(grn_number FROM 10) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM deliveries
  WHERE grn_number LIKE 'GRN-' || year_month || '-%';

  new_number := 'GRN-' || year_month || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_number;
END;
$$;


ALTER FUNCTION "public"."generate_grn_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_local_purchase_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  new_number TEXT;
  year_month TEXT;
  seq_num INTEGER;
BEGIN
  year_month := TO_CHAR(NOW(), 'YYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(purchase_number FROM 9) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM local_purchases
  WHERE purchase_number LIKE 'LP-' || year_month || '-%';

  new_number := 'LP-' || year_month || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_number;
END;
$$;


ALTER FUNCTION "public"."generate_local_purchase_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_mr_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  new_number TEXT;
  year_month TEXT;
  seq_num INTEGER;
BEGIN
  year_month := TO_CHAR(NOW(), 'YYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM 9) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM material_requests
  WHERE request_number LIKE 'MR-' || year_month || '-%';

  new_number := 'MR-' || year_month || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_number;
END;
$$;


ALTER FUNCTION "public"."generate_mr_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_payment_reference"("p_site_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_date_code TEXT;
  v_next_seq INT;
  v_reference TEXT;
  v_lock_key BIGINT;
BEGIN
  -- Create unique lock key from site_id (different from settlement lock)
  v_lock_key := ('x' || substr(md5(p_site_id::text || 'payment'), 1, 15))::bit(64)::bigint;

  -- Acquire advisory lock for this site
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Get current date in YYMMDD format
  v_date_code := TO_CHAR(CURRENT_DATE, 'YYMMDD');

  -- Find the next sequence number for this site and day
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(payment_reference FROM 'PAY-' || v_date_code || '-(\d+)')
      AS INT
    )
  ), 0) + 1
  INTO v_next_seq
  FROM labor_payments
  WHERE site_id = p_site_id
    AND payment_reference LIKE 'PAY-' || v_date_code || '-%';

  -- Format: PAY-YYMMDD-NNN
  v_reference := 'PAY-' || v_date_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');

  RETURN v_reference;
END;
$$;


ALTER FUNCTION "public"."generate_payment_reference"("p_site_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_payment_reference"("p_site_id" "uuid") IS 'Generates unique payment reference in PAY-YYMMDD-NNN format with advisory lock to prevent race conditions';



CREATE OR REPLACE FUNCTION "public"."generate_po_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  new_number TEXT;
  year_month TEXT;
  seq_num INTEGER;
BEGIN
  year_month := TO_CHAR(NOW(), 'YYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 9) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM purchase_orders
  WHERE po_number LIKE 'PO-' || year_month || '-%';

  new_number := 'PO-' || year_month || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_number;
END;
$$;


ALTER FUNCTION "public"."generate_po_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_settlement_code"("p_year" integer, "p_week" integer) RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  next_seq INT;
  new_code TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN settlement_code ~ ('^MAT-SET-' || p_year || '-W' || LPAD(p_week::TEXT, 2, '0') || '-\d{3}$')
      THEN CAST(SUBSTRING(settlement_code FROM 19 FOR 3) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_seq
  FROM inter_site_material_settlements
  WHERE year = p_year AND week_number = p_week;

  new_code := 'MAT-SET-' || p_year || '-W' || LPAD(p_week::TEXT, 2, '0') || '-' || LPAD(next_seq::TEXT, 3, '0');

  RETURN new_code;
END;
$_$;


ALTER FUNCTION "public"."generate_settlement_code"("p_year" integer, "p_week" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_settlement_reference"("p_site_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_date_code TEXT;
  v_next_seq INT;
  v_reference TEXT;
  v_lock_key BIGINT;
BEGIN
  -- Create unique lock key from site_id (using hash of site_id)
  -- This ensures only one process per site can generate a ref at a time
  v_lock_key := ('x' || substr(md5(p_site_id::text || 'settlement'), 1, 15))::bit(64)::bigint;

  -- Acquire advisory lock for this site (automatically released at transaction end)
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Get current date in YYMMDD format
  v_date_code := TO_CHAR(CURRENT_DATE, 'YYMMDD');

  -- Find the next sequence number for this site and day
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(settlement_reference FROM 'SET-' || v_date_code || '-(\d+)')
      AS INT
    )
  ), 0) + 1
  INTO v_next_seq
  FROM settlement_groups
  WHERE site_id = p_site_id
    AND settlement_reference LIKE 'SET-' || v_date_code || '-%';

  -- Format: SET-YYMMDD-NNN (padded to 3 digits)
  v_reference := 'SET-' || v_date_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');

  RETURN v_reference;
END;
$$;


ALTER FUNCTION "public"."generate_settlement_reference"("p_site_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_settlement_reference"("p_site_id" "uuid") IS 'Generates unique settlement reference in SET-YYMMDD-NNN format with advisory lock to prevent race conditions';



CREATE OR REPLACE FUNCTION "public"."generate_tea_shop_settlement_reference"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  ref TEXT;
  counter INT;
  date_str TEXT;
BEGIN
  date_str := TO_CHAR(NOW(), 'YYMMDD');

  -- Count settlements created today
  SELECT COUNT(*) + 1 INTO counter
  FROM tea_shop_settlements
  WHERE DATE(created_at) = CURRENT_DATE
    AND settlement_reference IS NOT NULL
    AND settlement_reference LIKE 'TSS-' || date_str || '-%';

  -- Generate reference with zero-padded counter
  ref := 'TSS-' || date_str || '-' || LPAD(counter::TEXT, 3, '0');

  RETURN ref;
END;
$$;


ALTER FUNCTION "public"."generate_tea_shop_settlement_reference"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_tea_shop_settlement_reference"() IS 'Generates unique settlement reference in TSS-YYMMDD-NNN format';



CREATE OR REPLACE FUNCTION "public"."generate_transfer_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  new_number TEXT;
  year_month TEXT;
  seq_num INTEGER;
BEGIN
  year_month := TO_CHAR(NOW(), 'YYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(transfer_number FROM 9) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM stock_transfers
  WHERE transfer_number LIKE 'ST-' || year_month || '-%';

  new_number := 'ST-' || year_month || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_number;
END;
$$;


ALTER FUNCTION "public"."generate_transfer_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_weekly_notifications"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_count INT := 0;
    v_site RECORD;
    v_pending_salary DECIMAL;
    v_missing_dates DATE[];
BEGIN
    -- For each active site
    FOR v_site IN SELECT id, name FROM sites WHERE status = 'active' LOOP
        
        -- Check pending salary (if Saturday)
        IF EXTRACT(DOW FROM CURRENT_DATE) = 6 THEN
            SELECT COALESCE(SUM(daily_earnings), 0)
            INTO v_pending_salary
            FROM daily_attendance
            WHERE site_id = v_site.id
                AND date BETWEEN CURRENT_DATE - 6 AND CURRENT_DATE
                AND is_deleted = FALSE;
            
            IF v_pending_salary > 0 THEN
                -- Create notification for office users
                INSERT INTO notifications (user_id, title, message, notification_type, related_table, related_id)
                SELECT 
                    u.id,
                    'Weekly Salary Due',
                    'Salary calculation pending for ' || v_site.name || '. Total: ₹' || v_pending_salary::TEXT,
                    'salary_due',
                    'sites',
                    v_site.id
                FROM users u
                WHERE u.role IN ('admin', 'office')
                    AND v_site.id = ANY(u.assigned_sites);
                
                v_count := v_count + 1;
            END IF;
        END IF;
        
        -- Check for missing attendance entries (last 7 days)
        SELECT array_agg(d::DATE)
        INTO v_missing_dates
        FROM generate_series(CURRENT_DATE - 7, CURRENT_DATE - 1, '1 day'::INTERVAL) d
        WHERE NOT EXISTS (
            SELECT 1 FROM daily_attendance da
            WHERE da.site_id = v_site.id AND da.date = d::DATE AND da.is_deleted = FALSE
        )
        AND NOT EXISTS (
            SELECT 1 FROM site_holidays sh
            WHERE sh.site_id = v_site.id AND sh.date = d::DATE
        );
        
        IF array_length(v_missing_dates, 1) > 0 THEN
            INSERT INTO notifications (user_id, title, message, notification_type, related_table, related_id)
            SELECT 
                u.id,
                'Missing Attendance',
                'No attendance entries for ' || v_site.name || ' on ' || array_to_string(v_missing_dates, ', '),
                'no_attendance',
                'sites',
                v_site.id
            FROM users u
            WHERE u.role IN ('admin', 'office')
                AND v_site.id = ANY(u.assigned_sites);
            
            v_count := v_count + 1;
        END IF;
        
    END LOOP;
    
    RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."generate_weekly_notifications"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_weekly_notifications"() IS 'Generate system notifications for pending actions';



CREATE OR REPLACE FUNCTION "public"."get_batch_settlement_summary"("batch_id" "uuid") RETURNS TABLE("settlement_reference" "text", "settlement_date" "date", "amount_used" numeric, "laborer_count" integer, "site_name" "text", "payment_channel" "text")
    LANGUAGE "sql"
    AS $$
  SELECT
    sg.settlement_reference,
    sg.settlement_date,
    ewbu.amount_used,
    sg.laborer_count,
    s.name as site_name,
    sg.payment_channel
  FROM engineer_wallet_batch_usage ewbu
  JOIN site_engineer_transactions spent ON spent.id = ewbu.transaction_id
  JOIN settlement_groups sg ON sg.id = spent.settlement_group_id
  JOIN sites s ON s.id = sg.site_id
  WHERE ewbu.batch_transaction_id = batch_id
  ORDER BY sg.settlement_date DESC;
$$;


ALTER FUNCTION "public"."get_batch_settlement_summary"("batch_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_batch_settlement_summary"("batch_id" "uuid") IS 'Returns all settlements that used money from a specific wallet batch';



CREATE OR REPLACE FUNCTION "public"."get_current_user_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id
    FROM users
    WHERE auth_id = auth.uid();
    
    RETURN v_user_id;
END;
$$;


ALTER FUNCTION "public"."get_current_user_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_current_user_id"() IS 'Returns the user ID of the currently authenticated user';



CREATE OR REPLACE FUNCTION "public"."get_material_count_for_vendor"("p_vendor_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM vendor_inventory
    WHERE vendor_id = p_vendor_id
      AND is_available = TRUE
  );
END;
$$;


ALTER FUNCTION "public"."get_material_count_for_vendor"("p_vendor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_materials_with_variants"("p_category_id" "uuid" DEFAULT NULL::"uuid", "p_include_inactive" boolean DEFAULT false) RETURNS TABLE("id" "uuid", "name" "text", "code" "text", "unit" "text", "parent_id" "uuid", "parent_name" "text", "category_id" "uuid", "category_name" "text", "is_active" boolean, "variant_count" bigint, "is_variant" boolean)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.name,
    m.code,
    m.unit::TEXT,
    m.parent_id,
    parent.name as parent_name,
    m.category_id,
    mc.name as category_name,
    m.is_active,
    (SELECT COUNT(*) FROM materials v WHERE v.parent_id = m.id AND (p_include_inactive OR v.is_active = true)) as variant_count,
    m.parent_id IS NOT NULL as is_variant
  FROM materials m
  LEFT JOIN material_categories mc ON mc.id = m.category_id
  LEFT JOIN materials parent ON parent.id = m.parent_id
  WHERE (p_include_inactive OR m.is_active = true)
    AND (p_category_id IS NULL OR m.category_id = p_category_id)
  ORDER BY
    -- Order parents first, then variants grouped under their parent
    COALESCE(parent.name, m.name),
    m.parent_id NULLS FIRST,
    m.name;
END;
$$;


ALTER FUNCTION "public"."get_materials_with_variants"("p_category_id" "uuid", "p_include_inactive" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_report"("p_site_id" "uuid", "p_year" integer, "p_month" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_result JSONB;
    v_summary JSONB;
    v_by_category JSONB;
    v_by_role JSONB;
    v_by_section JSONB;
    v_expenses JSONB;
BEGIN
    v_start_date := make_date(p_year, p_month, 1);
    v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    
    -- Overall summary
    SELECT jsonb_build_object(
        'total_work_days', COALESCE(SUM(work_days), 0),
        'total_earnings', COALESCE(SUM(daily_earnings), 0),
        'unique_laborers', COUNT(DISTINCT laborer_id),
        'working_days', COUNT(DISTINCT date)
    )
    INTO v_summary
    FROM daily_attendance
    WHERE site_id = p_site_id 
        AND date BETWEEN v_start_date AND v_end_date
        AND is_deleted = FALSE;
    
    -- By category
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'category', category_name,
            'work_days', total_days,
            'amount', total_amount,
            'laborers', laborer_count
        ) ORDER BY total_amount DESC
    ), '[]'::JSONB)
    INTO v_by_category
    FROM (
        SELECT 
            lc.name as category_name,
            SUM(da.work_days) as total_days,
            SUM(da.daily_earnings) as total_amount,
            COUNT(DISTINCT da.laborer_id) as laborer_count
        FROM daily_attendance da
        JOIN laborers l ON da.laborer_id = l.id
        JOIN labor_categories lc ON l.category_id = lc.id
        WHERE da.site_id = p_site_id 
            AND da.date BETWEEN v_start_date AND v_end_date
            AND da.is_deleted = FALSE
        GROUP BY lc.name
    ) cat_data;
    
    -- By role
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'role', role_name,
            'category', category_name,
            'work_days', total_days,
            'amount', total_amount,
            'laborers', laborer_count
        ) ORDER BY total_amount DESC
    ), '[]'::JSONB)
    INTO v_by_role
    FROM (
        SELECT 
            lr.name as role_name,
            lc.name as category_name,
            SUM(da.work_days) as total_days,
            SUM(da.daily_earnings) as total_amount,
            COUNT(DISTINCT da.laborer_id) as laborer_count
        FROM daily_attendance da
        JOIN laborers l ON da.laborer_id = l.id
        JOIN labor_roles lr ON l.role_id = lr.id
        JOIN labor_categories lc ON l.category_id = lc.id
        WHERE da.site_id = p_site_id 
            AND da.date BETWEEN v_start_date AND v_end_date
            AND da.is_deleted = FALSE
        GROUP BY lr.name, lc.name
    ) role_data;
    
    -- By section
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'section', section_name,
            'work_days', total_days,
            'amount', total_amount,
            'laborers', laborer_count
        ) ORDER BY seq_order
    ), '[]'::JSONB)
    INTO v_by_section
    FROM (
        SELECT 
            bs.name as section_name,
            bs.sequence_order as seq_order,
            SUM(da.work_days) as total_days,
            SUM(da.daily_earnings) as total_amount,
            COUNT(DISTINCT da.laborer_id) as laborer_count
        FROM daily_attendance da
        JOIN building_sections bs ON da.section_id = bs.id
        WHERE da.site_id = p_site_id 
            AND da.date BETWEEN v_start_date AND v_end_date
            AND da.is_deleted = FALSE
        GROUP BY bs.name, bs.sequence_order
    ) section_data;
    
    -- Expenses
    SELECT jsonb_build_object(
        'total', COALESCE(SUM(e.amount), 0),
        'by_category', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object('category', cat_name, 'amount', cat_amount)
            )
            FROM (
                SELECT 
                    ec.name as cat_name,
                    SUM(ex.amount) as cat_amount
                FROM expenses ex
                JOIN expense_categories ec ON ex.category_id = ec.id
                WHERE ex.site_id = p_site_id 
                    AND ex.date BETWEEN v_start_date AND v_end_date
                    AND ex.is_deleted = FALSE
                GROUP BY ec.name
            ) exp_cats
        ), '[]'::JSONB)
    )
    INTO v_expenses
    FROM expenses e
    WHERE e.site_id = p_site_id 
        AND e.date BETWEEN v_start_date AND v_end_date
        AND e.is_deleted = FALSE;
    
    -- Build final result
    v_result := jsonb_build_object(
        'site_id', p_site_id,
        'period', jsonb_build_object(
            'year', p_year, 
            'month', p_month, 
            'start', v_start_date, 
            'end', v_end_date
        ),
        'summary', v_summary,
        'by_category', v_by_category,
        'by_role', v_by_role,
        'by_section', v_by_section,
        'expenses', v_expenses
    );
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_monthly_report"("p_site_id" "uuid", "p_year" integer, "p_month" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_monthly_report"("p_site_id" "uuid", "p_year" integer, "p_month" integer) IS 'Generate monthly report data for a site';



CREATE OR REPLACE FUNCTION "public"."get_settlement_batch_sources"("p_settlement_group_id" "uuid") RETURNS TABLE("batch_code" "text", "batch_transaction_id" "uuid", "amount_used" numeric, "payer_source" "text", "payer_name" "text", "batch_date" "date")
    LANGUAGE "sql"
    AS $$
  SELECT
    batch_tx.batch_code,
    ewbu.batch_transaction_id,
    ewbu.amount_used,
    batch_tx.payer_source,
    batch_tx.payer_name,
    batch_tx.transaction_date::DATE as batch_date
  FROM settlement_groups sg
  JOIN site_engineer_transactions spent_tx ON spent_tx.settlement_group_id = sg.id
  JOIN engineer_wallet_batch_usage ewbu ON ewbu.transaction_id = spent_tx.id
  JOIN site_engineer_transactions batch_tx ON batch_tx.id = ewbu.batch_transaction_id
  WHERE sg.id = p_settlement_group_id
  ORDER BY ewbu.amount_used DESC;
$$;


ALTER FUNCTION "public"."get_settlement_batch_sources"("p_settlement_group_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_settlement_batch_sources"("p_settlement_group_id" "uuid") IS 'Returns all batch deposits that funded a specific settlement';



CREATE OR REPLACE FUNCTION "public"."get_settlement_laborers"("p_settlement_group_id" "uuid") RETURNS TABLE("laborer_id" "uuid", "laborer_name" "text", "amount" numeric, "work_date" "date", "attendance_type" "text")
    LANGUAGE "sql"
    AS $$
  -- Daily laborers
  SELECT
    l.id as laborer_id,
    l.name as laborer_name,
    da.daily_earnings as amount,
    da.date as work_date,
    'daily'::TEXT as attendance_type
  FROM daily_attendance da
  JOIN laborers l ON l.id = da.laborer_id
  WHERE da.settlement_group_id = p_settlement_group_id

  UNION ALL

  -- Market laborers
  SELECT
    NULL as laborer_id,
    lr.name as laborer_name,
    mla.total_cost as amount,
    mla.date as work_date,
    'market'::TEXT as attendance_type
  FROM market_laborer_attendance mla
  JOIN labor_roles lr ON lr.id = mla.role_id
  WHERE mla.settlement_group_id = p_settlement_group_id

  ORDER BY work_date, laborer_name;
$$;


ALTER FUNCTION "public"."get_settlement_laborers"("p_settlement_group_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_settlement_laborers"("p_settlement_group_id" "uuid") IS 'Returns all laborers paid in a specific settlement';



CREATE OR REPLACE FUNCTION "public"."get_site_dashboard"("p_site_id" "uuid", "p_date" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_result JSONB;
    v_today_data JSONB;
    v_week_data JSONB;
    v_section_data JSONB;
    v_pending_salary DECIMAL(12,2);
    v_week_start DATE;
    v_week_end DATE;
BEGIN
    -- Calculate week boundaries (Saturday ending)
    v_week_end := p_date + (6 - EXTRACT(DOW FROM p_date)::INT); -- Next Saturday
    v_week_start := v_week_end - 6;
    
    -- Today's data
    SELECT jsonb_build_object(
        'total_laborers', COUNT(DISTINCT laborer_id),
        'total_work_days', COALESCE(SUM(work_days), 0),
        'total_earnings', COALESCE(SUM(daily_earnings), 0)
    )
    INTO v_today_data
    FROM daily_attendance
    WHERE site_id = p_site_id AND date = p_date AND is_deleted = FALSE;
    
    -- Week's data
    SELECT jsonb_build_object(
        'total_laborers', COUNT(DISTINCT laborer_id),
        'total_work_days', COALESCE(SUM(work_days), 0),
        'total_earnings', COALESCE(SUM(daily_earnings), 0),
        'week_start', v_week_start,
        'week_end', v_week_end
    )
    INTO v_week_data
    FROM daily_attendance
    WHERE site_id = p_site_id 
        AND date BETWEEN v_week_start AND v_week_end 
        AND is_deleted = FALSE;
    
    -- Section breakdown
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'section_id', bs.id,
            'section_name', bs.name,
            'status', bs.status,
            'labor_cost', COALESCE(section_costs.labor_cost, 0),
            'work_days', COALESCE(section_costs.work_days, 0)
        ) ORDER BY bs.sequence_order
    ), '[]'::JSONB)
    INTO v_section_data
    FROM building_sections bs
    LEFT JOIN (
        SELECT section_id, 
               SUM(daily_earnings) as labor_cost,
               SUM(work_days) as work_days
        FROM daily_attendance
        WHERE site_id = p_site_id AND is_deleted = FALSE
        GROUP BY section_id
    ) section_costs ON bs.id = section_costs.section_id
    WHERE bs.site_id = p_site_id;
    
    -- Pending salary calculation
    SELECT COALESCE(SUM(net_payable - amount_paid), 0)
    INTO v_pending_salary
    FROM salary_periods sp
    JOIN laborers l ON sp.laborer_id = l.id
    JOIN laborer_site_assignments lsa ON l.id = lsa.laborer_id AND lsa.site_id = p_site_id
    WHERE sp.status IN ('calculated', 'partial');
    
    -- Build result
    v_result := jsonb_build_object(
        'site_id', p_site_id,
        'date', p_date,
        'today', v_today_data,
        'this_week', v_week_data,
        'sections', v_section_data,
        'pending_salary', v_pending_salary
    );
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_site_dashboard"("p_site_id" "uuid", "p_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_site_dashboard"("p_site_id" "uuid", "p_date" "date") IS 'Get basic dashboard data for a site';



CREATE OR REPLACE FUNCTION "public"."get_site_dashboard_detailed"("p_site_id" "uuid", "p_date" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_result JSONB;
    v_today_data JSONB;
    v_week_data JSONB;
    v_section_data JSONB;
    v_category_data JSONB;
    v_pending_salary DECIMAL(12,2);
    v_week_start DATE;
    v_week_end DATE;
BEGIN
    -- Calculate week boundaries (Saturday ending)
    v_week_end := p_date + (6 - EXTRACT(DOW FROM p_date)::INT);
    v_week_start := v_week_end - 6;
    
    -- Today's data
    SELECT jsonb_build_object(
        'total_laborers', COUNT(DISTINCT laborer_id),
        'total_work_days', COALESCE(SUM(work_days), 0),
        'total_earnings', COALESCE(SUM(daily_earnings), 0)
    )
    INTO v_today_data
    FROM daily_attendance
    WHERE site_id = p_site_id AND date = p_date AND is_deleted = FALSE;
    
    -- Week's data
    SELECT jsonb_build_object(
        'total_laborers', COUNT(DISTINCT laborer_id),
        'total_work_days', COALESCE(SUM(work_days), 0),
        'total_earnings', COALESCE(SUM(daily_earnings), 0),
        'week_start', v_week_start,
        'week_end', v_week_end
    )
    INTO v_week_data
    FROM daily_attendance
    WHERE site_id = p_site_id 
        AND date BETWEEN v_week_start AND v_week_end 
        AND is_deleted = FALSE;
    
    -- Category breakdown for today
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'category', category_name,
            'count', laborer_count,
            'days', total_days,
            'amount', total_amount
        )
    ), '[]'::JSONB)
    INTO v_category_data
    FROM v_site_daily_by_category
    WHERE site_id = p_site_id AND date = p_date;
    
    -- Section breakdown
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'section_id', section_id,
            'section_name', section_name,
            'status', status,
            'labor_cost', labor_cost,
            'expense_cost', expense_cost,
            'total_cost', total_cost,
            'work_days', total_work_days
        ) ORDER BY sequence_order
    ), '[]'::JSONB)
    INTO v_section_data
    FROM v_section_cost_summary
    WHERE site_id = p_site_id;
    
    -- Pending salary
    SELECT COALESCE(SUM(net_payable - amount_paid), 0)
    INTO v_pending_salary
    FROM salary_periods sp
    JOIN laborers l ON sp.laborer_id = l.id
    JOIN laborer_site_assignments lsa ON l.id = lsa.laborer_id AND lsa.site_id = p_site_id
    WHERE sp.status IN ('calculated', 'partial');
    
    -- Build result
    v_result := jsonb_build_object(
        'site_id', p_site_id,
        'date', p_date,
        'today', v_today_data,
        'today_by_category', v_category_data,
        'this_week', v_week_data,
        'sections', v_section_data,
        'pending_salary', v_pending_salary
    );
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_site_dashboard_detailed"("p_site_id" "uuid", "p_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_site_dashboard_detailed"("p_site_id" "uuid", "p_date" "date") IS 'Get detailed dashboard data with category breakdown';



CREATE OR REPLACE FUNCTION "public"."get_team_weekly_summary"("p_team_id" "uuid", "p_week_ending" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_week_start DATE;
    v_result JSONB;
    v_members JSONB;
    v_role_breakdown JSONB;
    v_totals JSONB;
BEGIN
    v_week_start := p_week_ending - 6;
    
    -- Get member details
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'laborer_id', l.id,
            'name', l.name,
            'role', lr.name,
            'days', COALESCE(att.total_days, 0),
            'earnings', COALESCE(att.total_earnings, 0),
            'advances', COALESCE(adv.total_advances, 0)
        ) ORDER BY lr.name, l.name
    ), '[]'::JSONB)
    INTO v_members
    FROM laborers l
    JOIN labor_roles lr ON l.role_id = lr.id
    LEFT JOIN (
        SELECT laborer_id, SUM(work_days) as total_days, SUM(daily_earnings) as total_earnings
        FROM daily_attendance
        WHERE date BETWEEN v_week_start AND p_week_ending AND is_deleted = FALSE
        GROUP BY laborer_id
    ) att ON l.id = att.laborer_id
    LEFT JOIN (
        SELECT laborer_id, SUM(amount) as total_advances
        FROM advances
        WHERE date BETWEEN v_week_start AND p_week_ending 
            AND transaction_type = 'advance' 
            AND is_deleted = FALSE
        GROUP BY laborer_id
    ) adv ON l.id = adv.laborer_id
    WHERE l.team_id = p_team_id AND l.status = 'active';
    
    -- Get role breakdown
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'role', role_name,
            'count', laborer_count,
            'days', total_days,
            'amount', total_amount
        )
    ), '[]'::JSONB)
    INTO v_role_breakdown
    FROM (
        SELECT 
            lr.name as role_name,
            COUNT(DISTINCT da.laborer_id) as laborer_count,
            SUM(da.work_days) as total_days,
            SUM(da.daily_earnings) as total_amount
        FROM daily_attendance da
        JOIN laborers l ON da.laborer_id = l.id
        JOIN labor_roles lr ON l.role_id = lr.id
        WHERE l.team_id = p_team_id
            AND da.date BETWEEN v_week_start AND p_week_ending
            AND da.is_deleted = FALSE
        GROUP BY lr.name
    ) role_data;
    
    -- Get totals
    SELECT jsonb_build_object(
        'total_members', COUNT(DISTINCT da.laborer_id),
        'total_days', COALESCE(SUM(da.work_days), 0),
        'total_earnings', COALESCE(SUM(da.daily_earnings), 0),
        'total_expenses', COALESCE((
            SELECT SUM(amount) FROM expenses 
            WHERE team_id = p_team_id 
                AND date BETWEEN v_week_start AND p_week_ending 
                AND is_deleted = FALSE
        ), 0),
        'total_advances', COALESCE((
            SELECT SUM(a.amount) 
            FROM advances a
            JOIN laborers l ON a.laborer_id = l.id
            WHERE l.team_id = p_team_id 
                AND a.date BETWEEN v_week_start AND p_week_ending 
                AND a.transaction_type = 'advance'
                AND a.is_deleted = FALSE
        ), 0)
    )
    INTO v_totals
    FROM daily_attendance da
    JOIN laborers l ON da.laborer_id = l.id
    WHERE l.team_id = p_team_id
        AND da.date BETWEEN v_week_start AND p_week_ending
        AND da.is_deleted = FALSE;
    
    -- Build result
    v_result := jsonb_build_object(
        'team_id', p_team_id,
        'week_start', v_week_start,
        'week_ending', p_week_ending,
        'totals', v_totals,
        'role_breakdown', v_role_breakdown,
        'members', v_members
    );
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_team_weekly_summary"("p_team_id" "uuid", "p_week_ending" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_team_weekly_summary"("p_team_id" "uuid", "p_week_ending" "date") IS 'Get detailed weekly summary for a team';



CREATE OR REPLACE FUNCTION "public"."get_unsettled_balance"("p_site_group_id" "uuid", "p_from_site_id" "uuid", "p_to_site_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total_usage DECIMAL;
  v_total_settled DECIMAL;
BEGIN
  -- Total usage cost
  SELECT COALESCE(SUM(ABS(gst.total_cost)), 0)
  INTO v_total_usage
  FROM group_stock_transactions gst
  WHERE gst.site_group_id = p_site_group_id
    AND gst.payment_source_site_id = p_from_site_id
    AND gst.usage_site_id = p_to_site_id
    AND gst.transaction_type = 'usage';

  -- Total settled amount
  SELECT COALESCE(SUM(isms.paid_amount), 0)
  INTO v_total_settled
  FROM inter_site_material_settlements isms
  WHERE isms.site_group_id = p_site_group_id
    AND isms.from_site_id = p_from_site_id
    AND isms.to_site_id = p_to_site_id
    AND isms.status != 'cancelled';

  RETURN v_total_usage - v_total_settled;
END;
$$;


ALTER FUNCTION "public"."get_unsettled_balance"("p_site_group_id" "uuid", "p_from_site_id" "uuid", "p_to_site_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "public"."user_role"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_role user_role;
BEGIN
    SELECT role INTO v_role
    FROM users
    WHERE auth_id = auth.uid();
    
    RETURN v_role;
END;
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_role"() IS 'Returns the role of the currently authenticated user';



CREATE OR REPLACE FUNCTION "public"."get_vendor_count_for_material"("p_material_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT vendor_id)
    FROM vendor_inventory
    WHERE material_id = p_material_id
      AND is_available = TRUE
  );
END;
$$;


ALTER FUNCTION "public"."get_vendor_count_for_material"("p_material_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_week_attendance_summary"("p_site_id" "uuid", "p_week_ending" "date") RETURNS TABLE("laborer_id" "uuid", "laborer_name" character varying, "laborer_phone" character varying, "role_name" character varying, "category_name" character varying, "team_id" "uuid", "team_name" character varying, "total_days" numeric, "total_earnings" numeric, "pending_advances" numeric, "extras" numeric, "net_payable" numeric)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_week_start DATE;
BEGIN
    v_week_start := p_week_ending - 6;
    
    RETURN QUERY
    SELECT 
        l.id as laborer_id,
        l.name as laborer_name,
        l.phone as laborer_phone,
        lr.name as role_name,
        lc.name as category_name,
        t.id as team_id,
        t.name as team_name,
        COALESCE(SUM(da.work_days), 0::DECIMAL) as total_days,
        COALESCE(SUM(da.daily_earnings), 0::DECIMAL) as total_earnings,
        COALESCE((
            SELECT SUM(a.amount - a.deducted_amount)
            FROM advances a
            WHERE a.laborer_id = l.id
                AND a.transaction_type = 'advance'
                AND a.deduction_status IN ('pending', 'partial')
                AND a.is_deleted = FALSE
        ), 0::DECIMAL) as pending_advances,
        COALESCE((
            SELECT SUM(a.amount)
            FROM advances a
            WHERE a.laborer_id = l.id
                AND a.transaction_type = 'extra'
                AND a.date BETWEEN v_week_start AND p_week_ending
                AND a.is_deleted = FALSE
        ), 0::DECIMAL) as extras,
        COALESCE(SUM(da.daily_earnings), 0::DECIMAL) 
            - COALESCE((
                SELECT SUM(a.amount - a.deducted_amount)
                FROM advances a
                WHERE a.laborer_id = l.id
                    AND a.transaction_type = 'advance'
                    AND a.deduction_status IN ('pending', 'partial')
                    AND a.is_deleted = FALSE
            ), 0::DECIMAL)
            + COALESCE((
                SELECT SUM(a.amount)
                FROM advances a
                WHERE a.laborer_id = l.id
                    AND a.transaction_type = 'extra'
                    AND a.date BETWEEN v_week_start AND p_week_ending
                    AND a.is_deleted = FALSE
            ), 0::DECIMAL) as net_payable
    FROM laborers l
    JOIN labor_roles lr ON l.role_id = lr.id
    JOIN labor_categories lc ON l.category_id = lc.id
    LEFT JOIN teams t ON l.team_id = t.id
    JOIN daily_attendance da ON da.laborer_id = l.id 
        AND da.site_id = p_site_id
        AND da.date BETWEEN v_week_start AND p_week_ending
        AND da.is_deleted = FALSE
    WHERE l.status = 'active'
    GROUP BY l.id, l.name, l.phone, lr.name, lc.name, t.id, t.name
    ORDER BY t.name NULLS LAST, lc.name, lr.name, l.name;
END;
$$;


ALTER FUNCTION "public"."get_week_attendance_summary"("p_site_id" "uuid", "p_week_ending" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_week_attendance_summary"("p_site_id" "uuid", "p_week_ending" "date") IS 'Get attendance summary for salary calculation';



CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN get_user_role() = 'admin';
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_admin"() IS 'Returns true if current user is an admin';



CREATE OR REPLACE FUNCTION "public"."notify_engineer_delivery_pending"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_site_name TEXT;
  v_vendor_name TEXT;
  v_engineer RECORD;
BEGIN
  -- Only notify for new pending deliveries
  IF NEW.verification_status != 'pending' OR NEW.requires_verification = FALSE THEN
    RETURN NEW;
  END IF;

  -- Get site and vendor names
  SELECT name INTO v_site_name FROM sites WHERE id = NEW.site_id;
  SELECT name INTO v_vendor_name FROM vendors WHERE id = NEW.vendor_id;

  -- Notify engineers assigned to this site
  FOR v_engineer IN
    SELECT u.id
    FROM users u
    WHERE u.role = 'site_engineer'
      AND u.status = 'active'
      AND NEW.site_id = ANY(u.assigned_sites)
  LOOP
    INSERT INTO notifications (
      user_id, title, message, notification_type,
      related_id, related_table, action_url, site_id
    ) VALUES (
      v_engineer.id,
      'Delivery Pending Verification',
      'Delivery from ' || v_vendor_name || ' at ' || v_site_name || ' needs verification',
      'delivery_pending',
      NEW.id,
      'deliveries',
      '/site/delivery-verification/' || NEW.id,
      NEW.site_id
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_engineer_delivery_pending"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_attendance_before_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_laborer_record RECORD;
    v_log_id UUID;
BEGIN
    -- 1. Get laborer details and set defaults
    SELECT daily_rate, team_id INTO v_laborer_record
    FROM laborers
    WHERE id = NEW.laborer_id;
    
    -- Set daily rate if not provided
    IF NEW.daily_rate_applied IS NULL OR NEW.daily_rate_applied = 0 THEN
        NEW.daily_rate_applied := COALESCE(v_laborer_record.daily_rate, 0);
    END IF;
    
    -- Set team_id if not provided
    IF NEW.team_id IS NULL THEN
        NEW.team_id := v_laborer_record.team_id;
    END IF;
    
    -- 2. Calculate hours worked from start/end time
    IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
        NEW.hours_worked := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600;
        IF NEW.hours_worked < 0 THEN
            NEW.hours_worked := NEW.hours_worked + 24;
        END IF;
    END IF;
    
    -- 3. Calculate daily earnings
    NEW.daily_earnings := COALESCE(NEW.work_days, 1) * COALESCE(NEW.daily_rate_applied, 0);
    
    -- 4. Calculate work variance
    IF NEW.hours_worked IS NOT NULL THEN
        CASE
            WHEN NEW.work_days = 1 THEN
                IF NEW.hours_worked > 9.5 THEN
                    NEW.work_variance := 'overtime';
                ELSIF NEW.hours_worked < 8.5 THEN
                    NEW.work_variance := 'undertime';
                ELSE
                    NEW.work_variance := 'standard';
                END IF;
            WHEN NEW.work_days = 0.5 THEN
                IF NEW.hours_worked > 5 THEN
                    NEW.work_variance := 'overtime';
                ELSIF NEW.hours_worked < 4 THEN
                    NEW.work_variance := 'undertime';
                ELSE
                    NEW.work_variance := 'standard';
                END IF;
            WHEN NEW.work_days = 1.5 THEN
                IF NEW.hours_worked > 14 THEN
                    NEW.work_variance := 'overtime';
                ELSIF NEW.hours_worked < 12 THEN
                    NEW.work_variance := 'undertime';
                ELSE
                    NEW.work_variance := 'standard';
                END IF;
            WHEN NEW.work_days = 2 THEN
                IF NEW.hours_worked > 18 THEN
                    NEW.work_variance := 'overtime';
                ELSIF NEW.hours_worked < 15 THEN
                    NEW.work_variance := 'undertime';
                ELSE
                    NEW.work_variance := 'standard';
                END IF;
            ELSE
                NEW.work_variance := 'standard';
        END CASE;
    END IF;
    
    -- 5. Ensure daily log exists
    SELECT id INTO v_log_id
    FROM daily_logs
    WHERE site_id = NEW.site_id AND date = NEW.date;
    
    IF v_log_id IS NULL THEN
        INSERT INTO daily_logs (site_id, date, logged_by)
        VALUES (NEW.site_id, NEW.date, NEW.entered_by)
        RETURNING id INTO v_log_id;
    END IF;
    
    NEW.daily_log_id := v_log_id;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."process_attendance_before_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_attendance_before_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Recalculate hours if times changed
    IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
        NEW.hours_worked := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600;
        IF NEW.hours_worked < 0 THEN
            NEW.hours_worked := NEW.hours_worked + 24;
        END IF;
    END IF;
    
    -- Recalculate earnings
    NEW.daily_earnings := COALESCE(NEW.work_days, 1) * COALESCE(NEW.daily_rate_applied, 0);
    
    -- Recalculate work variance
    IF NEW.hours_worked IS NOT NULL THEN
        CASE
            WHEN NEW.work_days = 1 THEN
                IF NEW.hours_worked > 9.5 THEN
                    NEW.work_variance := 'overtime';
                ELSIF NEW.hours_worked < 8.5 THEN
                    NEW.work_variance := 'undertime';
                ELSE
                    NEW.work_variance := 'standard';
                END IF;
            WHEN NEW.work_days = 0.5 THEN
                IF NEW.hours_worked > 5 THEN
                    NEW.work_variance := 'overtime';
                ELSIF NEW.hours_worked < 4 THEN
                    NEW.work_variance := 'undertime';
                ELSE
                    NEW.work_variance := 'standard';
                END IF;
            WHEN NEW.work_days = 1.5 THEN
                IF NEW.hours_worked > 14 THEN
                    NEW.work_variance := 'overtime';
                ELSIF NEW.hours_worked < 12 THEN
                    NEW.work_variance := 'undertime';
                ELSE
                    NEW.work_variance := 'standard';
                END IF;
            WHEN NEW.work_days = 2 THEN
                IF NEW.hours_worked > 18 THEN
                    NEW.work_variance := 'overtime';
                ELSIF NEW.hours_worked < 15 THEN
                    NEW.work_variance := 'undertime';
                ELSE
                    NEW.work_variance := 'standard';
                END IF;
            ELSE
                NEW.work_variance := 'standard';
        END CASE;
    END IF;
    
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."process_attendance_before_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_local_purchase_stock"("p_purchase_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_purchase RECORD;
  v_item RECORD;
  v_inv_id UUID;
BEGIN
  -- Get purchase details
  SELECT * INTO v_purchase FROM local_purchases WHERE id = p_purchase_id;

  IF v_purchase IS NULL OR v_purchase.stock_added = TRUE THEN
    RETURN FALSE;
  END IF;

  -- Process each item
  FOR v_item IN SELECT * FROM local_purchase_items WHERE local_purchase_id = p_purchase_id
  LOOP
    -- Skip items without material_id (custom materials don't go to stock)
    IF v_item.material_id IS NULL THEN
      CONTINUE;
    END IF;

    IF v_purchase.is_group_stock AND v_purchase.site_group_id IS NOT NULL THEN
      -- Add to group stock
      PERFORM update_group_stock_on_purchase(
        v_purchase.site_group_id,
        v_item.material_id,
        v_item.brand_id,
        v_item.quantity,
        v_item.unit_price,
        v_purchase.payment_source,
        v_purchase.site_id,
        'local_purchase',
        v_purchase.id,
        v_purchase.engineer_id
      );
    ELSE
      -- Add to site stock
      -- Find or create inventory record
      SELECT id INTO v_inv_id
      FROM stock_inventory
      WHERE site_id = v_purchase.site_id
        AND material_id = v_item.material_id
        AND (brand_id = v_item.brand_id OR (brand_id IS NULL AND v_item.brand_id IS NULL))
      LIMIT 1;

      IF v_inv_id IS NULL THEN
        INSERT INTO stock_inventory (
          site_id, material_id, brand_id,
          current_qty, avg_unit_cost, last_received_date
        ) VALUES (
          v_purchase.site_id, v_item.material_id, v_item.brand_id,
          v_item.quantity, v_item.unit_price, v_purchase.purchase_date
        )
        RETURNING id INTO v_inv_id;
      ELSE
        UPDATE stock_inventory
        SET
          current_qty = current_qty + v_item.quantity,
          avg_unit_cost = CASE
            WHEN current_qty + v_item.quantity > 0 THEN
              ((current_qty * COALESCE(avg_unit_cost, 0)) + (v_item.quantity * v_item.unit_price))
              / (current_qty + v_item.quantity)
            ELSE 0
          END,
          last_received_date = v_purchase.purchase_date,
          updated_at = NOW()
        WHERE id = v_inv_id;
      END IF;

      -- Create stock transaction
      INSERT INTO stock_transactions (
        site_id, inventory_id, transaction_type, transaction_date,
        quantity, unit_cost, total_cost, reference_type, reference_id, created_by
      ) VALUES (
        v_purchase.site_id, v_inv_id, 'purchase', v_purchase.purchase_date,
        v_item.quantity, v_item.unit_price, v_item.total_price,
        'local_purchase', v_purchase.id, v_purchase.engineer_id
      );
    END IF;

    -- Record price history if vendor is known
    IF v_purchase.vendor_id IS NOT NULL AND v_item.save_to_price_history THEN
      PERFORM record_price_entry(
        v_purchase.vendor_id,
        v_item.material_id,
        v_item.brand_id,
        v_item.unit_price,
        FALSE, -- price_includes_gst
        NULL,  -- gst_rate
        NULL,  -- transport_cost
        NULL,  -- loading_cost
        NULL,  -- unloading_cost
        'purchase',
        v_purchase.purchase_number,
        v_item.quantity,
        v_item.unit,
        v_purchase.engineer_id,
        'Local purchase by engineer'
      );
    END IF;
  END LOOP;

  -- Mark as stock added
  UPDATE local_purchases SET stock_added = TRUE, updated_at = NOW() WHERE id = p_purchase_id;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."process_local_purchase_stock"("p_purchase_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rebuild_tea_shop_waterfall"("p_tea_shop_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  settlement_rec RECORD;
  entry_rec RECORD;
  remaining_amount NUMERIC;
  entry_remaining NUMERIC;
  to_allocate NUMERIC;
BEGIN
  -- Step 1: Delete existing allocations for this shop's settlements
  DELETE FROM tea_shop_settlement_allocations
  WHERE settlement_id IN (
    SELECT id FROM tea_shop_settlements WHERE tea_shop_id = p_tea_shop_id
  );

  -- Step 2: Reset all entries for this shop to unpaid
  UPDATE tea_shop_entries
  SET amount_paid = 0, is_fully_paid = false
  WHERE tea_shop_id = p_tea_shop_id;

  -- Step 3: Reprocess each settlement chronologically
  FOR settlement_rec IN
    SELECT id, amount_paid
    FROM tea_shop_settlements
    WHERE tea_shop_id = p_tea_shop_id
    ORDER BY payment_date ASC, created_at ASC
  LOOP
    remaining_amount := settlement_rec.amount_paid;

    -- Allocate to entries (oldest first)
    FOR entry_rec IN
      SELECT id, total_amount, amount_paid
      FROM tea_shop_entries
      WHERE tea_shop_id = p_tea_shop_id
        AND COALESCE(amount_paid, 0) < COALESCE(total_amount, 0)
      ORDER BY date ASC
    LOOP
      EXIT WHEN remaining_amount <= 0;

      entry_remaining := COALESCE(entry_rec.total_amount, 0) - COALESCE(entry_rec.amount_paid, 0);

      IF entry_remaining > 0 THEN
        to_allocate := LEAST(remaining_amount, entry_remaining);

        -- Create allocation record
        INSERT INTO tea_shop_settlement_allocations (settlement_id, entry_id, allocated_amount)
        VALUES (settlement_rec.id, entry_rec.id, to_allocate);

        -- Update entry
        UPDATE tea_shop_entries
        SET amount_paid = COALESCE(amount_paid, 0) + to_allocate,
            is_fully_paid = (COALESCE(amount_paid, 0) + to_allocate >= COALESCE(total_amount, 0))
        WHERE id = entry_rec.id;

        remaining_amount := remaining_amount - to_allocate;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rebuild_tea_shop_waterfall"("p_tea_shop_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."rebuild_tea_shop_waterfall"("p_tea_shop_id" "uuid") IS 'Rebuilds waterfall settlement allocations for a tea shop. Called automatically when entry amounts change.';



CREATE OR REPLACE FUNCTION "public"."record_price_entry"("p_vendor_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_price" numeric, "p_price_includes_gst" boolean, "p_gst_rate" numeric, "p_transport_cost" numeric, "p_loading_cost" numeric, "p_unloading_cost" numeric, "p_source" "text", "p_source_reference" "text", "p_quantity" numeric, "p_unit" "text", "p_user_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_price_id UUID;
  v_total_cost DECIMAL;
BEGIN
  -- Calculate total landed cost
  v_total_cost := COALESCE(p_price, 0) +
    COALESCE(p_transport_cost, 0) +
    COALESCE(p_loading_cost, 0) +
    COALESCE(p_unloading_cost, 0);

  -- Insert price history record
  INSERT INTO price_history (
    vendor_id, material_id, brand_id,
    price, price_includes_gst, gst_rate,
    transport_cost, loading_cost, unloading_cost, total_landed_cost,
    recorded_date, source, source_reference,
    quantity, unit, recorded_by, notes
  ) VALUES (
    p_vendor_id, p_material_id, p_brand_id,
    p_price, p_price_includes_gst, p_gst_rate,
    p_transport_cost, p_loading_cost, p_unloading_cost, v_total_cost,
    CURRENT_DATE, p_source, p_source_reference,
    p_quantity, p_unit, p_user_id, p_notes
  )
  RETURNING id INTO v_price_id;

  -- Update or insert vendor inventory
  INSERT INTO vendor_inventory (
    vendor_id, material_id, brand_id,
    current_price, price_includes_gst, gst_rate,
    transport_cost, loading_cost, unloading_cost,
    unit, last_price_update, price_source
  ) VALUES (
    p_vendor_id, p_material_id, p_brand_id,
    p_price, p_price_includes_gst, p_gst_rate,
    p_transport_cost, p_loading_cost, p_unloading_cost,
    p_unit, NOW(), p_source
  )
  ON CONFLICT (vendor_id, material_id, brand_id)
  DO UPDATE SET
    current_price = EXCLUDED.current_price,
    price_includes_gst = EXCLUDED.price_includes_gst,
    gst_rate = EXCLUDED.gst_rate,
    transport_cost = EXCLUDED.transport_cost,
    loading_cost = EXCLUDED.loading_cost,
    unloading_cost = EXCLUDED.unloading_cost,
    unit = COALESCE(EXCLUDED.unit, vendor_inventory.unit),
    last_price_update = NOW(),
    price_source = EXCLUDED.price_source,
    updated_at = NOW();

  RETURN v_price_id;
END;
$$;


ALTER FUNCTION "public"."record_price_entry"("p_vendor_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_price" numeric, "p_price_includes_gst" boolean, "p_gst_rate" numeric, "p_transport_cost" numeric, "p_loading_cost" numeric, "p_unloading_cost" numeric, "p_source" "text", "p_source_reference" "text", "p_quantity" numeric, "p_unit" "text", "p_user_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_price_from_po_item"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_vendor_id UUID;
  v_transport_share DECIMAL;
  v_po_total DECIMAL;
  v_transport_cost DECIMAL;
BEGIN
  -- Get vendor_id and transport cost from PO
  SELECT
    po.vendor_id,
    po.subtotal,
    po.transport_cost
  INTO v_vendor_id, v_po_total, v_transport_cost
  FROM purchase_orders po
  WHERE po.id = NEW.po_id;

  -- Calculate transport share for this item
  IF v_po_total > 0 AND v_transport_cost > 0 THEN
    v_transport_share := (NEW.total_amount / v_po_total) * v_transport_cost / NEW.quantity;
  ELSE
    v_transport_share := 0;
  END IF;

  -- Record price history
  PERFORM record_price_entry(
    v_vendor_id,
    NEW.material_id,
    NEW.brand_id,
    NEW.unit_price,
    FALSE, -- price_includes_gst
    NEW.tax_rate,
    v_transport_share,
    0, -- loading_cost
    0, -- unloading_cost
    'purchase',
    (SELECT po_number FROM purchase_orders WHERE id = NEW.po_id),
    NEW.quantity,
    (SELECT unit::TEXT FROM materials WHERE id = NEW.material_id),
    (SELECT created_by FROM purchase_orders WHERE id = NEW.po_id),
    NULL
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."record_price_from_po_item"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_price_with_reason"("p_material_id" "uuid", "p_vendor_id" "uuid", "p_brand_id" "uuid", "p_price" numeric, "p_recorded_date" "date", "p_source" "text" DEFAULT 'manual'::"text", "p_change_reason_id" "uuid" DEFAULT NULL::"uuid", "p_change_reason_text" "text" DEFAULT NULL::"text", "p_bill_url" "text" DEFAULT NULL::"text", "p_bill_number" "text" DEFAULT NULL::"text", "p_bill_date" "date" DEFAULT NULL::"date", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_id UUID;
  v_previous_price DECIMAL;
  v_change_percentage DECIMAL;
BEGIN
  -- Get the previous price for this material/vendor combo
  SELECT price INTO v_previous_price
  FROM price_history
  WHERE material_id = p_material_id
    AND vendor_id = p_vendor_id
    AND (brand_id = p_brand_id OR (brand_id IS NULL AND p_brand_id IS NULL))
  ORDER BY recorded_date DESC
  LIMIT 1;

  -- Calculate percentage change
  IF v_previous_price IS NOT NULL AND v_previous_price > 0 THEN
    v_change_percentage := ((p_price - v_previous_price) / v_previous_price) * 100;
  END IF;

  -- Insert the new price record
  INSERT INTO price_history (
    material_id,
    vendor_id,
    brand_id,
    price,
    recorded_date,
    source,
    change_reason_id,
    change_reason_text,
    change_percentage,
    bill_url,
    bill_number,
    bill_date,
    notes
  ) VALUES (
    p_material_id,
    p_vendor_id,
    p_brand_id,
    p_price,
    p_recorded_date,
    p_source,
    p_change_reason_id,
    p_change_reason_text,
    v_change_percentage,
    p_bill_url,
    p_bill_number,
    p_bill_date,
    p_notes
  )
  RETURNING id INTO v_id;

  -- Update vendor_inventory with new price
  UPDATE vendor_inventory
  SET current_price = p_price,
      updated_at = NOW()
  WHERE material_id = p_material_id
    AND vendor_id = p_vendor_id
    AND (brand_id = p_brand_id OR (brand_id IS NULL AND p_brand_id IS NULL));

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."record_price_with_reason"("p_material_id" "uuid", "p_vendor_id" "uuid", "p_brand_id" "uuid", "p_price" numeric, "p_recorded_date" "date", "p_source" "text", "p_change_reason_id" "uuid", "p_change_reason_text" "text", "p_bill_url" "text", "p_bill_number" "text", "p_bill_date" "date", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_settlement_payment"("p_settlement_id" "uuid", "p_amount" numeric, "p_payment_mode" "text", "p_reference_number" "text" DEFAULT NULL::"text", "p_recorded_by" "uuid" DEFAULT NULL::"uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_payment_id UUID;
  v_current_paid DECIMAL;
  v_total_amount DECIMAL;
  v_new_status inter_site_settlement_status;
BEGIN
  -- Get current amounts
  SELECT paid_amount, total_amount
  INTO v_current_paid, v_total_amount
  FROM inter_site_material_settlements
  WHERE id = p_settlement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Settlement not found';
  END IF;

  -- Create payment record
  INSERT INTO inter_site_settlement_payments (
    settlement_id, amount, payment_mode, reference_number, notes, recorded_by
  ) VALUES (
    p_settlement_id, p_amount, p_payment_mode, p_reference_number, p_notes, p_recorded_by
  )
  RETURNING id INTO v_payment_id;

  -- Update settlement
  v_current_paid := v_current_paid + p_amount;

  IF v_current_paid >= v_total_amount THEN
    v_new_status := 'settled';
  ELSE
    v_new_status := 'approved'; -- Keep as approved if partial payment
  END IF;

  UPDATE inter_site_material_settlements
  SET paid_amount = v_current_paid,
      status = v_new_status,
      settled_by = CASE WHEN v_new_status = 'settled' THEN p_recorded_by ELSE settled_by END,
      settled_at = CASE WHEN v_new_status = 'settled' THEN NOW() ELSE settled_at END,
      updated_at = NOW()
  WHERE id = p_settlement_id;

  RETURN v_payment_id;
END;
$$;


ALTER FUNCTION "public"."record_settlement_payment"("p_settlement_id" "uuid", "p_amount" numeric, "p_payment_mode" "text", "p_reference_number" "text", "p_recorded_by" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_deletion"("p_request_id" "uuid", "p_reviewed_by" "uuid", "p_review_notes" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE deletion_requests
    SET 
        status = 'rejected',
        reviewed_by = p_reviewed_by,
        reviewed_at = NOW(),
        review_notes = p_review_notes
    WHERE id = p_request_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Deletion request not found or already processed';
    END IF;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."reject_deletion"("p_request_id" "uuid", "p_reviewed_by" "uuid", "p_review_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reject_deletion"("p_request_id" "uuid", "p_reviewed_by" "uuid", "p_review_notes" "text") IS 'Admin function to reject a deletion request';



CREATE OR REPLACE FUNCTION "public"."request_deletion"("p_table_name" character varying, "p_record_id" "uuid", "p_requested_by" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_request_id UUID;
    v_record_summary TEXT;
BEGIN
    -- Get a summary of what's being deleted (customize per table)
    CASE p_table_name
        WHEN 'laborers' THEN
            SELECT 'Laborer: ' || name INTO v_record_summary FROM laborers WHERE id = p_record_id;
        WHEN 'daily_attendance' THEN
            SELECT 'Attendance: ' || l.name || ' on ' || da.date::TEXT 
            INTO v_record_summary 
            FROM daily_attendance da 
            JOIN laborers l ON da.laborer_id = l.id 
            WHERE da.id = p_record_id;
        WHEN 'advances' THEN
            SELECT 'Advance: ₹' || amount || ' for ' || l.name 
            INTO v_record_summary 
            FROM advances a 
            JOIN laborers l ON a.laborer_id = l.id 
            WHERE a.id = p_record_id;
        ELSE
            v_record_summary := p_table_name || ': ' || p_record_id::TEXT;
    END CASE;
    
    -- Create deletion request
    INSERT INTO deletion_requests (
        table_name,
        record_id,
        record_summary,
        requested_by,
        reason
    ) VALUES (
        p_table_name,
        p_record_id,
        v_record_summary,
        p_requested_by,
        p_reason
    )
    RETURNING id INTO v_request_id;
    
    -- Create audit log
    PERFORM create_audit_log(
        p_table_name,
        p_record_id,
        'soft_delete',
        NULL,
        jsonb_build_object('deletion_request_id', v_request_id),
        p_requested_by,
        'Deletion requested: ' || COALESCE(p_reason, 'No reason provided')
    );
    
    RETURN v_request_id;
END;
$$;


ALTER FUNCTION "public"."request_deletion"("p_table_name" character varying, "p_record_id" "uuid", "p_requested_by" "uuid", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."request_deletion"("p_table_name" character varying, "p_record_id" "uuid", "p_requested_by" "uuid", "p_reason" "text") IS 'Create a deletion request for admin approval';



CREATE OR REPLACE FUNCTION "public"."set_laborer_daily_rate"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Only set if daily_rate is 0 or NULL
    IF NEW.daily_rate IS NULL OR NEW.daily_rate = 0 THEN
        SELECT default_daily_rate INTO NEW.daily_rate
        FROM labor_roles
        WHERE id = NEW.role_id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_laborer_daily_rate"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_local_purchase_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.purchase_number IS NULL THEN
    NEW.purchase_number := generate_local_purchase_number();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_local_purchase_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_process_local_purchase_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.add_to_stock = TRUE AND NEW.stock_added = FALSE THEN
    PERFORM process_local_purchase_stock(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_process_local_purchase_stock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_tea_shop_entry_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only rebuild if total_amount changed
  IF TG_OP = 'UPDATE' AND OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
    PERFORM rebuild_tea_shop_waterfall(NEW.tea_shop_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM rebuild_tea_shop_waterfall(OLD.tea_shop_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."trigger_tea_shop_entry_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_tea_shop_entry_change"() IS 'Trigger function that calls rebuild_tea_shop_waterfall when tea_shop_entries.total_amount changes.';



CREATE OR REPLACE FUNCTION "public"."trigger_tea_shop_settlement_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Settlement deleted - rebuild to mark entries as unpaid
    PERFORM rebuild_tea_shop_waterfall(OLD.tea_shop_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Rebuild if amount changed
    IF OLD.amount_paid IS DISTINCT FROM NEW.amount_paid THEN
      PERFORM rebuild_tea_shop_waterfall(NEW.tea_shop_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    -- For new settlements, rebuild to ensure allocations are correct
    PERFORM rebuild_tea_shop_waterfall(NEW.tea_shop_id);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trigger_tea_shop_settlement_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_tea_shop_settlement_change"() IS 'Trigger function that calls rebuild_tea_shop_waterfall when settlements are created, updated, or deleted.';



CREATE OR REPLACE FUNCTION "public"."unlock_batch_for_sharing"("p_inventory_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE group_stock_inventory
  SET is_dedicated = false,
      dedicated_site_id = NULL,
      can_be_shared = true,
      updated_at = NOW()
  WHERE id = p_inventory_id;

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."unlock_batch_for_sharing"("p_inventory_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_advance_deduction_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.transaction_type = 'advance' THEN
        IF NEW.deducted_amount >= NEW.amount THEN
            NEW.deduction_status := 'deducted';
        ELSIF NEW.deducted_amount > 0 THEN
            NEW.deduction_status := 'partial';
        END IF;
    ELSE
        -- Extras don't have deduction status
        NEW.deduction_status := 'deducted'; -- Mark as processed
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_advance_deduction_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_contract_after_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Update milestone status if milestone payment
    IF NEW.milestone_id IS NOT NULL THEN
        UPDATE contract_milestones
        SET status = 'paid', updated_at = NOW()
        WHERE id = NEW.milestone_id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_contract_after_payment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_daily_work_summary_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_daily_work_summary_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_group_stock_on_daily_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_inv_id UUID;
  v_avg_cost DECIMAL(12,2);
BEGIN
  -- Only process if using group stock
  IF NOT NEW.is_group_stock OR NEW.site_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the group inventory record
  SELECT id, avg_unit_cost INTO v_inv_id, v_avg_cost
  FROM group_stock_inventory
  WHERE site_group_id = NEW.site_group_id
    AND material_id = NEW.material_id
    AND (brand_id = NEW.brand_id OR (brand_id IS NULL AND NEW.brand_id IS NULL))
  LIMIT 1;

  IF v_inv_id IS NOT NULL THEN
    -- Update inventory (deduct quantity)
    UPDATE group_stock_inventory
    SET
      current_qty = current_qty - NEW.quantity,
      last_used_date = NEW.usage_date,
      updated_at = NOW()
    WHERE id = v_inv_id;

    -- Set cost on the usage record if not set
    IF NEW.unit_cost IS NULL THEN
      NEW.unit_cost := v_avg_cost;
      NEW.total_cost := NEW.quantity * v_avg_cost;
    END IF;

    -- Create group stock transaction
    INSERT INTO group_stock_transactions (
      site_group_id, inventory_id, material_id, brand_id,
      transaction_type, transaction_date,
      quantity, unit_cost, total_cost,
      usage_site_id, work_description,
      reference_type, reference_id, created_by
    ) VALUES (
      NEW.site_group_id, v_inv_id, NEW.material_id, NEW.brand_id,
      'usage', NEW.usage_date,
      -NEW.quantity, NEW.unit_cost, NEW.total_cost,
      NEW.site_id, NEW.work_description,
      'daily_material_usage', NEW.id, NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_group_stock_on_daily_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_group_stock_on_purchase"("p_group_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_quantity" numeric, "p_unit_cost" numeric, "p_payment_source" "text", "p_payment_site_id" "uuid", "p_reference_type" "text", "p_reference_id" "uuid", "p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_inv_id UUID;
  v_trans_id UUID;
BEGIN
  -- Find or create group inventory record
  SELECT id INTO v_inv_id
  FROM group_stock_inventory
  WHERE site_group_id = p_group_id
    AND material_id = p_material_id
    AND (brand_id = p_brand_id OR (brand_id IS NULL AND p_brand_id IS NULL));

  IF v_inv_id IS NULL THEN
    -- Create new inventory record
    INSERT INTO group_stock_inventory (
      site_group_id, material_id, brand_id,
      current_qty, avg_unit_cost, last_received_date
    ) VALUES (
      p_group_id, p_material_id, p_brand_id,
      p_quantity, p_unit_cost, CURRENT_DATE
    )
    RETURNING id INTO v_inv_id;
  ELSE
    -- Update existing inventory with weighted average cost
    UPDATE group_stock_inventory
    SET
      current_qty = current_qty + p_quantity,
      avg_unit_cost = CASE
        WHEN current_qty + p_quantity > 0 THEN
          ((current_qty * COALESCE(avg_unit_cost, 0)) + (p_quantity * p_unit_cost))
          / (current_qty + p_quantity)
        ELSE 0
      END,
      last_received_date = CURRENT_DATE,
      updated_at = NOW()
    WHERE id = v_inv_id;
  END IF;

  -- Create transaction record
  INSERT INTO group_stock_transactions (
    site_group_id, inventory_id, material_id, brand_id,
    transaction_type, transaction_date,
    quantity, unit_cost, total_cost,
    payment_source, payment_source_site_id,
    reference_type, reference_id, created_by
  ) VALUES (
    p_group_id, v_inv_id, p_material_id, p_brand_id,
    'purchase', CURRENT_DATE,
    p_quantity, p_unit_cost, p_quantity * p_unit_cost,
    p_payment_source, p_payment_site_id,
    p_reference_type, p_reference_id, p_user_id
  )
  RETURNING id INTO v_trans_id;

  RETURN v_trans_id;
END;
$$;


ALTER FUNCTION "public"."update_group_stock_on_purchase"("p_group_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_quantity" numeric, "p_unit_cost" numeric, "p_payment_source" "text", "p_payment_site_id" "uuid", "p_reference_type" "text", "p_reference_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_group_stock_on_purchase"("p_site_group_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_location_id" "uuid", "p_quantity" numeric, "p_unit_cost" numeric, "p_payment_source" "text", "p_payment_source_site_id" "uuid", "p_reference_type" "text", "p_reference_id" "uuid", "p_is_dedicated" boolean DEFAULT false, "p_dedicated_site_id" "uuid" DEFAULT NULL::"uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_inventory_id UUID;
  v_transaction_id UUID;
  v_batch_code TEXT;
  v_existing_qty DECIMAL;
  v_existing_cost DECIMAL;
  v_new_avg_cost DECIMAL;
BEGIN
  -- Generate batch code
  v_batch_code := generate_batch_code();

  -- Find or create inventory record
  SELECT id, current_qty, avg_unit_cost
  INTO v_inventory_id, v_existing_qty, v_existing_cost
  FROM group_stock_inventory
  WHERE site_group_id = p_site_group_id
    AND material_id = p_material_id
    AND COALESCE(brand_id, '00000000-0000-0000-0000-000000000000') = COALESCE(p_brand_id, '00000000-0000-0000-0000-000000000000')
    AND COALESCE(location_id, '00000000-0000-0000-0000-000000000000') = COALESCE(p_location_id, '00000000-0000-0000-0000-000000000000');

  IF v_inventory_id IS NULL THEN
    -- Create new inventory record
    INSERT INTO group_stock_inventory (
      site_group_id, material_id, brand_id, location_id,
      current_qty, avg_unit_cost, last_received_date,
      batch_code, is_dedicated, dedicated_site_id
    ) VALUES (
      p_site_group_id, p_material_id, p_brand_id, p_location_id,
      p_quantity, p_unit_cost, CURRENT_DATE,
      v_batch_code, p_is_dedicated, p_dedicated_site_id
    )
    RETURNING id INTO v_inventory_id;

    v_new_avg_cost := p_unit_cost;
  ELSE
    -- Calculate weighted average cost
    v_new_avg_cost := ((v_existing_qty * v_existing_cost) + (p_quantity * p_unit_cost)) / (v_existing_qty + p_quantity);

    -- Update existing inventory
    UPDATE group_stock_inventory
    SET current_qty = current_qty + p_quantity,
        avg_unit_cost = v_new_avg_cost,
        last_received_date = CURRENT_DATE,
        batch_code = v_batch_code,
        is_dedicated = COALESCE(p_is_dedicated, is_dedicated),
        dedicated_site_id = COALESCE(p_dedicated_site_id, dedicated_site_id),
        updated_at = NOW()
    WHERE id = v_inventory_id;
  END IF;

  -- Create transaction record
  INSERT INTO group_stock_transactions (
    site_group_id, inventory_id, material_id, brand_id,
    transaction_type, quantity, unit_cost, total_cost,
    payment_source, payment_source_site_id,
    reference_type, reference_id,
    batch_code, notes
  ) VALUES (
    p_site_group_id, v_inventory_id, p_material_id, p_brand_id,
    'purchase', p_quantity, p_unit_cost, p_quantity * p_unit_cost,
    p_payment_source, p_payment_source_site_id,
    p_reference_type, p_reference_id,
    v_batch_code, p_notes
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;


ALTER FUNCTION "public"."update_group_stock_on_purchase"("p_site_group_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_location_id" "uuid", "p_quantity" numeric, "p_unit_cost" numeric, "p_payment_source" "text", "p_payment_source_site_id" "uuid", "p_reference_type" "text", "p_reference_id" "uuid", "p_is_dedicated" boolean, "p_dedicated_site_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_group_stock_on_usage"("p_site_group_id" "uuid", "p_inventory_id" "uuid", "p_quantity" numeric, "p_usage_site_id" "uuid", "p_work_description" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_transaction_id UUID;
  v_material_id UUID;
  v_brand_id UUID;
  v_unit_cost DECIMAL;
  v_batch_code TEXT;
  v_is_dedicated BOOLEAN;
  v_dedicated_site_id UUID;
  v_current_qty DECIMAL;
BEGIN
  -- Get inventory details
  SELECT material_id, brand_id, avg_unit_cost, batch_code,
         is_dedicated, dedicated_site_id, current_qty
  INTO v_material_id, v_brand_id, v_unit_cost, v_batch_code,
       v_is_dedicated, v_dedicated_site_id, v_current_qty
  FROM group_stock_inventory
  WHERE id = p_inventory_id
    AND site_group_id = p_site_group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory record not found';
  END IF;

  -- Check if site can use this batch
  IF v_is_dedicated AND v_dedicated_site_id IS NOT NULL AND v_dedicated_site_id != p_usage_site_id THEN
    RAISE EXCEPTION 'This batch is dedicated to another site and cannot be used';
  END IF;

  -- Check sufficient quantity
  IF v_current_qty < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_current_qty, p_quantity;
  END IF;

  -- Update inventory
  UPDATE group_stock_inventory
  SET current_qty = current_qty - p_quantity,
      last_used_date = CURRENT_DATE,
      updated_at = NOW()
  WHERE id = p_inventory_id;

  -- Create transaction record
  INSERT INTO group_stock_transactions (
    site_group_id, inventory_id, material_id, brand_id,
    transaction_type, quantity, unit_cost, total_cost,
    usage_site_id, work_description,
    batch_code, notes
  ) VALUES (
    p_site_group_id, p_inventory_id, v_material_id, v_brand_id,
    'usage', -p_quantity, v_unit_cost, p_quantity * v_unit_cost,
    p_usage_site_id, p_work_description,
    v_batch_code, p_notes
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;


ALTER FUNCTION "public"."update_group_stock_on_usage"("p_site_group_id" "uuid", "p_inventory_id" "uuid", "p_quantity" numeric, "p_usage_site_id" "uuid", "p_work_description" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_group_stock_on_usage"("p_group_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_quantity" numeric, "p_usage_site_id" "uuid", "p_work_description" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_inv_id UUID;
  v_avg_cost DECIMAL;
  v_trans_id UUID;
BEGIN
  -- Find the group inventory record
  SELECT id, avg_unit_cost INTO v_inv_id, v_avg_cost
  FROM group_stock_inventory
  WHERE site_group_id = p_group_id
    AND material_id = p_material_id
    AND (brand_id = p_brand_id OR (brand_id IS NULL AND p_brand_id IS NULL));

  IF v_inv_id IS NULL THEN
    RAISE EXCEPTION 'Material not found in group stock';
  END IF;

  -- Update inventory (deduct quantity)
  UPDATE group_stock_inventory
  SET
    current_qty = current_qty - p_quantity,
    last_used_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE id = v_inv_id;

  -- Create transaction record
  INSERT INTO group_stock_transactions (
    site_group_id, inventory_id, material_id, brand_id,
    transaction_type, transaction_date,
    quantity, unit_cost, total_cost,
    usage_site_id, work_description,
    reference_type, reference_id, created_by
  ) VALUES (
    p_group_id, v_inv_id, p_material_id, p_brand_id,
    'usage', CURRENT_DATE,
    -p_quantity, v_avg_cost, p_quantity * v_avg_cost,
    p_usage_site_id, p_work_description,
    p_reference_type, p_reference_id, p_user_id
  )
  RETURNING id INTO v_trans_id;

  RETURN v_trans_id;
END;
$$;


ALTER FUNCTION "public"."update_group_stock_on_usage"("p_group_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_quantity" numeric, "p_usage_site_id" "uuid", "p_work_description" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_po_status_on_delivery"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_po_id UUID;
  v_total_ordered DECIMAL;
  v_total_received DECIMAL;
BEGIN
  -- Get PO ID from delivery
  SELECT po_id INTO v_po_id FROM deliveries WHERE id = NEW.delivery_id;

  IF v_po_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate total ordered and received
  SELECT
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(received_qty), 0)
  INTO v_total_ordered, v_total_received
  FROM purchase_order_items
  WHERE po_id = v_po_id;

  -- Update PO status
  UPDATE purchase_orders
  SET
    status = CASE
      WHEN v_total_received >= v_total_ordered THEN 'delivered'::po_status
      WHEN v_total_received > 0 THEN 'partial_delivered'::po_status
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = v_po_id
    AND status IN ('ordered', 'partial_delivered');

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_po_status_on_delivery"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_salary_period_after_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    total_payments DECIMAL(12,2);
    period_net DECIMAL(12,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_payments
    FROM salary_payments
    WHERE salary_period_id = NEW.salary_period_id;
    
    SELECT net_payable INTO period_net
    FROM salary_periods
    WHERE id = NEW.salary_period_id;
    
    UPDATE salary_periods
    SET 
        amount_paid = total_payments,
        balance_due = period_net - total_payments,
        status = CASE
            WHEN total_payments >= period_net THEN 'paid'::salary_status
            WHEN total_payments > 0 THEN 'partial'::salary_status
            ELSE status
        END,
        updated_at = NOW()
    WHERE id = NEW.salary_period_id;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_salary_period_after_payment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_settlement_groups_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_settlement_groups_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_site_payers_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_site_payers_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_stock_on_delivery"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_site_id UUID;
  v_location_id UUID;
  v_delivery_date DATE;
  v_inv_id UUID;
BEGIN
  -- Get delivery details
  SELECT d.site_id, d.location_id, d.delivery_date
  INTO v_site_id, v_location_id, v_delivery_date
  FROM deliveries d
  WHERE d.id = NEW.delivery_id;

  -- Find or create stock inventory record
  SELECT id INTO v_inv_id
  FROM stock_inventory
  WHERE site_id = v_site_id
    AND (location_id = v_location_id OR (location_id IS NULL AND v_location_id IS NULL))
    AND material_id = NEW.material_id
    AND (brand_id = NEW.brand_id OR (brand_id IS NULL AND NEW.brand_id IS NULL));

  IF v_inv_id IS NULL THEN
    -- Create new inventory record
    INSERT INTO stock_inventory (
      site_id, location_id, material_id, brand_id,
      current_qty, avg_unit_cost, last_received_date
    ) VALUES (
      v_site_id, v_location_id, NEW.material_id, NEW.brand_id,
      COALESCE(NEW.accepted_qty, NEW.received_qty),
      COALESCE(NEW.unit_price, 0),
      v_delivery_date
    )
    RETURNING id INTO v_inv_id;
  ELSE
    -- Update existing inventory with weighted average cost
    UPDATE stock_inventory
    SET
      current_qty = current_qty + COALESCE(NEW.accepted_qty, NEW.received_qty),
      avg_unit_cost = CASE
        WHEN current_qty + COALESCE(NEW.accepted_qty, NEW.received_qty) > 0 THEN
          ((current_qty * COALESCE(avg_unit_cost, 0)) +
           (COALESCE(NEW.accepted_qty, NEW.received_qty) * COALESCE(NEW.unit_price, 0)))
          / (current_qty + COALESCE(NEW.accepted_qty, NEW.received_qty))
        ELSE 0
      END,
      last_received_date = v_delivery_date,
      updated_at = NOW()
    WHERE id = v_inv_id;
  END IF;

  -- Create stock transaction
  INSERT INTO stock_transactions (
    site_id, inventory_id, transaction_type, transaction_date,
    quantity, unit_cost, total_cost, reference_type, reference_id
  ) VALUES (
    v_site_id, v_inv_id, 'purchase', v_delivery_date,
    COALESCE(NEW.accepted_qty, NEW.received_qty),
    NEW.unit_price,
    COALESCE(NEW.accepted_qty, NEW.received_qty) * COALESCE(NEW.unit_price, 0),
    'delivery', NEW.delivery_id
  );

  -- Update PO item received quantity if linked
  IF NEW.po_item_id IS NOT NULL THEN
    UPDATE purchase_order_items
    SET received_qty = received_qty + COALESCE(NEW.accepted_qty, NEW.received_qty)
    WHERE id = NEW.po_item_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_stock_on_delivery"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_stock_on_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_inv_id UUID;
  v_avg_cost DECIMAL(12,2);
BEGIN
  -- Find the inventory record
  SELECT id, avg_unit_cost INTO v_inv_id, v_avg_cost
  FROM stock_inventory
  WHERE site_id = NEW.site_id
    AND material_id = NEW.material_id
    AND (brand_id = NEW.brand_id OR (brand_id IS NULL AND NEW.brand_id IS NULL))
  LIMIT 1;

  IF v_inv_id IS NOT NULL THEN
    -- Update inventory (deduct quantity)
    UPDATE stock_inventory
    SET
      current_qty = current_qty - NEW.quantity,
      last_issued_date = NEW.usage_date,
      updated_at = NOW()
    WHERE id = v_inv_id;

    -- Update usage record with cost if not set
    IF NEW.unit_cost IS NULL THEN
      NEW.unit_cost := v_avg_cost;
      NEW.total_cost := NEW.quantity * v_avg_cost;
    END IF;

    -- Create stock transaction
    INSERT INTO stock_transactions (
      site_id, inventory_id, transaction_type, transaction_date,
      quantity, unit_cost, total_cost, reference_type, reference_id,
      section_id, created_by
    ) VALUES (
      NEW.site_id, v_inv_id, 'usage', NEW.usage_date,
      -NEW.quantity, NEW.unit_cost, NEW.total_cost,
      'daily_material_usage', NEW.id,
      NEW.section_id, NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_stock_on_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_stock_on_verified_delivery"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_site_id UUID;
  v_location_id UUID;
  v_delivery_date DATE;
  v_verification_status TEXT;
  v_requires_verification BOOLEAN;
  v_inv_id UUID;
BEGIN
  -- Get delivery details
  SELECT d.site_id, d.location_id, d.delivery_date, d.verification_status, d.requires_verification
  INTO v_site_id, v_location_id, v_delivery_date, v_verification_status, v_requires_verification
  FROM deliveries d
  WHERE d.id = NEW.delivery_id;

  -- Only update stock if verified OR doesn't require verification
  IF v_verification_status != 'verified' AND v_requires_verification = TRUE THEN
    RETURN NEW;
  END IF;

  -- Find or create stock inventory record
  SELECT id INTO v_inv_id
  FROM stock_inventory
  WHERE site_id = v_site_id
    AND (location_id = v_location_id OR (location_id IS NULL AND v_location_id IS NULL))
    AND material_id = NEW.material_id
    AND (brand_id = NEW.brand_id OR (brand_id IS NULL AND NEW.brand_id IS NULL));

  IF v_inv_id IS NULL THEN
    -- Create new inventory record
    INSERT INTO stock_inventory (
      site_id, location_id, material_id, brand_id,
      current_qty, avg_unit_cost, last_received_date
    ) VALUES (
      v_site_id, v_location_id, NEW.material_id, NEW.brand_id,
      COALESCE(NEW.accepted_qty, NEW.received_qty),
      COALESCE(NEW.unit_price, 0),
      v_delivery_date
    )
    RETURNING id INTO v_inv_id;
  ELSE
    -- Update existing inventory with weighted average cost
    UPDATE stock_inventory
    SET
      current_qty = current_qty + COALESCE(NEW.accepted_qty, NEW.received_qty),
      avg_unit_cost = CASE
        WHEN current_qty + COALESCE(NEW.accepted_qty, NEW.received_qty) > 0 THEN
          ((current_qty * COALESCE(avg_unit_cost, 0)) +
           (COALESCE(NEW.accepted_qty, NEW.received_qty) * COALESCE(NEW.unit_price, 0)))
          / (current_qty + COALESCE(NEW.accepted_qty, NEW.received_qty))
        ELSE 0
      END,
      last_received_date = v_delivery_date,
      updated_at = NOW()
    WHERE id = v_inv_id;
  END IF;

  -- Create stock transaction
  INSERT INTO stock_transactions (
    site_id, inventory_id, transaction_type, transaction_date,
    quantity, unit_cost, total_cost, reference_type, reference_id
  ) VALUES (
    v_site_id, v_inv_id, 'purchase', v_delivery_date,
    COALESCE(NEW.accepted_qty, NEW.received_qty),
    NEW.unit_price,
    COALESCE(NEW.accepted_qty, NEW.received_qty) * COALESCE(NEW.unit_price, 0),
    'delivery', NEW.delivery_id
  );

  -- Update PO item received quantity if linked
  IF NEW.po_item_id IS NOT NULL THEN
    UPDATE purchase_order_items
    SET received_qty = received_qty + COALESCE(NEW.accepted_qty, NEW.received_qty)
    WHERE id = NEW.po_item_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_stock_on_verified_delivery"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tea_shop_accounts_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tea_shop_accounts_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tea_shop_consumption_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tea_shop_consumption_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tea_shop_entries_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tea_shop_entries_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tea_shop_settlements_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tea_shop_settlements_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_delivery"("p_delivery_id" "uuid", "p_user_id" "uuid", "p_verification_photos" "text"[], "p_verification_notes" "text", "p_discrepancies" "jsonb" DEFAULT NULL::"jsonb", "p_verification_status" "text" DEFAULT 'verified'::"text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_delivery RECORD;
  v_item RECORD;
BEGIN
  -- Get delivery details
  SELECT * INTO v_delivery FROM deliveries WHERE id = p_delivery_id;

  IF v_delivery IS NULL THEN
    RAISE EXCEPTION 'Delivery not found';
  END IF;

  IF v_delivery.verification_status = 'verified' THEN
    RAISE EXCEPTION 'Delivery already verified';
  END IF;

  -- Update delivery with verification details
  UPDATE deliveries
  SET
    verification_status = p_verification_status,
    verification_photos = p_verification_photos,
    verification_notes = p_verification_notes,
    discrepancies = p_discrepancies,
    engineer_verified_by = p_user_id,
    engineer_verified_at = NOW(),
    delivery_status = CASE
      WHEN p_verification_status = 'verified' THEN 'delivered'::delivery_status
      WHEN p_verification_status = 'rejected' THEN 'rejected'::delivery_status
      ELSE delivery_status
    END,
    updated_at = NOW()
  WHERE id = p_delivery_id;

  -- If verified, process stock updates
  IF p_verification_status = 'verified' THEN
    -- Process each delivery item
    FOR v_item IN SELECT * FROM delivery_items WHERE delivery_id = p_delivery_id
    LOOP
      -- Update accepted_qty based on discrepancies
      IF p_discrepancies IS NOT NULL THEN
        -- Check if this item has a discrepancy
        UPDATE delivery_items
        SET accepted_qty = COALESCE(
          (SELECT (d->>'received_qty')::DECIMAL
           FROM jsonb_array_elements(p_discrepancies) d
           WHERE (d->>'item_id')::UUID = v_item.id),
          v_item.received_qty
        )
        WHERE id = v_item.id;
      ELSE
        -- No discrepancies, accept all
        UPDATE delivery_items
        SET accepted_qty = received_qty
        WHERE id = v_item.id;
      END IF;
    END LOOP;

    -- Now trigger stock updates by re-inserting items (triggers will process them)
    -- Actually, we need a different approach since items are already inserted
    -- Let's manually process the stock updates

    FOR v_item IN SELECT * FROM delivery_items WHERE delivery_id = p_delivery_id
    LOOP
      DECLARE
        v_site_id UUID;
        v_location_id UUID;
        v_inv_id UUID;
      BEGIN
        -- Get delivery details
        SELECT d.site_id, d.location_id
        INTO v_site_id, v_location_id
        FROM deliveries d
        WHERE d.id = p_delivery_id;

        -- Find or create stock inventory record
        SELECT id INTO v_inv_id
        FROM stock_inventory
        WHERE site_id = v_site_id
          AND (location_id = v_location_id OR (location_id IS NULL AND v_location_id IS NULL))
          AND material_id = v_item.material_id
          AND (brand_id = v_item.brand_id OR (brand_id IS NULL AND v_item.brand_id IS NULL));

        IF v_inv_id IS NULL THEN
          INSERT INTO stock_inventory (
            site_id, location_id, material_id, brand_id,
            current_qty, avg_unit_cost, last_received_date
          ) VALUES (
            v_site_id, v_location_id, v_item.material_id, v_item.brand_id,
            COALESCE(v_item.accepted_qty, v_item.received_qty),
            COALESCE(v_item.unit_price, 0),
            v_delivery.delivery_date
          )
          RETURNING id INTO v_inv_id;
        ELSE
          UPDATE stock_inventory
          SET
            current_qty = current_qty + COALESCE(v_item.accepted_qty, v_item.received_qty),
            avg_unit_cost = CASE
              WHEN current_qty + COALESCE(v_item.accepted_qty, v_item.received_qty) > 0 THEN
                ((current_qty * COALESCE(avg_unit_cost, 0)) +
                 (COALESCE(v_item.accepted_qty, v_item.received_qty) * COALESCE(v_item.unit_price, 0)))
                / (current_qty + COALESCE(v_item.accepted_qty, v_item.received_qty))
              ELSE 0
            END,
            last_received_date = v_delivery.delivery_date,
            updated_at = NOW()
          WHERE id = v_inv_id;
        END IF;

        -- Create stock transaction
        INSERT INTO stock_transactions (
          site_id, inventory_id, transaction_type, transaction_date,
          quantity, unit_cost, total_cost, reference_type, reference_id, created_by
        ) VALUES (
          v_site_id, v_inv_id, 'purchase', v_delivery.delivery_date,
          COALESCE(v_item.accepted_qty, v_item.received_qty),
          v_item.unit_price,
          COALESCE(v_item.accepted_qty, v_item.received_qty) * COALESCE(v_item.unit_price, 0),
          'delivery', p_delivery_id, p_user_id
        );

        -- Update PO item received quantity if linked
        IF v_item.po_item_id IS NOT NULL THEN
          UPDATE purchase_order_items
          SET received_qty = received_qty + COALESCE(v_item.accepted_qty, v_item.received_qty)
          WHERE id = v_item.po_item_id;
        END IF;
      END;
    END LOOP;

    -- Record prices in price history
    FOR v_item IN
      SELECT di.*, d.vendor_id, po.po_number, po.transport_cost, po.subtotal
      FROM delivery_items di
      JOIN deliveries d ON d.id = di.delivery_id
      LEFT JOIN purchase_orders po ON po.id = d.po_id
      WHERE di.delivery_id = p_delivery_id
    LOOP
      IF v_item.vendor_id IS NOT NULL AND v_item.material_id IS NOT NULL THEN
        DECLARE
          v_transport_share DECIMAL := 0;
        BEGIN
          -- Calculate transport share if PO exists
          IF v_item.subtotal > 0 AND v_item.transport_cost > 0 THEN
            v_transport_share := (v_item.accepted_qty * v_item.unit_price / v_item.subtotal) * v_item.transport_cost / v_item.accepted_qty;
          END IF;

          PERFORM record_price_entry(
            v_item.vendor_id,
            v_item.material_id,
            v_item.brand_id,
            v_item.unit_price,
            FALSE,
            NULL,
            v_transport_share,
            NULL,
            NULL,
            'purchase',
            v_item.po_number,
            v_item.accepted_qty,
            NULL,
            p_user_id,
            NULL
          );
        END;
      END IF;
    END LOOP;
  END IF;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."verify_delivery"("p_delivery_id" "uuid", "p_user_id" "uuid", "p_verification_photos" "text"[], "p_verification_notes" "text", "p_discrepancies" "jsonb", "p_verification_status" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."advances" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "laborer_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "transaction_type" "public"."transaction_type" NOT NULL,
    "payment_mode" "public"."payment_mode",
    "reference_number" character varying(100),
    "reason" "text",
    "given_by" "uuid",
    "deduction_status" "public"."deduction_status" DEFAULT 'pending'::"public"."deduction_status" NOT NULL,
    "deducted_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "deducted_in_period_id" "uuid",
    "deducted_date" "date",
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "advances_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."advances" OWNER TO "postgres";


COMMENT ON TABLE "public"."advances" IS 'Advances (deductions) and extras (additions) for laborers';



CREATE TABLE IF NOT EXISTS "public"."attendance_expense_sync" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attendance_date" "date" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "expense_id" "uuid",
    "total_laborers" integer NOT NULL,
    "total_work_days" numeric(6,2) NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "synced_by" "text" NOT NULL,
    "synced_by_user_id" "uuid",
    "synced_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."attendance_expense_sync" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "action" "public"."audit_action" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" character varying(45),
    "user_agent" "text",
    "notes" "text"
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_log" IS 'Audit trail for all data changes';



CREATE TABLE IF NOT EXISTS "public"."building_sections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "sequence_order" integer DEFAULT 0 NOT NULL,
    "status" "public"."section_status" DEFAULT 'not_started'::"public"."section_status" NOT NULL,
    "planned_start_date" "date",
    "planned_end_date" "date",
    "actual_start_date" "date",
    "actual_end_date" "date",
    "area_sqft" numeric(10,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "construction_phase_id" "uuid",
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."building_sections" OWNER TO "postgres";


COMMENT ON TABLE "public"."building_sections" IS 'Sections of a building (Foundation, Ground Floor, etc.)';



COMMENT ON COLUMN "public"."building_sections"."construction_phase_id" IS 'Links section to a construction phase (Foundation, Structure, Finishing, etc.)';



COMMENT ON COLUMN "public"."building_sections"."created_by" IS 'User who created this section (audit trail)';



COMMENT ON COLUMN "public"."building_sections"."updated_by" IS 'User who last updated this section (audit trail)';



CREATE TABLE IF NOT EXISTS "public"."client_payment_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "plan_name" "text" NOT NULL,
    "total_contract_amount" numeric NOT NULL,
    "description" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_payment_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "payment_phase_id" "uuid",
    "payment_date" "date" NOT NULL,
    "payment_mode" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "transaction_reference" "text",
    "notes" "text",
    "receipt_url" "text",
    "is_verified" boolean DEFAULT true NOT NULL,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_payments_payment_mode_check" CHECK (("payment_mode" = ANY (ARRAY['cash'::"text", 'upi'::"text", 'bank_transfer'::"text", 'cheque'::"text"])))
);


ALTER TABLE "public"."client_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "phone" character varying(20),
    "email" character varying(255),
    "address" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


COMMENT ON TABLE "public"."clients" IS 'Construction clients - minimal now, expanded in Finance module';



CREATE TABLE IF NOT EXISTS "public"."construction_phases" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(120) NOT NULL,
    "description" "text",
    "sequence_order" integer DEFAULT 0 NOT NULL,
    "default_payment_percentage" numeric(5,2),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."construction_phases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."construction_subphases" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "phase_id" "uuid" NOT NULL,
    "name" character varying(160) NOT NULL,
    "description" "text",
    "sequence_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."construction_subphases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_attendance" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "daily_log_id" "uuid",
    "date" "date" NOT NULL,
    "laborer_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "section_id" "uuid",
    "start_time" time without time zone,
    "end_time" time without time zone,
    "hours_worked" numeric(4,2),
    "work_days" numeric(3,1) DEFAULT 1 NOT NULL,
    "work_variance" "public"."work_variance",
    "daily_rate_applied" numeric(10,2) NOT NULL,
    "daily_earnings" numeric(10,2) NOT NULL,
    "work_description" "text",
    "task_completed" "text",
    "team_id" "uuid",
    "subcontract_id" "uuid",
    "entered_by" "uuid",
    "verified_by" "uuid",
    "is_verified" boolean DEFAULT false NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_paid" boolean DEFAULT false,
    "payment_id" "uuid",
    "synced_to_expense" boolean DEFAULT false,
    "recorded_by" "text",
    "recorded_by_user_id" "uuid",
    "in_time" time without time zone,
    "lunch_out" time without time zone,
    "lunch_in" time without time zone,
    "out_time" time without time zone,
    "work_hours" numeric(4,2),
    "break_hours" numeric(4,2),
    "total_hours" numeric(4,2),
    "day_units" numeric(2,1) DEFAULT 1,
    "snacks_amount" numeric(10,2) DEFAULT 0,
    "updated_by" character varying(255),
    "updated_by_user_id" "uuid",
    "attendance_status" "text" DEFAULT 'confirmed'::"text",
    "morning_entry_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "work_progress_percent" integer DEFAULT 100,
    "payment_date" "date",
    "payment_mode" "text",
    "payment_proof_url" "text",
    "paid_via" "text",
    "engineer_transaction_id" "uuid",
    "expense_id" "uuid",
    "payment_notes" "text",
    "payer_source" "text",
    "payer_name" "text",
    "settlement_group_id" "uuid",
    CONSTRAINT "daily_attendance_attendance_status_check" CHECK (("attendance_status" = ANY (ARRAY['morning_entry'::"text", 'confirmed'::"text", 'draft'::"text"]))),
    CONSTRAINT "daily_attendance_paid_via_check" CHECK (("paid_via" = ANY (ARRAY['direct'::"text", 'engineer_wallet'::"text"]))),
    CONSTRAINT "daily_attendance_payer_source_check" CHECK ((("payer_source" IS NULL) OR ("payer_source" = ANY (ARRAY['own_money'::"text", 'amma_money'::"text", 'client_money'::"text", 'other_site_money'::"text", 'custom'::"text", 'mothers_money'::"text", 'trust_account'::"text"])))),
    CONSTRAINT "daily_attendance_work_days_check" CHECK (("work_days" = ANY (ARRAY[0.5, (1)::numeric, 1.5, (2)::numeric])))
);


ALTER TABLE "public"."daily_attendance" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_attendance" IS 'Daily work entries - one or more per laborer per day';



COMMENT ON COLUMN "public"."daily_attendance"."work_days" IS 'Number of days worked: 0.5, 1, 1.5, or 2';



COMMENT ON COLUMN "public"."daily_attendance"."work_variance" IS 'Overtime/undertime indicator based on hours vs work_days';



COMMENT ON COLUMN "public"."daily_attendance"."daily_rate_applied" IS 'Rate used for this entry - copied from laborer at time of entry';



COMMENT ON COLUMN "public"."daily_attendance"."daily_earnings" IS 'Calculated: work_days × daily_rate_applied';



COMMENT ON COLUMN "public"."daily_attendance"."updated_by" IS 'Name of user who last updated this record';



COMMENT ON COLUMN "public"."daily_attendance"."updated_by_user_id" IS 'UUID of user who last updated this record';



COMMENT ON COLUMN "public"."daily_attendance"."expense_id" IS 'Links to expenses table for salary payments (direct payments)';



COMMENT ON COLUMN "public"."daily_attendance"."payment_notes" IS 'Notes/comments added when settling the payment';



COMMENT ON COLUMN "public"."daily_attendance"."payer_source" IS 'Source of money used for payment: own_money, amma_money, client_money, other_site_money, custom, mothers_money, trust_account';



COMMENT ON COLUMN "public"."daily_attendance"."payer_name" IS 'Custom payer name when payer_source is custom';



CREATE TABLE IF NOT EXISTS "public"."daily_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "weather" character varying(50),
    "is_holiday" boolean DEFAULT false NOT NULL,
    "holiday_reason" character varying(255),
    "general_notes" "text",
    "work_summary" "text",
    "logged_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_logs" IS 'Daily log header - links all daily activities across modules';



CREATE TABLE IF NOT EXISTS "public"."daily_material_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "section_id" "uuid",
    "usage_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "material_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "quantity" numeric(12,3) NOT NULL,
    "unit_cost" numeric(12,2),
    "total_cost" numeric(12,2),
    "work_description" "text",
    "work_area" "text",
    "used_by" "text",
    "is_verified" boolean DEFAULT false,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "site_group_id" "uuid",
    "is_group_stock" boolean DEFAULT false
);


ALTER TABLE "public"."daily_material_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_work_summary" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "work_description" "text",
    "work_status" "text",
    "comments" "text",
    "first_in_time" time without time zone,
    "last_out_time" time without time zone,
    "daily_laborer_count" integer DEFAULT 0,
    "contract_laborer_count" integer DEFAULT 0,
    "market_laborer_count" integer DEFAULT 0,
    "total_laborer_count" integer DEFAULT 0,
    "total_salary" numeric(12,2) DEFAULT 0,
    "total_snacks" numeric(10,2) DEFAULT 0,
    "total_expense" numeric(12,2) DEFAULT 0,
    "default_snacks_per_person" numeric(10,2) DEFAULT 0,
    "entered_by" character varying(255),
    "entered_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" character varying(255),
    "updated_by_user_id" "uuid",
    "work_progress_percent" integer DEFAULT 100,
    "work_updates" "jsonb"
);


ALTER TABLE "public"."daily_work_summary" OWNER TO "postgres";


COMMENT ON COLUMN "public"."daily_work_summary"."updated_by" IS 'Name of user who last updated this record';



COMMENT ON COLUMN "public"."daily_work_summary"."updated_by_user_id" IS 'UUID of user who last updated this record';



COMMENT ON COLUMN "public"."daily_work_summary"."work_updates" IS 'JSON structure for morning/evening work updates with photos. Structure: { photoCount: number, morning: { description, photos[], timestamp }, evening: { completionPercent, summary, photos[], timestamp } }';



CREATE TABLE IF NOT EXISTS "public"."default_building_sections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "sequence_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."default_building_sections" OWNER TO "postgres";


COMMENT ON TABLE "public"."default_building_sections" IS 'Template sections copied to new sites';



CREATE TABLE IF NOT EXISTS "public"."deletion_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "record_summary" "text",
    "requested_by" "uuid" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reason" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "status" "public"."deletion_request_status" DEFAULT 'pending'::"public"."deletion_request_status" NOT NULL,
    "executed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."deletion_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."deletion_requests" IS 'Soft delete requests requiring admin approval';



CREATE TABLE IF NOT EXISTS "public"."deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "grn_number" "text" NOT NULL,
    "po_id" "uuid",
    "site_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "delivery_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "delivery_status" "public"."delivery_status" DEFAULT 'pending'::"public"."delivery_status",
    "challan_number" "text",
    "challan_date" "date",
    "challan_url" "text",
    "vehicle_number" "text",
    "driver_name" "text",
    "driver_phone" "text",
    "received_by" "uuid",
    "verified" boolean DEFAULT false,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "inspection_notes" "text",
    "invoice_number" "text",
    "invoice_date" "date",
    "invoice_amount" numeric(12,2),
    "invoice_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "verification_status" "text" DEFAULT 'pending'::"text",
    "verification_photos" "text"[],
    "verification_notes" "text",
    "discrepancies" "jsonb",
    "engineer_verified_by" "uuid",
    "engineer_verified_at" timestamp with time zone,
    "requires_verification" boolean DEFAULT true,
    CONSTRAINT "deliveries_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'disputed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "delivery_id" "uuid" NOT NULL,
    "po_item_id" "uuid",
    "material_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "ordered_qty" numeric(12,3),
    "received_qty" numeric(12,3) NOT NULL,
    "accepted_qty" numeric(12,3),
    "rejected_qty" numeric(12,3) DEFAULT 0,
    "rejection_reason" "text",
    "unit_price" numeric(12,2),
    "batch_number" "text",
    "expiry_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."delivery_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engineer_reimbursements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "expense_transaction_id" "uuid" NOT NULL,
    "engineer_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "payer_source" "text" NOT NULL,
    "payer_name" "text",
    "payment_mode" "text" NOT NULL,
    "proof_url" "text",
    "settled_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "settled_by_user_id" "uuid",
    "settled_by_name" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "engineer_reimbursements_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "engineer_reimbursements_payer_source_check" CHECK (("payer_source" = ANY (ARRAY['own_money'::"text", 'amma_money'::"text", 'client_money'::"text", 'trust_account'::"text", 'other_site_money'::"text", 'custom'::"text", 'mothers_money'::"text"])))
);


ALTER TABLE "public"."engineer_reimbursements" OWNER TO "postgres";


COMMENT ON TABLE "public"."engineer_reimbursements" IS 'Tracks reimbursements to engineers who used their own money';



COMMENT ON COLUMN "public"."engineer_reimbursements"."expense_transaction_id" IS 'The used_own_money transaction being reimbursed';



COMMENT ON COLUMN "public"."engineer_reimbursements"."payer_source" IS 'Who paid back the engineer (Trust, Amma, Client, etc.)';



CREATE TABLE IF NOT EXISTS "public"."engineer_wallet_batch_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "batch_transaction_id" "uuid" NOT NULL,
    "amount_used" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "engineer_wallet_batch_usage_amount_used_check" CHECK (("amount_used" > (0)::numeric))
);


ALTER TABLE "public"."engineer_wallet_batch_usage" OWNER TO "postgres";


COMMENT ON TABLE "public"."engineer_wallet_batch_usage" IS 'Tracks which deposit batches were used for each spending transaction';



COMMENT ON COLUMN "public"."engineer_wallet_batch_usage"."transaction_id" IS 'The spending transaction (FK to site_engineer_transactions)';



COMMENT ON COLUMN "public"."engineer_wallet_batch_usage"."batch_transaction_id" IS 'The source deposit batch (FK to site_engineer_transactions)';



COMMENT ON COLUMN "public"."engineer_wallet_batch_usage"."amount_used" IS 'Amount taken from this batch for the spending transaction';



CREATE TABLE IF NOT EXISTS "public"."expense_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "module" "public"."expense_module" DEFAULT 'labor'::"public"."expense_module" NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "is_recurring" boolean DEFAULT false NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."expense_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."expense_categories" IS 'Categories for expenses - expandable for future modules';



CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "module" "public"."expense_module" DEFAULT 'labor'::"public"."expense_module" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "site_id" "uuid",
    "section_id" "uuid",
    "team_id" "uuid",
    "contract_id" "uuid",
    "laborer_id" "uuid",
    "vendor_name" character varying(255),
    "vendor_contact" character varying(50),
    "description" "text",
    "payment_mode" "public"."payment_mode",
    "reference_number" character varying(100),
    "paid_by" "uuid",
    "receipt_url" character varying(500),
    "is_recurring" boolean DEFAULT false NOT NULL,
    "week_ending" "date",
    "is_cleared" boolean DEFAULT false NOT NULL,
    "cleared_date" "date",
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "entered_by_user_id" "uuid",
    "entered_by" "text",
    "site_payer_id" "uuid",
    "engineer_transaction_id" "uuid",
    CONSTRAINT "expenses_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


COMMENT ON TABLE "public"."expenses" IS 'Unified expense tracking - labor module for now, expandable';



COMMENT ON COLUMN "public"."expenses"."engineer_transaction_id" IS 'Links to site_engineer_transactions for salary payments made via engineer';



CREATE TABLE IF NOT EXISTS "public"."group_stock_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_group_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "location_id" "uuid",
    "current_qty" numeric(12,3) DEFAULT 0 NOT NULL,
    "reserved_qty" numeric(12,3) DEFAULT 0 NOT NULL,
    "available_qty" numeric(12,3) GENERATED ALWAYS AS (("current_qty" - "reserved_qty")) STORED,
    "avg_unit_cost" numeric(12,2) DEFAULT 0,
    "total_value" numeric(14,2) GENERATED ALWAYS AS (("current_qty" * "avg_unit_cost")) STORED,
    "last_received_date" "date",
    "last_used_date" "date",
    "reorder_level" numeric(10,3),
    "reorder_qty" numeric(10,3),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "batch_code" "text",
    "is_dedicated" boolean DEFAULT false,
    "dedicated_site_id" "uuid",
    "can_be_shared" boolean DEFAULT true,
    CONSTRAINT "check_dedicated_site" CHECK (((NOT "is_dedicated") OR ("dedicated_site_id" IS NOT NULL)))
);


ALTER TABLE "public"."group_stock_inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_stock_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_group_id" "uuid" NOT NULL,
    "inventory_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "transaction_type" "public"."stock_transaction_type" NOT NULL,
    "transaction_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "quantity" numeric(12,3) NOT NULL,
    "unit_cost" numeric(12,2),
    "total_cost" numeric(12,2),
    "payment_source" "text",
    "payment_source_site_id" "uuid",
    "usage_site_id" "uuid",
    "work_description" "text",
    "reference_type" "text",
    "reference_id" "uuid",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "batch_code" "text",
    CONSTRAINT "group_stock_transactions_payment_source_check" CHECK (("payment_source" = ANY (ARRAY['company'::"text", 'site_cash'::"text", 'engineer_own'::"text"])))
);


ALTER TABLE "public"."group_stock_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "import_type" character varying(50) NOT NULL,
    "file_name" character varying(255),
    "file_size" integer,
    "total_rows" integer DEFAULT 0 NOT NULL,
    "success_rows" integer DEFAULT 0 NOT NULL,
    "error_rows" integer DEFAULT 0 NOT NULL,
    "skipped_rows" integer DEFAULT 0 NOT NULL,
    "error_details" "jsonb",
    "imported_by" "uuid",
    "status" character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."import_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."import_logs" IS 'CSV/Excel import history and results';



CREATE TABLE IF NOT EXISTS "public"."inter_site_material_settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "settlement_code" "text" NOT NULL,
    "site_group_id" "uuid" NOT NULL,
    "from_site_id" "uuid" NOT NULL,
    "to_site_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "week_number" integer NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "paid_amount" numeric(12,2) DEFAULT 0,
    "pending_amount" numeric(12,2) GENERATED ALWAYS AS (("total_amount" - "paid_amount")) STORED,
    "status" "public"."inter_site_settlement_status" DEFAULT 'draft'::"public"."inter_site_settlement_status",
    "notes" "text",
    "created_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "settled_by" "uuid",
    "settled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "different_sites" CHECK (("from_site_id" <> "to_site_id")),
    CONSTRAINT "inter_site_material_settlements_week_number_check" CHECK ((("week_number" >= 1) AND ("week_number" <= 53)))
);


ALTER TABLE "public"."inter_site_material_settlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inter_site_settlement_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "settlement_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "batch_code" "text",
    "quantity_used" numeric(12,3) NOT NULL,
    "unit" "text" NOT NULL,
    "unit_cost" numeric(12,2) NOT NULL,
    "total_cost" numeric(12,2) NOT NULL,
    "transaction_id" "uuid",
    "usage_date" "date" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inter_site_settlement_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inter_site_settlement_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "settlement_id" "uuid" NOT NULL,
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "payment_mode" "text",
    "reference_number" "text",
    "notes" "text",
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inter_site_settlement_payments_payment_mode_check" CHECK (("payment_mode" = ANY (ARRAY['cash'::"text", 'bank_transfer'::"text", 'upi'::"text", 'adjustment'::"text"])))
);


ALTER TABLE "public"."inter_site_settlement_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."labor_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."labor_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."labor_categories" IS 'Top-level labor categories: Civil, Electrical, Plumbing, etc.';



CREATE TABLE IF NOT EXISTS "public"."labor_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "laborer_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "subcontract_id" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "payment_for_date" "date" NOT NULL,
    "payment_mode" "text" NOT NULL,
    "payment_channel" "text" NOT NULL,
    "paid_by" "text" NOT NULL,
    "paid_by_user_id" "uuid",
    "site_engineer_transaction_id" "uuid",
    "proof_url" "text",
    "is_under_contract" boolean DEFAULT false,
    "attendance_id" "uuid",
    "recorded_by" "text" NOT NULL,
    "recorded_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "settlement_group_id" "uuid",
    "payment_type" "text" DEFAULT 'salary'::"text",
    "actual_payment_date" "date" DEFAULT CURRENT_DATE,
    "payment_reference" "text",
    "is_advance_deduction" boolean DEFAULT false,
    "advance_deduction_from_payment_id" "uuid",
    CONSTRAINT "labor_payments_payment_channel_check" CHECK (("payment_channel" = ANY (ARRAY['direct'::"text", 'engineer_wallet'::"text"]))),
    CONSTRAINT "labor_payments_payment_mode_check" CHECK (("payment_mode" = ANY (ARRAY['cash'::"text", 'upi'::"text", 'bank_transfer'::"text"]))),
    CONSTRAINT "labor_payments_payment_type_check" CHECK (("payment_type" = ANY (ARRAY['salary'::"text", 'advance'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."labor_payments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."labor_payments"."payment_channel" IS 'Payment channel: direct (company pays directly) or engineer_wallet (via site engineer)';



COMMENT ON COLUMN "public"."labor_payments"."notes" IS 'Notes/comments added when settling the payment';



COMMENT ON COLUMN "public"."labor_payments"."settlement_group_id" IS 'Link to settlement_groups for reference code and tracking';



COMMENT ON COLUMN "public"."labor_payments"."payment_type" IS 'Type of payment: salary (reduces weekly due), advance (tracked separately, does not reduce weekly due), other (misc)';



COMMENT ON COLUMN "public"."labor_payments"."actual_payment_date" IS 'Actual date when payment was made (vs created_at which is entry time)';



COMMENT ON COLUMN "public"."labor_payments"."payment_reference" IS 'Unique reference code per payment: PAY-YYYYMM-NNN format';



COMMENT ON COLUMN "public"."labor_payments"."is_advance_deduction" IS 'True if this payment record represents a deduction of a previously given advance';



COMMENT ON COLUMN "public"."labor_payments"."advance_deduction_from_payment_id" IS 'Links to the original advance payment that is being deducted';



CREATE TABLE IF NOT EXISTS "public"."labor_roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "default_daily_rate" numeric(10,2) DEFAULT 0 NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_market_role" boolean DEFAULT false
);


ALTER TABLE "public"."labor_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."labor_roles" IS 'Roles within categories: Mason, Helper, etc. with default rates';



COMMENT ON COLUMN "public"."labor_roles"."is_market_role" IS 'True if this role is available for market (daily) laborers';



CREATE TABLE IF NOT EXISTS "public"."laborer_site_assignments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "laborer_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "assigned_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "unassigned_date" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."laborer_site_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."laborer_site_assignments" IS 'Which laborers are assigned to which sites';



CREATE TABLE IF NOT EXISTS "public"."laborers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "phone" character varying(20),
    "alternate_phone" character varying(20),
    "age" integer,
    "address" "text",
    "photo_url" character varying(500),
    "id_proof_type" character varying(50),
    "id_proof_number" character varying(50),
    "category_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "employment_type" "public"."employment_type" DEFAULT 'daily_wage'::"public"."employment_type" NOT NULL,
    "daily_rate" numeric(10,2) DEFAULT 0 NOT NULL,
    "team_id" "uuid",
    "status" "public"."laborer_status" DEFAULT 'active'::"public"."laborer_status" NOT NULL,
    "joining_date" "date",
    "deactivation_date" "date",
    "deactivation_reason" "text",
    "emergency_contact_name" character varying(255),
    "emergency_contact_phone" character varying(20),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "laborer_type" "text" DEFAULT 'daily_market'::"text",
    "associated_team_id" "uuid",
    "language" character varying(20) DEFAULT 'Tamil'::character varying,
    "total_advance_given" numeric(12,2) DEFAULT 0,
    "total_advance_deducted" numeric(12,2) DEFAULT 0,
    CONSTRAINT "laborers_laborer_type_check" CHECK (("laborer_type" = ANY (ARRAY['contract'::"text", 'daily_market'::"text"])))
);


ALTER TABLE "public"."laborers" OWNER TO "postgres";


COMMENT ON TABLE "public"."laborers" IS 'Individual workers - independent or under a team';



COMMENT ON COLUMN "public"."laborers"."language" IS 'Language spoken by the laborer (Hindi, Tamil)';



COMMENT ON COLUMN "public"."laborers"."total_advance_given" IS 'Cumulative total of advance payments given to this laborer (reduces subcontract, tracked separately from salary)';



COMMENT ON COLUMN "public"."laborers"."total_advance_deducted" IS 'Cumulative total of advances that have been deducted from subsequent salary payments';



CREATE TABLE IF NOT EXISTS "public"."local_purchase_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_purchase_id" "uuid" NOT NULL,
    "material_id" "uuid",
    "custom_material_name" "text",
    "brand_id" "uuid",
    "quantity" numeric(12,3) NOT NULL,
    "unit" "text" NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "total_price" numeric(12,2) NOT NULL,
    "save_to_vendor_inventory" boolean DEFAULT true,
    "save_to_price_history" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "local_purchase_items_material_check" CHECK ((("material_id" IS NOT NULL) OR ("custom_material_name" IS NOT NULL)))
);


ALTER TABLE "public"."local_purchase_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."local_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_number" "text",
    "site_id" "uuid" NOT NULL,
    "site_group_id" "uuid",
    "engineer_id" "uuid" NOT NULL,
    "vendor_id" "uuid",
    "vendor_name" "text" NOT NULL,
    "vendor_phone" "text",
    "vendor_address" "text",
    "is_new_vendor" boolean DEFAULT false,
    "purchase_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "receipt_url" "text",
    "total_amount" numeric(12,2) NOT NULL,
    "payment_mode" "text" DEFAULT 'cash'::"text",
    "payment_reference" "text",
    "payment_source" "text",
    "description" "text",
    "status" "text" DEFAULT 'completed'::"text",
    "needs_reimbursement" boolean DEFAULT false,
    "reimbursement_amount" numeric(12,2),
    "reimbursement_status" "text" DEFAULT 'pending'::"text",
    "reimbursement_transaction_id" "uuid",
    "reimbursed_at" timestamp with time zone,
    "add_to_stock" boolean DEFAULT true,
    "stock_added" boolean DEFAULT false,
    "is_group_stock" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "local_purchases_payment_mode_check" CHECK (("payment_mode" = ANY (ARRAY['cash'::"text", 'upi'::"text", 'engineer_own'::"text"]))),
    CONSTRAINT "local_purchases_payment_source_check" CHECK (("payment_source" = ANY (ARRAY['company'::"text", 'site_cash'::"text", 'engineer_own'::"text"]))),
    CONSTRAINT "local_purchases_reimbursement_status_check" CHECK (("reimbursement_status" = ANY (ARRAY['pending'::"text", 'processed'::"text", 'completed'::"text"]))),
    CONSTRAINT "local_purchases_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."local_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."market_laborer_attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "section_id" "uuid",
    "date" "date" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "count" integer DEFAULT 1 NOT NULL,
    "work_hours" numeric(4,2) DEFAULT 8,
    "work_days" numeric(3,2) DEFAULT 1 NOT NULL,
    "rate_per_person" numeric(10,2) NOT NULL,
    "total_cost" numeric(12,2) NOT NULL,
    "notes" "text",
    "entered_by" "text" NOT NULL,
    "entered_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "in_time" time without time zone,
    "lunch_out" time without time zone,
    "lunch_in" time without time zone,
    "out_time" time without time zone,
    "break_hours" numeric(4,2),
    "total_hours" numeric(4,2),
    "day_units" numeric(2,1) DEFAULT 1,
    "snacks_per_person" numeric(10,2) DEFAULT 0,
    "total_snacks" numeric(10,2) DEFAULT 0,
    "updated_by" character varying(255),
    "updated_by_user_id" "uuid",
    "attendance_status" "text" DEFAULT 'confirmed'::"text",
    "morning_entry_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "is_paid" boolean DEFAULT false,
    "payment_date" "date",
    "payment_mode" "text",
    "payment_proof_url" "text",
    "paid_via" "text",
    "engineer_transaction_id" "uuid",
    "expense_id" "uuid",
    "payment_notes" "text",
    "payer_source" "text",
    "payer_name" "text",
    "subcontract_id" "uuid",
    "settlement_group_id" "uuid",
    CONSTRAINT "market_laborer_attendance_attendance_status_check" CHECK (("attendance_status" = ANY (ARRAY['morning_entry'::"text", 'confirmed'::"text", 'draft'::"text"]))),
    CONSTRAINT "market_laborer_attendance_paid_via_check" CHECK (("paid_via" = ANY (ARRAY['direct'::"text", 'engineer_wallet'::"text"]))),
    CONSTRAINT "market_laborer_attendance_payer_source_check" CHECK ((("payer_source" IS NULL) OR ("payer_source" = ANY (ARRAY['own_money'::"text", 'amma_money'::"text", 'client_money'::"text", 'other_site_money'::"text", 'custom'::"text", 'mothers_money'::"text", 'trust_account'::"text"]))))
);


ALTER TABLE "public"."market_laborer_attendance" OWNER TO "postgres";


COMMENT ON COLUMN "public"."market_laborer_attendance"."updated_by" IS 'Name of user who last updated this record';



COMMENT ON COLUMN "public"."market_laborer_attendance"."updated_by_user_id" IS 'UUID of user who last updated this record';



COMMENT ON COLUMN "public"."market_laborer_attendance"."expense_id" IS 'Links to expenses table for salary payments (direct payments)';



COMMENT ON COLUMN "public"."market_laborer_attendance"."payment_notes" IS 'Notes/comments added when settling the payment';



COMMENT ON COLUMN "public"."market_laborer_attendance"."payer_source" IS 'Source of money used for payment: own_money, amma_money, client_money, other_site_money, custom, mothers_money, trust_account';



COMMENT ON COLUMN "public"."market_laborer_attendance"."payer_name" IS 'Custom payer name when payer_source is custom';



CREATE TABLE IF NOT EXISTS "public"."material_brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "material_id" "uuid" NOT NULL,
    "brand_name" "text" NOT NULL,
    "is_preferred" boolean DEFAULT false,
    "quality_rating" integer,
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "material_brands_quality_rating_check" CHECK ((("quality_rating" >= 1) AND ("quality_rating" <= 5)))
);


ALTER TABLE "public"."material_brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text",
    "description" "text",
    "parent_id" "uuid",
    "display_order" integer DEFAULT 0,
    "icon" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."material_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_request_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "requested_qty" numeric(12,3) NOT NULL,
    "approved_qty" numeric(12,3),
    "fulfilled_qty" numeric(12,3) DEFAULT 0,
    "estimated_cost" numeric(12,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."material_request_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_number" "text" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "section_id" "uuid",
    "requested_by" "uuid" NOT NULL,
    "request_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "required_by_date" "date",
    "priority" "text" DEFAULT 'normal'::"text",
    "status" "public"."material_request_status" DEFAULT 'draft'::"public"."material_request_status",
    "notes" "text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "rejection_reason" "text",
    "converted_to_po_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "material_requests_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"])))
);


ALTER TABLE "public"."material_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "material_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "unit_price" numeric(12,2) NOT NULL,
    "min_order_qty" numeric(10,3) DEFAULT 1,
    "lead_time_days" integer DEFAULT 3,
    "is_preferred" boolean DEFAULT false,
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "last_price_update" "date" DEFAULT CURRENT_DATE,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."material_vendors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text",
    "local_name" "text",
    "category_id" "uuid",
    "description" "text",
    "unit" "public"."material_unit" DEFAULT 'piece'::"public"."material_unit" NOT NULL,
    "secondary_unit" "public"."material_unit",
    "conversion_factor" numeric(10,4) DEFAULT 1,
    "hsn_code" "text",
    "gst_rate" numeric(4,2) DEFAULT 18.00,
    "specifications" "jsonb" DEFAULT '{}'::"jsonb",
    "min_order_qty" numeric(10,3) DEFAULT 1,
    "reorder_level" numeric(10,3) DEFAULT 10,
    "image_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "parent_id" "uuid",
    "weight_per_unit" numeric(10,6) DEFAULT NULL::numeric,
    "weight_unit" "text" DEFAULT 'kg'::"text",
    "length_per_piece" numeric(10,4) DEFAULT NULL::numeric,
    "length_unit" "text" DEFAULT 'm'::"text",
    "rods_per_bundle" integer
);


ALTER TABLE "public"."materials" OWNER TO "postgres";


COMMENT ON COLUMN "public"."materials"."weight_per_unit" IS 'Weight per unit piece (e.g., 0.395 kg for 8mm TMT)';



COMMENT ON COLUMN "public"."materials"."weight_unit" IS 'Unit for weight measurement (kg, g, ton)';



COMMENT ON COLUMN "public"."materials"."length_per_piece" IS 'Standard length per piece (e.g., 12m for TMT bars)';



COMMENT ON COLUMN "public"."materials"."length_unit" IS 'Unit for length measurement (m, ft, mm)';



COMMENT ON COLUMN "public"."materials"."rods_per_bundle" IS 'Number of rods/pieces per bundle (e.g., 10 for 8mm TMT, 5 for 12mm TMT)';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "title" character varying(255) NOT NULL,
    "message" "text" NOT NULL,
    "notification_type" character varying(50) NOT NULL,
    "related_table" character varying(100),
    "related_id" "uuid",
    "action_url" character varying(500),
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."notifications" IS 'User notifications for alerts and reminders';



CREATE TABLE IF NOT EXISTS "public"."site_payers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."site_payers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."payer_expense_summary" AS
 SELECT "sp"."id" AS "payer_id",
    "sp"."name" AS "payer_name",
    "sp"."site_id",
    "sp"."phone",
    "sp"."is_active",
    "count"("e"."id") AS "expense_count",
    COALESCE("sum"("e"."amount"), (0)::numeric) AS "total_amount",
    "min"("e"."date") AS "first_expense_date",
    "max"("e"."date") AS "last_expense_date"
   FROM ("public"."site_payers" "sp"
     LEFT JOIN "public"."expenses" "e" ON ((("e"."site_payer_id" = "sp"."id") AND ("e"."is_deleted" = false))))
  GROUP BY "sp"."id", "sp"."name", "sp"."site_id", "sp"."phone", "sp"."is_active";


ALTER VIEW "public"."payer_expense_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_phases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_plan_id" "uuid" NOT NULL,
    "phase_name" "text" NOT NULL,
    "description" "text",
    "percentage" numeric NOT NULL,
    "amount" numeric NOT NULL,
    "expected_date" "date",
    "sequence_order" integer DEFAULT 1 NOT NULL,
    "is_milestone" boolean DEFAULT false NOT NULL,
    "construction_phase_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payment_phases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_week_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "labor_payment_id" "uuid" NOT NULL,
    "laborer_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "week_start" "date" NOT NULL,
    "week_end" "date" NOT NULL,
    "allocated_amount" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_week_allocations_allocated_amount_check" CHECK (("allocated_amount" > (0)::numeric))
);


ALTER TABLE "public"."payment_week_allocations" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_week_allocations" IS 'Tracks how salary payments are allocated across weeks (oldest first). One payment can span multiple weeks.';



COMMENT ON COLUMN "public"."payment_week_allocations"."labor_payment_id" IS 'The payment being allocated';



COMMENT ON COLUMN "public"."payment_week_allocations"."laborer_id" IS 'The laborer this allocation is for';



COMMENT ON COLUMN "public"."payment_week_allocations"."week_start" IS 'Start date of the week (Sunday)';



COMMENT ON COLUMN "public"."payment_week_allocations"."week_end" IS 'End date of the week (Saturday)';



COMMENT ON COLUMN "public"."payment_week_allocations"."allocated_amount" IS 'Amount allocated to this week from the payment';



CREATE TABLE IF NOT EXISTS "public"."price_change_reasons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reason" "text" NOT NULL,
    "description" "text",
    "is_increase" boolean,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."price_change_reasons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "price" numeric(12,2) NOT NULL,
    "price_includes_gst" boolean DEFAULT false,
    "gst_rate" numeric(5,2),
    "transport_cost" numeric(10,2),
    "loading_cost" numeric(10,2),
    "unloading_cost" numeric(10,2),
    "total_landed_cost" numeric(12,2),
    "recorded_date" "date" NOT NULL,
    "source" "text" NOT NULL,
    "source_reference" "text",
    "quantity" numeric(12,3),
    "unit" "text",
    "recorded_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "change_reason_id" "uuid",
    "change_reason_text" "text",
    "change_percentage" numeric(8,2),
    "bill_url" "text",
    "bill_number" "text",
    "bill_date" "date",
    CONSTRAINT "price_history_source_check" CHECK (("source" = ANY (ARRAY['purchase'::"text", 'enquiry'::"text", 'quotation'::"text", 'bill'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."price_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "po_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "description" "text",
    "quantity" numeric(12,3) NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "tax_rate" numeric(4,2) DEFAULT 0,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "discount_percent" numeric(5,2) DEFAULT 0,
    "discount_amount" numeric(12,2) DEFAULT 0,
    "total_amount" numeric(12,2) NOT NULL,
    "received_qty" numeric(12,3) DEFAULT 0,
    "pending_qty" numeric(12,3) GENERATED ALWAYS AS (("quantity" - "received_qty")) STORED,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."purchase_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "po_number" "text" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "status" "public"."po_status" DEFAULT 'draft'::"public"."po_status",
    "order_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "expected_delivery_date" "date",
    "delivery_address" "text",
    "delivery_location_id" "uuid",
    "subtotal" numeric(12,2) DEFAULT 0,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "discount_amount" numeric(12,2) DEFAULT 0,
    "transport_cost" numeric(12,2) DEFAULT 0,
    "other_charges" numeric(12,2) DEFAULT 0,
    "total_amount" numeric(12,2) DEFAULT 0,
    "payment_terms" "text",
    "advance_paid" numeric(12,2) DEFAULT 0,
    "quotation_url" "text",
    "po_document_url" "text",
    "notes" "text",
    "internal_notes" "text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_payment_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "po_id" "uuid",
    "delivery_id" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."purchase_payment_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "site_id" "uuid",
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "payment_mode" "text" NOT NULL,
    "reference_number" "text",
    "bank_name" "text",
    "receipt_url" "text",
    "notes" "text",
    "is_advance" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "purchase_payments_payment_mode_check" CHECK (("payment_mode" = ANY (ARRAY['cash'::"text", 'upi'::"text", 'bank_transfer'::"text", 'cheque'::"text", 'card'::"text"])))
);


ALTER TABLE "public"."purchase_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh_key" "text" NOT NULL,
    "auth_key" "text" NOT NULL,
    "user_agent" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salary_payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "salary_period_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "payment_date" "date" NOT NULL,
    "payment_mode" "public"."payment_mode" NOT NULL,
    "reference_number" character varying(100),
    "paid_by" "uuid",
    "paid_to" character varying(255),
    "is_team_payment" boolean DEFAULT false NOT NULL,
    "team_id" "uuid",
    "comments" "text",
    "receipt_url" character varying(500),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "salary_payments_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."salary_payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."salary_payments" IS 'Individual payments against salary periods';



CREATE TABLE IF NOT EXISTS "public"."salary_periods" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "laborer_id" "uuid" NOT NULL,
    "week_ending" "date" NOT NULL,
    "week_start" "date" NOT NULL,
    "total_days_worked" numeric(4,1) DEFAULT 0 NOT NULL,
    "total_hours_worked" numeric(6,2),
    "gross_earnings" numeric(12,2) DEFAULT 0 NOT NULL,
    "advance_deductions" numeric(10,2) DEFAULT 0 NOT NULL,
    "other_deductions" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_deductions" numeric(10,2) DEFAULT 0 NOT NULL,
    "extras" numeric(10,2) DEFAULT 0 NOT NULL,
    "other_additions" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_additions" numeric(10,2) DEFAULT 0 NOT NULL,
    "net_payable" numeric(12,2) DEFAULT 0 NOT NULL,
    "amount_paid" numeric(12,2) DEFAULT 0 NOT NULL,
    "balance_due" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "public"."salary_status" DEFAULT 'draft'::"public"."salary_status" NOT NULL,
    "site_breakdown" "jsonb",
    "calculated_at" timestamp with time zone,
    "calculated_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."salary_periods" OWNER TO "postgres";


COMMENT ON TABLE "public"."salary_periods" IS 'Weekly salary calculation for laborers';



CREATE TABLE IF NOT EXISTS "public"."settlement_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "settlement_reference" "text" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "settlement_date" "date" NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "laborer_count" integer DEFAULT 0 NOT NULL,
    "payment_channel" "text" NOT NULL,
    "payment_mode" "text",
    "payer_source" "text",
    "payer_name" "text",
    "proof_url" "text",
    "notes" "text",
    "subcontract_id" "uuid",
    "engineer_transaction_id" "uuid",
    "is_cancelled" boolean DEFAULT false NOT NULL,
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "text",
    "cancelled_by_user_id" "uuid",
    "cancellation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "created_by_name" "text",
    "payment_type" "text" DEFAULT 'salary'::"text",
    "actual_payment_date" "date" DEFAULT CURRENT_DATE,
    "settlement_type" "text" DEFAULT 'date_wise'::"text",
    "week_allocations" "jsonb",
    "proof_urls" "text"[],
    CONSTRAINT "settlement_groups_payment_channel_check" CHECK (("payment_channel" = ANY (ARRAY['direct'::"text", 'engineer_wallet'::"text"]))),
    CONSTRAINT "settlement_groups_payment_type_check" CHECK (("payment_type" = ANY (ARRAY['salary'::"text", 'advance'::"text", 'other'::"text"]))),
    CONSTRAINT "settlement_groups_settlement_type_check" CHECK (("settlement_type" = ANY (ARRAY['date_wise'::"text", 'labor_wise'::"text", 'weekly'::"text"])))
);


ALTER TABLE "public"."settlement_groups" OWNER TO "postgres";


COMMENT ON TABLE "public"."settlement_groups" IS 'Settlement groups table with corrected dates for backfilled records (Dec 23, 2025)';



COMMENT ON COLUMN "public"."settlement_groups"."settlement_reference" IS 'Unique human-readable reference code (SET-YYMMDD-NNN format)';



COMMENT ON COLUMN "public"."settlement_groups"."settlement_date" IS 'The date when money was given to the laborer. Should equal actual_payment_date.';



COMMENT ON COLUMN "public"."settlement_groups"."payment_channel" IS 'How payment was made: direct (company pays) or engineer_wallet (via engineer)';



COMMENT ON COLUMN "public"."settlement_groups"."payer_source" IS 'Source of money: own_money, client_money, custom, etc.';



COMMENT ON COLUMN "public"."settlement_groups"."payment_type" IS 'Type of payment in this settlement group';



COMMENT ON COLUMN "public"."settlement_groups"."actual_payment_date" IS 'The date when payment was made to the laborer.';



COMMENT ON COLUMN "public"."settlement_groups"."settlement_type" IS 'Type of settlement: date_wise (new default - single payment date covers multiple weeks), labor_wise (legacy - per laborer), weekly (batch weekly)';



COMMENT ON COLUMN "public"."settlement_groups"."week_allocations" IS 'JSONB array storing week allocations: [{weekStart, weekEnd, weekLabel, allocatedAmount, laborerCount, isFullyPaid}]';



COMMENT ON COLUMN "public"."settlement_groups"."proof_urls" IS 'Array of proof screenshot URLs for this settlement (supports multiple attachments)';



CREATE TABLE IF NOT EXISTS "public"."site_clients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "ownership_percentage" numeric(5,2),
    "contract_value" numeric(14,2),
    "is_primary_client" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."site_clients" OWNER TO "postgres";


COMMENT ON TABLE "public"."site_clients" IS 'Many-to-many relationship for multi-client sites';



CREATE TABLE IF NOT EXISTS "public"."site_engineer_settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_engineer_id" "uuid" NOT NULL,
    "settlement_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "settlement_type" "text" NOT NULL,
    "payment_mode" "text" NOT NULL,
    "proof_url" "text",
    "transactions_covered" "uuid"[] DEFAULT '{}'::"uuid"[],
    "notes" "text",
    "recorded_by" "text" NOT NULL,
    "recorded_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "site_engineer_settlements_payment_mode_check" CHECK (("payment_mode" = ANY (ARRAY['cash'::"text", 'upi'::"text", 'bank_transfer'::"text"]))),
    CONSTRAINT "site_engineer_settlements_settlement_type_check" CHECK (("settlement_type" = ANY (ARRAY['company_to_engineer'::"text", 'engineer_to_company'::"text"])))
);


ALTER TABLE "public"."site_engineer_settlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_engineer_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "transaction_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "site_id" "uuid",
    "description" "text",
    "recipient_type" "text",
    "recipient_id" "uuid",
    "payment_mode" "text" NOT NULL,
    "proof_url" "text",
    "related_attendance_id" "uuid",
    "related_subcontract_id" "uuid",
    "is_settled" boolean DEFAULT false,
    "settled_date" "date",
    "settled_by" "uuid",
    "notes" "text",
    "recorded_by" "text" NOT NULL,
    "recorded_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "settlement_status" "text" DEFAULT 'pending_settlement'::"text",
    "settlement_mode" "text",
    "settlement_proof_url" "text",
    "confirmed_by" "text",
    "confirmed_by_user_id" "uuid",
    "confirmed_at" timestamp with time zone,
    "dispute_notes" "text",
    "settlement_reason" "text",
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "text",
    "cancelled_by_user_id" "uuid",
    "cancellation_reason" "text",
    "money_source" "text",
    "money_source_name" "text",
    "payer_source" "text",
    "payer_name" "text",
    "batch_code" "text",
    "site_restricted" boolean DEFAULT false,
    "remaining_balance" numeric DEFAULT 0,
    "settlement_reference" "text",
    "settlement_group_id" "uuid",
    CONSTRAINT "site_engineer_transactions_money_source_check" CHECK ((("money_source" IS NULL) OR ("money_source" = ANY (ARRAY['own_money'::"text", 'amma_money'::"text", 'client_money'::"text", 'other_site_money'::"text", 'custom'::"text", 'trust_account'::"text"])))),
    CONSTRAINT "site_engineer_transactions_payer_source_check" CHECK ((("payer_source" IS NULL) OR ("payer_source" = ANY (ARRAY['own_money'::"text", 'amma_money'::"text", 'client_money'::"text", 'trust_account'::"text", 'other_site_money'::"text", 'custom'::"text", 'mothers_money'::"text"])))),
    CONSTRAINT "site_engineer_transactions_payment_mode_check" CHECK (("payment_mode" = ANY (ARRAY['cash'::"text", 'upi'::"text", 'bank_transfer'::"text"]))),
    CONSTRAINT "site_engineer_transactions_recipient_type_check" CHECK (("recipient_type" = ANY (ARRAY['laborer'::"text", 'mesthri'::"text", 'vendor'::"text", 'other'::"text"]))),
    CONSTRAINT "site_engineer_transactions_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['received_from_company'::"text", 'spent_on_behalf'::"text", 'used_own_money'::"text", 'returned_to_company'::"text"])))
);


ALTER TABLE "public"."site_engineer_transactions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."site_engineer_transactions"."transaction_type" IS 'Transaction type: received_from_company (company sends money to engineer), spent_on_behalf (engineer pays for company expenses), used_own_money (engineer uses personal funds), returned_to_company (engineer returns unused funds)';



COMMENT ON COLUMN "public"."site_engineer_transactions"."settlement_status" IS 'Status: pending_settlement, pending_confirmation, confirmed, disputed';



COMMENT ON COLUMN "public"."site_engineer_transactions"."settlement_mode" IS 'Payment mode used by engineer when settling (upi, cash, net_banking, other)';



COMMENT ON COLUMN "public"."site_engineer_transactions"."settlement_proof_url" IS 'Proof uploaded by engineer when settling';



COMMENT ON COLUMN "public"."site_engineer_transactions"."confirmed_by" IS 'Name of admin who confirmed the settlement';



COMMENT ON COLUMN "public"."site_engineer_transactions"."confirmed_by_user_id" IS 'User ID of admin who confirmed';



COMMENT ON COLUMN "public"."site_engineer_transactions"."confirmed_at" IS 'Timestamp when settlement was confirmed';



COMMENT ON COLUMN "public"."site_engineer_transactions"."dispute_notes" IS 'Notes if settlement is disputed';



COMMENT ON COLUMN "public"."site_engineer_transactions"."cancelled_at" IS 'Timestamp when transaction was cancelled';



COMMENT ON COLUMN "public"."site_engineer_transactions"."cancelled_by" IS 'Name of user who cancelled the transaction';



COMMENT ON COLUMN "public"."site_engineer_transactions"."cancelled_by_user_id" IS 'User ID of who cancelled the transaction';



COMMENT ON COLUMN "public"."site_engineer_transactions"."cancellation_reason" IS 'Optional reason for cancellation';



COMMENT ON COLUMN "public"."site_engineer_transactions"."money_source" IS 'Source of money: own_money, amma_money, client_money, other_site_money, custom, trust_account';



COMMENT ON COLUMN "public"."site_engineer_transactions"."money_source_name" IS 'Custom source name when money_source is other_site_money or custom';



COMMENT ON COLUMN "public"."site_engineer_transactions"."payer_source" IS 'Payment source: own_money, amma_money, client_money, trust_account, other_site_money, custom';



COMMENT ON COLUMN "public"."site_engineer_transactions"."payer_name" IS 'Custom payer name when payer_source is custom or other_site_money';



COMMENT ON COLUMN "public"."site_engineer_transactions"."batch_code" IS 'Auto-generated batch code like TRUST-202412-001';



COMMENT ON COLUMN "public"."site_engineer_transactions"."site_restricted" IS 'If true, money can only be used for the linked site_id';



COMMENT ON COLUMN "public"."site_engineer_transactions"."remaining_balance" IS 'For deposits: tracks unspent amount. Decreases as money is spent.';



COMMENT ON COLUMN "public"."site_engineer_transactions"."settlement_reference" IS 'Links spending transaction to settlement group reference (e.g., SET-202412-001)';



COMMENT ON COLUMN "public"."site_engineer_transactions"."settlement_group_id" IS 'Direct FK to settlement_groups for wallet spending transactions';



CREATE TABLE IF NOT EXISTS "public"."site_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."site_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_holidays" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "reason" character varying(255),
    "is_paid_holiday" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."site_holidays" OWNER TO "postgres";


COMMENT ON TABLE "public"."site_holidays" IS 'Holidays per site - no work expected on these days';



CREATE TABLE IF NOT EXISTS "public"."site_material_budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "budget_amount" numeric(12,2) NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."site_material_budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_payment_milestones" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "milestone_name" character varying(255) NOT NULL,
    "milestone_description" "text",
    "percentage" numeric(5,2) NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "expected_date" "date",
    "actual_payment_date" "date",
    "status" character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    "sequence_order" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "milestone_percentage_check" CHECK ((("percentage" >= (0)::numeric) AND ("percentage" <= (100)::numeric))),
    CONSTRAINT "site_payment_milestones_total_pct_chk" CHECK (("percentage" >= (0)::numeric))
);


ALTER TABLE "public"."site_payment_milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "address" "text",
    "city" character varying(100),
    "site_type" "public"."site_type" DEFAULT 'single_client'::"public"."site_type" NOT NULL,
    "status" "public"."site_status" DEFAULT 'active'::"public"."site_status" NOT NULL,
    "start_date" "date",
    "target_completion_date" "date",
    "actual_completion_date" "date",
    "default_work_start" time without time zone DEFAULT '09:00:00'::time without time zone,
    "default_work_end" time without time zone DEFAULT '18:00:00'::time without time zone,
    "nearby_tea_shop_name" character varying(255),
    "nearby_tea_shop_contact" character varying(20),
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_name" character varying(255),
    "client_contact" character varying(20),
    "client_email" character varying(255),
    "project_contract_value" numeric(15,2),
    "contract_document_url" "text",
    "total_amount_received" numeric(15,2) DEFAULT 0,
    "last_payment_amount" numeric(15,2),
    "last_payment_date" "date",
    "construction_phase" character varying(100),
    "location_lat" numeric(10,8),
    "location_lng" numeric(11,8),
    "location_google_maps_url" "text",
    "construction_phase_id" "uuid",
    "payment_segments" integer,
    "payment_plan_json" "jsonb",
    "default_section_id" "uuid",
    "has_multiple_payers" boolean DEFAULT false,
    "site_group_id" "uuid",
    CONSTRAINT "payment_segments_range" CHECK ((("payment_segments" IS NULL) OR (("payment_segments" >= 1) AND ("payment_segments" <= 20))))
);


ALTER TABLE "public"."sites" OWNER TO "postgres";


COMMENT ON TABLE "public"."sites" IS 'Construction sites - central entity for all modules';



COMMENT ON COLUMN "public"."sites"."client_name" IS 'Name of the client who contracted the project';



COMMENT ON COLUMN "public"."sites"."client_contact" IS 'Primary contact number of the client';



COMMENT ON COLUMN "public"."sites"."project_contract_value" IS 'Total contract value agreed with the client';



COMMENT ON COLUMN "public"."sites"."contract_document_url" IS 'URL to contract PDF in Supabase Storage';



COMMENT ON COLUMN "public"."sites"."total_amount_received" IS 'Cumulative amount received from client';



COMMENT ON COLUMN "public"."sites"."construction_phase" IS 'Current construction stage (Foundation, Structure, etc.)';



COMMENT ON COLUMN "public"."sites"."payment_segments" IS 'Number of payment milestones/phases planned with the client';



COMMENT ON COLUMN "public"."sites"."default_section_id" IS 'Default work section for this site, auto-selected in forms like attendance';



CREATE TABLE IF NOT EXISTS "public"."stock_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "material_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "current_qty" numeric(12,3) DEFAULT 0 NOT NULL,
    "reserved_qty" numeric(12,3) DEFAULT 0 NOT NULL,
    "available_qty" numeric(12,3) GENERATED ALWAYS AS (("current_qty" - "reserved_qty")) STORED,
    "avg_unit_cost" numeric(12,2) DEFAULT 0,
    "last_received_date" "date",
    "last_issued_date" "date",
    "reorder_level" numeric(10,3),
    "reorder_qty" numeric(10,3),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "batch_code" "text"
);


ALTER TABLE "public"."stock_inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text",
    "description" "text",
    "location_type" "text" DEFAULT 'store'::"text",
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stock_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "inventory_id" "uuid" NOT NULL,
    "transaction_type" "public"."stock_transaction_type" NOT NULL,
    "transaction_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "quantity" numeric(12,3) NOT NULL,
    "unit_cost" numeric(12,2),
    "total_cost" numeric(12,2),
    "reference_type" "text",
    "reference_id" "uuid",
    "section_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "batch_code" "text"
);


ALTER TABLE "public"."stock_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_transfer_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transfer_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "quantity_sent" numeric(12,3) NOT NULL,
    "quantity_received" numeric(12,3),
    "unit_cost" numeric(12,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stock_transfer_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transfer_number" "text",
    "from_site_id" "uuid" NOT NULL,
    "to_site_id" "uuid" NOT NULL,
    "from_location_id" "uuid",
    "to_location_id" "uuid",
    "transfer_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "notes" "text",
    "initiated_by" "uuid",
    "initiated_at" timestamp with time zone DEFAULT "now"(),
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "received_by" "uuid",
    "received_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "stock_transfers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_transit'::"text", 'received'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."stock_transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subcontract_milestones" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "sequence_order" integer DEFAULT 0 NOT NULL,
    "amount" numeric(12,2),
    "percentage" numeric(5,2),
    "due_date" "date",
    "completion_date" "date",
    "status" "public"."milestone_status" DEFAULT 'pending'::"public"."milestone_status" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subcontract_milestones" OWNER TO "postgres";


COMMENT ON TABLE "public"."subcontract_milestones" IS 'Payment milestones for contracts';



CREATE TABLE IF NOT EXISTS "public"."subcontract_payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "milestone_id" "uuid",
    "payment_type" "public"."contract_payment_type" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "payment_date" "date" NOT NULL,
    "payment_mode" "public"."payment_mode" NOT NULL,
    "reference_number" character varying(100),
    "paid_by" "uuid",
    "comments" "text",
    "receipt_url" character varying(500),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_channel" "text",
    "paid_by_user_id" "uuid",
    "period_from_date" "date",
    "period_to_date" "date",
    "total_salary_for_period" numeric(12,2),
    "balance_after_payment" numeric(12,2),
    "site_engineer_transaction_id" "uuid",
    "recorded_by" "text",
    "recorded_by_user_id" "uuid",
    CONSTRAINT "contract_payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "subcontract_payments_payment_channel_check" CHECK (("payment_channel" = ANY (ARRAY['via_site_engineer'::"text", 'mesthri_at_office'::"text", 'company_direct_online'::"text"])))
);


ALTER TABLE "public"."subcontract_payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."subcontract_payments" IS 'Payments against Mesthri and Specialist contracts';



CREATE TABLE IF NOT EXISTS "public"."subcontract_sections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "section_id" "uuid" NOT NULL,
    "scope_notes" "text",
    "estimated_value" numeric(12,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subcontract_sections" OWNER TO "postgres";


COMMENT ON TABLE "public"."subcontract_sections" IS 'Which building sections a contract covers';



CREATE TABLE IF NOT EXISTS "public"."subcontracts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "contract_number" character varying(50),
    "contract_type" "public"."contract_type" NOT NULL,
    "team_id" "uuid",
    "laborer_id" "uuid",
    "site_id" "uuid" NOT NULL,
    "assigned_sections" "uuid"[] DEFAULT '{}'::"uuid"[],
    "title" character varying(255) NOT NULL,
    "description" "text",
    "scope_of_work" "text",
    "total_value" numeric(14,2) DEFAULT 0 NOT NULL,
    "measurement_unit" "public"."measurement_unit",
    "rate_per_unit" numeric(10,2),
    "total_units" numeric(12,2),
    "weekly_advance_rate" numeric(10,2),
    "start_date" "date",
    "expected_end_date" "date",
    "actual_end_date" "date",
    "status" "public"."contract_status" DEFAULT 'draft'::"public"."contract_status" NOT NULL,
    "terms_and_conditions" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_rate_based" boolean DEFAULT true NOT NULL,
    "maestri_margin_per_day" numeric(10,2) DEFAULT 0,
    CONSTRAINT "contract_party_check" CHECK (((("contract_type" = 'mesthri'::"public"."contract_type") AND ("team_id" IS NOT NULL)) OR (("contract_type" = 'specialist'::"public"."contract_type") AND ("laborer_id" IS NOT NULL))))
);


ALTER TABLE "public"."subcontracts" OWNER TO "postgres";


COMMENT ON TABLE "public"."subcontracts" IS 'Mesthri and Specialist contracts with terms and values';



COMMENT ON COLUMN "public"."subcontracts"."assigned_sections" IS 'Array of section IDs - also tracked in contract_sections table';



COMMENT ON COLUMN "public"."subcontracts"."weekly_advance_rate" IS 'For mesthri contracts: daily rate used for weekly advance calculation';



COMMENT ON COLUMN "public"."subcontracts"."is_rate_based" IS 'Indicates if contract value is rate-based (calculated from rate_per_unit × total_units) or lump sum';



COMMENT ON COLUMN "public"."subcontracts"."maestri_margin_per_day" IS 'Daily margin earned by the maestri (contractor) per laborer per day worked. Total maestri earnings = margin x days_worked x laborer_count';



CREATE TABLE IF NOT EXISTS "public"."tea_shop_accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_name" character varying(255) NOT NULL,
    "owner_name" character varying(255),
    "contact_phone" character varying(20),
    "address" "text",
    "site_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "upi_id" character varying(100),
    "qr_code_url" "text"
);


ALTER TABLE "public"."tea_shop_accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."tea_shop_accounts" IS 'Tea/snack shops with running accounts';



COMMENT ON COLUMN "public"."tea_shop_accounts"."upi_id" IS 'UPI ID for the tea shop vendor (e.g., shopname@upi)';



COMMENT ON COLUMN "public"."tea_shop_accounts"."qr_code_url" IS 'URL to the payment QR code image stored in Supabase Storage';



CREATE TABLE IF NOT EXISTS "public"."tea_shop_clearances" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tea_shop_id" "uuid" NOT NULL,
    "week_start" "date" NOT NULL,
    "week_end" "date" NOT NULL,
    "total_amount" numeric(10,2) NOT NULL,
    "amount_paid" numeric(10,2) NOT NULL,
    "balance" numeric(10,2) DEFAULT 0 NOT NULL,
    "payment_date" "date" NOT NULL,
    "payment_mode" "public"."payment_mode",
    "paid_by" "uuid",
    "expense_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tea_shop_clearances" OWNER TO "postgres";


COMMENT ON TABLE "public"."tea_shop_clearances" IS 'Weekly clearance records for tea shop accounts';



CREATE TABLE IF NOT EXISTS "public"."tea_shop_consumption_details" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "laborer_id" "uuid",
    "laborer_name" character varying(255),
    "laborer_type" character varying(50),
    "tea_rounds" integer DEFAULT 0,
    "tea_amount" numeric(10,2) DEFAULT 0,
    "snacks_items" "jsonb" DEFAULT '{}'::"jsonb",
    "snacks_amount" numeric(10,2) DEFAULT 0,
    "total_amount" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_working" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tea_shop_consumption_details" OWNER TO "postgres";


COMMENT ON TABLE "public"."tea_shop_consumption_details" IS 'DEPRECATED: Per-laborer consumption tracking. Data preserved for historical records. No longer created for new entries.';



COMMENT ON COLUMN "public"."tea_shop_consumption_details"."is_working" IS 'true = laborer was working that day, false = on leave but consumed';



CREATE TABLE IF NOT EXISTS "public"."tea_shop_entries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tea_shop_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "num_people" integer,
    "num_rounds" integer,
    "items_detail" "text",
    "team_id" "uuid",
    "site_id" "uuid",
    "notes" "text",
    "entered_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "market_laborer_count" integer DEFAULT 0,
    "market_laborer_tea_amount" numeric(10,2) DEFAULT 0,
    "market_laborer_snacks_amount" numeric(10,2) DEFAULT 0,
    "market_laborer_total" numeric(10,2) DEFAULT 0,
    "nonworking_laborer_count" integer DEFAULT 0,
    "nonworking_laborer_total" numeric(10,2) DEFAULT 0,
    "working_laborer_count" integer DEFAULT 0,
    "working_laborer_total" numeric(10,2) DEFAULT 0,
    "tea_rounds" integer DEFAULT 0,
    "tea_people_count" integer DEFAULT 0,
    "tea_rate_per_round" numeric(10,2) DEFAULT 0,
    "tea_total" numeric(10,2) DEFAULT 0,
    "snacks_items" "jsonb" DEFAULT '[]'::"jsonb",
    "snacks_total" numeric(10,2) DEFAULT 0,
    "total_amount" numeric(10,2) DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" character varying(255),
    "updated_by_user_id" "uuid",
    "entry_mode" character varying(20) DEFAULT 'detailed'::character varying,
    "percentage_split" "jsonb",
    "simple_total_cost" numeric(10,2) DEFAULT NULL::numeric,
    "is_split_entry" boolean DEFAULT false,
    "split_source_entry_id" "uuid",
    "split_target_site_id" "uuid",
    "split_percentage" numeric(5,2) DEFAULT NULL::numeric,
    "entered_by_user_id" "uuid",
    "amount_paid" numeric(10,2) DEFAULT 0,
    "is_fully_paid" boolean DEFAULT false,
    CONSTRAINT "tea_shop_entries_entry_mode_check" CHECK ((("entry_mode")::"text" = ANY ((ARRAY['simple'::character varying, 'detailed'::character varying])::"text"[])))
);


ALTER TABLE "public"."tea_shop_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."tea_shop_entries" IS 'Daily consumption entries at tea shops';



COMMENT ON COLUMN "public"."tea_shop_entries"."entered_by" IS 'Name of user who entered this record';



COMMENT ON COLUMN "public"."tea_shop_entries"."market_laborer_count" IS 'Number of market laborers who consumed (anonymous group)';



COMMENT ON COLUMN "public"."tea_shop_entries"."market_laborer_total" IS 'Total tea+snacks amount for market laborers as a group';



COMMENT ON COLUMN "public"."tea_shop_entries"."nonworking_laborer_total" IS 'Total for laborers not working that day but consumed';



COMMENT ON COLUMN "public"."tea_shop_entries"."working_laborer_total" IS 'Total for laborers who worked that day and consumed';



COMMENT ON COLUMN "public"."tea_shop_entries"."tea_rounds" IS 'DEPRECATED: Only used in detailed mode. Data preserved for historical records.';



COMMENT ON COLUMN "public"."tea_shop_entries"."tea_people_count" IS 'Total number of people who had tea';



COMMENT ON COLUMN "public"."tea_shop_entries"."tea_rate_per_round" IS 'DEPRECATED: Only used in detailed mode. Data preserved for historical records.';



COMMENT ON COLUMN "public"."tea_shop_entries"."tea_total" IS 'Total tea cost (rounds * rate)';



COMMENT ON COLUMN "public"."tea_shop_entries"."snacks_items" IS 'DEPRECATED: Only used in detailed mode. Data preserved for historical records.';



COMMENT ON COLUMN "public"."tea_shop_entries"."snacks_total" IS 'Total snacks cost';



COMMENT ON COLUMN "public"."tea_shop_entries"."total_amount" IS 'Grand total (tea + snacks)';



COMMENT ON COLUMN "public"."tea_shop_entries"."updated_by" IS 'Name of user who last updated this record';



COMMENT ON COLUMN "public"."tea_shop_entries"."updated_by_user_id" IS 'UUID of user who last updated this record';



COMMENT ON COLUMN "public"."tea_shop_entries"."entry_mode" IS 'Entry mode: simple (total cost with percentage split) or detailed (per-laborer tracking)';



COMMENT ON COLUMN "public"."tea_shop_entries"."percentage_split" IS 'JSON object with labor group percentages: {daily: number, contract: number, market: number}';



COMMENT ON COLUMN "public"."tea_shop_entries"."simple_total_cost" IS 'Original total cost in simple mode (before any site split)';



COMMENT ON COLUMN "public"."tea_shop_entries"."is_split_entry" IS 'True if this entry was created as part of a multi-site split';



COMMENT ON COLUMN "public"."tea_shop_entries"."split_source_entry_id" IS 'References the primary entry if this is a secondary split entry';



COMMENT ON COLUMN "public"."tea_shop_entries"."split_target_site_id" IS 'The other site involved in the split';



COMMENT ON COLUMN "public"."tea_shop_entries"."split_percentage" IS 'Percentage of total cost allocated to this site';



COMMENT ON COLUMN "public"."tea_shop_entries"."entered_by_user_id" IS 'User ID of the person who created this entry';



COMMENT ON COLUMN "public"."tea_shop_entries"."amount_paid" IS 'Running total of amount paid via settlements (waterfall method)';



COMMENT ON COLUMN "public"."tea_shop_entries"."is_fully_paid" IS 'True when amount_paid >= total_amount';



CREATE TABLE IF NOT EXISTS "public"."tea_shop_settlement_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "settlement_id" "uuid" NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "allocated_amount" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tea_shop_settlement_allocations" OWNER TO "postgres";


COMMENT ON TABLE "public"."tea_shop_settlement_allocations" IS 'Tracks how each settlement payment is allocated across tea shop entries (waterfall model)';



CREATE TABLE IF NOT EXISTS "public"."tea_shop_settlements" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tea_shop_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "entries_total" numeric(12,2) NOT NULL,
    "previous_balance" numeric(12,2) DEFAULT 0,
    "total_due" numeric(12,2) NOT NULL,
    "amount_paid" numeric(12,2) NOT NULL,
    "balance_remaining" numeric(12,2) DEFAULT 0,
    "payment_date" "date" NOT NULL,
    "payment_mode" character varying(50) NOT NULL,
    "payer_type" character varying(50) NOT NULL,
    "site_engineer_id" "uuid",
    "site_engineer_transaction_id" "uuid",
    "is_engineer_settled" boolean DEFAULT false,
    "status" character varying(50) DEFAULT 'completed'::character varying,
    "notes" "text",
    "recorded_by" character varying(255),
    "recorded_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "subcontract_id" "uuid",
    "settlement_reference" character varying(50),
    "is_cancelled" boolean DEFAULT false,
    "proof_url" "text"
);


ALTER TABLE "public"."tea_shop_settlements" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tea_shop_settlements"."settlement_reference" IS 'Unique settlement reference code (e.g., TSS-251228-001)';



COMMENT ON COLUMN "public"."tea_shop_settlements"."is_cancelled" IS 'Soft delete flag - cancelled settlements are excluded from expenses view';



COMMENT ON COLUMN "public"."tea_shop_settlements"."proof_url" IS 'URL to payment proof screenshot (for UPI payments)';



CREATE TABLE IF NOT EXISTS "public"."team_salary_summaries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "week_ending" "date" NOT NULL,
    "total_laborers" integer DEFAULT 0 NOT NULL,
    "total_days_worked" numeric(6,1) DEFAULT 0 NOT NULL,
    "total_gross_earnings" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_deductions" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_additions" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_net_payable" numeric(14,2) DEFAULT 0 NOT NULL,
    "role_breakdown" "jsonb",
    "total_paid" numeric(14,2) DEFAULT 0 NOT NULL,
    "balance_due" numeric(14,2) DEFAULT 0 NOT NULL,
    "status" "public"."salary_status" DEFAULT 'draft'::"public"."salary_status" NOT NULL,
    "total_expenses" numeric(12,2) DEFAULT 0 NOT NULL,
    "grand_total" numeric(14,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_salary_summaries" OWNER TO "postgres";


COMMENT ON TABLE "public"."team_salary_summaries" IS 'Aggregated weekly summary for teams';



CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "leader_name" character varying(255) NOT NULL,
    "leader_phone" character varying(20),
    "leader_address" "text",
    "status" "public"."team_status" DEFAULT 'active'::"public"."team_status" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


COMMENT ON TABLE "public"."teams" IS 'Mesthri teams - group of workers under a team leader';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "auth_id" "uuid",
    "email" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "phone" character varying(20),
    "role" "public"."user_role" DEFAULT 'site_engineer'::"public"."user_role" NOT NULL,
    "assigned_sites" "uuid"[] DEFAULT '{}'::"uuid"[],
    "status" "public"."user_status" DEFAULT 'active'::"public"."user_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_url" "text",
    "display_name" "text",
    "job_title" "text",
    "timezone" "text" DEFAULT 'Asia/Kolkata'::"text",
    "date_format" "text" DEFAULT 'DD/MM/YYYY'::"text",
    "last_login_at" timestamp with time zone,
    "theme_preference" "text" DEFAULT 'light'::"text",
    "email_notifications" boolean DEFAULT true
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'Application users with role-based access control';



CREATE OR REPLACE VIEW "public"."v_active_attendance" AS
 SELECT "da"."id",
    "da"."daily_log_id",
    "da"."date",
    "da"."laborer_id",
    "da"."site_id",
    "da"."section_id",
    "da"."start_time",
    "da"."end_time",
    "da"."hours_worked",
    "da"."work_days",
    "da"."work_variance",
    "da"."daily_rate_applied",
    "da"."daily_earnings",
    "da"."work_description",
    "da"."task_completed",
    "da"."team_id",
    "da"."subcontract_id" AS "contract_id",
    "da"."entered_by",
    "da"."verified_by",
    "da"."is_verified",
    "da"."is_deleted",
    "da"."deleted_at",
    "da"."deleted_by",
    "da"."created_at",
    "da"."updated_at",
    "l"."name" AS "laborer_name",
    "l"."phone" AS "laborer_phone",
    "lr"."name" AS "role_name",
    "lc"."name" AS "category_name",
    "s"."name" AS "site_name",
    "bs"."name" AS "section_name",
    "t"."name" AS "team_name",
    "t"."leader_name" AS "team_leader"
   FROM (((((("public"."daily_attendance" "da"
     JOIN "public"."laborers" "l" ON (("da"."laborer_id" = "l"."id")))
     JOIN "public"."labor_roles" "lr" ON (("l"."role_id" = "lr"."id")))
     JOIN "public"."labor_categories" "lc" ON (("l"."category_id" = "lc"."id")))
     JOIN "public"."sites" "s" ON (("da"."site_id" = "s"."id")))
     LEFT JOIN "public"."building_sections" "bs" ON (("da"."section_id" = "bs"."id")))
     LEFT JOIN "public"."teams" "t" ON (("da"."team_id" = "t"."id")))
  WHERE ("da"."is_deleted" = false);


ALTER VIEW "public"."v_active_attendance" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_active_attendance" IS 'Active attendance entries with joined laborer and site details';



CREATE OR REPLACE VIEW "public"."v_all_expenses" AS
 SELECT "e"."id",
    "e"."site_id",
    "e"."date",
    "e"."date" AS "recorded_date",
    "e"."amount",
    "e"."description",
    "e"."category_id",
    "ec"."name" AS "category_name",
    ("e"."module")::"text" AS "module",
    (
        CASE "e"."module"
            WHEN 'material'::"public"."expense_module" THEN 'Material'::character varying
            WHEN 'machinery'::"public"."expense_module" THEN 'Machinery'::character varying
            WHEN 'general'::"public"."expense_module" THEN 'General'::character varying
            ELSE COALESCE("ec"."name", 'Other'::character varying)
        END)::"text" AS "expense_type",
    "e"."is_cleared",
    "e"."cleared_date",
    "e"."contract_id",
    "sc"."title" AS "subcontract_title",
    "e"."site_payer_id",
    "sp"."name" AS "payer_name",
    ("e"."payment_mode")::"text" AS "payment_mode",
    "e"."vendor_name",
    "e"."receipt_url",
    "e"."paid_by",
    "e"."entered_by",
    "e"."entered_by_user_id",
    NULL::"text" AS "settlement_reference",
    NULL::"uuid" AS "settlement_group_id",
    'expense'::"text" AS "source_type",
    "e"."id" AS "source_id",
    "e"."created_at",
    "e"."is_deleted"
   FROM ((("public"."expenses" "e"
     LEFT JOIN "public"."expense_categories" "ec" ON (("e"."category_id" = "ec"."id")))
     LEFT JOIN "public"."subcontracts" "sc" ON (("e"."contract_id" = "sc"."id")))
     LEFT JOIN "public"."site_payers" "sp" ON (("e"."site_payer_id" = "sp"."id")))
  WHERE (("e"."is_deleted" = false) AND ("e"."module" <> 'labor'::"public"."expense_module"))
UNION ALL
 SELECT ("array_agg"("sg"."id" ORDER BY "sg"."created_at"))[1] AS "id",
    "sg"."site_id",
    "sg"."settlement_date" AS "date",
    "max"(COALESCE("sg"."actual_payment_date", ("sg"."created_at")::"date")) AS "recorded_date",
    "sum"("sg"."total_amount") AS "amount",
    (('Salary settlement ('::"text" || "sum"("sg"."laborer_count")) || ' laborers)'::"text") AS "description",
    ( SELECT "expense_categories"."id"
           FROM "public"."expense_categories"
          WHERE (("expense_categories"."name")::"text" = 'Salary Settlement'::"text")
         LIMIT 1) AS "category_id",
    'Salary Settlement'::character varying AS "category_name",
    'labor'::"text" AS "module",
    'Daily Salary'::"text" AS "expense_type",
    "bool_and"(
        CASE
            WHEN ("sg"."payment_channel" = 'direct'::"text") THEN true
            WHEN ("sg"."engineer_transaction_id" IS NOT NULL) THEN COALESCE(( SELECT "site_engineer_transactions"."is_settled"
               FROM "public"."site_engineer_transactions"
              WHERE ("site_engineer_transactions"."id" = "sg"."engineer_transaction_id")), false)
            ELSE false
        END) AS "is_cleared",
    "max"(
        CASE
            WHEN ("sg"."payment_channel" = 'direct'::"text") THEN "sg"."settlement_date"
            WHEN ("sg"."engineer_transaction_id" IS NOT NULL) THEN ( SELECT ("site_engineer_transactions"."confirmed_at")::"date" AS "confirmed_at"
               FROM "public"."site_engineer_transactions"
              WHERE (("site_engineer_transactions"."id" = "sg"."engineer_transaction_id") AND ("site_engineer_transactions"."is_settled" = true)))
            ELSE NULL::"date"
        END) AS "cleared_date",
    ("array_agg"("sg"."subcontract_id" ORDER BY "sg"."created_at") FILTER (WHERE ("sg"."subcontract_id" IS NOT NULL)))[1] AS "contract_id",
    ("array_agg"("sc"."title" ORDER BY "sg"."created_at") FILTER (WHERE ("sc"."title" IS NOT NULL)))[1] AS "subcontract_title",
    NULL::"uuid" AS "site_payer_id",
        CASE
            WHEN ("count"(DISTINCT "sg"."payer_source") = 1) THEN
            CASE
                WHEN ("max"("sg"."payer_source") IS NULL) THEN 'Own Money'::"text"
                WHEN ("max"("sg"."payer_source") = 'own_money'::"text") THEN 'Own Money'::"text"
                WHEN ("max"("sg"."payer_source") = 'amma_money'::"text") THEN 'Amma Money'::"text"
                WHEN ("max"("sg"."payer_source") = 'client_money'::"text") THEN 'Client Money'::"text"
                WHEN ("max"("sg"."payer_source") = 'other_site_money'::"text") THEN COALESCE("max"("sg"."payer_name"), 'Other Site'::"text")
                WHEN ("max"("sg"."payer_source") = 'custom'::"text") THEN COALESCE("max"("sg"."payer_name"), 'Other'::"text")
                ELSE COALESCE("max"("sg"."payer_name"), 'Own Money'::"text")
            END
            ELSE 'Multiple Sources'::"text"
        END AS "payer_name",
    ("array_agg"("sg"."payment_mode" ORDER BY "sg"."created_at"))[1] AS "payment_mode",
    NULL::"text" AS "vendor_name",
    ("array_agg"("sg"."proof_url" ORDER BY "sg"."created_at") FILTER (WHERE ("sg"."proof_url" IS NOT NULL)))[1] AS "receipt_url",
    ("array_agg"("sg"."created_by" ORDER BY "sg"."created_at"))[1] AS "paid_by",
    ("array_agg"("sg"."created_by_name" ORDER BY "sg"."created_at"))[1] AS "entered_by",
    ("array_agg"("sg"."created_by" ORDER BY "sg"."created_at"))[1] AS "entered_by_user_id",
    ("array_agg"("sg"."settlement_reference" ORDER BY "sg"."created_at"))[1] AS "settlement_reference",
    ("array_agg"("sg"."id" ORDER BY "sg"."created_at"))[1] AS "settlement_group_id",
    'settlement'::"text" AS "source_type",
    ("array_agg"("sg"."id" ORDER BY "sg"."created_at"))[1] AS "source_id",
    "min"("sg"."created_at") AS "created_at",
    false AS "is_deleted"
   FROM ("public"."settlement_groups" "sg"
     LEFT JOIN "public"."subcontracts" "sc" ON (("sg"."subcontract_id" = "sc"."id")))
  WHERE (("sg"."is_cancelled" = false) AND (COALESCE("sg"."payment_type", 'salary'::"text") <> 'advance'::"text") AND (NOT (EXISTS ( SELECT 1
           FROM "public"."labor_payments" "lp"
          WHERE (("lp"."settlement_group_id" = "sg"."id") AND ("lp"."is_under_contract" = true))))))
  GROUP BY "sg"."site_id", "sg"."settlement_date"
UNION ALL
 SELECT "sg"."id",
    "sg"."site_id",
    "sg"."settlement_date" AS "date",
    COALESCE("sg"."actual_payment_date", ("sg"."created_at")::"date") AS "recorded_date",
    "sg"."total_amount" AS "amount",
        CASE
            WHEN (("sg"."notes" IS NOT NULL) AND ("sg"."notes" <> ''::"text")) THEN ((('Salary settlement ('::"text" || "sg"."laborer_count") || ' laborers) - '::"text") || "sg"."notes")
            ELSE (('Salary settlement ('::"text" || "sg"."laborer_count") || ' laborers)'::"text")
        END AS "description",
    ( SELECT "expense_categories"."id"
           FROM "public"."expense_categories"
          WHERE (("expense_categories"."name")::"text" = 'Salary Settlement'::"text")
         LIMIT 1) AS "category_id",
    'Salary Settlement'::character varying AS "category_name",
    'labor'::"text" AS "module",
    'Contract Salary'::"text" AS "expense_type",
        CASE
            WHEN ("sg"."payment_channel" = 'direct'::"text") THEN true
            WHEN ("sg"."engineer_transaction_id" IS NOT NULL) THEN COALESCE(( SELECT "site_engineer_transactions"."is_settled"
               FROM "public"."site_engineer_transactions"
              WHERE ("site_engineer_transactions"."id" = "sg"."engineer_transaction_id")), false)
            ELSE false
        END AS "is_cleared",
        CASE
            WHEN ("sg"."payment_channel" = 'direct'::"text") THEN "sg"."settlement_date"
            WHEN ("sg"."engineer_transaction_id" IS NOT NULL) THEN ( SELECT ("site_engineer_transactions"."confirmed_at")::"date" AS "confirmed_at"
               FROM "public"."site_engineer_transactions"
              WHERE (("site_engineer_transactions"."id" = "sg"."engineer_transaction_id") AND ("site_engineer_transactions"."is_settled" = true)))
            ELSE NULL::"date"
        END AS "cleared_date",
    "sg"."subcontract_id" AS "contract_id",
    "sc"."title" AS "subcontract_title",
    NULL::"uuid" AS "site_payer_id",
        CASE
            WHEN ("sg"."payer_source" IS NULL) THEN 'Own Money'::"text"
            WHEN ("sg"."payer_source" = 'own_money'::"text") THEN 'Own Money'::"text"
            WHEN ("sg"."payer_source" = 'amma_money'::"text") THEN 'Amma Money'::"text"
            WHEN ("sg"."payer_source" = 'client_money'::"text") THEN 'Client Money'::"text"
            WHEN ("sg"."payer_source" = 'other_site_money'::"text") THEN COALESCE("sg"."payer_name", 'Other Site'::"text")
            WHEN ("sg"."payer_source" = 'custom'::"text") THEN COALESCE("sg"."payer_name", 'Other'::"text")
            ELSE COALESCE("sg"."payer_name", 'Own Money'::"text")
        END AS "payer_name",
    "sg"."payment_mode",
    NULL::"text" AS "vendor_name",
    "sg"."proof_url" AS "receipt_url",
    "sg"."created_by" AS "paid_by",
    "sg"."created_by_name" AS "entered_by",
    "sg"."created_by" AS "entered_by_user_id",
    "sg"."settlement_reference",
    "sg"."id" AS "settlement_group_id",
    'settlement'::"text" AS "source_type",
    "sg"."id" AS "source_id",
    "sg"."created_at",
    "sg"."is_cancelled" AS "is_deleted"
   FROM ("public"."settlement_groups" "sg"
     LEFT JOIN "public"."subcontracts" "sc" ON (("sg"."subcontract_id" = "sc"."id")))
  WHERE (("sg"."is_cancelled" = false) AND (EXISTS ( SELECT 1
           FROM "public"."labor_payments" "lp"
          WHERE (("lp"."settlement_group_id" = "sg"."id") AND ("lp"."is_under_contract" = true)))))
UNION ALL
 SELECT "sg"."id",
    "sg"."site_id",
    "sg"."settlement_date" AS "date",
    COALESCE("sg"."actual_payment_date", ("sg"."created_at")::"date") AS "recorded_date",
    "sg"."total_amount" AS "amount",
        CASE
            WHEN (("sg"."notes" IS NOT NULL) AND ("sg"."notes" <> ''::"text")) THEN ((('Advance payment ('::"text" || "sg"."laborer_count") || ' laborers) - '::"text") || "sg"."notes")
            ELSE (('Advance payment ('::"text" || "sg"."laborer_count") || ' laborers)'::"text")
        END AS "description",
    ( SELECT "expense_categories"."id"
           FROM "public"."expense_categories"
          WHERE (("expense_categories"."name")::"text" = 'Salary Settlement'::"text")
         LIMIT 1) AS "category_id",
    'Salary Settlement'::character varying AS "category_name",
    'labor'::"text" AS "module",
    'Advance'::"text" AS "expense_type",
        CASE
            WHEN ("sg"."payment_channel" = 'direct'::"text") THEN true
            WHEN ("sg"."engineer_transaction_id" IS NOT NULL) THEN COALESCE(( SELECT "site_engineer_transactions"."is_settled"
               FROM "public"."site_engineer_transactions"
              WHERE ("site_engineer_transactions"."id" = "sg"."engineer_transaction_id")), false)
            ELSE false
        END AS "is_cleared",
        CASE
            WHEN ("sg"."payment_channel" = 'direct'::"text") THEN "sg"."settlement_date"
            WHEN ("sg"."engineer_transaction_id" IS NOT NULL) THEN ( SELECT ("site_engineer_transactions"."confirmed_at")::"date" AS "confirmed_at"
               FROM "public"."site_engineer_transactions"
              WHERE (("site_engineer_transactions"."id" = "sg"."engineer_transaction_id") AND ("site_engineer_transactions"."is_settled" = true)))
            ELSE NULL::"date"
        END AS "cleared_date",
    "sg"."subcontract_id" AS "contract_id",
    "sc"."title" AS "subcontract_title",
    NULL::"uuid" AS "site_payer_id",
        CASE
            WHEN ("sg"."payer_source" IS NULL) THEN 'Own Money'::"text"
            WHEN ("sg"."payer_source" = 'own_money'::"text") THEN 'Own Money'::"text"
            WHEN ("sg"."payer_source" = 'amma_money'::"text") THEN 'Amma Money'::"text"
            WHEN ("sg"."payer_source" = 'client_money'::"text") THEN 'Client Money'::"text"
            WHEN ("sg"."payer_source" = 'other_site_money'::"text") THEN COALESCE("sg"."payer_name", 'Other Site'::"text")
            WHEN ("sg"."payer_source" = 'custom'::"text") THEN COALESCE("sg"."payer_name", 'Other'::"text")
            ELSE COALESCE("sg"."payer_name", 'Own Money'::"text")
        END AS "payer_name",
    "sg"."payment_mode",
    NULL::"text" AS "vendor_name",
    "sg"."proof_url" AS "receipt_url",
    "sg"."created_by" AS "paid_by",
    "sg"."created_by_name" AS "entered_by",
    "sg"."created_by" AS "entered_by_user_id",
    "sg"."settlement_reference",
    "sg"."id" AS "settlement_group_id",
    'settlement'::"text" AS "source_type",
    "sg"."id" AS "source_id",
    "sg"."created_at",
    "sg"."is_cancelled" AS "is_deleted"
   FROM ("public"."settlement_groups" "sg"
     LEFT JOIN "public"."subcontracts" "sc" ON (("sg"."subcontract_id" = "sc"."id")))
  WHERE (("sg"."is_cancelled" = false) AND ("sg"."payment_type" = 'advance'::"text"))
UNION ALL
 SELECT "ts"."id",
    "tsa"."site_id",
    "ts"."payment_date" AS "date",
    "ts"."payment_date" AS "recorded_date",
    "ts"."amount_paid" AS "amount",
        CASE
            WHEN (("ts"."notes" IS NOT NULL) AND ("ts"."notes" <> ''::"text")) THEN ((('Tea Shop - '::"text" || ("tsa"."shop_name")::"text") || ' - '::"text") || "ts"."notes")
            ELSE ('Tea Shop - '::"text" || ("tsa"."shop_name")::"text")
        END AS "description",
    ( SELECT "expense_categories"."id"
           FROM "public"."expense_categories"
          WHERE (("expense_categories"."name")::"text" = 'Tea & Snacks'::"text")
         LIMIT 1) AS "category_id",
    'Tea & Snacks'::character varying AS "category_name",
    'general'::"text" AS "module",
    'Tea & Snacks'::"text" AS "expense_type",
        CASE
            WHEN (("ts"."payer_type")::"text" = 'company_direct'::"text") THEN true
            WHEN ("ts"."site_engineer_transaction_id" IS NOT NULL) THEN COALESCE(( SELECT "site_engineer_transactions"."is_settled"
               FROM "public"."site_engineer_transactions"
              WHERE ("site_engineer_transactions"."id" = "ts"."site_engineer_transaction_id")), false)
            ELSE true
        END AS "is_cleared",
        CASE
            WHEN (("ts"."payer_type")::"text" = 'company_direct'::"text") THEN "ts"."payment_date"
            WHEN ("ts"."site_engineer_transaction_id" IS NOT NULL) THEN ( SELECT ("site_engineer_transactions"."confirmed_at")::"date" AS "confirmed_at"
               FROM "public"."site_engineer_transactions"
              WHERE (("site_engineer_transactions"."id" = "ts"."site_engineer_transaction_id") AND ("site_engineer_transactions"."is_settled" = true)))
            ELSE "ts"."payment_date"
        END AS "cleared_date",
    "ts"."subcontract_id" AS "contract_id",
    "sc"."title" AS "subcontract_title",
    NULL::"uuid" AS "site_payer_id",
        CASE "ts"."payer_type"
            WHEN 'company_direct'::"text" THEN 'Company Direct'::character varying
            WHEN 'site_engineer'::"text" THEN COALESCE(( SELECT "users"."name"
               FROM "public"."users"
              WHERE ("users"."id" = "ts"."site_engineer_id")), 'Site Engineer'::character varying)
            ELSE "ts"."payer_type"
        END AS "payer_name",
    "ts"."payment_mode",
    "tsa"."shop_name" AS "vendor_name",
    NULL::"text" AS "receipt_url",
    "ts"."recorded_by_user_id" AS "paid_by",
    "ts"."recorded_by" AS "entered_by",
    "ts"."recorded_by_user_id" AS "entered_by_user_id",
    "ts"."settlement_reference",
    NULL::"uuid" AS "settlement_group_id",
    'tea_shop_settlement'::"text" AS "source_type",
    "ts"."id" AS "source_id",
    "ts"."created_at",
    COALESCE("ts"."is_cancelled", false) AS "is_deleted"
   FROM (("public"."tea_shop_settlements" "ts"
     JOIN "public"."tea_shop_accounts" "tsa" ON (("ts"."tea_shop_id" = "tsa"."id")))
     LEFT JOIN "public"."subcontracts" "sc" ON (("ts"."subcontract_id" = "sc"."id")))
  WHERE (COALESCE("ts"."is_cancelled", false) = false);


ALTER VIEW "public"."v_all_expenses" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_all_expenses" IS 'Unified view combining regular expenses, derived salary expenses from settlement_groups (Daily Salary aggregated by date), and tea shop settlements.';



CREATE OR REPLACE VIEW "public"."v_batch_allocation_summary" AS
 SELECT "gst"."site_group_id",
    "sg"."name" AS "group_name",
    "gst"."batch_code",
    "gst"."material_id",
    "m"."name" AS "material_name",
    "m"."unit",
    ( SELECT "ps"."id"
           FROM ("public"."group_stock_transactions" "pt"
             JOIN "public"."sites" "ps" ON (("ps"."id" = "pt"."payment_source_site_id")))
          WHERE (("pt"."inventory_id" = "gst"."inventory_id") AND ("pt"."transaction_type" = 'purchase'::"public"."stock_transaction_type"))
          ORDER BY "pt"."created_at"
         LIMIT 1) AS "paid_by_site_id",
    ( SELECT "ps"."name"
           FROM ("public"."group_stock_transactions" "pt"
             JOIN "public"."sites" "ps" ON (("ps"."id" = "pt"."payment_source_site_id")))
          WHERE (("pt"."inventory_id" = "gst"."inventory_id") AND ("pt"."transaction_type" = 'purchase'::"public"."stock_transaction_type"))
          ORDER BY "pt"."created_at"
         LIMIT 1) AS "paid_by_site_name",
    ( SELECT "sum"("pt"."total_cost") AS "sum"
           FROM "public"."group_stock_transactions" "pt"
          WHERE (("pt"."inventory_id" = "gst"."inventory_id") AND ("pt"."transaction_type" = 'purchase'::"public"."stock_transaction_type"))) AS "total_purchase_cost",
    "gst"."usage_site_id",
    "us"."name" AS "usage_site_name",
    "sum"("abs"("gst"."quantity")) AS "quantity_used",
    "sum"("abs"("gst"."total_cost")) AS "cost_used"
   FROM ((("public"."group_stock_transactions" "gst"
     JOIN "public"."site_groups" "sg" ON (("sg"."id" = "gst"."site_group_id")))
     JOIN "public"."materials" "m" ON (("m"."id" = "gst"."material_id")))
     LEFT JOIN "public"."sites" "us" ON (("us"."id" = "gst"."usage_site_id")))
  WHERE (("gst"."transaction_type" = 'usage'::"public"."stock_transaction_type") AND ("gst"."usage_site_id" IS NOT NULL))
  GROUP BY "gst"."site_group_id", "sg"."name", "gst"."batch_code", "gst"."material_id", "m"."name", "m"."unit", "gst"."inventory_id", "gst"."usage_site_id", "us"."name"
  ORDER BY "gst"."site_group_id", "gst"."batch_code", "gst"."usage_site_id";


ALTER VIEW "public"."v_batch_allocation_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text",
    "contact_person" "text",
    "phone" "text",
    "alternate_phone" "text",
    "whatsapp_number" "text",
    "email" "text",
    "address" "text",
    "city" "text",
    "state" "text" DEFAULT 'Tamil Nadu'::"text",
    "pincode" "text",
    "gst_number" "text",
    "pan_number" "text",
    "bank_name" "text",
    "bank_account_number" "text",
    "bank_ifsc" "text",
    "payment_terms_days" integer DEFAULT 30,
    "credit_limit" numeric(12,2) DEFAULT 0,
    "notes" "text",
    "rating" numeric(2,1),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "vendor_type" "public"."vendor_type" DEFAULT 'dealer'::"public"."vendor_type",
    "shop_name" "text",
    "has_physical_store" boolean DEFAULT false,
    "store_address" "text",
    "store_city" "text",
    "store_pincode" "text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "provides_transport" boolean DEFAULT false,
    "provides_loading" boolean DEFAULT false,
    "provides_unloading" boolean DEFAULT false,
    "min_order_amount" numeric(12,2),
    "delivery_radius_km" integer,
    "specializations" "text"[],
    "accepts_upi" boolean DEFAULT false,
    "accepts_cash" boolean DEFAULT true,
    "accepts_credit" boolean DEFAULT false,
    "credit_days" integer,
    CONSTRAINT "vendors_rating_check" CHECK ((("rating" >= (0)::numeric) AND ("rating" <= (5)::numeric)))
);


ALTER TABLE "public"."vendors" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_delivery_verification_details" AS
 SELECT "d"."id",
    "d"."grn_number",
    "d"."site_id",
    "s"."name" AS "site_name",
    "d"."vendor_id",
    "v"."name" AS "vendor_name",
    "v"."phone" AS "vendor_phone",
    "d"."po_id",
    "po"."po_number",
    "d"."delivery_date",
    "d"."challan_number",
    "d"."challan_url",
    "d"."vehicle_number",
    "d"."driver_name",
    "d"."driver_phone",
    "d"."delivery_status",
    "d"."verification_status",
    "d"."verification_photos",
    "d"."verification_notes",
    "d"."discrepancies",
    "d"."engineer_verified_by",
    "u"."name" AS "verified_by_name",
    "d"."engineer_verified_at",
    "d"."requires_verification",
    "d"."created_at"
   FROM (((("public"."deliveries" "d"
     JOIN "public"."sites" "s" ON (("s"."id" = "d"."site_id")))
     JOIN "public"."vendors" "v" ON (("v"."id" = "d"."vendor_id")))
     LEFT JOIN "public"."purchase_orders" "po" ON (("po"."id" = "d"."po_id")))
     LEFT JOIN "public"."users" "u" ON (("u"."id" = "d"."engineer_verified_by")));


ALTER VIEW "public"."v_delivery_verification_details" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_group_stock_summary" AS
 SELECT "gsi"."site_group_id",
    "sg"."name" AS "group_name",
    "m"."id" AS "material_id",
    "m"."name" AS "material_name",
    "m"."code" AS "material_code",
    "mc"."name" AS "category_name",
    "m"."unit",
    "mb"."brand_name",
    COALESCE("gsi"."current_qty", (0)::numeric) AS "total_qty",
    COALESCE("gsi"."reserved_qty", (0)::numeric) AS "total_reserved",
    COALESCE("gsi"."available_qty", (0)::numeric) AS "total_available",
    COALESCE("gsi"."avg_unit_cost", (0)::numeric) AS "avg_cost",
    COALESCE("gsi"."total_value", (0)::numeric) AS "total_value",
    "gsi"."last_received_date",
    "gsi"."last_used_date"
   FROM (((("public"."group_stock_inventory" "gsi"
     JOIN "public"."site_groups" "sg" ON (("sg"."id" = "gsi"."site_group_id")))
     JOIN "public"."materials" "m" ON (("m"."id" = "gsi"."material_id")))
     LEFT JOIN "public"."material_categories" "mc" ON (("mc"."id" = "m"."category_id")))
     LEFT JOIN "public"."material_brands" "mb" ON (("mb"."id" = "gsi"."brand_id")))
  WHERE ("sg"."is_active" = true);


ALTER VIEW "public"."v_group_stock_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_group_usage_by_site" AS
 SELECT "gst"."site_group_id",
    "sg"."name" AS "group_name",
    "gst"."usage_site_id",
    "s"."name" AS "site_name",
    "gst"."material_id",
    "m"."name" AS "material_name",
    "m"."unit",
    "date_trunc"('month'::"text", ("gst"."transaction_date")::timestamp with time zone) AS "usage_month",
    "sum"("abs"("gst"."quantity")) AS "total_quantity",
    "sum"("abs"("gst"."total_cost")) AS "total_cost"
   FROM ((("public"."group_stock_transactions" "gst"
     JOIN "public"."site_groups" "sg" ON (("sg"."id" = "gst"."site_group_id")))
     JOIN "public"."sites" "s" ON (("s"."id" = "gst"."usage_site_id")))
     JOIN "public"."materials" "m" ON (("m"."id" = "gst"."material_id")))
  WHERE (("gst"."transaction_type" = 'usage'::"public"."stock_transaction_type") AND ("gst"."usage_site_id" IS NOT NULL))
  GROUP BY "gst"."site_group_id", "sg"."name", "gst"."usage_site_id", "s"."name", "gst"."material_id", "m"."name", "m"."unit", ("date_trunc"('month'::"text", ("gst"."transaction_date")::timestamp with time zone));


ALTER VIEW "public"."v_group_usage_by_site" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_inter_site_balance" AS
 SELECT "gst"."site_group_id",
    "sg"."name" AS "group_name",
    "gst"."payment_source_site_id" AS "creditor_site_id",
    "cs"."name" AS "creditor_site_name",
    "gst"."usage_site_id" AS "debtor_site_id",
    "ds"."name" AS "debtor_site_name",
    (EXTRACT(year FROM "gst"."transaction_date"))::integer AS "year",
    (EXTRACT(week FROM "gst"."transaction_date"))::integer AS "week_number",
    ("date_trunc"('week'::"text", ("gst"."transaction_date")::timestamp with time zone))::"date" AS "week_start",
    (("date_trunc"('week'::"text", ("gst"."transaction_date")::timestamp with time zone) + '6 days'::interval))::"date" AS "week_end",
    "count"(DISTINCT "gst"."id") AS "transaction_count",
    "count"(DISTINCT "gst"."material_id") AS "material_count",
    "sum"("abs"("gst"."quantity")) AS "total_quantity",
    "sum"("abs"("gst"."total_cost")) AS "total_amount_owed"
   FROM ((("public"."group_stock_transactions" "gst"
     JOIN "public"."site_groups" "sg" ON (("sg"."id" = "gst"."site_group_id")))
     JOIN "public"."sites" "cs" ON (("cs"."id" = "gst"."payment_source_site_id")))
     JOIN "public"."sites" "ds" ON (("ds"."id" = "gst"."usage_site_id")))
  WHERE (("gst"."transaction_type" = 'usage'::"public"."stock_transaction_type") AND ("gst"."usage_site_id" IS NOT NULL) AND ("gst"."payment_source_site_id" IS NOT NULL) AND ("gst"."payment_source_site_id" <> "gst"."usage_site_id"))
  GROUP BY "gst"."site_group_id", "sg"."name", "gst"."payment_source_site_id", "cs"."name", "gst"."usage_site_id", "ds"."name", (EXTRACT(year FROM "gst"."transaction_date")), (EXTRACT(week FROM "gst"."transaction_date")), ("date_trunc"('week'::"text", ("gst"."transaction_date")::timestamp with time zone))
  ORDER BY ((EXTRACT(year FROM "gst"."transaction_date"))::integer) DESC, ((EXTRACT(week FROM "gst"."transaction_date"))::integer) DESC, "gst"."site_group_id";


ALTER VIEW "public"."v_inter_site_balance" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_laborer_advance_summary" AS
 SELECT "id" AS "laborer_id",
    "name" AS "laborer_name",
    "total_advance_given",
    "total_advance_deducted",
    ("total_advance_given" - "total_advance_deducted") AS "pending_advance",
    COALESCE(( SELECT "sum"("lp"."amount") AS "sum"
           FROM "public"."labor_payments" "lp"
          WHERE (("lp"."laborer_id" = "l"."id") AND ("lp"."payment_type" = 'advance'::"text") AND ("lp"."is_advance_deduction" = false))), (0)::numeric) AS "calculated_advance_given",
    COALESCE(( SELECT "sum"("lp"."amount") AS "sum"
           FROM "public"."labor_payments" "lp"
          WHERE (("lp"."laborer_id" = "l"."id") AND ("lp"."is_advance_deduction" = true))), (0)::numeric) AS "calculated_advance_deducted"
   FROM "public"."laborers" "l"
  WHERE ("laborer_type" = 'contract'::"text");


ALTER VIEW "public"."v_laborer_advance_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_laborer_advance_summary" IS 'Summary of advance payments and deductions for contract laborers';



CREATE OR REPLACE VIEW "public"."v_local_purchases_details" AS
 SELECT "lp"."id",
    "lp"."purchase_number",
    "lp"."site_id",
    "s"."name" AS "site_name",
    "lp"."site_group_id",
    "sg"."name" AS "group_name",
    "lp"."engineer_id",
    "u"."name" AS "engineer_name",
    "lp"."vendor_id",
    "lp"."vendor_name",
    "v"."vendor_type",
    "lp"."vendor_phone",
    "lp"."purchase_date",
    "lp"."receipt_url",
    "lp"."total_amount",
    "lp"."payment_mode",
    "lp"."payment_source",
    "lp"."description",
    "lp"."status",
    "lp"."needs_reimbursement",
    "lp"."reimbursement_status",
    "lp"."reimbursement_transaction_id",
    "lp"."add_to_stock",
    "lp"."stock_added",
    "lp"."is_group_stock",
    "lp"."created_at",
    ( SELECT "count"(*) AS "count"
           FROM "public"."local_purchase_items"
          WHERE ("local_purchase_items"."local_purchase_id" = "lp"."id")) AS "item_count"
   FROM (((("public"."local_purchases" "lp"
     JOIN "public"."sites" "s" ON (("s"."id" = "lp"."site_id")))
     LEFT JOIN "public"."site_groups" "sg" ON (("sg"."id" = "lp"."site_group_id")))
     JOIN "public"."users" "u" ON (("u"."id" = "lp"."engineer_id")))
     LEFT JOIN "public"."vendors" "v" ON (("v"."id" = "lp"."vendor_id")))
  ORDER BY "lp"."purchase_date" DESC, "lp"."created_at" DESC;


ALTER VIEW "public"."v_local_purchases_details" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_low_stock_alerts" AS
 SELECT "si"."id",
    "si"."site_id",
    "s"."name" AS "site_name",
    "m"."id" AS "material_id",
    "m"."name" AS "material_name",
    "m"."code" AS "material_code",
    "m"."unit",
    "si"."current_qty",
    COALESCE("si"."reorder_level", "m"."reorder_level", (0)::numeric) AS "reorder_level",
    (COALESCE("si"."reorder_level", "m"."reorder_level", (0)::numeric) - "si"."current_qty") AS "shortage_qty",
    "si"."avg_unit_cost"
   FROM (("public"."stock_inventory" "si"
     JOIN "public"."sites" "s" ON (("s"."id" = "si"."site_id")))
     JOIN "public"."materials" "m" ON (("m"."id" = "si"."material_id")))
  WHERE (("si"."current_qty" <= COALESCE("si"."reorder_level", "m"."reorder_level", (0)::numeric)) AND (COALESCE("si"."reorder_level", "m"."reorder_level", (0)::numeric) > (0)::numeric));


ALTER VIEW "public"."v_low_stock_alerts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_material_usage_by_section" AS
 SELECT "dmu"."site_id",
    "dmu"."section_id",
    "bs"."name" AS "section_name",
    "dmu"."material_id",
    "m"."name" AS "material_name",
    "m"."unit",
    COALESCE("sum"("dmu"."quantity"), (0)::numeric) AS "total_quantity",
    COALESCE("sum"("dmu"."total_cost"), (0)::numeric) AS "total_cost",
    "min"("dmu"."usage_date") AS "first_usage",
    "max"("dmu"."usage_date") AS "last_usage",
    "count"(*) AS "usage_count"
   FROM (("public"."daily_material_usage" "dmu"
     JOIN "public"."materials" "m" ON (("m"."id" = "dmu"."material_id")))
     LEFT JOIN "public"."building_sections" "bs" ON (("bs"."id" = "dmu"."section_id")))
  GROUP BY "dmu"."site_id", "dmu"."section_id", "bs"."name", "dmu"."material_id", "m"."name", "m"."unit";


ALTER VIEW "public"."v_material_usage_by_section" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendor_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "material_id" "uuid",
    "custom_material_name" "text",
    "brand_id" "uuid",
    "current_price" numeric(12,2),
    "price_includes_gst" boolean DEFAULT false,
    "gst_rate" numeric(5,2),
    "price_includes_transport" boolean DEFAULT false,
    "transport_cost" numeric(10,2),
    "loading_cost" numeric(10,2),
    "unloading_cost" numeric(10,2),
    "is_available" boolean DEFAULT true,
    "min_order_qty" numeric(12,3),
    "unit" "text",
    "lead_time_days" integer,
    "last_price_update" timestamp with time zone,
    "price_source" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vendor_inventory_material_check" CHECK ((("material_id" IS NOT NULL) OR ("custom_material_name" IS NOT NULL))),
    CONSTRAINT "vendor_inventory_price_source_check" CHECK (("price_source" = ANY (ARRAY['purchase'::"text", 'enquiry'::"text", 'quotation'::"text", 'manual'::"text", 'bill'::"text"])))
);


ALTER TABLE "public"."vendor_inventory" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_material_vendor_prices" AS
 SELECT "vi"."material_id",
    "m"."name" AS "material_name",
    "m"."code" AS "material_code",
    "mc"."name" AS "category_name",
    "m"."unit",
    "vi"."brand_id",
    "mb"."brand_name",
    "vi"."vendor_id",
    "v"."name" AS "vendor_name",
    "v"."vendor_type",
    "v"."shop_name",
    "v"."store_city",
    "v"."provides_transport",
    "v"."provides_loading",
    "v"."min_order_amount",
    "vi"."current_price",
    "vi"."price_includes_gst",
    "vi"."transport_cost",
    "vi"."loading_cost",
    "vi"."unloading_cost",
    (((COALESCE("vi"."current_price", (0)::numeric) +
        CASE
            WHEN (NOT "vi"."price_includes_transport") THEN COALESCE("vi"."transport_cost", (0)::numeric)
            ELSE (0)::numeric
        END) + COALESCE("vi"."loading_cost", (0)::numeric)) + COALESCE("vi"."unloading_cost", (0)::numeric)) AS "total_landed_cost",
    "vi"."min_order_qty",
    "vi"."lead_time_days",
    "vi"."last_price_update",
    "vi"."is_available",
    ( SELECT "ph"."price"
           FROM "public"."price_history" "ph"
          WHERE (("ph"."vendor_id" = "vi"."vendor_id") AND ("ph"."material_id" = "vi"."material_id") AND (("ph"."brand_id" = "vi"."brand_id") OR (("ph"."brand_id" IS NULL) AND ("vi"."brand_id" IS NULL))))
          ORDER BY "ph"."recorded_date" DESC
         OFFSET 1
         LIMIT 1) AS "previous_price"
   FROM (((("public"."vendor_inventory" "vi"
     JOIN "public"."vendors" "v" ON ((("v"."id" = "vi"."vendor_id") AND ("v"."is_active" = true))))
     JOIN "public"."materials" "m" ON (("m"."id" = "vi"."material_id")))
     LEFT JOIN "public"."material_categories" "mc" ON (("mc"."id" = "m"."category_id")))
     LEFT JOIN "public"."material_brands" "mb" ON (("mb"."id" = "vi"."brand_id")))
  WHERE ("vi"."is_available" = true)
  ORDER BY (((COALESCE("vi"."current_price", (0)::numeric) +
        CASE
            WHEN (NOT "vi"."price_includes_transport") THEN COALESCE("vi"."transport_cost", (0)::numeric)
            ELSE (0)::numeric
        END) + COALESCE("vi"."loading_cost", (0)::numeric)) + COALESCE("vi"."unloading_cost", (0)::numeric));


ALTER VIEW "public"."v_material_vendor_prices" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_materials_with_variants" AS
 SELECT "m"."id",
    "m"."name",
    "m"."code",
    "m"."local_name",
    "m"."category_id",
    "m"."description",
    "m"."unit",
    "m"."secondary_unit",
    "m"."conversion_factor",
    "m"."hsn_code",
    "m"."gst_rate",
    "m"."specifications",
    "m"."min_order_qty",
    "m"."reorder_level",
    "m"."image_url",
    "m"."is_active",
    "m"."created_at",
    "m"."updated_at",
    "m"."created_by",
    "m"."parent_id",
    "mc"."name" AS "category_name",
    "mc"."code" AS "category_code",
    "parent"."name" AS "parent_name",
    "parent"."code" AS "parent_code",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."materials" "v"
          WHERE (("v"."parent_id" = "m"."id") AND ("v"."is_active" = true))), (0)::bigint) AS "variant_count",
        CASE
            WHEN ("m"."parent_id" IS NOT NULL) THEN true
            ELSE false
        END AS "is_variant"
   FROM (("public"."materials" "m"
     LEFT JOIN "public"."material_categories" "mc" ON (("mc"."id" = "m"."category_id")))
     LEFT JOIN "public"."materials" "parent" ON (("parent"."id" = "m"."parent_id")));


ALTER VIEW "public"."v_materials_with_variants" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pending_advances" AS
 SELECT "laborer_id",
    "sum"(("amount" - "deducted_amount")) AS "pending_amount",
    "count"(*) AS "pending_count"
   FROM "public"."advances"
  WHERE (("transaction_type" = 'advance'::"public"."transaction_type") AND ("deduction_status" = ANY (ARRAY['pending'::"public"."deduction_status", 'partial'::"public"."deduction_status"])) AND ("is_deleted" = false))
  GROUP BY "laborer_id";


ALTER VIEW "public"."v_pending_advances" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_pending_advances" IS 'Quick lookup of pending advance amounts per laborer';



CREATE OR REPLACE VIEW "public"."v_pending_deletions" AS
 SELECT "dr"."id",
    "dr"."table_name",
    "dr"."record_id",
    "dr"."record_summary",
    "dr"."requested_by",
    "dr"."requested_at",
    "dr"."reason",
    "dr"."reviewed_by",
    "dr"."reviewed_at",
    "dr"."review_notes",
    "dr"."status",
    "dr"."executed_at",
    "dr"."created_at",
    "u"."name" AS "requested_by_name",
    "u"."role" AS "requested_by_role"
   FROM ("public"."deletion_requests" "dr"
     JOIN "public"."users" "u" ON (("dr"."requested_by" = "u"."id")))
  WHERE ("dr"."status" = 'pending'::"public"."deletion_request_status")
  ORDER BY "dr"."requested_at" DESC;


ALTER VIEW "public"."v_pending_deletions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pending_delivery_verifications" AS
 SELECT "d"."id",
    "d"."grn_number",
    "d"."site_id",
    "s"."name" AS "site_name",
    "d"."vendor_id",
    "v"."name" AS "vendor_name",
    "d"."po_id",
    "po"."po_number",
    "d"."delivery_date",
    "d"."challan_number",
    "d"."vehicle_number",
    "d"."driver_name",
    "d"."driver_phone",
    "d"."delivery_status",
    "d"."verification_status",
    "d"."created_at",
    ( SELECT "count"(*) AS "count"
           FROM "public"."delivery_items"
          WHERE ("delivery_items"."delivery_id" = "d"."id")) AS "item_count",
    ( SELECT "sum"(("delivery_items"."received_qty" * COALESCE("delivery_items"."unit_price", (0)::numeric))) AS "sum"
           FROM "public"."delivery_items"
          WHERE ("delivery_items"."delivery_id" = "d"."id")) AS "total_value"
   FROM ((("public"."deliveries" "d"
     JOIN "public"."sites" "s" ON (("s"."id" = "d"."site_id")))
     JOIN "public"."vendors" "v" ON (("v"."id" = "d"."vendor_id")))
     LEFT JOIN "public"."purchase_orders" "po" ON (("po"."id" = "d"."po_id")))
  WHERE (("d"."verification_status" = 'pending'::"text") AND ("d"."requires_verification" = true))
  ORDER BY "d"."delivery_date" DESC, "d"."created_at" DESC;


ALTER VIEW "public"."v_pending_delivery_verifications" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pending_inter_site_settlements" AS
 SELECT "vb"."site_group_id",
    "vb"."group_name",
    "vb"."creditor_site_id",
    "vb"."creditor_site_name",
    "vb"."debtor_site_id",
    "vb"."debtor_site_name",
    "vb"."year",
    "vb"."week_number",
    "vb"."week_start",
    "vb"."week_end",
    "vb"."transaction_count",
    "vb"."material_count",
    "vb"."total_quantity",
    "vb"."total_amount_owed",
    "isms"."id" AS "settlement_id",
    "isms"."status" AS "settlement_status",
    "isms"."total_amount" AS "settled_amount",
        CASE
            WHEN ("isms"."id" IS NULL) THEN 'not_created'::"text"
            WHEN ("isms"."status" = 'draft'::"public"."inter_site_settlement_status") THEN 'draft'::"text"
            WHEN ("isms"."status" = 'pending'::"public"."inter_site_settlement_status") THEN 'pending_approval'::"text"
            WHEN ("isms"."status" = 'approved'::"public"."inter_site_settlement_status") THEN 'pending_payment'::"text"
            WHEN ("isms"."status" = 'settled'::"public"."inter_site_settlement_status") THEN 'settled'::"text"
            ELSE 'unknown'::"text"
        END AS "settlement_state"
   FROM ("public"."v_inter_site_balance" "vb"
     LEFT JOIN "public"."inter_site_material_settlements" "isms" ON ((("isms"."site_group_id" = "vb"."site_group_id") AND ("isms"."from_site_id" = "vb"."creditor_site_id") AND ("isms"."to_site_id" = "vb"."debtor_site_id") AND ("isms"."year" = "vb"."year") AND ("isms"."week_number" = "vb"."week_number"))));


ALTER VIEW "public"."v_pending_inter_site_settlements" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pending_purchase_orders" AS
 SELECT "po"."id",
    "po"."po_number",
    "po"."site_id",
    "s"."name" AS "site_name",
    "po"."vendor_id",
    "v"."name" AS "vendor_name",
    "po"."status",
    "po"."order_date",
    "po"."expected_delivery_date",
    "po"."total_amount",
    "po"."created_by",
    "u"."name" AS "created_by_name"
   FROM ((("public"."purchase_orders" "po"
     JOIN "public"."sites" "s" ON (("s"."id" = "po"."site_id")))
     JOIN "public"."vendors" "v" ON (("v"."id" = "po"."vendor_id")))
     LEFT JOIN "public"."users" "u" ON (("u"."id" = "po"."created_by")))
  WHERE ("po"."status" = ANY (ARRAY['pending_approval'::"public"."po_status", 'approved'::"public"."po_status", 'ordered'::"public"."po_status", 'partial_delivered'::"public"."po_status"]));


ALTER VIEW "public"."v_pending_purchase_orders" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pending_reimbursements" AS
 SELECT "lp"."id",
    "lp"."purchase_number",
    "lp"."site_id",
    "s"."name" AS "site_name",
    "lp"."engineer_id",
    "u"."name" AS "engineer_name",
    "lp"."vendor_name",
    "lp"."purchase_date",
    "lp"."total_amount" AS "reimbursement_amount",
    "lp"."receipt_url",
    "lp"."reimbursement_status",
    "lp"."created_at"
   FROM (("public"."local_purchases" "lp"
     JOIN "public"."sites" "s" ON (("s"."id" = "lp"."site_id")))
     JOIN "public"."users" "u" ON (("u"."id" = "lp"."engineer_id")))
  WHERE (("lp"."needs_reimbursement" = true) AND ("lp"."reimbursement_status" = ANY (ARRAY['pending'::"text", 'processed'::"text"])))
  ORDER BY "lp"."purchase_date";


ALTER VIEW "public"."v_pending_reimbursements" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_price_history_details" AS
 SELECT "ph"."id",
    "ph"."material_id",
    "m"."name" AS "material_name",
    "m"."code" AS "material_code",
    "m"."unit" AS "material_unit",
    "ph"."vendor_id",
    "v"."name" AS "vendor_name",
    "v"."shop_name" AS "vendor_shop_name",
    "ph"."brand_id",
    "mb"."brand_name",
    "ph"."price",
    "ph"."recorded_date",
    "ph"."change_reason_id",
    "pcr"."reason" AS "change_reason",
    "pcr"."is_increase" AS "reason_is_increase",
    "ph"."change_reason_text",
    "ph"."change_percentage",
    "ph"."bill_url",
    "ph"."bill_number",
    "ph"."bill_date",
    "ph"."notes",
    "ph"."created_at",
    "lag"("ph"."price") OVER (PARTITION BY "ph"."material_id", "ph"."vendor_id" ORDER BY "ph"."recorded_date") AS "previous_price",
    ("ph"."price" - "lag"("ph"."price") OVER (PARTITION BY "ph"."material_id", "ph"."vendor_id" ORDER BY "ph"."recorded_date")) AS "price_change"
   FROM (((("public"."price_history" "ph"
     JOIN "public"."materials" "m" ON (("m"."id" = "ph"."material_id")))
     LEFT JOIN "public"."vendors" "v" ON (("v"."id" = "ph"."vendor_id")))
     LEFT JOIN "public"."material_brands" "mb" ON (("mb"."id" = "ph"."brand_id")))
     LEFT JOIN "public"."price_change_reasons" "pcr" ON (("pcr"."id" = "ph"."change_reason_id")))
  ORDER BY "ph"."recorded_date" DESC;


ALTER VIEW "public"."v_price_history_details" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_price_trends" AS
 SELECT "ph"."material_id",
    "m"."name" AS "material_name",
    "ph"."vendor_id",
    "v"."name" AS "vendor_name",
    "ph"."brand_id",
    "mb"."brand_name",
    "ph"."recorded_date",
    "ph"."price",
    "ph"."change_percentage",
    "avg"("ph"."price") OVER (PARTITION BY "ph"."material_id", "ph"."vendor_id" ORDER BY "ph"."recorded_date" ROWS BETWEEN 30 PRECEDING AND CURRENT ROW) AS "moving_avg_30d",
    "min"("ph"."price") OVER (PARTITION BY "ph"."material_id", "ph"."vendor_id" ORDER BY "ph"."recorded_date" ROWS BETWEEN 90 PRECEDING AND CURRENT ROW) AS "min_price_90d",
    "max"("ph"."price") OVER (PARTITION BY "ph"."material_id", "ph"."vendor_id" ORDER BY "ph"."recorded_date" ROWS BETWEEN 90 PRECEDING AND CURRENT ROW) AS "max_price_90d"
   FROM ((("public"."price_history" "ph"
     JOIN "public"."materials" "m" ON (("m"."id" = "ph"."material_id")))
     LEFT JOIN "public"."vendors" "v" ON (("v"."id" = "ph"."vendor_id")))
     LEFT JOIN "public"."material_brands" "mb" ON (("mb"."id" = "ph"."brand_id")))
  ORDER BY "ph"."material_id", "ph"."vendor_id", "ph"."recorded_date";


ALTER VIEW "public"."v_price_trends" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_salary_periods_detailed" AS
 SELECT "sp"."id",
    "sp"."laborer_id",
    "sp"."week_ending",
    "sp"."week_start",
    "sp"."total_days_worked",
    "sp"."total_hours_worked",
    "sp"."gross_earnings",
    "sp"."advance_deductions",
    "sp"."other_deductions",
    "sp"."total_deductions",
    "sp"."extras",
    "sp"."other_additions",
    "sp"."total_additions",
    "sp"."net_payable",
    "sp"."amount_paid",
    "sp"."balance_due",
    "sp"."status",
    "sp"."site_breakdown",
    "sp"."calculated_at",
    "sp"."calculated_by",
    "sp"."notes",
    "sp"."created_at",
    "sp"."updated_at",
    "l"."name" AS "laborer_name",
    "l"."phone" AS "laborer_phone",
    "lr"."name" AS "role_name",
    "lc"."name" AS "category_name",
    "t"."name" AS "team_name",
    "t"."leader_name" AS "team_leader"
   FROM (((("public"."salary_periods" "sp"
     JOIN "public"."laborers" "l" ON (("sp"."laborer_id" = "l"."id")))
     JOIN "public"."labor_roles" "lr" ON (("l"."role_id" = "lr"."id")))
     JOIN "public"."labor_categories" "lc" ON (("l"."category_id" = "lc"."id")))
     LEFT JOIN "public"."teams" "t" ON (("l"."team_id" = "t"."id")));


ALTER VIEW "public"."v_salary_periods_detailed" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_salary_periods_detailed" IS 'Salary periods with laborer and team details';



CREATE OR REPLACE VIEW "public"."v_section_cost_by_role" AS
 SELECT "da"."section_id",
    "bs"."name" AS "section_name",
    "bs"."site_id",
    "lr"."id" AS "role_id",
    "lr"."name" AS "role_name",
    "lc"."name" AS "category_name",
    "sum"("da"."work_days") AS "total_days",
    "sum"("da"."daily_earnings") AS "total_amount",
    "count"(DISTINCT "da"."laborer_id") AS "laborer_count"
   FROM (((("public"."daily_attendance" "da"
     JOIN "public"."building_sections" "bs" ON (("da"."section_id" = "bs"."id")))
     JOIN "public"."laborers" "l" ON (("da"."laborer_id" = "l"."id")))
     JOIN "public"."labor_roles" "lr" ON (("l"."role_id" = "lr"."id")))
     JOIN "public"."labor_categories" "lc" ON (("l"."category_id" = "lc"."id")))
  WHERE (("da"."is_deleted" = false) AND ("da"."section_id" IS NOT NULL))
  GROUP BY "da"."section_id", "bs"."name", "bs"."site_id", "lr"."id", "lr"."name", "lc"."name";


ALTER VIEW "public"."v_section_cost_by_role" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_section_cost_by_role" IS 'Section costs broken down by role';



CREATE OR REPLACE VIEW "public"."v_section_cost_summary" AS
 SELECT "bs"."id" AS "section_id",
    "bs"."site_id",
    "s"."name" AS "site_name",
    "bs"."name" AS "section_name",
    "bs"."status",
    "bs"."sequence_order",
    COALESCE("labor_data"."labor_cost", (0)::numeric) AS "labor_cost",
    COALESCE("labor_data"."total_work_days", (0)::numeric) AS "total_work_days",
    COALESCE("labor_data"."unique_laborers", (0)::bigint) AS "unique_laborers",
    COALESCE("expense_data"."expense_cost", (0)::numeric) AS "expense_cost",
    (COALESCE("labor_data"."labor_cost", (0)::numeric) + COALESCE("expense_data"."expense_cost", (0)::numeric)) AS "total_cost"
   FROM ((("public"."building_sections" "bs"
     JOIN "public"."sites" "s" ON (("bs"."site_id" = "s"."id")))
     LEFT JOIN ( SELECT "daily_attendance"."section_id",
            "sum"("daily_attendance"."daily_earnings") AS "labor_cost",
            "sum"("daily_attendance"."work_days") AS "total_work_days",
            "count"(DISTINCT "daily_attendance"."laborer_id") AS "unique_laborers"
           FROM "public"."daily_attendance"
          WHERE (("daily_attendance"."is_deleted" = false) AND ("daily_attendance"."section_id" IS NOT NULL))
          GROUP BY "daily_attendance"."section_id") "labor_data" ON (("bs"."id" = "labor_data"."section_id")))
     LEFT JOIN ( SELECT "expenses"."section_id",
            "sum"("expenses"."amount") AS "expense_cost"
           FROM "public"."expenses"
          WHERE (("expenses"."is_deleted" = false) AND ("expenses"."section_id" IS NOT NULL))
          GROUP BY "expenses"."section_id") "expense_data" ON (("bs"."id" = "expense_data"."section_id")))
  ORDER BY "bs"."site_id", "bs"."sequence_order";


ALTER VIEW "public"."v_section_cost_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_section_cost_summary" IS 'Cost breakdown by building section';



CREATE OR REPLACE VIEW "public"."v_settlement_details" AS
 SELECT "isms"."id",
    "isms"."settlement_code",
    "isms"."site_group_id",
    "sg"."name" AS "group_name",
    "isms"."from_site_id",
    "fs"."name" AS "from_site_name",
    "isms"."to_site_id",
    "ts"."name" AS "to_site_name",
    "isms"."year",
    "isms"."week_number",
    "isms"."period_start",
    "isms"."period_end",
    "isms"."total_amount",
    "isms"."paid_amount",
    "isms"."pending_amount",
    "isms"."status",
    "isms"."notes",
    "isms"."created_at",
    "isms"."approved_at",
    "isms"."settled_at",
    ( SELECT "count"(*) AS "count"
           FROM "public"."inter_site_settlement_items"
          WHERE ("inter_site_settlement_items"."settlement_id" = "isms"."id")) AS "item_count",
    ( SELECT "string_agg"(DISTINCT "m"."name", ', '::"text" ORDER BY "m"."name") AS "string_agg"
           FROM ("public"."inter_site_settlement_items" "isi"
             JOIN "public"."materials" "m" ON (("m"."id" = "isi"."material_id")))
          WHERE ("isi"."settlement_id" = "isms"."id")) AS "materials_summary"
   FROM ((("public"."inter_site_material_settlements" "isms"
     JOIN "public"."site_groups" "sg" ON (("sg"."id" = "isms"."site_group_id")))
     JOIN "public"."sites" "fs" ON (("fs"."id" = "isms"."from_site_id")))
     JOIN "public"."sites" "ts" ON (("ts"."id" = "isms"."to_site_id")));


ALTER VIEW "public"."v_settlement_details" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_site_daily_by_category" AS
 SELECT "da"."site_id",
    "da"."date",
    "lc"."id" AS "category_id",
    "lc"."name" AS "category_name",
    "count"(DISTINCT "da"."laborer_id") AS "laborer_count",
    "sum"("da"."work_days") AS "total_days",
    "sum"("da"."daily_earnings") AS "total_amount"
   FROM (("public"."daily_attendance" "da"
     JOIN "public"."laborers" "l" ON (("da"."laborer_id" = "l"."id")))
     JOIN "public"."labor_categories" "lc" ON (("l"."category_id" = "lc"."id")))
  WHERE ("da"."is_deleted" = false)
  GROUP BY "da"."site_id", "da"."date", "lc"."id", "lc"."name";


ALTER VIEW "public"."v_site_daily_by_category" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_site_daily_by_category" IS 'Daily summary by labor category';



CREATE OR REPLACE VIEW "public"."v_site_daily_summary" AS
 SELECT "da"."site_id",
    "s"."name" AS "site_name",
    "da"."date",
    "count"(DISTINCT "da"."laborer_id") AS "total_laborers",
    "sum"("da"."work_days") AS "total_work_days",
    "sum"("da"."daily_earnings") AS "total_earnings"
   FROM ("public"."daily_attendance" "da"
     JOIN "public"."sites" "s" ON (("da"."site_id" = "s"."id")))
  WHERE ("da"."is_deleted" = false)
  GROUP BY "da"."site_id", "s"."name", "da"."date";


ALTER VIEW "public"."v_site_daily_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_site_daily_summary" IS 'Daily summary of labor activity per site';



CREATE OR REPLACE VIEW "public"."v_site_eligible_batches" AS
 SELECT "gsi"."id" AS "inventory_id",
    "gsi"."site_group_id",
    "sg"."name" AS "group_name",
    "s"."id" AS "site_id",
    "s"."name" AS "site_name",
    "gsi"."batch_code",
    "gsi"."material_id",
    "m"."name" AS "material_name",
    "m"."code" AS "material_code",
    "m"."unit",
    "gsi"."brand_id",
    "mb"."brand_name",
    "gsi"."current_qty" AS "available_qty",
    "gsi"."avg_unit_cost",
    "gsi"."is_dedicated",
    "gsi"."dedicated_site_id",
        CASE
            WHEN ("gsi"."is_dedicated" AND ("gsi"."dedicated_site_id" = "s"."id")) THEN 'dedicated_own'::"text"
            WHEN ("gsi"."is_dedicated" AND ("gsi"."dedicated_site_id" <> "s"."id")) THEN 'dedicated_other'::"text"
            WHEN (NOT "gsi"."is_dedicated") THEN 'shared'::"text"
            ELSE NULL::"text"
        END AS "allocation_type",
        CASE
            WHEN ("gsi"."is_dedicated" AND ("gsi"."dedicated_site_id" <> "s"."id")) THEN false
            ELSE true
        END AS "can_use"
   FROM (((("public"."group_stock_inventory" "gsi"
     JOIN "public"."site_groups" "sg" ON (("sg"."id" = "gsi"."site_group_id")))
     JOIN "public"."sites" "s" ON (("s"."site_group_id" = "sg"."id")))
     JOIN "public"."materials" "m" ON (("m"."id" = "gsi"."material_id")))
     LEFT JOIN "public"."material_brands" "mb" ON (("mb"."id" = "gsi"."brand_id")))
  WHERE (("gsi"."current_qty" > (0)::numeric) AND ("sg"."is_active" = true) AND ("s"."status" = 'active'::"public"."site_status"))
  ORDER BY "gsi"."material_id", "gsi"."batch_code";


ALTER VIEW "public"."v_site_eligible_batches" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_site_stock_summary" AS
 SELECT "si"."site_id",
    "s"."name" AS "site_name",
    "m"."id" AS "material_id",
    "m"."name" AS "material_name",
    "m"."code" AS "material_code",
    "mc"."name" AS "category_name",
    "m"."unit",
    COALESCE("sum"("si"."current_qty"), (0)::numeric) AS "total_qty",
    COALESCE("sum"("si"."reserved_qty"), (0)::numeric) AS "total_reserved",
    COALESCE("sum"("si"."available_qty"), (0)::numeric) AS "total_available",
    COALESCE("avg"("si"."avg_unit_cost"), (0)::numeric) AS "avg_cost",
    COALESCE("sum"(("si"."current_qty" * "si"."avg_unit_cost")), (0)::numeric) AS "total_value"
   FROM ((("public"."stock_inventory" "si"
     JOIN "public"."sites" "s" ON (("s"."id" = "si"."site_id")))
     JOIN "public"."materials" "m" ON (("m"."id" = "si"."material_id")))
     LEFT JOIN "public"."material_categories" "mc" ON (("mc"."id" = "m"."category_id")))
  GROUP BY "si"."site_id", "s"."name", "m"."id", "m"."name", "m"."code", "mc"."name", "m"."unit";


ALTER VIEW "public"."v_site_stock_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_stock_by_batch" AS
 SELECT "gsi"."id",
    "gsi"."site_group_id",
    "sg"."name" AS "group_name",
    "gsi"."batch_code",
    "gsi"."material_id",
    "m"."name" AS "material_name",
    "m"."code" AS "material_code",
    "m"."unit",
    "mc"."name" AS "category_name",
    "gsi"."brand_id",
    "mb"."brand_name",
    "gsi"."is_dedicated",
    "gsi"."dedicated_site_id",
    "ds"."name" AS "dedicated_site_name",
    "gsi"."can_be_shared",
    "gsi"."current_qty",
    "gsi"."reserved_qty",
    "gsi"."available_qty",
    "gsi"."avg_unit_cost",
    "gsi"."total_value",
    "gsi"."last_received_date",
    "gsi"."last_used_date",
    ( SELECT "gst"."payment_source_site_id"
           FROM "public"."group_stock_transactions" "gst"
          WHERE (("gst"."inventory_id" = "gsi"."id") AND ("gst"."transaction_type" = 'purchase'::"public"."stock_transaction_type"))
          ORDER BY "gst"."created_at"
         LIMIT 1) AS "paid_by_site_id",
    ( SELECT "s"."name"
           FROM ("public"."group_stock_transactions" "gst"
             JOIN "public"."sites" "s" ON (("s"."id" = "gst"."payment_source_site_id")))
          WHERE (("gst"."inventory_id" = "gsi"."id") AND ("gst"."transaction_type" = 'purchase'::"public"."stock_transaction_type"))
          ORDER BY "gst"."created_at"
         LIMIT 1) AS "paid_by_site_name"
   FROM ((((("public"."group_stock_inventory" "gsi"
     JOIN "public"."site_groups" "sg" ON (("sg"."id" = "gsi"."site_group_id")))
     JOIN "public"."materials" "m" ON (("m"."id" = "gsi"."material_id")))
     LEFT JOIN "public"."material_categories" "mc" ON (("mc"."id" = "m"."category_id")))
     LEFT JOIN "public"."material_brands" "mb" ON (("mb"."id" = "gsi"."brand_id")))
     LEFT JOIN "public"."sites" "ds" ON (("ds"."id" = "gsi"."dedicated_site_id")))
  WHERE (("gsi"."current_qty" > (0)::numeric) AND ("sg"."is_active" = true));


ALTER VIEW "public"."v_stock_by_batch" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_tea_shop_weekly" AS
 SELECT "ts"."id" AS "tea_shop_id",
    "ts"."shop_name",
    "ts"."site_id",
    ("date_trunc"('week'::"text", ("tse"."date")::timestamp with time zone))::"date" AS "week_start",
    (("date_trunc"('week'::"text", ("tse"."date")::timestamp with time zone) + '6 days'::interval))::"date" AS "week_end",
    "sum"("tse"."amount") AS "total_amount",
    "sum"("tse"."num_people") AS "total_people",
    "count"(*) AS "num_days"
   FROM ("public"."tea_shop_accounts" "ts"
     JOIN "public"."tea_shop_entries" "tse" ON (("ts"."id" = "tse"."tea_shop_id")))
  GROUP BY "ts"."id", "ts"."shop_name", "ts"."site_id", ("date_trunc"('week'::"text", ("tse"."date")::timestamp with time zone));


ALTER VIEW "public"."v_tea_shop_weekly" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_tea_shop_weekly" IS 'Weekly summary of tea shop consumption';



CREATE OR REPLACE VIEW "public"."v_team_weekly_by_role" AS
 SELECT "l"."team_id",
    "t"."name" AS "team_name",
    (("date_trunc"('week'::"text", ("da"."date")::timestamp with time zone))::"date" + 5) AS "week_ending",
    "lr"."id" AS "role_id",
    "lr"."name" AS "role_name",
    "count"(DISTINCT "da"."laborer_id") AS "laborer_count",
    "sum"("da"."work_days") AS "total_days",
    "sum"("da"."daily_earnings") AS "total_amount"
   FROM ((("public"."daily_attendance" "da"
     JOIN "public"."laborers" "l" ON (("da"."laborer_id" = "l"."id")))
     JOIN "public"."teams" "t" ON (("l"."team_id" = "t"."id")))
     JOIN "public"."labor_roles" "lr" ON (("l"."role_id" = "lr"."id")))
  WHERE (("da"."is_deleted" = false) AND ("l"."team_id" IS NOT NULL))
  GROUP BY "l"."team_id", "t"."name", ("date_trunc"('week'::"text", ("da"."date")::timestamp with time zone)), "lr"."id", "lr"."name";


ALTER VIEW "public"."v_team_weekly_by_role" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_team_weekly_by_role" IS 'Team weekly breakdown by role';



CREATE OR REPLACE VIEW "public"."v_team_weekly_summary" AS
 WITH "team_weeks" AS (
         SELECT "t"."id" AS "team_id",
            "t"."name" AS "team_name",
            "t"."leader_name",
            ("date_trunc"('week'::"text", ("da"."date")::timestamp with time zone))::"date" AS "week_start",
            (("date_trunc"('week'::"text", ("da"."date")::timestamp with time zone))::"date" + 5) AS "week_ending",
            "count"(DISTINCT "da"."laborer_id") AS "active_members",
            "sum"("da"."work_days") AS "total_work_days",
            "sum"("da"."daily_earnings") AS "total_earnings"
           FROM (("public"."teams" "t"
             JOIN "public"."laborers" "l" ON (("l"."team_id" = "t"."id")))
             JOIN "public"."daily_attendance" "da" ON ((("da"."laborer_id" = "l"."id") AND ("da"."is_deleted" = false))))
          WHERE ("t"."status" = 'active'::"public"."team_status")
          GROUP BY "t"."id", "t"."name", "t"."leader_name", ("date_trunc"('week'::"text", ("da"."date")::timestamp with time zone))
        ), "team_expenses" AS (
         SELECT "e"."team_id",
            ("date_trunc"('week'::"text", ("e"."date")::timestamp with time zone))::"date" AS "week_start",
            "sum"("e"."amount") AS "total_expenses"
           FROM "public"."expenses" "e"
          WHERE (("e"."is_deleted" = false) AND ("e"."team_id" IS NOT NULL))
          GROUP BY "e"."team_id", ("date_trunc"('week'::"text", ("e"."date")::timestamp with time zone))
        ), "team_advances" AS (
         SELECT "l"."team_id",
            ("date_trunc"('week'::"text", ("a"."date")::timestamp with time zone))::"date" AS "week_start",
            "sum"("a"."amount") AS "total_advances"
           FROM ("public"."advances" "a"
             JOIN "public"."laborers" "l" ON (("a"."laborer_id" = "l"."id")))
          WHERE (("a"."is_deleted" = false) AND ("a"."transaction_type" = 'advance'::"public"."transaction_type") AND ("l"."team_id" IS NOT NULL))
          GROUP BY "l"."team_id", ("date_trunc"('week'::"text", ("a"."date")::timestamp with time zone))
        )
 SELECT "tw"."team_id",
    "tw"."team_name",
    "tw"."leader_name",
    "tw"."week_ending",
    "tw"."active_members",
    "tw"."total_work_days",
    "tw"."total_earnings",
    COALESCE("te"."total_expenses", (0)::numeric) AS "total_expenses",
    COALESCE("ta"."total_advances", (0)::numeric) AS "total_advances"
   FROM (("team_weeks" "tw"
     LEFT JOIN "team_expenses" "te" ON ((("tw"."team_id" = "te"."team_id") AND ("tw"."week_start" = "te"."week_start"))))
     LEFT JOIN "team_advances" "ta" ON ((("tw"."team_id" = "ta"."team_id") AND ("tw"."week_start" = "ta"."week_start"))));


ALTER VIEW "public"."v_team_weekly_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_team_weekly_summary" IS 'Weekly summary for teams';



CREATE OR REPLACE VIEW "public"."v_unread_notifications" AS
 SELECT "user_id",
    "count"(*) AS "unread_count"
   FROM "public"."notifications"
  WHERE (("is_read" = false) AND (("expires_at" IS NULL) OR ("expires_at" > "now"())))
  GROUP BY "user_id";


ALTER VIEW "public"."v_unread_notifications" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_vendor_inventory_details" AS
 SELECT "vi"."id",
    "vi"."vendor_id",
    "v"."name" AS "vendor_name",
    "v"."vendor_type",
    "v"."shop_name",
    "v"."store_city",
    "v"."provides_transport",
    "v"."provides_loading",
    "vi"."material_id",
    COALESCE("m"."name", "vi"."custom_material_name") AS "material_name",
    "m"."code" AS "material_code",
    "mc"."name" AS "category_name",
    "vi"."brand_id",
    "mb"."brand_name",
    "vi"."current_price",
    "vi"."price_includes_gst",
    "vi"."gst_rate",
    "vi"."price_includes_transport",
    "vi"."transport_cost",
    "vi"."loading_cost",
    "vi"."unloading_cost",
    (((COALESCE("vi"."current_price", (0)::numeric) +
        CASE
            WHEN (NOT "vi"."price_includes_transport") THEN COALESCE("vi"."transport_cost", (0)::numeric)
            ELSE (0)::numeric
        END) + COALESCE("vi"."loading_cost", (0)::numeric)) + COALESCE("vi"."unloading_cost", (0)::numeric)) AS "total_landed_cost",
    "vi"."is_available",
    "vi"."min_order_qty",
    "vi"."unit",
    "vi"."lead_time_days",
    "vi"."last_price_update",
    "vi"."price_source"
   FROM (((("public"."vendor_inventory" "vi"
     JOIN "public"."vendors" "v" ON (("v"."id" = "vi"."vendor_id")))
     LEFT JOIN "public"."materials" "m" ON (("m"."id" = "vi"."material_id")))
     LEFT JOIN "public"."material_categories" "mc" ON (("mc"."id" = "m"."category_id")))
     LEFT JOIN "public"."material_brands" "mb" ON (("mb"."id" = "vi"."brand_id")))
  WHERE ("v"."is_active" = true);


ALTER VIEW "public"."v_vendor_inventory_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendor_material_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vendor_material_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendor_price_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "material_vendor_id" "uuid" NOT NULL,
    "old_price" numeric(12,2) NOT NULL,
    "new_price" numeric(12,2) NOT NULL,
    "effective_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "reason" "text",
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vendor_price_history" OWNER TO "postgres";


ALTER TABLE ONLY "public"."advances"
    ADD CONSTRAINT "advances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_expense_sync"
    ADD CONSTRAINT "attendance_expense_sync_attendance_date_site_id_key" UNIQUE ("attendance_date", "site_id");



ALTER TABLE ONLY "public"."attendance_expense_sync"
    ADD CONSTRAINT "attendance_expense_sync_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."building_sections"
    ADD CONSTRAINT "building_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."building_sections"
    ADD CONSTRAINT "building_sections_site_id_name_key" UNIQUE ("site_id", "name");



ALTER TABLE ONLY "public"."client_payment_plans"
    ADD CONSTRAINT "client_payment_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_payments"
    ADD CONSTRAINT "client_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."construction_phases"
    ADD CONSTRAINT "construction_phases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."construction_subphases"
    ADD CONSTRAINT "construction_subphases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subcontract_milestones"
    ADD CONSTRAINT "contract_milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subcontract_payments"
    ADD CONSTRAINT "contract_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subcontract_sections"
    ADD CONSTRAINT "contract_sections_contract_id_section_id_key" UNIQUE ("contract_id", "section_id");



ALTER TABLE ONLY "public"."subcontract_sections"
    ADD CONSTRAINT "contract_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subcontracts"
    ADD CONSTRAINT "contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_attendance"
    ADD CONSTRAINT "daily_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "daily_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "daily_logs_site_id_date_key" UNIQUE ("site_id", "date");



ALTER TABLE ONLY "public"."daily_material_usage"
    ADD CONSTRAINT "daily_material_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_work_summary"
    ADD CONSTRAINT "daily_work_summary_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_work_summary"
    ADD CONSTRAINT "daily_work_summary_site_id_date_key" UNIQUE ("site_id", "date");



ALTER TABLE ONLY "public"."default_building_sections"
    ADD CONSTRAINT "default_building_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_grn_number_key" UNIQUE ("grn_number");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_items"
    ADD CONSTRAINT "delivery_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engineer_reimbursements"
    ADD CONSTRAINT "engineer_reimbursements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engineer_wallet_batch_usage"
    ADD CONSTRAINT "engineer_wallet_batch_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engineer_wallet_batch_usage"
    ADD CONSTRAINT "engineer_wallet_batch_usage_transaction_id_batch_transactio_key" UNIQUE ("transaction_id", "batch_transaction_id");



ALTER TABLE ONLY "public"."expense_categories"
    ADD CONSTRAINT "expense_categories_module_name_key" UNIQUE ("module", "name");



ALTER TABLE ONLY "public"."expense_categories"
    ADD CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_stock_inventory"
    ADD CONSTRAINT "group_stock_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_stock_inventory"
    ADD CONSTRAINT "group_stock_inventory_site_group_id_material_id_brand_id_lo_key" UNIQUE ("site_group_id", "material_id", "brand_id", "location_id");



ALTER TABLE ONLY "public"."group_stock_transactions"
    ADD CONSTRAINT "group_stock_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_logs"
    ADD CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inter_site_material_settlements"
    ADD CONSTRAINT "inter_site_material_settlemen_site_group_id_from_site_id_to_key" UNIQUE ("site_group_id", "from_site_id", "to_site_id", "year", "week_number");



ALTER TABLE ONLY "public"."inter_site_material_settlements"
    ADD CONSTRAINT "inter_site_material_settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inter_site_material_settlements"
    ADD CONSTRAINT "inter_site_material_settlements_settlement_code_key" UNIQUE ("settlement_code");



ALTER TABLE ONLY "public"."inter_site_settlement_items"
    ADD CONSTRAINT "inter_site_settlement_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inter_site_settlement_payments"
    ADD CONSTRAINT "inter_site_settlement_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."labor_categories"
    ADD CONSTRAINT "labor_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."labor_categories"
    ADD CONSTRAINT "labor_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."labor_payments"
    ADD CONSTRAINT "labor_payments_payment_reference_key" UNIQUE ("payment_reference");



ALTER TABLE ONLY "public"."labor_payments"
    ADD CONSTRAINT "labor_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."labor_roles"
    ADD CONSTRAINT "labor_roles_category_id_name_key" UNIQUE ("category_id", "name");



ALTER TABLE ONLY "public"."labor_roles"
    ADD CONSTRAINT "labor_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laborer_site_assignments"
    ADD CONSTRAINT "laborer_site_assignments_laborer_id_site_id_assigned_date_key" UNIQUE ("laborer_id", "site_id", "assigned_date");



ALTER TABLE ONLY "public"."laborer_site_assignments"
    ADD CONSTRAINT "laborer_site_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laborers"
    ADD CONSTRAINT "laborers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."local_purchase_items"
    ADD CONSTRAINT "local_purchase_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."local_purchases"
    ADD CONSTRAINT "local_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."local_purchases"
    ADD CONSTRAINT "local_purchases_purchase_number_key" UNIQUE ("purchase_number");



ALTER TABLE ONLY "public"."market_laborer_attendance"
    ADD CONSTRAINT "market_laborer_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."market_laborer_attendance"
    ADD CONSTRAINT "market_laborer_attendance_site_id_date_role_id_key" UNIQUE ("site_id", "date", "role_id");



ALTER TABLE ONLY "public"."material_brands"
    ADD CONSTRAINT "material_brands_material_id_brand_name_key" UNIQUE ("material_id", "brand_name");



ALTER TABLE ONLY "public"."material_brands"
    ADD CONSTRAINT "material_brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_categories"
    ADD CONSTRAINT "material_categories_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."material_categories"
    ADD CONSTRAINT "material_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_request_items"
    ADD CONSTRAINT "material_request_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_requests"
    ADD CONSTRAINT "material_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_requests"
    ADD CONSTRAINT "material_requests_request_number_key" UNIQUE ("request_number");



ALTER TABLE ONLY "public"."material_vendors"
    ADD CONSTRAINT "material_vendors_material_id_vendor_id_brand_id_key" UNIQUE ("material_id", "vendor_id", "brand_id");



ALTER TABLE ONLY "public"."material_vendors"
    ADD CONSTRAINT "material_vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_phases"
    ADD CONSTRAINT "payment_phases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_week_allocations"
    ADD CONSTRAINT "payment_week_allocations_labor_payment_id_week_start_key" UNIQUE ("labor_payment_id", "week_start");



ALTER TABLE ONLY "public"."payment_week_allocations"
    ADD CONSTRAINT "payment_week_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_change_reasons"
    ADD CONSTRAINT "price_change_reasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_po_number_key" UNIQUE ("po_number");



ALTER TABLE ONLY "public"."purchase_payment_allocations"
    ADD CONSTRAINT "purchase_payment_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_payments"
    ADD CONSTRAINT "purchase_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salary_periods"
    ADD CONSTRAINT "salary_periods_laborer_id_week_ending_key" UNIQUE ("laborer_id", "week_ending");



ALTER TABLE ONLY "public"."salary_periods"
    ADD CONSTRAINT "salary_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlement_groups"
    ADD CONSTRAINT "settlement_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlement_groups"
    ADD CONSTRAINT "settlement_groups_settlement_reference_key" UNIQUE ("settlement_reference");



ALTER TABLE ONLY "public"."site_clients"
    ADD CONSTRAINT "site_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_clients"
    ADD CONSTRAINT "site_clients_site_id_client_id_key" UNIQUE ("site_id", "client_id");



ALTER TABLE ONLY "public"."site_engineer_settlements"
    ADD CONSTRAINT "site_engineer_settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_engineer_transactions"
    ADD CONSTRAINT "site_engineer_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_groups"
    ADD CONSTRAINT "site_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_holidays"
    ADD CONSTRAINT "site_holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_holidays"
    ADD CONSTRAINT "site_holidays_site_id_date_key" UNIQUE ("site_id", "date");



ALTER TABLE ONLY "public"."site_material_budgets"
    ADD CONSTRAINT "site_material_budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_payers"
    ADD CONSTRAINT "site_payers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_payment_milestones"
    ADD CONSTRAINT "site_payment_milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_inventory"
    ADD CONSTRAINT "stock_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_inventory"
    ADD CONSTRAINT "stock_inventory_site_id_location_id_material_id_brand_id_key" UNIQUE ("site_id", "location_id", "material_id", "brand_id");



ALTER TABLE ONLY "public"."stock_locations"
    ADD CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_locations"
    ADD CONSTRAINT "stock_locations_site_id_name_key" UNIQUE ("site_id", "name");



ALTER TABLE ONLY "public"."stock_transactions"
    ADD CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_transfer_items"
    ADD CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_transfer_number_key" UNIQUE ("transfer_number");



ALTER TABLE ONLY "public"."tea_shop_accounts"
    ADD CONSTRAINT "tea_shop_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tea_shop_clearances"
    ADD CONSTRAINT "tea_shop_clearances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tea_shop_consumption_details"
    ADD CONSTRAINT "tea_shop_consumption_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tea_shop_entries"
    ADD CONSTRAINT "tea_shop_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tea_shop_entries"
    ADD CONSTRAINT "tea_shop_entries_tea_shop_id_date_key" UNIQUE ("tea_shop_id", "date");



ALTER TABLE ONLY "public"."tea_shop_settlement_allocations"
    ADD CONSTRAINT "tea_shop_settlement_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tea_shop_settlement_allocations"
    ADD CONSTRAINT "tea_shop_settlement_allocations_settlement_id_entry_id_key" UNIQUE ("settlement_id", "entry_id");



ALTER TABLE ONLY "public"."tea_shop_settlements"
    ADD CONSTRAINT "tea_shop_settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_salary_summaries"
    ADD CONSTRAINT "team_salary_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_salary_summaries"
    ADD CONSTRAINT "team_salary_summaries_team_id_week_ending_key" UNIQUE ("team_id", "week_ending");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "unique_push_endpoint" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."site_payers"
    ADD CONSTRAINT "unique_site_payer_name" UNIQUE ("site_id", "name");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_id_key" UNIQUE ("auth_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendor_inventory"
    ADD CONSTRAINT "vendor_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendor_inventory"
    ADD CONSTRAINT "vendor_inventory_vendor_id_material_id_brand_id_key" UNIQUE ("vendor_id", "material_id", "brand_id");



ALTER TABLE ONLY "public"."vendor_material_categories"
    ADD CONSTRAINT "vendor_material_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendor_material_categories"
    ADD CONSTRAINT "vendor_material_categories_vendor_id_category_id_key" UNIQUE ("vendor_id", "category_id");



ALTER TABLE ONLY "public"."vendor_price_history"
    ADD CONSTRAINT "vendor_price_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_advances_date" ON "public"."advances" USING "btree" ("date");



CREATE INDEX "idx_advances_deduction_status" ON "public"."advances" USING "btree" ("deduction_status");



CREATE INDEX "idx_advances_laborer_id" ON "public"."advances" USING "btree" ("laborer_id");



CREATE INDEX "idx_advances_pending" ON "public"."advances" USING "btree" ("laborer_id", "deduction_status") WHERE (("transaction_type" = 'advance'::"public"."transaction_type") AND ("deduction_status" = ANY (ARRAY['pending'::"public"."deduction_status", 'partial'::"public"."deduction_status"])) AND ("is_deleted" = false));



CREATE INDEX "idx_advances_transaction_type" ON "public"."advances" USING "btree" ("transaction_type");



CREATE INDEX "idx_attendance_is_paid" ON "public"."daily_attendance" USING "btree" ("is_paid");



CREATE INDEX "idx_attendance_sync_date" ON "public"."attendance_expense_sync" USING "btree" ("attendance_date");



CREATE INDEX "idx_attendance_sync_site" ON "public"."attendance_expense_sync" USING "btree" ("site_id");



CREATE INDEX "idx_attendance_synced" ON "public"."daily_attendance" USING "btree" ("synced_to_expense");



CREATE INDEX "idx_audit_log_action" ON "public"."audit_log" USING "btree" ("action");



CREATE INDEX "idx_audit_log_changed_at" ON "public"."audit_log" USING "btree" ("changed_at");



CREATE INDEX "idx_audit_log_changed_by" ON "public"."audit_log" USING "btree" ("changed_by");



CREATE INDEX "idx_audit_log_record_id" ON "public"."audit_log" USING "btree" ("record_id");



CREATE INDEX "idx_audit_log_table_name" ON "public"."audit_log" USING "btree" ("table_name");



CREATE INDEX "idx_audit_log_table_record" ON "public"."audit_log" USING "btree" ("table_name", "record_id");



CREATE INDEX "idx_batch_usage_batch" ON "public"."engineer_wallet_batch_usage" USING "btree" ("batch_transaction_id");



CREATE INDEX "idx_batch_usage_transaction" ON "public"."engineer_wallet_batch_usage" USING "btree" ("transaction_id");



CREATE INDEX "idx_building_sections_created_by" ON "public"."building_sections" USING "btree" ("created_by");



CREATE INDEX "idx_building_sections_phase" ON "public"."building_sections" USING "btree" ("construction_phase_id");



CREATE INDEX "idx_building_sections_site_id" ON "public"."building_sections" USING "btree" ("site_id");



CREATE INDEX "idx_building_sections_status" ON "public"."building_sections" USING "btree" ("status");



CREATE INDEX "idx_clients_is_active" ON "public"."clients" USING "btree" ("is_active");



CREATE INDEX "idx_clients_name" ON "public"."clients" USING "btree" ("name");



CREATE INDEX "idx_construction_phases_active" ON "public"."construction_phases" USING "btree" ("is_active");



CREATE INDEX "idx_construction_phases_sequence" ON "public"."construction_phases" USING "btree" ("sequence_order");



CREATE INDEX "idx_construction_subphases_phase" ON "public"."construction_subphases" USING "btree" ("phase_id", "sequence_order");



CREATE INDEX "idx_contract_milestones_contract_id" ON "public"."subcontract_milestones" USING "btree" ("contract_id");



CREATE INDEX "idx_contract_milestones_status" ON "public"."subcontract_milestones" USING "btree" ("status");



CREATE INDEX "idx_contract_payments_contract_id" ON "public"."subcontract_payments" USING "btree" ("contract_id");



CREATE INDEX "idx_contract_payments_milestone_id" ON "public"."subcontract_payments" USING "btree" ("milestone_id");



CREATE INDEX "idx_contract_payments_payment_date" ON "public"."subcontract_payments" USING "btree" ("payment_date");



CREATE INDEX "idx_contract_payments_payment_type" ON "public"."subcontract_payments" USING "btree" ("payment_type");



CREATE INDEX "idx_contract_sections_contract_id" ON "public"."subcontract_sections" USING "btree" ("contract_id");



CREATE INDEX "idx_contract_sections_section_id" ON "public"."subcontract_sections" USING "btree" ("section_id");



CREATE INDEX "idx_contracts_contract_type" ON "public"."subcontracts" USING "btree" ("contract_type");



CREATE INDEX "idx_contracts_is_rate_based" ON "public"."subcontracts" USING "btree" ("is_rate_based");



CREATE INDEX "idx_contracts_laborer_id" ON "public"."subcontracts" USING "btree" ("laborer_id");



CREATE INDEX "idx_contracts_site_id" ON "public"."subcontracts" USING "btree" ("site_id");



CREATE INDEX "idx_contracts_status" ON "public"."subcontracts" USING "btree" ("status");



CREATE INDEX "idx_contracts_team_id" ON "public"."subcontracts" USING "btree" ("team_id");



CREATE INDEX "idx_daily_attendance_contract_id" ON "public"."daily_attendance" USING "btree" ("subcontract_id");



CREATE INDEX "idx_daily_attendance_daily_log_id" ON "public"."daily_attendance" USING "btree" ("daily_log_id");



CREATE INDEX "idx_daily_attendance_date" ON "public"."daily_attendance" USING "btree" ("date");



CREATE INDEX "idx_daily_attendance_date_not_deleted" ON "public"."daily_attendance" USING "btree" ("date") WHERE ("is_deleted" = false);



CREATE INDEX "idx_daily_attendance_engineer_tx" ON "public"."daily_attendance" USING "btree" ("engineer_transaction_id") WHERE ("engineer_transaction_id" IS NOT NULL);



CREATE INDEX "idx_daily_attendance_expense_id" ON "public"."daily_attendance" USING "btree" ("expense_id") WHERE ("expense_id" IS NOT NULL);



CREATE INDEX "idx_daily_attendance_laborer_date" ON "public"."daily_attendance" USING "btree" ("laborer_id", "date");



CREATE INDEX "idx_daily_attendance_laborer_id" ON "public"."daily_attendance" USING "btree" ("laborer_id");



CREATE INDEX "idx_daily_attendance_section_id" ON "public"."daily_attendance" USING "btree" ("section_id");



CREATE INDEX "idx_daily_attendance_settlement_group" ON "public"."daily_attendance" USING "btree" ("settlement_group_id") WHERE ("settlement_group_id" IS NOT NULL);



CREATE INDEX "idx_daily_attendance_site_date" ON "public"."daily_attendance" USING "btree" ("site_id", "date");



CREATE INDEX "idx_daily_attendance_site_id" ON "public"."daily_attendance" USING "btree" ("site_id");



CREATE INDEX "idx_daily_attendance_status" ON "public"."daily_attendance" USING "btree" ("attendance_status") WHERE ("attendance_status" = 'morning_entry'::"text");



CREATE INDEX "idx_daily_attendance_team_id" ON "public"."daily_attendance" USING "btree" ("team_id");



CREATE INDEX "idx_daily_attendance_unpaid" ON "public"."daily_attendance" USING "btree" ("is_paid", "site_id", "date") WHERE (("is_paid" = false) OR ("is_paid" IS NULL));



CREATE INDEX "idx_daily_attendance_updated_by_user_id" ON "public"."daily_attendance" USING "btree" ("updated_by_user_id");



CREATE INDEX "idx_daily_attendance_week_calc" ON "public"."daily_attendance" USING "btree" ("laborer_id", "date", "is_deleted") WHERE ("is_deleted" = false);



CREATE INDEX "idx_daily_logs_date" ON "public"."daily_logs" USING "btree" ("date");



CREATE INDEX "idx_daily_logs_site_date" ON "public"."daily_logs" USING "btree" ("site_id", "date");



CREATE INDEX "idx_daily_logs_site_id" ON "public"."daily_logs" USING "btree" ("site_id");



CREATE INDEX "idx_daily_material_usage_date" ON "public"."daily_material_usage" USING "btree" ("usage_date" DESC);



CREATE INDEX "idx_daily_material_usage_group" ON "public"."daily_material_usage" USING "btree" ("site_group_id");



CREATE INDEX "idx_daily_material_usage_material" ON "public"."daily_material_usage" USING "btree" ("material_id");



CREATE INDEX "idx_daily_material_usage_section" ON "public"."daily_material_usage" USING "btree" ("section_id");



CREATE INDEX "idx_daily_material_usage_site" ON "public"."daily_material_usage" USING "btree" ("site_id");



CREATE INDEX "idx_daily_material_usage_site_date" ON "public"."daily_material_usage" USING "btree" ("site_id", "usage_date");



CREATE INDEX "idx_daily_work_summary_site_date" ON "public"."daily_work_summary" USING "btree" ("site_id", "date");



CREATE INDEX "idx_daily_work_summary_updated_by_user_id" ON "public"."daily_work_summary" USING "btree" ("updated_by_user_id");



CREATE INDEX "idx_deletion_requests_pending" ON "public"."deletion_requests" USING "btree" ("status") WHERE ("status" = 'pending'::"public"."deletion_request_status");



CREATE INDEX "idx_deletion_requests_requested_by" ON "public"."deletion_requests" USING "btree" ("requested_by");



CREATE INDEX "idx_deletion_requests_status" ON "public"."deletion_requests" USING "btree" ("status");



CREATE INDEX "idx_deletion_requests_table_name" ON "public"."deletion_requests" USING "btree" ("table_name");



CREATE INDEX "idx_deliveries_date" ON "public"."deliveries" USING "btree" ("delivery_date" DESC);



CREATE INDEX "idx_deliveries_grn" ON "public"."deliveries" USING "btree" ("grn_number");



CREATE INDEX "idx_deliveries_po" ON "public"."deliveries" USING "btree" ("po_id");



CREATE INDEX "idx_deliveries_site" ON "public"."deliveries" USING "btree" ("site_id");



CREATE INDEX "idx_deliveries_status" ON "public"."deliveries" USING "btree" ("delivery_status");



CREATE INDEX "idx_deliveries_vendor" ON "public"."deliveries" USING "btree" ("vendor_id");



CREATE INDEX "idx_deliveries_verification_pending" ON "public"."deliveries" USING "btree" ("site_id", "verification_status") WHERE ("verification_status" = 'pending'::"text");



CREATE INDEX "idx_deliveries_verification_status" ON "public"."deliveries" USING "btree" ("verification_status");



CREATE INDEX "idx_delivery_items_delivery" ON "public"."delivery_items" USING "btree" ("delivery_id");



CREATE INDEX "idx_delivery_items_material" ON "public"."delivery_items" USING "btree" ("material_id");



CREATE INDEX "idx_delivery_items_po_item" ON "public"."delivery_items" USING "btree" ("po_item_id");



CREATE INDEX "idx_engineer_reimbursements_engineer" ON "public"."engineer_reimbursements" USING "btree" ("engineer_id");



CREATE INDEX "idx_engineer_reimbursements_expense" ON "public"."engineer_reimbursements" USING "btree" ("expense_transaction_id");



CREATE INDEX "idx_expense_categories_is_active" ON "public"."expense_categories" USING "btree" ("is_active");



CREATE INDEX "idx_expense_categories_module" ON "public"."expense_categories" USING "btree" ("module");



CREATE INDEX "idx_expenses_category_id" ON "public"."expenses" USING "btree" ("category_id");



CREATE INDEX "idx_expenses_contract_id" ON "public"."expenses" USING "btree" ("contract_id");



CREATE INDEX "idx_expenses_date" ON "public"."expenses" USING "btree" ("date");



CREATE INDEX "idx_expenses_engineer_transaction_id" ON "public"."expenses" USING "btree" ("engineer_transaction_id") WHERE ("engineer_transaction_id" IS NOT NULL);



CREATE INDEX "idx_expenses_is_cleared" ON "public"."expenses" USING "btree" ("is_cleared");



CREATE INDEX "idx_expenses_labor" ON "public"."expenses" USING "btree" ("module", "site_id", "date") WHERE (("module" = 'labor'::"public"."expense_module") AND ("is_deleted" = false));



CREATE INDEX "idx_expenses_module" ON "public"."expenses" USING "btree" ("module");



CREATE INDEX "idx_expenses_pending_clearance" ON "public"."expenses" USING "btree" ("is_cleared", "week_ending") WHERE (("is_recurring" = true) AND ("is_cleared" = false) AND ("is_deleted" = false));



CREATE INDEX "idx_expenses_site_id" ON "public"."expenses" USING "btree" ("site_id");



CREATE INDEX "idx_expenses_site_payer_id" ON "public"."expenses" USING "btree" ("site_payer_id");



CREATE INDEX "idx_expenses_team_id" ON "public"."expenses" USING "btree" ("team_id");



CREATE INDEX "idx_expenses_week_ending" ON "public"."expenses" USING "btree" ("week_ending");



CREATE INDEX "idx_group_stock_inventory_batch" ON "public"."group_stock_inventory" USING "btree" ("batch_code");



CREATE INDEX "idx_group_stock_inventory_dedicated" ON "public"."group_stock_inventory" USING "btree" ("is_dedicated", "dedicated_site_id");



CREATE INDEX "idx_group_stock_inventory_group" ON "public"."group_stock_inventory" USING "btree" ("site_group_id");



CREATE INDEX "idx_group_stock_inventory_low_stock" ON "public"."group_stock_inventory" USING "btree" ("site_group_id", "material_id") WHERE ("current_qty" > (0)::numeric);



CREATE INDEX "idx_group_stock_inventory_material" ON "public"."group_stock_inventory" USING "btree" ("material_id");



CREATE INDEX "idx_group_stock_transactions_batch" ON "public"."group_stock_transactions" USING "btree" ("batch_code");



CREATE INDEX "idx_group_stock_transactions_date" ON "public"."group_stock_transactions" USING "btree" ("transaction_date" DESC);



CREATE INDEX "idx_group_stock_transactions_group" ON "public"."group_stock_transactions" USING "btree" ("site_group_id");



CREATE INDEX "idx_group_stock_transactions_inventory" ON "public"."group_stock_transactions" USING "btree" ("inventory_id");



CREATE INDEX "idx_group_stock_transactions_ref" ON "public"."group_stock_transactions" USING "btree" ("reference_type", "reference_id");



CREATE INDEX "idx_group_stock_transactions_type" ON "public"."group_stock_transactions" USING "btree" ("transaction_type");



CREATE INDEX "idx_group_stock_transactions_usage_site" ON "public"."group_stock_transactions" USING "btree" ("usage_site_id");



CREATE INDEX "idx_import_logs_created_at" ON "public"."import_logs" USING "btree" ("created_at");



CREATE INDEX "idx_import_logs_import_type" ON "public"."import_logs" USING "btree" ("import_type");



CREATE INDEX "idx_import_logs_imported_by" ON "public"."import_logs" USING "btree" ("imported_by");



CREATE INDEX "idx_inter_site_settlements_from" ON "public"."inter_site_material_settlements" USING "btree" ("from_site_id");



CREATE INDEX "idx_inter_site_settlements_group" ON "public"."inter_site_material_settlements" USING "btree" ("site_group_id");



CREATE INDEX "idx_inter_site_settlements_status" ON "public"."inter_site_material_settlements" USING "btree" ("status");



CREATE INDEX "idx_inter_site_settlements_to" ON "public"."inter_site_material_settlements" USING "btree" ("to_site_id");



CREATE INDEX "idx_inter_site_settlements_week" ON "public"."inter_site_material_settlements" USING "btree" ("year" DESC, "week_number" DESC);



CREATE INDEX "idx_labor_categories_is_active" ON "public"."labor_categories" USING "btree" ("is_active");



CREATE INDEX "idx_labor_categories_name" ON "public"."labor_categories" USING "btree" ("name");



CREATE INDEX "idx_labor_payments_actual_date" ON "public"."labor_payments" USING "btree" ("actual_payment_date");



CREATE INDEX "idx_labor_payments_advance" ON "public"."labor_payments" USING "btree" ("laborer_id", "payment_type") WHERE ("payment_type" = 'advance'::"text");



CREATE INDEX "idx_labor_payments_attendance" ON "public"."labor_payments" USING "btree" ("attendance_id");



CREATE INDEX "idx_labor_payments_date" ON "public"."labor_payments" USING "btree" ("payment_for_date");



CREATE INDEX "idx_labor_payments_laborer" ON "public"."labor_payments" USING "btree" ("laborer_id");



CREATE INDEX "idx_labor_payments_payment_type" ON "public"."labor_payments" USING "btree" ("payment_type");



CREATE INDEX "idx_labor_payments_reference" ON "public"."labor_payments" USING "btree" ("payment_reference");



CREATE INDEX "idx_labor_payments_settlement_group" ON "public"."labor_payments" USING "btree" ("settlement_group_id") WHERE ("settlement_group_id" IS NOT NULL);



CREATE INDEX "idx_labor_payments_site" ON "public"."labor_payments" USING "btree" ("site_id");



CREATE INDEX "idx_labor_payments_subcontract" ON "public"."labor_payments" USING "btree" ("subcontract_id");



CREATE INDEX "idx_labor_roles_category_id" ON "public"."labor_roles" USING "btree" ("category_id");



CREATE INDEX "idx_labor_roles_is_active" ON "public"."labor_roles" USING "btree" ("is_active");



CREATE INDEX "idx_labor_roles_name" ON "public"."labor_roles" USING "btree" ("name");



CREATE INDEX "idx_laborer_site_assignments_is_active" ON "public"."laborer_site_assignments" USING "btree" ("is_active");



CREATE INDEX "idx_laborer_site_assignments_laborer_id" ON "public"."laborer_site_assignments" USING "btree" ("laborer_id");



CREATE INDEX "idx_laborer_site_assignments_site_id" ON "public"."laborer_site_assignments" USING "btree" ("site_id");



CREATE INDEX "idx_laborers_active_category" ON "public"."laborers" USING "btree" ("status", "category_id") WHERE ("status" = 'active'::"public"."laborer_status");



CREATE INDEX "idx_laborers_active_team" ON "public"."laborers" USING "btree" ("status", "team_id") WHERE ("status" = 'active'::"public"."laborer_status");



CREATE INDEX "idx_laborers_category_id" ON "public"."laborers" USING "btree" ("category_id");



CREATE INDEX "idx_laborers_employment_type" ON "public"."laborers" USING "btree" ("employment_type");



CREATE INDEX "idx_laborers_name" ON "public"."laborers" USING "btree" ("name");



CREATE INDEX "idx_laborers_phone" ON "public"."laborers" USING "btree" ("phone");



CREATE INDEX "idx_laborers_role_id" ON "public"."laborers" USING "btree" ("role_id");



CREATE INDEX "idx_laborers_status" ON "public"."laborers" USING "btree" ("status");



CREATE INDEX "idx_laborers_team" ON "public"."laborers" USING "btree" ("associated_team_id");



CREATE INDEX "idx_laborers_team_id" ON "public"."laborers" USING "btree" ("team_id");



CREATE INDEX "idx_laborers_type" ON "public"."laborers" USING "btree" ("laborer_type");



CREATE INDEX "idx_local_purchase_items_material" ON "public"."local_purchase_items" USING "btree" ("material_id");



CREATE INDEX "idx_local_purchase_items_purchase" ON "public"."local_purchase_items" USING "btree" ("local_purchase_id");



CREATE INDEX "idx_local_purchases_date" ON "public"."local_purchases" USING "btree" ("purchase_date" DESC);



CREATE INDEX "idx_local_purchases_engineer" ON "public"."local_purchases" USING "btree" ("engineer_id");



CREATE INDEX "idx_local_purchases_group" ON "public"."local_purchases" USING "btree" ("site_group_id");



CREATE INDEX "idx_local_purchases_reimbursement" ON "public"."local_purchases" USING "btree" ("needs_reimbursement", "reimbursement_status") WHERE ("needs_reimbursement" = true);



CREATE INDEX "idx_local_purchases_site" ON "public"."local_purchases" USING "btree" ("site_id");



CREATE INDEX "idx_local_purchases_status" ON "public"."local_purchases" USING "btree" ("status");



CREATE INDEX "idx_local_purchases_vendor" ON "public"."local_purchases" USING "btree" ("vendor_id");



CREATE INDEX "idx_market_attendance_engineer_tx" ON "public"."market_laborer_attendance" USING "btree" ("engineer_transaction_id") WHERE ("engineer_transaction_id" IS NOT NULL);



CREATE INDEX "idx_market_attendance_settlement_group" ON "public"."market_laborer_attendance" USING "btree" ("settlement_group_id") WHERE ("settlement_group_id" IS NOT NULL);



CREATE INDEX "idx_market_laborer_attendance_expense_id" ON "public"."market_laborer_attendance" USING "btree" ("expense_id") WHERE ("expense_id" IS NOT NULL);



CREATE INDEX "idx_market_laborer_attendance_unpaid" ON "public"."market_laborer_attendance" USING "btree" ("is_paid", "site_id", "date") WHERE ("is_paid" = false);



CREATE INDEX "idx_market_laborer_attendance_updated_by_user_id" ON "public"."market_laborer_attendance" USING "btree" ("updated_by_user_id");



CREATE INDEX "idx_material_brands_material" ON "public"."material_brands" USING "btree" ("material_id");



CREATE INDEX "idx_material_brands_preferred" ON "public"."material_brands" USING "btree" ("material_id") WHERE ("is_preferred" = true);



CREATE INDEX "idx_material_categories_active" ON "public"."material_categories" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_material_categories_order" ON "public"."material_categories" USING "btree" ("display_order");



CREATE INDEX "idx_material_categories_parent" ON "public"."material_categories" USING "btree" ("parent_id");



CREATE INDEX "idx_material_request_items_material" ON "public"."material_request_items" USING "btree" ("material_id");



CREATE INDEX "idx_material_request_items_request" ON "public"."material_request_items" USING "btree" ("request_id");



CREATE INDEX "idx_material_requests_date" ON "public"."material_requests" USING "btree" ("request_date" DESC);



CREATE INDEX "idx_material_requests_priority" ON "public"."material_requests" USING "btree" ("priority");



CREATE INDEX "idx_material_requests_requested_by" ON "public"."material_requests" USING "btree" ("requested_by");



CREATE INDEX "idx_material_requests_site" ON "public"."material_requests" USING "btree" ("site_id");



CREATE INDEX "idx_material_requests_status" ON "public"."material_requests" USING "btree" ("status");



CREATE INDEX "idx_material_vendors_material" ON "public"."material_vendors" USING "btree" ("material_id");



CREATE INDEX "idx_material_vendors_preferred" ON "public"."material_vendors" USING "btree" ("material_id") WHERE ("is_preferred" = true);



CREATE INDEX "idx_material_vendors_vendor" ON "public"."material_vendors" USING "btree" ("vendor_id");



CREATE INDEX "idx_materials_active" ON "public"."materials" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_materials_category" ON "public"."materials" USING "btree" ("category_id");



CREATE INDEX "idx_materials_code" ON "public"."materials" USING "btree" ("code");



CREATE INDEX "idx_materials_name" ON "public"."materials" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_materials_parent" ON "public"."materials" USING "btree" ("parent_id");



CREATE INDEX "idx_materials_weight" ON "public"."materials" USING "btree" ("weight_per_unit") WHERE ("weight_per_unit" IS NOT NULL);



CREATE INDEX "idx_notifications_is_read" ON "public"."notifications" USING "btree" ("is_read");



CREATE INDEX "idx_notifications_related" ON "public"."notifications" USING "btree" ("related_id", "related_table");



CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING "btree" ("notification_type");



CREATE INDEX "idx_notifications_type_related" ON "public"."notifications" USING "btree" ("notification_type", "related_id");



CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("user_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_notifications_user_created" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_user_unread" ON "public"."notifications" USING "btree" ("user_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_payment_allocations_laborer_week" ON "public"."payment_week_allocations" USING "btree" ("laborer_id", "week_start");



CREATE INDEX "idx_payment_allocations_payment" ON "public"."payment_week_allocations" USING "btree" ("labor_payment_id");



CREATE INDEX "idx_payment_allocations_site" ON "public"."payment_week_allocations" USING "btree" ("site_id");



CREATE INDEX "idx_payment_milestones_site_id" ON "public"."site_payment_milestones" USING "btree" ("site_id");



CREATE INDEX "idx_payment_milestones_status" ON "public"."site_payment_milestones" USING "btree" ("status");



CREATE INDEX "idx_price_history_bill" ON "public"."price_history" USING "btree" ("bill_number");



CREATE INDEX "idx_price_history_change_reason" ON "public"."price_history" USING "btree" ("change_reason_id");



CREATE INDEX "idx_price_history_date" ON "public"."price_history" USING "btree" ("recorded_date" DESC);



CREATE INDEX "idx_price_history_material" ON "public"."price_history" USING "btree" ("material_id", "recorded_date" DESC);



CREATE INDEX "idx_price_history_material_vendor" ON "public"."price_history" USING "btree" ("material_id", "vendor_id", "recorded_date" DESC);



CREATE INDEX "idx_price_history_source" ON "public"."price_history" USING "btree" ("source");



CREATE INDEX "idx_price_history_vendor" ON "public"."price_history" USING "btree" ("vendor_id", "recorded_date" DESC);



CREATE INDEX "idx_purchase_order_items_material" ON "public"."purchase_order_items" USING "btree" ("material_id");



CREATE INDEX "idx_purchase_order_items_po" ON "public"."purchase_order_items" USING "btree" ("po_id");



CREATE INDEX "idx_purchase_orders_date" ON "public"."purchase_orders" USING "btree" ("order_date" DESC);



CREATE INDEX "idx_purchase_orders_number" ON "public"."purchase_orders" USING "btree" ("po_number");



CREATE INDEX "idx_purchase_orders_site" ON "public"."purchase_orders" USING "btree" ("site_id");



CREATE INDEX "idx_purchase_orders_status" ON "public"."purchase_orders" USING "btree" ("status");



CREATE INDEX "idx_purchase_orders_vendor" ON "public"."purchase_orders" USING "btree" ("vendor_id");



CREATE INDEX "idx_purchase_payment_allocations_payment" ON "public"."purchase_payment_allocations" USING "btree" ("payment_id");



CREATE INDEX "idx_purchase_payment_allocations_po" ON "public"."purchase_payment_allocations" USING "btree" ("po_id");



CREATE INDEX "idx_purchase_payments_date" ON "public"."purchase_payments" USING "btree" ("payment_date" DESC);



CREATE INDEX "idx_purchase_payments_site" ON "public"."purchase_payments" USING "btree" ("site_id");



CREATE INDEX "idx_purchase_payments_vendor" ON "public"."purchase_payments" USING "btree" ("vendor_id");



CREATE INDEX "idx_push_subscriptions_user_active" ON "public"."push_subscriptions" USING "btree" ("user_id") WHERE ("is_active" = true);



CREATE INDEX "idx_salary_payments_payment_date" ON "public"."salary_payments" USING "btree" ("payment_date");



CREATE INDEX "idx_salary_payments_salary_period_id" ON "public"."salary_payments" USING "btree" ("salary_period_id");



CREATE INDEX "idx_salary_payments_team_id" ON "public"."salary_payments" USING "btree" ("team_id");



CREATE INDEX "idx_salary_periods_laborer_id" ON "public"."salary_periods" USING "btree" ("laborer_id");



CREATE INDEX "idx_salary_periods_pending" ON "public"."salary_periods" USING "btree" ("status", "week_ending") WHERE ("status" = ANY (ARRAY['calculated'::"public"."salary_status", 'partial'::"public"."salary_status"]));



CREATE INDEX "idx_salary_periods_status" ON "public"."salary_periods" USING "btree" ("status");



CREATE INDEX "idx_salary_periods_week_ending" ON "public"."salary_periods" USING "btree" ("week_ending");



CREATE INDEX "idx_set_settlement_status" ON "public"."site_engineer_transactions" USING "btree" ("settlement_status", "user_id");



CREATE INDEX "idx_set_transactions_settlement_group" ON "public"."site_engineer_transactions" USING "btree" ("settlement_group_id") WHERE ("settlement_group_id" IS NOT NULL);



CREATE INDEX "idx_set_transactions_settlement_ref" ON "public"."site_engineer_transactions" USING "btree" ("settlement_reference") WHERE ("settlement_reference" IS NOT NULL);



CREATE INDEX "idx_set_user_pending" ON "public"."site_engineer_transactions" USING "btree" ("user_id", "settlement_status") WHERE ("settlement_status" = 'pending_settlement'::"text");



CREATE INDEX "idx_settlement_groups_engineer_tx" ON "public"."settlement_groups" USING "btree" ("engineer_transaction_id") WHERE ("engineer_transaction_id" IS NOT NULL);



CREATE INDEX "idx_settlement_groups_not_cancelled" ON "public"."settlement_groups" USING "btree" ("site_id", "settlement_date") WHERE ("is_cancelled" = false);



CREATE INDEX "idx_settlement_groups_reference" ON "public"."settlement_groups" USING "btree" ("settlement_reference");



CREATE INDEX "idx_settlement_groups_site_date" ON "public"."settlement_groups" USING "btree" ("site_id", "settlement_date" DESC);



CREATE INDEX "idx_settlement_groups_site_id" ON "public"."settlement_groups" USING "btree" ("site_id");



CREATE INDEX "idx_settlement_groups_subcontract" ON "public"."settlement_groups" USING "btree" ("subcontract_id") WHERE ("subcontract_id" IS NOT NULL);



CREATE INDEX "idx_settlement_groups_type_date" ON "public"."settlement_groups" USING "btree" ("site_id", "settlement_type", "settlement_date" DESC);



CREATE INDEX "idx_settlement_items_date" ON "public"."inter_site_settlement_items" USING "btree" ("usage_date");



CREATE INDEX "idx_settlement_items_material" ON "public"."inter_site_settlement_items" USING "btree" ("material_id");



CREATE INDEX "idx_settlement_items_settlement" ON "public"."inter_site_settlement_items" USING "btree" ("settlement_id");



CREATE INDEX "idx_settlement_payments_settlement" ON "public"."inter_site_settlement_payments" USING "btree" ("settlement_id");



CREATE INDEX "idx_settlements_date" ON "public"."site_engineer_settlements" USING "btree" ("settlement_date");



CREATE INDEX "idx_settlements_engineer" ON "public"."site_engineer_settlements" USING "btree" ("site_engineer_id");



CREATE INDEX "idx_site_clients_client_id" ON "public"."site_clients" USING "btree" ("client_id");



CREATE INDEX "idx_site_clients_site_id" ON "public"."site_clients" USING "btree" ("site_id");



CREATE INDEX "idx_site_eng_trans_date" ON "public"."site_engineer_transactions" USING "btree" ("transaction_date");



CREATE INDEX "idx_site_eng_trans_settled" ON "public"."site_engineer_transactions" USING "btree" ("is_settled") WHERE ("transaction_type" = 'used_own_money'::"text");



CREATE INDEX "idx_site_eng_trans_site" ON "public"."site_engineer_transactions" USING "btree" ("site_id");



CREATE INDEX "idx_site_eng_trans_type" ON "public"."site_engineer_transactions" USING "btree" ("transaction_type");



CREATE INDEX "idx_site_eng_trans_user" ON "public"."site_engineer_transactions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_site_engineer_transactions_batch_code_unique" ON "public"."site_engineer_transactions" USING "btree" ("batch_code") WHERE ("batch_code" IS NOT NULL);



CREATE INDEX "idx_site_engineer_transactions_cancelled" ON "public"."site_engineer_transactions" USING "btree" ("cancelled_at") WHERE ("cancelled_at" IS NOT NULL);



CREATE INDEX "idx_site_engineer_transactions_money_source" ON "public"."site_engineer_transactions" USING "btree" ("money_source", "site_id") WHERE ("money_source" IS NOT NULL);



CREATE INDEX "idx_site_engineer_transactions_remaining_balance" ON "public"."site_engineer_transactions" USING "btree" ("user_id", "remaining_balance") WHERE (("remaining_balance" > (0)::numeric) AND ("transaction_type" = 'received_from_company'::"text"));



CREATE INDEX "idx_site_engineer_transactions_settlement_status" ON "public"."site_engineer_transactions" USING "btree" ("settlement_status") WHERE ("settlement_status" IS NOT NULL);



CREATE INDEX "idx_site_engineer_transactions_site_restricted" ON "public"."site_engineer_transactions" USING "btree" ("user_id", "site_id", "site_restricted") WHERE ("site_restricted" = true);



CREATE INDEX "idx_site_groups_active" ON "public"."site_groups" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_site_holidays_date" ON "public"."site_holidays" USING "btree" ("date");



CREATE INDEX "idx_site_holidays_site_date" ON "public"."site_holidays" USING "btree" ("site_id", "date" DESC);



CREATE INDEX "idx_site_holidays_site_id" ON "public"."site_holidays" USING "btree" ("site_id");



CREATE INDEX "idx_site_material_budgets_period" ON "public"."site_material_budgets" USING "btree" ("period_start", "period_end");



CREATE INDEX "idx_site_material_budgets_site" ON "public"."site_material_budgets" USING "btree" ("site_id");



CREATE INDEX "idx_site_payers_active" ON "public"."site_payers" USING "btree" ("site_id", "is_active");



CREATE INDEX "idx_site_payers_site_id" ON "public"."site_payers" USING "btree" ("site_id");



CREATE INDEX "idx_site_payment_milestones_sequence" ON "public"."site_payment_milestones" USING "btree" ("site_id", "sequence_order");



CREATE INDEX "idx_site_payment_milestones_site_id" ON "public"."site_payment_milestones" USING "btree" ("site_id");



CREATE INDEX "idx_sites_client_name" ON "public"."sites" USING "btree" ("client_name");



CREATE INDEX "idx_sites_construction_phase" ON "public"."sites" USING "btree" ("construction_phase");



CREATE INDEX "idx_sites_construction_phase_id" ON "public"."sites" USING "btree" ("construction_phase_id");



CREATE INDEX "idx_sites_default_section" ON "public"."sites" USING "btree" ("default_section_id");



CREATE INDEX "idx_sites_group" ON "public"."sites" USING "btree" ("site_group_id");



CREATE INDEX "idx_sites_location" ON "public"."sites" USING "btree" ("location_lat", "location_lng");



CREATE INDEX "idx_sites_name" ON "public"."sites" USING "btree" ("name");



CREATE INDEX "idx_sites_status" ON "public"."sites" USING "btree" ("status");



CREATE INDEX "idx_stock_inventory_batch" ON "public"."stock_inventory" USING "btree" ("batch_code");



CREATE INDEX "idx_stock_inventory_location" ON "public"."stock_inventory" USING "btree" ("location_id");



CREATE INDEX "idx_stock_inventory_low_stock" ON "public"."stock_inventory" USING "btree" ("site_id", "material_id") WHERE ("current_qty" > (0)::numeric);



CREATE INDEX "idx_stock_inventory_material" ON "public"."stock_inventory" USING "btree" ("material_id");



CREATE INDEX "idx_stock_inventory_site" ON "public"."stock_inventory" USING "btree" ("site_id");



CREATE INDEX "idx_stock_locations_default" ON "public"."stock_locations" USING "btree" ("site_id") WHERE ("is_default" = true);



CREATE INDEX "idx_stock_locations_site" ON "public"."stock_locations" USING "btree" ("site_id");



CREATE INDEX "idx_stock_transactions_batch" ON "public"."stock_transactions" USING "btree" ("batch_code");



CREATE INDEX "idx_stock_transactions_date" ON "public"."stock_transactions" USING "btree" ("transaction_date" DESC);



CREATE INDEX "idx_stock_transactions_inventory" ON "public"."stock_transactions" USING "btree" ("inventory_id");



CREATE INDEX "idx_stock_transactions_ref" ON "public"."stock_transactions" USING "btree" ("reference_type", "reference_id");



CREATE INDEX "idx_stock_transactions_site" ON "public"."stock_transactions" USING "btree" ("site_id");



CREATE INDEX "idx_stock_transactions_type" ON "public"."stock_transactions" USING "btree" ("transaction_type");



CREATE INDEX "idx_stock_transfer_items_material" ON "public"."stock_transfer_items" USING "btree" ("material_id");



CREATE INDEX "idx_stock_transfer_items_transfer" ON "public"."stock_transfer_items" USING "btree" ("transfer_id");



CREATE INDEX "idx_stock_transfers_date" ON "public"."stock_transfers" USING "btree" ("transfer_date" DESC);



CREATE INDEX "idx_stock_transfers_from" ON "public"."stock_transfers" USING "btree" ("from_site_id");



CREATE INDEX "idx_stock_transfers_status" ON "public"."stock_transfers" USING "btree" ("status");



CREATE INDEX "idx_stock_transfers_to" ON "public"."stock_transfers" USING "btree" ("to_site_id");



CREATE INDEX "idx_subcontract_payments_channel" ON "public"."subcontract_payments" USING "btree" ("payment_channel");



CREATE INDEX "idx_subcontract_payments_period" ON "public"."subcontract_payments" USING "btree" ("period_from_date", "period_to_date");



CREATE INDEX "idx_tea_shop_accounts_is_active" ON "public"."tea_shop_accounts" USING "btree" ("is_active");



CREATE INDEX "idx_tea_shop_accounts_site" ON "public"."tea_shop_accounts" USING "btree" ("site_id");



CREATE INDEX "idx_tea_shop_accounts_site_id" ON "public"."tea_shop_accounts" USING "btree" ("site_id");



CREATE INDEX "idx_tea_shop_clearances_tea_shop_id" ON "public"."tea_shop_clearances" USING "btree" ("tea_shop_id");



CREATE INDEX "idx_tea_shop_clearances_week_end" ON "public"."tea_shop_clearances" USING "btree" ("week_end");



CREATE INDEX "idx_tea_shop_consumption_entry" ON "public"."tea_shop_consumption_details" USING "btree" ("entry_id");



CREATE INDEX "idx_tea_shop_consumption_laborer" ON "public"."tea_shop_consumption_details" USING "btree" ("laborer_id");



CREATE INDEX "idx_tea_shop_entries_date" ON "public"."tea_shop_entries" USING "btree" ("date");



CREATE INDEX "idx_tea_shop_entries_entered_by_user_id" ON "public"."tea_shop_entries" USING "btree" ("entered_by_user_id") WHERE ("entered_by_user_id" IS NOT NULL);



CREATE INDEX "idx_tea_shop_entries_entry_mode" ON "public"."tea_shop_entries" USING "btree" ("entry_mode");



CREATE INDEX "idx_tea_shop_entries_is_fully_paid" ON "public"."tea_shop_entries" USING "btree" ("is_fully_paid") WHERE ("is_fully_paid" = false);



CREATE INDEX "idx_tea_shop_entries_shop_date" ON "public"."tea_shop_entries" USING "btree" ("tea_shop_id", "date");



CREATE INDEX "idx_tea_shop_entries_site_date" ON "public"."tea_shop_entries" USING "btree" ("site_id", "date");



CREATE INDEX "idx_tea_shop_entries_site_id" ON "public"."tea_shop_entries" USING "btree" ("site_id");



CREATE INDEX "idx_tea_shop_entries_split_source" ON "public"."tea_shop_entries" USING "btree" ("split_source_entry_id") WHERE ("split_source_entry_id" IS NOT NULL);



CREATE INDEX "idx_tea_shop_entries_tea_shop_id" ON "public"."tea_shop_entries" USING "btree" ("tea_shop_id");



CREATE INDEX "idx_tea_shop_entries_updated_by_user_id" ON "public"."tea_shop_entries" USING "btree" ("updated_by_user_id");



CREATE INDEX "idx_tea_shop_settlement_allocations_entry" ON "public"."tea_shop_settlement_allocations" USING "btree" ("entry_id");



CREATE INDEX "idx_tea_shop_settlement_allocations_settlement" ON "public"."tea_shop_settlement_allocations" USING "btree" ("settlement_id");



CREATE INDEX "idx_tea_shop_settlements_date" ON "public"."tea_shop_settlements" USING "btree" ("payment_date");



CREATE INDEX "idx_tea_shop_settlements_proof" ON "public"."tea_shop_settlements" USING "btree" ("tea_shop_id") WHERE ("proof_url" IS NOT NULL);



CREATE INDEX "idx_tea_shop_settlements_shop" ON "public"."tea_shop_settlements" USING "btree" ("tea_shop_id");



CREATE INDEX "idx_tea_shop_settlements_subcontract_id" ON "public"."tea_shop_settlements" USING "btree" ("subcontract_id");



CREATE INDEX "idx_team_salary_summaries_status" ON "public"."team_salary_summaries" USING "btree" ("status");



CREATE INDEX "idx_team_salary_summaries_team_id" ON "public"."team_salary_summaries" USING "btree" ("team_id");



CREATE INDEX "idx_team_salary_summaries_week_ending" ON "public"."team_salary_summaries" USING "btree" ("week_ending");



CREATE INDEX "idx_teams_leader_name" ON "public"."teams" USING "btree" ("leader_name");



CREATE INDEX "idx_teams_status" ON "public"."teams" USING "btree" ("status");



CREATE INDEX "idx_users_auth_id" ON "public"."users" USING "btree" ("auth_id");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role");



CREATE INDEX "idx_vendor_inventory_available" ON "public"."vendor_inventory" USING "btree" ("vendor_id", "is_available") WHERE ("is_available" = true);



CREATE INDEX "idx_vendor_inventory_material" ON "public"."vendor_inventory" USING "btree" ("material_id");



CREATE INDEX "idx_vendor_inventory_price_update" ON "public"."vendor_inventory" USING "btree" ("last_price_update" DESC);



CREATE INDEX "idx_vendor_inventory_vendor" ON "public"."vendor_inventory" USING "btree" ("vendor_id");



CREATE INDEX "idx_vendor_material_categories_category" ON "public"."vendor_material_categories" USING "btree" ("category_id");



CREATE INDEX "idx_vendor_material_categories_vendor" ON "public"."vendor_material_categories" USING "btree" ("vendor_id");



CREATE INDEX "idx_vendor_price_history_date" ON "public"."vendor_price_history" USING "btree" ("effective_date" DESC);



CREATE INDEX "idx_vendor_price_history_mv" ON "public"."vendor_price_history" USING "btree" ("material_vendor_id");



CREATE INDEX "idx_vendors_active" ON "public"."vendors" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_vendors_city" ON "public"."vendors" USING "btree" ("store_city");



CREATE INDEX "idx_vendors_code" ON "public"."vendors" USING "btree" ("code");



CREATE INDEX "idx_vendors_name" ON "public"."vendors" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_vendors_transport" ON "public"."vendors" USING "btree" ("provides_transport") WHERE ("provides_transport" = true);



CREATE INDEX "idx_vendors_type" ON "public"."vendors" USING "btree" ("vendor_type");



CREATE OR REPLACE TRIGGER "auto_create_site_sections_trigger" AFTER INSERT ON "public"."sites" FOR EACH ROW EXECUTE FUNCTION "public"."auto_create_site_sections"();



CREATE OR REPLACE TRIGGER "calculate_milestone_amount_trigger" BEFORE INSERT OR UPDATE ON "public"."subcontract_milestones" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_milestone_amount"();



CREATE OR REPLACE TRIGGER "daily_work_summary_updated_at" BEFORE UPDATE ON "public"."daily_work_summary" FOR EACH ROW EXECUTE FUNCTION "public"."update_daily_work_summary_timestamp"();



CREATE OR REPLACE TRIGGER "process_attendance_insert" BEFORE INSERT ON "public"."daily_attendance" FOR EACH ROW EXECUTE FUNCTION "public"."process_attendance_before_insert"();



CREATE OR REPLACE TRIGGER "process_attendance_update" BEFORE UPDATE ON "public"."daily_attendance" FOR EACH ROW EXECUTE FUNCTION "public"."process_attendance_before_update"();



CREATE OR REPLACE TRIGGER "set_laborer_daily_rate_trigger" BEFORE INSERT ON "public"."laborers" FOR EACH ROW EXECUTE FUNCTION "public"."set_laborer_daily_rate"();



CREATE OR REPLACE TRIGGER "tea_shop_accounts_updated_at" BEFORE UPDATE ON "public"."tea_shop_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_tea_shop_accounts_timestamp"();



CREATE OR REPLACE TRIGGER "tea_shop_settlements_updated_at" BEFORE UPDATE ON "public"."tea_shop_settlements" FOR EACH ROW EXECUTE FUNCTION "public"."update_tea_shop_settlements_timestamp"();



CREATE OR REPLACE TRIGGER "trg_check_low_stock" AFTER UPDATE OF "current_qty" ON "public"."stock_inventory" FOR EACH ROW WHEN (("new"."current_qty" < "old"."current_qty")) EXECUTE FUNCTION "public"."check_low_stock_alerts"();



CREATE OR REPLACE TRIGGER "trg_check_material_parent_level" BEFORE INSERT OR UPDATE ON "public"."materials" FOR EACH ROW EXECUTE FUNCTION "public"."check_material_parent_level"();



CREATE OR REPLACE TRIGGER "trg_notify_delivery_pending" AFTER INSERT ON "public"."deliveries" FOR EACH ROW WHEN ((("new"."verification_status" = 'pending'::"text") AND ("new"."requires_verification" = true))) EXECUTE FUNCTION "public"."notify_engineer_delivery_pending"();



CREATE OR REPLACE TRIGGER "trg_process_local_purchase_stock" AFTER INSERT OR UPDATE OF "status" ON "public"."local_purchases" FOR EACH ROW WHEN ((("new"."status" = 'completed'::"text") AND ("new"."add_to_stock" = true) AND ("new"."stock_added" = false))) EXECUTE FUNCTION "public"."trigger_process_local_purchase_stock"();



CREATE OR REPLACE TRIGGER "trg_record_price_from_po" AFTER INSERT ON "public"."purchase_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."record_price_from_po_item"();



CREATE OR REPLACE TRIGGER "trg_set_local_purchase_number" BEFORE INSERT ON "public"."local_purchases" FOR EACH ROW EXECUTE FUNCTION "public"."set_local_purchase_number"();



CREATE OR REPLACE TRIGGER "trg_tea_shop_entry_waterfall" AFTER DELETE OR UPDATE ON "public"."tea_shop_entries" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_tea_shop_entry_change"();



CREATE OR REPLACE TRIGGER "trg_tea_shop_settlement_waterfall" AFTER INSERT OR DELETE OR UPDATE ON "public"."tea_shop_settlements" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_tea_shop_settlement_change"();



CREATE OR REPLACE TRIGGER "trg_update_group_stock_on_daily_usage" BEFORE INSERT ON "public"."daily_material_usage" FOR EACH ROW WHEN ((("new"."is_group_stock" = true) AND ("new"."site_group_id" IS NOT NULL))) EXECUTE FUNCTION "public"."update_group_stock_on_daily_usage"();



CREATE OR REPLACE TRIGGER "trg_update_po_status_on_delivery" AFTER INSERT ON "public"."delivery_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_po_status_on_delivery"();



CREATE OR REPLACE TRIGGER "trg_update_stock_on_delivery" AFTER INSERT ON "public"."delivery_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_stock_on_verified_delivery"();



CREATE OR REPLACE TRIGGER "trg_update_stock_on_usage" BEFORE INSERT ON "public"."daily_material_usage" FOR EACH ROW EXECUTE FUNCTION "public"."update_stock_on_usage"();



CREATE OR REPLACE TRIGGER "trigger_settlement_groups_updated_at" BEFORE UPDATE ON "public"."settlement_groups" FOR EACH ROW EXECUTE FUNCTION "public"."update_settlement_groups_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_site_payers_updated_at" BEFORE UPDATE ON "public"."site_payers" FOR EACH ROW EXECUTE FUNCTION "public"."update_site_payers_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_tea_shop_consumption_updated_at" BEFORE UPDATE ON "public"."tea_shop_consumption_details" FOR EACH ROW EXECUTE FUNCTION "public"."update_tea_shop_consumption_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_tea_shop_entries_updated_at" BEFORE UPDATE ON "public"."tea_shop_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_tea_shop_entries_updated_at"();



CREATE OR REPLACE TRIGGER "update_advance_deduction_status_trigger" BEFORE UPDATE ON "public"."advances" FOR EACH ROW EXECUTE FUNCTION "public"."update_advance_deduction_status"();



CREATE OR REPLACE TRIGGER "update_advances_updated_at" BEFORE UPDATE ON "public"."advances" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_building_sections_updated_at" BEFORE UPDATE ON "public"."building_sections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_construction_phases_updated_at" BEFORE UPDATE ON "public"."construction_phases" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_construction_subphases_updated_at" BEFORE UPDATE ON "public"."construction_subphases" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_contract_after_payment_trigger" AFTER INSERT ON "public"."subcontract_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_contract_after_payment"();



CREATE OR REPLACE TRIGGER "update_contract_milestones_updated_at" BEFORE UPDATE ON "public"."subcontract_milestones" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_contracts_updated_at" BEFORE UPDATE ON "public"."subcontracts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_daily_attendance_updated_at" BEFORE UPDATE ON "public"."daily_attendance" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_daily_logs_updated_at" BEFORE UPDATE ON "public"."daily_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_expense_categories_updated_at" BEFORE UPDATE ON "public"."expense_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_expenses_updated_at" BEFORE UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_labor_categories_updated_at" BEFORE UPDATE ON "public"."labor_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_labor_roles_updated_at" BEFORE UPDATE ON "public"."labor_roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_laborers_updated_at" BEFORE UPDATE ON "public"."laborers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_market_laborer_attendance_updated_at" BEFORE UPDATE ON "public"."market_laborer_attendance" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_salary_period_after_payment_trigger" AFTER INSERT ON "public"."salary_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_salary_period_after_payment"();



CREATE OR REPLACE TRIGGER "update_salary_periods_updated_at" BEFORE UPDATE ON "public"."salary_periods" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_site_clients_updated_at" BEFORE UPDATE ON "public"."site_clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_site_payment_milestones_updated_at" BEFORE UPDATE ON "public"."site_payment_milestones" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sites_updated_at" BEFORE UPDATE ON "public"."sites" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tea_shop_accounts_updated_at" BEFORE UPDATE ON "public"."tea_shop_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_team_salary_summaries_updated_at" BEFORE UPDATE ON "public"."team_salary_summaries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_teams_updated_at" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."advances"
    ADD CONSTRAINT "advances_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."advances"
    ADD CONSTRAINT "advances_given_by_fkey" FOREIGN KEY ("given_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."advances"
    ADD CONSTRAINT "advances_laborer_id_fkey" FOREIGN KEY ("laborer_id") REFERENCES "public"."laborers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."attendance_expense_sync"
    ADD CONSTRAINT "attendance_expense_sync_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id");



ALTER TABLE ONLY "public"."attendance_expense_sync"
    ADD CONSTRAINT "attendance_expense_sync_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."attendance_expense_sync"
    ADD CONSTRAINT "attendance_expense_sync_synced_by_user_id_fkey" FOREIGN KEY ("synced_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."building_sections"
    ADD CONSTRAINT "building_sections_construction_phase_id_fkey" FOREIGN KEY ("construction_phase_id") REFERENCES "public"."construction_phases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."building_sections"
    ADD CONSTRAINT "building_sections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."building_sections"
    ADD CONSTRAINT "building_sections_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."building_sections"
    ADD CONSTRAINT "building_sections_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_payment_plans"
    ADD CONSTRAINT "client_payment_plans_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_payments"
    ADD CONSTRAINT "client_payments_payment_phase_id_fkey" FOREIGN KEY ("payment_phase_id") REFERENCES "public"."payment_phases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_payments"
    ADD CONSTRAINT "client_payments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."construction_subphases"
    ADD CONSTRAINT "construction_subphases_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "public"."construction_phases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subcontract_milestones"
    ADD CONSTRAINT "contract_milestones_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."subcontracts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subcontract_payments"
    ADD CONSTRAINT "contract_payments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."subcontracts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."subcontract_payments"
    ADD CONSTRAINT "contract_payments_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "public"."subcontract_milestones"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subcontract_payments"
    ADD CONSTRAINT "contract_payments_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."subcontract_sections"
    ADD CONSTRAINT "contract_sections_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."subcontracts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subcontract_sections"
    ADD CONSTRAINT "contract_sections_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."building_sections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subcontracts"
    ADD CONSTRAINT "contracts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."subcontracts"
    ADD CONSTRAINT "contracts_laborer_id_fkey" FOREIGN KEY ("laborer_id") REFERENCES "public"."laborers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."subcontracts"
    ADD CONSTRAINT "contracts_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."subcontracts"
    ADD CONSTRAINT "contracts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."daily_attendance"
    ADD CONSTRAINT "daily_attendance_contract_id_fkey" FOREIGN KEY ("subcontract_id") REFERENCES "public"."subcontracts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_attendance"
    ADD CONSTRAINT "daily_attendance_daily_log_id_fkey" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_attendance"
    ADD CONSTRAINT "daily_attendance_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."daily_attendance"
    ADD CONSTRAINT "daily_attendance_engineer_transaction_id_fkey" FOREIGN KEY ("engineer_transaction_id") REFERENCES "public"."site_engineer_transactions"("id");



ALTER TABLE ONLY "public"."daily_attendance"
    ADD CONSTRAINT "daily_attendance_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."daily_attendance"
    ADD CONSTRAINT "daily_attendance_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_attendance"
    ADD CONSTRAINT "daily_attendance_laborer_id_fkey" FOREIGN KEY ("laborer_id") REFERENCES "public"."laborers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."daily_attendance"
    ADD CONSTRAINT "daily_attendance_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."labor_payments"("id");



ALTER TABLE ONLY "public"."daily_attendance"
    ADD CONSTRAINT "daily_attendance_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."daily_attendance"
    ADD CONSTRAINT "daily_attendance_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."building_sections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_attendance"
    ADD CONSTRAINT "daily_attendance_settlement_group_id_fkey" FOREIGN KEY ("settlement_group_id") REFERENCES "public"."settlement_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_attendance"
    ADD CONSTRAINT "daily_attendance_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."daily_attendance"
    ADD CONSTRAINT "daily_attendance_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_attendance"
    ADD CONSTRAINT "daily_attendance_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."daily_attendance"
    ADD CONSTRAINT "daily_attendance_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "daily_logs_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "daily_logs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_material_usage"
    ADD CONSTRAINT "daily_material_usage_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."material_brands"("id");



ALTER TABLE ONLY "public"."daily_material_usage"
    ADD CONSTRAINT "daily_material_usage_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."daily_material_usage"
    ADD CONSTRAINT "daily_material_usage_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."daily_material_usage"
    ADD CONSTRAINT "daily_material_usage_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."building_sections"("id");



ALTER TABLE ONLY "public"."daily_material_usage"
    ADD CONSTRAINT "daily_material_usage_site_group_id_fkey" FOREIGN KEY ("site_group_id") REFERENCES "public"."site_groups"("id");



ALTER TABLE ONLY "public"."daily_material_usage"
    ADD CONSTRAINT "daily_material_usage_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."daily_material_usage"
    ADD CONSTRAINT "daily_material_usage_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."daily_work_summary"
    ADD CONSTRAINT "daily_work_summary_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_work_summary"
    ADD CONSTRAINT "daily_work_summary_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_engineer_verified_by_fkey" FOREIGN KEY ("engineer_verified_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."stock_locations"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."delivery_items"
    ADD CONSTRAINT "delivery_items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."material_brands"("id");



ALTER TABLE ONLY "public"."delivery_items"
    ADD CONSTRAINT "delivery_items_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_items"
    ADD CONSTRAINT "delivery_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."delivery_items"
    ADD CONSTRAINT "delivery_items_po_item_id_fkey" FOREIGN KEY ("po_item_id") REFERENCES "public"."purchase_order_items"("id");



ALTER TABLE ONLY "public"."engineer_reimbursements"
    ADD CONSTRAINT "engineer_reimbursements_engineer_id_fkey" FOREIGN KEY ("engineer_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."engineer_reimbursements"
    ADD CONSTRAINT "engineer_reimbursements_expense_transaction_id_fkey" FOREIGN KEY ("expense_transaction_id") REFERENCES "public"."site_engineer_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engineer_reimbursements"
    ADD CONSTRAINT "engineer_reimbursements_settled_by_user_id_fkey" FOREIGN KEY ("settled_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."engineer_wallet_batch_usage"
    ADD CONSTRAINT "engineer_wallet_batch_usage_batch_transaction_id_fkey" FOREIGN KEY ("batch_transaction_id") REFERENCES "public"."site_engineer_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engineer_wallet_batch_usage"
    ADD CONSTRAINT "engineer_wallet_batch_usage_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."site_engineer_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."subcontracts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_engineer_transaction_id_fkey" FOREIGN KEY ("engineer_transaction_id") REFERENCES "public"."site_engineer_transactions"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_entered_by_user_id_fkey" FOREIGN KEY ("entered_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_laborer_id_fkey" FOREIGN KEY ("laborer_id") REFERENCES "public"."laborers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."building_sections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_site_payer_id_fkey" FOREIGN KEY ("site_payer_id") REFERENCES "public"."site_payers"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subcontract_payments"
    ADD CONSTRAINT "fk_subcontract_payments_site_eng_trans" FOREIGN KEY ("site_engineer_transaction_id") REFERENCES "public"."site_engineer_transactions"("id");



ALTER TABLE ONLY "public"."group_stock_inventory"
    ADD CONSTRAINT "group_stock_inventory_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."material_brands"("id");



ALTER TABLE ONLY "public"."group_stock_inventory"
    ADD CONSTRAINT "group_stock_inventory_dedicated_site_id_fkey" FOREIGN KEY ("dedicated_site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."group_stock_inventory"
    ADD CONSTRAINT "group_stock_inventory_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."stock_locations"("id");



ALTER TABLE ONLY "public"."group_stock_inventory"
    ADD CONSTRAINT "group_stock_inventory_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."group_stock_inventory"
    ADD CONSTRAINT "group_stock_inventory_site_group_id_fkey" FOREIGN KEY ("site_group_id") REFERENCES "public"."site_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_stock_transactions"
    ADD CONSTRAINT "group_stock_transactions_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."material_brands"("id");



ALTER TABLE ONLY "public"."group_stock_transactions"
    ADD CONSTRAINT "group_stock_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."group_stock_transactions"
    ADD CONSTRAINT "group_stock_transactions_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "public"."group_stock_inventory"("id");



ALTER TABLE ONLY "public"."group_stock_transactions"
    ADD CONSTRAINT "group_stock_transactions_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."group_stock_transactions"
    ADD CONSTRAINT "group_stock_transactions_payment_source_site_id_fkey" FOREIGN KEY ("payment_source_site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."group_stock_transactions"
    ADD CONSTRAINT "group_stock_transactions_site_group_id_fkey" FOREIGN KEY ("site_group_id") REFERENCES "public"."site_groups"("id");



ALTER TABLE ONLY "public"."group_stock_transactions"
    ADD CONSTRAINT "group_stock_transactions_usage_site_id_fkey" FOREIGN KEY ("usage_site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."import_logs"
    ADD CONSTRAINT "import_logs_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inter_site_material_settlements"
    ADD CONSTRAINT "inter_site_material_settlements_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inter_site_material_settlements"
    ADD CONSTRAINT "inter_site_material_settlements_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inter_site_material_settlements"
    ADD CONSTRAINT "inter_site_material_settlements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inter_site_material_settlements"
    ADD CONSTRAINT "inter_site_material_settlements_from_site_id_fkey" FOREIGN KEY ("from_site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."inter_site_material_settlements"
    ADD CONSTRAINT "inter_site_material_settlements_settled_by_fkey" FOREIGN KEY ("settled_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inter_site_material_settlements"
    ADD CONSTRAINT "inter_site_material_settlements_site_group_id_fkey" FOREIGN KEY ("site_group_id") REFERENCES "public"."site_groups"("id");



ALTER TABLE ONLY "public"."inter_site_material_settlements"
    ADD CONSTRAINT "inter_site_material_settlements_to_site_id_fkey" FOREIGN KEY ("to_site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."inter_site_settlement_items"
    ADD CONSTRAINT "inter_site_settlement_items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."material_brands"("id");



ALTER TABLE ONLY "public"."inter_site_settlement_items"
    ADD CONSTRAINT "inter_site_settlement_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."inter_site_settlement_items"
    ADD CONSTRAINT "inter_site_settlement_items_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "public"."inter_site_material_settlements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inter_site_settlement_items"
    ADD CONSTRAINT "inter_site_settlement_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."group_stock_transactions"("id");



ALTER TABLE ONLY "public"."inter_site_settlement_payments"
    ADD CONSTRAINT "inter_site_settlement_payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inter_site_settlement_payments"
    ADD CONSTRAINT "inter_site_settlement_payments_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "public"."inter_site_material_settlements"("id");



ALTER TABLE ONLY "public"."labor_payments"
    ADD CONSTRAINT "labor_payments_advance_deduction_from_payment_id_fkey" FOREIGN KEY ("advance_deduction_from_payment_id") REFERENCES "public"."labor_payments"("id");



ALTER TABLE ONLY "public"."labor_payments"
    ADD CONSTRAINT "labor_payments_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "public"."daily_attendance"("id");



ALTER TABLE ONLY "public"."labor_payments"
    ADD CONSTRAINT "labor_payments_laborer_id_fkey" FOREIGN KEY ("laborer_id") REFERENCES "public"."laborers"("id");



ALTER TABLE ONLY "public"."labor_payments"
    ADD CONSTRAINT "labor_payments_paid_by_user_id_fkey" FOREIGN KEY ("paid_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."labor_payments"
    ADD CONSTRAINT "labor_payments_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."labor_payments"
    ADD CONSTRAINT "labor_payments_settlement_group_id_fkey" FOREIGN KEY ("settlement_group_id") REFERENCES "public"."settlement_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."labor_payments"
    ADD CONSTRAINT "labor_payments_site_engineer_transaction_id_fkey" FOREIGN KEY ("site_engineer_transaction_id") REFERENCES "public"."site_engineer_transactions"("id");



ALTER TABLE ONLY "public"."labor_payments"
    ADD CONSTRAINT "labor_payments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."labor_payments"
    ADD CONSTRAINT "labor_payments_subcontract_id_fkey" FOREIGN KEY ("subcontract_id") REFERENCES "public"."subcontracts"("id");



ALTER TABLE ONLY "public"."labor_roles"
    ADD CONSTRAINT "labor_roles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."labor_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."laborer_site_assignments"
    ADD CONSTRAINT "laborer_site_assignments_laborer_id_fkey" FOREIGN KEY ("laborer_id") REFERENCES "public"."laborers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."laborer_site_assignments"
    ADD CONSTRAINT "laborer_site_assignments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."laborers"
    ADD CONSTRAINT "laborers_associated_team_id_fkey" FOREIGN KEY ("associated_team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."laborers"
    ADD CONSTRAINT "laborers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."labor_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."laborers"
    ADD CONSTRAINT "laborers_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."labor_roles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."laborers"
    ADD CONSTRAINT "laborers_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."local_purchase_items"
    ADD CONSTRAINT "local_purchase_items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."material_brands"("id");



ALTER TABLE ONLY "public"."local_purchase_items"
    ADD CONSTRAINT "local_purchase_items_local_purchase_id_fkey" FOREIGN KEY ("local_purchase_id") REFERENCES "public"."local_purchases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."local_purchase_items"
    ADD CONSTRAINT "local_purchase_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."local_purchases"
    ADD CONSTRAINT "local_purchases_engineer_id_fkey" FOREIGN KEY ("engineer_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."local_purchases"
    ADD CONSTRAINT "local_purchases_reimbursement_transaction_id_fkey" FOREIGN KEY ("reimbursement_transaction_id") REFERENCES "public"."site_engineer_transactions"("id");



ALTER TABLE ONLY "public"."local_purchases"
    ADD CONSTRAINT "local_purchases_site_group_id_fkey" FOREIGN KEY ("site_group_id") REFERENCES "public"."site_groups"("id");



ALTER TABLE ONLY "public"."local_purchases"
    ADD CONSTRAINT "local_purchases_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."local_purchases"
    ADD CONSTRAINT "local_purchases_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."market_laborer_attendance"
    ADD CONSTRAINT "market_laborer_attendance_engineer_transaction_id_fkey" FOREIGN KEY ("engineer_transaction_id") REFERENCES "public"."site_engineer_transactions"("id");



ALTER TABLE ONLY "public"."market_laborer_attendance"
    ADD CONSTRAINT "market_laborer_attendance_entered_by_user_id_fkey" FOREIGN KEY ("entered_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."market_laborer_attendance"
    ADD CONSTRAINT "market_laborer_attendance_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."market_laborer_attendance"
    ADD CONSTRAINT "market_laborer_attendance_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."labor_roles"("id");



ALTER TABLE ONLY "public"."market_laborer_attendance"
    ADD CONSTRAINT "market_laborer_attendance_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."building_sections"("id");



ALTER TABLE ONLY "public"."market_laborer_attendance"
    ADD CONSTRAINT "market_laborer_attendance_settlement_group_id_fkey" FOREIGN KEY ("settlement_group_id") REFERENCES "public"."settlement_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."market_laborer_attendance"
    ADD CONSTRAINT "market_laborer_attendance_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."market_laborer_attendance"
    ADD CONSTRAINT "market_laborer_attendance_subcontract_id_fkey" FOREIGN KEY ("subcontract_id") REFERENCES "public"."subcontracts"("id");



ALTER TABLE ONLY "public"."market_laborer_attendance"
    ADD CONSTRAINT "market_laborer_attendance_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."material_brands"
    ADD CONSTRAINT "material_brands_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_categories"
    ADD CONSTRAINT "material_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."material_categories"("id");



ALTER TABLE ONLY "public"."material_request_items"
    ADD CONSTRAINT "material_request_items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."material_brands"("id");



ALTER TABLE ONLY "public"."material_request_items"
    ADD CONSTRAINT "material_request_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."material_request_items"
    ADD CONSTRAINT "material_request_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."material_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_requests"
    ADD CONSTRAINT "material_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."material_requests"
    ADD CONSTRAINT "material_requests_converted_to_po_id_fkey" FOREIGN KEY ("converted_to_po_id") REFERENCES "public"."purchase_orders"("id");



ALTER TABLE ONLY "public"."material_requests"
    ADD CONSTRAINT "material_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."material_requests"
    ADD CONSTRAINT "material_requests_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."building_sections"("id");



ALTER TABLE ONLY "public"."material_requests"
    ADD CONSTRAINT "material_requests_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."material_vendors"
    ADD CONSTRAINT "material_vendors_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."material_brands"("id");



ALTER TABLE ONLY "public"."material_vendors"
    ADD CONSTRAINT "material_vendors_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_vendors"
    ADD CONSTRAINT "material_vendors_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."material_categories"("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_phases"
    ADD CONSTRAINT "payment_phases_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "public"."client_payment_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_week_allocations"
    ADD CONSTRAINT "payment_week_allocations_labor_payment_id_fkey" FOREIGN KEY ("labor_payment_id") REFERENCES "public"."labor_payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_week_allocations"
    ADD CONSTRAINT "payment_week_allocations_laborer_id_fkey" FOREIGN KEY ("laborer_id") REFERENCES "public"."laborers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_week_allocations"
    ADD CONSTRAINT "payment_week_allocations_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."material_brands"("id");



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_change_reason_id_fkey" FOREIGN KEY ("change_reason_id") REFERENCES "public"."price_change_reasons"("id");



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."material_brands"("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_delivery_location_id_fkey" FOREIGN KEY ("delivery_location_id") REFERENCES "public"."stock_locations"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."purchase_payment_allocations"
    ADD CONSTRAINT "purchase_payment_allocations_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id");



ALTER TABLE ONLY "public"."purchase_payment_allocations"
    ADD CONSTRAINT "purchase_payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."purchase_payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_payment_allocations"
    ADD CONSTRAINT "purchase_payment_allocations_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id");



ALTER TABLE ONLY "public"."purchase_payments"
    ADD CONSTRAINT "purchase_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."purchase_payments"
    ADD CONSTRAINT "purchase_payments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."purchase_payments"
    ADD CONSTRAINT "purchase_payments_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_salary_period_id_fkey" FOREIGN KEY ("salary_period_id") REFERENCES "public"."salary_periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."salary_periods"
    ADD CONSTRAINT "salary_periods_calculated_by_fkey" FOREIGN KEY ("calculated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."salary_periods"
    ADD CONSTRAINT "salary_periods_laborer_id_fkey" FOREIGN KEY ("laborer_id") REFERENCES "public"."laborers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."settlement_groups"
    ADD CONSTRAINT "settlement_groups_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."settlement_groups"
    ADD CONSTRAINT "settlement_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."settlement_groups"
    ADD CONSTRAINT "settlement_groups_engineer_transaction_id_fkey" FOREIGN KEY ("engineer_transaction_id") REFERENCES "public"."site_engineer_transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."settlement_groups"
    ADD CONSTRAINT "settlement_groups_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settlement_groups"
    ADD CONSTRAINT "settlement_groups_subcontract_id_fkey" FOREIGN KEY ("subcontract_id") REFERENCES "public"."subcontracts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."site_clients"
    ADD CONSTRAINT "site_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."site_clients"
    ADD CONSTRAINT "site_clients_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_engineer_settlements"
    ADD CONSTRAINT "site_engineer_settlements_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."site_engineer_settlements"
    ADD CONSTRAINT "site_engineer_settlements_site_engineer_id_fkey" FOREIGN KEY ("site_engineer_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."site_engineer_transactions"
    ADD CONSTRAINT "site_engineer_transactions_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."site_engineer_transactions"
    ADD CONSTRAINT "site_engineer_transactions_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."site_engineer_transactions"
    ADD CONSTRAINT "site_engineer_transactions_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."site_engineer_transactions"
    ADD CONSTRAINT "site_engineer_transactions_related_attendance_id_fkey" FOREIGN KEY ("related_attendance_id") REFERENCES "public"."daily_attendance"("id");



ALTER TABLE ONLY "public"."site_engineer_transactions"
    ADD CONSTRAINT "site_engineer_transactions_related_subcontract_id_fkey" FOREIGN KEY ("related_subcontract_id") REFERENCES "public"."subcontracts"("id");



ALTER TABLE ONLY "public"."site_engineer_transactions"
    ADD CONSTRAINT "site_engineer_transactions_settled_by_fkey" FOREIGN KEY ("settled_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."site_engineer_transactions"
    ADD CONSTRAINT "site_engineer_transactions_settlement_group_id_fkey" FOREIGN KEY ("settlement_group_id") REFERENCES "public"."settlement_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."site_engineer_transactions"
    ADD CONSTRAINT "site_engineer_transactions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."site_engineer_transactions"
    ADD CONSTRAINT "site_engineer_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."site_groups"
    ADD CONSTRAINT "site_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."site_holidays"
    ADD CONSTRAINT "site_holidays_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."site_holidays"
    ADD CONSTRAINT "site_holidays_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_material_budgets"
    ADD CONSTRAINT "site_material_budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."material_categories"("id");



ALTER TABLE ONLY "public"."site_material_budgets"
    ADD CONSTRAINT "site_material_budgets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."site_material_budgets"
    ADD CONSTRAINT "site_material_budgets_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."site_payers"
    ADD CONSTRAINT "site_payers_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_payment_milestones"
    ADD CONSTRAINT "site_payment_milestones_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_construction_phase_id_fkey" FOREIGN KEY ("construction_phase_id") REFERENCES "public"."construction_phases"("id");



ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_default_section_id_fkey" FOREIGN KEY ("default_section_id") REFERENCES "public"."building_sections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_site_group_id_fkey" FOREIGN KEY ("site_group_id") REFERENCES "public"."site_groups"("id");



ALTER TABLE ONLY "public"."stock_inventory"
    ADD CONSTRAINT "stock_inventory_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."material_brands"("id");



ALTER TABLE ONLY "public"."stock_inventory"
    ADD CONSTRAINT "stock_inventory_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."stock_locations"("id");



ALTER TABLE ONLY "public"."stock_inventory"
    ADD CONSTRAINT "stock_inventory_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."stock_inventory"
    ADD CONSTRAINT "stock_inventory_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_locations"
    ADD CONSTRAINT "stock_locations_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_transactions"
    ADD CONSTRAINT "stock_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_transactions"
    ADD CONSTRAINT "stock_transactions_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "public"."stock_inventory"("id");



ALTER TABLE ONLY "public"."stock_transactions"
    ADD CONSTRAINT "stock_transactions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."building_sections"("id");



ALTER TABLE ONLY "public"."stock_transactions"
    ADD CONSTRAINT "stock_transactions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."stock_transfer_items"
    ADD CONSTRAINT "stock_transfer_items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."material_brands"("id");



ALTER TABLE ONLY "public"."stock_transfer_items"
    ADD CONSTRAINT "stock_transfer_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."stock_transfer_items"
    ADD CONSTRAINT "stock_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "public"."stock_locations"("id");



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_from_site_id_fkey" FOREIGN KEY ("from_site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "public"."stock_locations"("id");



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_to_site_id_fkey" FOREIGN KEY ("to_site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."subcontract_payments"
    ADD CONSTRAINT "subcontract_payments_paid_by_user_id_fkey" FOREIGN KEY ("paid_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."subcontract_payments"
    ADD CONSTRAINT "subcontract_payments_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tea_shop_accounts"
    ADD CONSTRAINT "tea_shop_accounts_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tea_shop_clearances"
    ADD CONSTRAINT "tea_shop_clearances_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tea_shop_clearances"
    ADD CONSTRAINT "tea_shop_clearances_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tea_shop_clearances"
    ADD CONSTRAINT "tea_shop_clearances_tea_shop_id_fkey" FOREIGN KEY ("tea_shop_id") REFERENCES "public"."tea_shop_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tea_shop_consumption_details"
    ADD CONSTRAINT "tea_shop_consumption_details_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."tea_shop_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tea_shop_consumption_details"
    ADD CONSTRAINT "tea_shop_consumption_details_laborer_id_fkey" FOREIGN KEY ("laborer_id") REFERENCES "public"."laborers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tea_shop_entries"
    ADD CONSTRAINT "tea_shop_entries_entered_by_user_id_fkey" FOREIGN KEY ("entered_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tea_shop_entries"
    ADD CONSTRAINT "tea_shop_entries_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tea_shop_entries"
    ADD CONSTRAINT "tea_shop_entries_split_source_entry_id_fkey" FOREIGN KEY ("split_source_entry_id") REFERENCES "public"."tea_shop_entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tea_shop_entries"
    ADD CONSTRAINT "tea_shop_entries_split_target_site_id_fkey" FOREIGN KEY ("split_target_site_id") REFERENCES "public"."sites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tea_shop_entries"
    ADD CONSTRAINT "tea_shop_entries_tea_shop_id_fkey" FOREIGN KEY ("tea_shop_id") REFERENCES "public"."tea_shop_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tea_shop_entries"
    ADD CONSTRAINT "tea_shop_entries_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tea_shop_entries"
    ADD CONSTRAINT "tea_shop_entries_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tea_shop_settlement_allocations"
    ADD CONSTRAINT "tea_shop_settlement_allocations_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."tea_shop_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tea_shop_settlement_allocations"
    ADD CONSTRAINT "tea_shop_settlement_allocations_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "public"."tea_shop_settlements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tea_shop_settlements"
    ADD CONSTRAINT "tea_shop_settlements_site_engineer_id_fkey" FOREIGN KEY ("site_engineer_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tea_shop_settlements"
    ADD CONSTRAINT "tea_shop_settlements_subcontract_id_fkey" FOREIGN KEY ("subcontract_id") REFERENCES "public"."subcontracts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tea_shop_settlements"
    ADD CONSTRAINT "tea_shop_settlements_tea_shop_id_fkey" FOREIGN KEY ("tea_shop_id") REFERENCES "public"."tea_shop_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_salary_summaries"
    ADD CONSTRAINT "team_salary_summaries_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_inventory"
    ADD CONSTRAINT "vendor_inventory_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."material_brands"("id");



ALTER TABLE ONLY "public"."vendor_inventory"
    ADD CONSTRAINT "vendor_inventory_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."vendor_inventory"
    ADD CONSTRAINT "vendor_inventory_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_material_categories"
    ADD CONSTRAINT "vendor_material_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."material_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_material_categories"
    ADD CONSTRAINT "vendor_material_categories_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_price_history"
    ADD CONSTRAINT "vendor_price_history_material_vendor_id_fkey" FOREIGN KEY ("material_vendor_id") REFERENCES "public"."material_vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_price_history"
    ADD CONSTRAINT "vendor_price_history_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



CREATE POLICY "Admins and site engineers can manage payers" ON "public"."site_payers" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role", 'site_engineer'::"public"."user_role"]))))));



CREATE POLICY "Allow all for authenticated users" ON "public"."engineer_reimbursements" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."engineer_wallet_batch_usage" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated delete settlement_groups" ON "public"."settlement_groups" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated insert settlement_groups" ON "public"."settlement_groups" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated read price_change_reasons" ON "public"."price_change_reasons" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read settlement_groups" ON "public"."settlement_groups" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated update settlement_groups" ON "public"."settlement_groups" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated users to delete payment allocations" ON "public"."payment_week_allocations" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to insert payment allocations" ON "public"."payment_week_allocations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated users to read payment allocations" ON "public"."payment_week_allocations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can create notifications for others" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can delete consumption details" ON "public"."tea_shop_consumption_details" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Users can delete tea shop accounts" ON "public"."tea_shop_accounts" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Users can delete tea shop entries" ON "public"."tea_shop_entries" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Users can delete tea shop settlements" ON "public"."tea_shop_settlements" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Users can delete their own notifications" ON "public"."notifications" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own push subscriptions" ON "public"."push_subscriptions" FOR DELETE USING (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert consumption details" ON "public"."tea_shop_consumption_details" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can insert labor payments" ON "public"."labor_payments" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert settlements" ON "public"."site_engineer_settlements" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert site engineer transactions" ON "public"."site_engineer_transactions" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert sync records" ON "public"."attendance_expense_sync" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert tea shop accounts" ON "public"."tea_shop_accounts" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can insert tea shop entries" ON "public"."tea_shop_entries" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can insert tea shop settlements" ON "public"."tea_shop_settlements" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can insert their own push subscriptions" ON "public"."push_subscriptions" FOR INSERT WITH CHECK (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "Users can read their own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update consumption details" ON "public"."tea_shop_consumption_details" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can update labor payments" ON "public"."labor_payments" FOR UPDATE USING (true);



CREATE POLICY "Users can update site engineer transactions" ON "public"."site_engineer_transactions" FOR UPDATE USING (true);



CREATE POLICY "Users can update tea shop accounts" ON "public"."tea_shop_accounts" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can update tea shop entries" ON "public"."tea_shop_entries" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can update tea shop settlements" ON "public"."tea_shop_settlements" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own push subscriptions" ON "public"."push_subscriptions" FOR UPDATE USING (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "Users can view consumption details" ON "public"."tea_shop_consumption_details" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view holidays for accessible sites" ON "public"."site_holidays" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_id" = "auth"."uid"()) AND (("u"."role" = 'admin'::"public"."user_role") OR ("site_holidays"."site_id" = ANY ("u"."assigned_sites")))))));



CREATE POLICY "Users can view labor payments" ON "public"."labor_payments" FOR SELECT USING (true);



CREATE POLICY "Users can view payers for sites they have access to" ON "public"."site_payers" FOR SELECT USING (true);



CREATE POLICY "Users can view settlements" ON "public"."site_engineer_settlements" FOR SELECT USING (true);



CREATE POLICY "Users can view site engineer transactions" ON "public"."site_engineer_transactions" FOR SELECT USING (true);



CREATE POLICY "Users can view sync records" ON "public"."attendance_expense_sync" FOR SELECT USING (true);



CREATE POLICY "Users can view tea shop accounts" ON "public"."tea_shop_accounts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view tea shop entries" ON "public"."tea_shop_entries" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view tea shop settlements" ON "public"."tea_shop_settlements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view their own push subscriptions" ON "public"."push_subscriptions" FOR SELECT USING (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "Users with edit permissions can delete holidays" ON "public"."site_holidays" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY['admin'::"public"."user_role", 'site_engineer'::"public"."user_role"]))))));



CREATE POLICY "Users with edit permissions can insert holidays" ON "public"."site_holidays" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY['admin'::"public"."user_role", 'site_engineer'::"public"."user_role"]))))));



CREATE POLICY "Users with edit permissions can update holidays" ON "public"."site_holidays" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY['admin'::"public"."user_role", 'site_engineer'::"public"."user_role"]))))));



ALTER TABLE "public"."advances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "advances_delete" ON "public"."advances" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "advances_insert" ON "public"."advances" FOR INSERT WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



CREATE POLICY "advances_select" ON "public"."advances" FOR SELECT USING (true);



CREATE POLICY "advances_update" ON "public"."advances" FOR UPDATE USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



CREATE POLICY "allow_all_daily_material_usage" ON "public"."daily_material_usage" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_delete_daily_attendance" ON "public"."daily_attendance" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "allow_all_delete_daily_work_summary" ON "public"."daily_work_summary" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "allow_all_delete_expenses" ON "public"."expenses" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "allow_all_delete_market_laborer_attendance" ON "public"."market_laborer_attendance" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "allow_all_deliveries" ON "public"."deliveries" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_delivery_items" ON "public"."delivery_items" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_group_stock_inventory" ON "public"."group_stock_inventory" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_insert_daily_attendance" ON "public"."daily_attendance" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "allow_all_insert_daily_work_summary" ON "public"."daily_work_summary" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "allow_all_insert_expenses" ON "public"."expenses" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "allow_all_insert_market_laborer_attendance" ON "public"."market_laborer_attendance" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "allow_all_inter_site_settlements" ON "public"."inter_site_material_settlements" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"]))))));



CREATE POLICY "allow_all_local_purchase_items" ON "public"."local_purchase_items" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_material_brands" ON "public"."material_brands" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"]))))));



CREATE POLICY "allow_all_material_categories" ON "public"."material_categories" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"]))))));



CREATE POLICY "allow_all_material_request_items" ON "public"."material_request_items" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_material_requests" ON "public"."material_requests" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_material_vendors" ON "public"."material_vendors" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"]))))));



CREATE POLICY "allow_all_purchase_order_items" ON "public"."purchase_order_items" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_purchase_orders" ON "public"."purchase_orders" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_purchase_payment_allocations" ON "public"."purchase_payment_allocations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"]))))));



CREATE POLICY "allow_all_purchase_payments" ON "public"."purchase_payments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"]))))));



CREATE POLICY "allow_all_select_daily_attendance" ON "public"."daily_attendance" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_all_select_daily_work_summary" ON "public"."daily_work_summary" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_all_select_expenses" ON "public"."expenses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_all_select_market_laborer_attendance" ON "public"."market_laborer_attendance" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_all_settlement_items" ON "public"."inter_site_settlement_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"]))))));



CREATE POLICY "allow_all_settlement_payments" ON "public"."inter_site_settlement_payments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"]))))));



CREATE POLICY "allow_all_site_groups" ON "public"."site_groups" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"]))))));



CREATE POLICY "allow_all_site_material_budgets" ON "public"."site_material_budgets" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"]))))));



CREATE POLICY "allow_all_stock_inventory" ON "public"."stock_inventory" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_stock_locations" ON "public"."stock_locations" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_stock_transfer_items" ON "public"."stock_transfer_items" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_stock_transfers" ON "public"."stock_transfers" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_update_daily_attendance" ON "public"."daily_attendance" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_update_daily_work_summary" ON "public"."daily_work_summary" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_update_expenses" ON "public"."expenses" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_update_market_laborer_attendance" ON "public"."market_laborer_attendance" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_vendor_inventory" ON "public"."vendor_inventory" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"]))))));



CREATE POLICY "allow_all_vendor_material_categories" ON "public"."vendor_material_categories" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"]))))));



CREATE POLICY "allow_all_vendors" ON "public"."vendors" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"]))))));



CREATE POLICY "allow_anon_delete_daily_attendance" ON "public"."daily_attendance" FOR DELETE TO "anon" USING (true);



CREATE POLICY "allow_anon_delete_daily_work_summary" ON "public"."daily_work_summary" FOR DELETE TO "anon" USING (true);



CREATE POLICY "allow_anon_delete_expenses" ON "public"."expenses" FOR DELETE TO "anon" USING (true);



CREATE POLICY "allow_anon_delete_market_laborer_attendance" ON "public"."market_laborer_attendance" FOR DELETE TO "anon" USING (true);



CREATE POLICY "allow_anon_insert_daily_attendance" ON "public"."daily_attendance" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "allow_anon_insert_daily_work_summary" ON "public"."daily_work_summary" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "allow_anon_insert_expenses" ON "public"."expenses" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "allow_anon_insert_market_laborer_attendance" ON "public"."market_laborer_attendance" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "allow_anon_select_daily_attendance" ON "public"."daily_attendance" FOR SELECT TO "anon" USING (true);



CREATE POLICY "allow_anon_select_daily_work_summary" ON "public"."daily_work_summary" FOR SELECT TO "anon" USING (true);



CREATE POLICY "allow_anon_select_expenses" ON "public"."expenses" FOR SELECT TO "anon" USING (true);



CREATE POLICY "allow_anon_select_market_laborer_attendance" ON "public"."market_laborer_attendance" FOR SELECT TO "anon" USING (true);



CREATE POLICY "allow_anon_update_daily_attendance" ON "public"."daily_attendance" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "allow_anon_update_daily_work_summary" ON "public"."daily_work_summary" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "allow_anon_update_expenses" ON "public"."expenses" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "allow_anon_update_market_laborer_attendance" ON "public"."market_laborer_attendance" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "allow_delete_laborers" ON "public"."laborers" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "allow_delete_materials" ON "public"."materials" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"]))))));



CREATE POLICY "allow_insert_group_stock_transactions" ON "public"."group_stock_transactions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "allow_insert_laborers" ON "public"."laborers" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "allow_insert_local_purchases" ON "public"."local_purchases" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "allow_insert_materials" ON "public"."materials" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "allow_insert_price_history" ON "public"."price_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "allow_insert_stock_transactions" ON "public"."stock_transactions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "allow_insert_vendor_price_history" ON "public"."vendor_price_history" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"]))))));



CREATE POLICY "allow_select_daily_material_usage" ON "public"."daily_material_usage" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_deliveries" ON "public"."deliveries" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_delivery_items" ON "public"."delivery_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_group_stock_inventory" ON "public"."group_stock_inventory" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_group_stock_transactions" ON "public"."group_stock_transactions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_inter_site_settlements" ON "public"."inter_site_material_settlements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_laborers" ON "public"."laborers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_local_purchase_items" ON "public"."local_purchase_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_local_purchases" ON "public"."local_purchases" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_material_brands" ON "public"."material_brands" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_material_categories" ON "public"."material_categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_material_request_items" ON "public"."material_request_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_material_requests" ON "public"."material_requests" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_material_vendors" ON "public"."material_vendors" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_materials" ON "public"."materials" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_price_history" ON "public"."price_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_purchase_order_items" ON "public"."purchase_order_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_purchase_orders" ON "public"."purchase_orders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_purchase_payment_allocations" ON "public"."purchase_payment_allocations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_purchase_payments" ON "public"."purchase_payments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_settlement_items" ON "public"."inter_site_settlement_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_settlement_payments" ON "public"."inter_site_settlement_payments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_site_groups" ON "public"."site_groups" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_site_material_budgets" ON "public"."site_material_budgets" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_stock_inventory" ON "public"."stock_inventory" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_stock_locations" ON "public"."stock_locations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_stock_transactions" ON "public"."stock_transactions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_stock_transfer_items" ON "public"."stock_transfer_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_stock_transfers" ON "public"."stock_transfers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_vendor_inventory" ON "public"."vendor_inventory" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_vendor_material_categories" ON "public"."vendor_material_categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_vendor_price_history" ON "public"."vendor_price_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_select_vendors" ON "public"."vendors" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow_update_laborers" ON "public"."laborers" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_update_local_purchases" ON "public"."local_purchases" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_update_materials" ON "public"."materials" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"]))))));



ALTER TABLE "public"."attendance_expense_sync" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_insert" ON "public"."audit_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "audit_log_select" ON "public"."audit_log" FOR SELECT USING ("public"."is_admin"());



ALTER TABLE "public"."building_sections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "building_sections_delete" ON "public"."building_sections" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "building_sections_insert" ON "public"."building_sections" FOR INSERT WITH CHECK (("public"."is_admin"() AND "public"."can_access_site"("site_id")));



CREATE POLICY "building_sections_select" ON "public"."building_sections" FOR SELECT USING ("public"."can_access_site"("site_id"));



CREATE POLICY "building_sections_update" ON "public"."building_sections" FOR UPDATE USING (("public"."is_admin"() OR (("public"."get_user_role"() = 'office'::"public"."user_role") AND "public"."can_access_site"("site_id"))));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_delete" ON "public"."clients" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "clients_insert" ON "public"."clients" FOR INSERT WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



CREATE POLICY "clients_select" ON "public"."clients" FOR SELECT USING (true);



CREATE POLICY "clients_update" ON "public"."clients" FOR UPDATE USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



CREATE POLICY "contract_milestones_delete" ON "public"."subcontract_milestones" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "contract_milestones_insert" ON "public"."subcontract_milestones" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "contract_milestones_select" ON "public"."subcontract_milestones" FOR SELECT USING (true);



CREATE POLICY "contract_milestones_update" ON "public"."subcontract_milestones" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "contract_payments_delete" ON "public"."subcontract_payments" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "contract_payments_insert" ON "public"."subcontract_payments" FOR INSERT WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



CREATE POLICY "contract_payments_select" ON "public"."subcontract_payments" FOR SELECT USING (true);



CREATE POLICY "contract_payments_update" ON "public"."subcontract_payments" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "contract_sections_delete" ON "public"."subcontract_sections" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "contract_sections_insert" ON "public"."subcontract_sections" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "contract_sections_select" ON "public"."subcontract_sections" FOR SELECT USING (true);



CREATE POLICY "contract_sections_update" ON "public"."subcontract_sections" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "contracts_delete" ON "public"."subcontracts" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "contracts_insert" ON "public"."subcontracts" FOR INSERT WITH CHECK (("public"."is_admin"() AND "public"."can_access_site"("site_id")));



CREATE POLICY "contracts_select" ON "public"."subcontracts" FOR SELECT USING ("public"."can_access_site"("site_id"));



CREATE POLICY "contracts_update" ON "public"."subcontracts" FOR UPDATE USING (("public"."is_admin"() AND "public"."can_access_site"("site_id")));



ALTER TABLE "public"."daily_attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "daily_logs_delete" ON "public"."daily_logs" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "daily_logs_insert" ON "public"."daily_logs" FOR INSERT WITH CHECK ("public"."can_access_site"("site_id"));



CREATE POLICY "daily_logs_select" ON "public"."daily_logs" FOR SELECT USING ("public"."can_access_site"("site_id"));



CREATE POLICY "daily_logs_update" ON "public"."daily_logs" FOR UPDATE USING ("public"."can_access_site"("site_id"));



ALTER TABLE "public"."daily_material_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_work_summary" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deletion_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deletion_requests_delete" ON "public"."deletion_requests" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "deletion_requests_insert" ON "public"."deletion_requests" FOR INSERT WITH CHECK (true);



CREATE POLICY "deletion_requests_select" ON "public"."deletion_requests" FOR SELECT USING (("public"."is_admin"() OR ("requested_by" = "public"."get_current_user_id"())));



CREATE POLICY "deletion_requests_update" ON "public"."deletion_requests" FOR UPDATE USING ("public"."is_admin"());



ALTER TABLE "public"."deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delivery_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."engineer_reimbursements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."engineer_wallet_batch_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expense_categories_delete" ON "public"."expense_categories" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "expense_categories_insert" ON "public"."expense_categories" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "expense_categories_select" ON "public"."expense_categories" FOR SELECT USING (true);



CREATE POLICY "expense_categories_update" ON "public"."expense_categories" FOR UPDATE USING ("public"."is_admin"());



ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_delete" ON "public"."expenses" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "expenses_insert" ON "public"."expenses" FOR INSERT WITH CHECK ((("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role", 'site_engineer'::"public"."user_role"])) AND (("site_id" IS NULL) OR "public"."can_access_site"("site_id"))));



CREATE POLICY "expenses_select" ON "public"."expenses" FOR SELECT USING ((("site_id" IS NULL) OR "public"."can_access_site"("site_id")));



CREATE POLICY "expenses_update" ON "public"."expenses" FOR UPDATE USING ((("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])) AND (("site_id" IS NULL) OR "public"."can_access_site"("site_id"))));



ALTER TABLE "public"."group_stock_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_stock_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_logs_insert" ON "public"."import_logs" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "import_logs_select" ON "public"."import_logs" FOR SELECT USING (("public"."is_admin"() OR ("imported_by" = "public"."get_current_user_id"())));



ALTER TABLE "public"."inter_site_material_settlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inter_site_settlement_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inter_site_settlement_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."labor_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "labor_categories_delete" ON "public"."labor_categories" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "labor_categories_insert" ON "public"."labor_categories" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "labor_categories_select" ON "public"."labor_categories" FOR SELECT USING (true);



CREATE POLICY "labor_categories_update" ON "public"."labor_categories" FOR UPDATE USING ("public"."is_admin"());



ALTER TABLE "public"."labor_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."labor_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "labor_roles_delete" ON "public"."labor_roles" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "labor_roles_insert" ON "public"."labor_roles" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "labor_roles_select" ON "public"."labor_roles" FOR SELECT USING (true);



CREATE POLICY "labor_roles_update" ON "public"."labor_roles" FOR UPDATE USING ("public"."is_admin"());



ALTER TABLE "public"."laborer_site_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "laborer_site_assignments_delete" ON "public"."laborer_site_assignments" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "laborer_site_assignments_insert" ON "public"."laborer_site_assignments" FOR INSERT WITH CHECK ((("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])) AND "public"."can_access_site"("site_id")));



CREATE POLICY "laborer_site_assignments_select" ON "public"."laborer_site_assignments" FOR SELECT USING ("public"."can_access_site"("site_id"));



CREATE POLICY "laborer_site_assignments_update" ON "public"."laborer_site_assignments" FOR UPDATE USING ((("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])) AND "public"."can_access_site"("site_id")));



ALTER TABLE "public"."laborers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "laborers_delete" ON "public"."laborers" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "laborers_insert" ON "public"."laborers" FOR INSERT WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



CREATE POLICY "laborers_select" ON "public"."laborers" FOR SELECT USING (true);



CREATE POLICY "laborers_update" ON "public"."laborers" FOR UPDATE USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



ALTER TABLE "public"."local_purchase_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."local_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."market_laborer_attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_brands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_request_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_vendors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_delete" ON "public"."notifications" FOR DELETE USING ((("user_id" = "public"."get_current_user_id"()) OR "public"."is_admin"()));



CREATE POLICY "notifications_insert" ON "public"."notifications" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "notifications_select" ON "public"."notifications" FOR SELECT USING ((("user_id" = "public"."get_current_user_id"()) OR "public"."is_admin"()));



CREATE POLICY "notifications_update" ON "public"."notifications" FOR UPDATE USING (("user_id" = "public"."get_current_user_id"()));



ALTER TABLE "public"."payment_week_allocations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_change_reasons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_payment_allocations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."salary_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salary_payments_delete" ON "public"."salary_payments" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "salary_payments_insert" ON "public"."salary_payments" FOR INSERT WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



CREATE POLICY "salary_payments_select" ON "public"."salary_payments" FOR SELECT USING (true);



CREATE POLICY "salary_payments_update" ON "public"."salary_payments" FOR UPDATE USING ("public"."is_admin"());



ALTER TABLE "public"."salary_periods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salary_periods_delete" ON "public"."salary_periods" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "salary_periods_insert" ON "public"."salary_periods" FOR INSERT WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



CREATE POLICY "salary_periods_select" ON "public"."salary_periods" FOR SELECT USING (true);



CREATE POLICY "salary_periods_update" ON "public"."salary_periods" FOR UPDATE USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



ALTER TABLE "public"."settlement_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "site_clients_delete" ON "public"."site_clients" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "site_clients_insert" ON "public"."site_clients" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "site_clients_select" ON "public"."site_clients" FOR SELECT USING ("public"."can_access_site"("site_id"));



CREATE POLICY "site_clients_update" ON "public"."site_clients" FOR UPDATE USING ("public"."is_admin"());



ALTER TABLE "public"."site_engineer_settlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_engineer_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_holidays" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "site_holidays_delete" ON "public"."site_holidays" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "site_holidays_insert" ON "public"."site_holidays" FOR INSERT WITH CHECK ((("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])) AND "public"."can_access_site"("site_id")));



CREATE POLICY "site_holidays_select" ON "public"."site_holidays" FOR SELECT USING ("public"."can_access_site"("site_id"));



CREATE POLICY "site_holidays_update" ON "public"."site_holidays" FOR UPDATE USING ((("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])) AND "public"."can_access_site"("site_id")));



ALTER TABLE "public"."site_material_budgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_payers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sites_delete" ON "public"."sites" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "sites_insert" ON "public"."sites" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "sites_select" ON "public"."sites" FOR SELECT USING ("public"."can_access_site"("id"));



CREATE POLICY "sites_update" ON "public"."sites" FOR UPDATE USING (("public"."is_admin"() OR (("public"."get_user_role"() = 'office'::"public"."user_role") AND "public"."can_access_site"("id"))));



ALTER TABLE "public"."stock_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_transfer_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_transfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subcontract_milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subcontract_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subcontract_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subcontracts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tea_shop_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tea_shop_accounts_delete" ON "public"."tea_shop_accounts" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "tea_shop_accounts_insert" ON "public"."tea_shop_accounts" FOR INSERT WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



CREATE POLICY "tea_shop_accounts_select" ON "public"."tea_shop_accounts" FOR SELECT USING ((("site_id" IS NULL) OR "public"."can_access_site"("site_id")));



CREATE POLICY "tea_shop_accounts_update" ON "public"."tea_shop_accounts" FOR UPDATE USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



ALTER TABLE "public"."tea_shop_clearances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tea_shop_clearances_delete" ON "public"."tea_shop_clearances" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "tea_shop_clearances_insert" ON "public"."tea_shop_clearances" FOR INSERT WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



CREATE POLICY "tea_shop_clearances_select" ON "public"."tea_shop_clearances" FOR SELECT USING (true);



CREATE POLICY "tea_shop_clearances_update" ON "public"."tea_shop_clearances" FOR UPDATE USING ("public"."is_admin"());



ALTER TABLE "public"."tea_shop_consumption_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tea_shop_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tea_shop_entries_delete" ON "public"."tea_shop_entries" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "tea_shop_entries_insert" ON "public"."tea_shop_entries" FOR INSERT WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role", 'site_engineer'::"public"."user_role"])));



CREATE POLICY "tea_shop_entries_select" ON "public"."tea_shop_entries" FOR SELECT USING ((("site_id" IS NULL) OR "public"."can_access_site"("site_id")));



CREATE POLICY "tea_shop_entries_update" ON "public"."tea_shop_entries" FOR UPDATE USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



ALTER TABLE "public"."tea_shop_settlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_salary_summaries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_salary_summaries_delete" ON "public"."team_salary_summaries" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "team_salary_summaries_insert" ON "public"."team_salary_summaries" FOR INSERT WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



CREATE POLICY "team_salary_summaries_select" ON "public"."team_salary_summaries" FOR SELECT USING (true);



CREATE POLICY "team_salary_summaries_update" ON "public"."team_salary_summaries" FOR UPDATE USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teams_delete" ON "public"."teams" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "teams_insert" ON "public"."teams" FOR INSERT WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



CREATE POLICY "teams_select" ON "public"."teams" FOR SELECT USING (true);



CREATE POLICY "teams_update" ON "public"."teams" FOR UPDATE USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_delete" ON "public"."users" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "users_insert" ON "public"."users" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "users_select" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "users_update" ON "public"."users" FOR UPDATE USING (("public"."is_admin"() OR ("id" = "public"."get_current_user_id"())));



ALTER TABLE "public"."vendor_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendor_material_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendor_price_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendors" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_deletion"("p_request_id" "uuid", "p_reviewed_by" "uuid", "p_review_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_deletion"("p_request_id" "uuid", "p_reviewed_by" "uuid", "p_review_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_deletion"("p_request_id" "uuid", "p_reviewed_by" "uuid", "p_review_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_settlement"("p_settlement_id" "uuid", "p_approved_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_settlement"("p_settlement_id" "uuid", "p_approved_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_settlement"("p_settlement_id" "uuid", "p_approved_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_create_site_sections"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_create_site_sections"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_create_site_sections"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_material_weight"("p_material_id" "uuid", "p_quantity" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_material_weight"("p_material_id" "uuid", "p_quantity" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_material_weight"("p_material_id" "uuid", "p_quantity" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_milestone_amount"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_milestone_amount"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_milestone_amount"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_salary_period"("p_laborer_id" "uuid", "p_week_ending" "date", "p_calculated_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_salary_period"("p_laborer_id" "uuid", "p_week_ending" "date", "p_calculated_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_salary_period"("p_laborer_id" "uuid", "p_week_ending" "date", "p_calculated_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_site"("p_site_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_site"("p_site_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_site"("p_site_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_site_use_batch"("p_site_id" "uuid", "p_inventory_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_site_use_batch"("p_site_id" "uuid", "p_inventory_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_site_use_batch"("p_site_id" "uuid", "p_inventory_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_settlement"("p_settlement_id" "uuid", "p_cancelled_by" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_settlement"("p_settlement_id" "uuid", "p_cancelled_by" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_settlement"("p_settlement_id" "uuid", "p_cancelled_by" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_low_stock_alerts"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_low_stock_alerts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_low_stock_alerts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_material_parent_level"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_material_parent_level"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_material_parent_level"() TO "service_role";



GRANT ALL ON FUNCTION "public"."copy_default_sections_to_site"("p_site_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."copy_default_sections_to_site"("p_site_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."copy_default_sections_to_site"("p_site_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_audit_log"("p_table_name" character varying, "p_record_id" "uuid", "p_action" "public"."audit_action", "p_old_data" "jsonb", "p_new_data" "jsonb", "p_changed_by" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_audit_log"("p_table_name" character varying, "p_record_id" "uuid", "p_action" "public"."audit_action", "p_old_data" "jsonb", "p_new_data" "jsonb", "p_changed_by" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_audit_log"("p_table_name" character varying, "p_record_id" "uuid", "p_action" "public"."audit_action", "p_old_data" "jsonb", "p_new_data" "jsonb", "p_changed_by" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_local_purchase_reimbursement"("p_purchase_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_local_purchase_reimbursement"("p_purchase_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_local_purchase_reimbursement"("p_purchase_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_weekly_settlement"("p_site_group_id" "uuid", "p_from_site_id" "uuid", "p_to_site_id" "uuid", "p_year" integer, "p_week" integer, "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_weekly_settlement"("p_site_group_id" "uuid", "p_from_site_id" "uuid", "p_to_site_id" "uuid", "p_year" integer, "p_week" integer, "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_weekly_settlement"("p_site_group_id" "uuid", "p_from_site_id" "uuid", "p_to_site_id" "uuid", "p_year" integer, "p_week" integer, "p_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."dedicate_batch_to_site"("p_inventory_id" "uuid", "p_site_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."dedicate_batch_to_site"("p_inventory_id" "uuid", "p_site_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dedicate_batch_to_site"("p_inventory_id" "uuid", "p_site_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_engineer_transaction"("p_transaction_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_engineer_transaction"("p_transaction_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_engineer_transaction"("p_transaction_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_batch_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_batch_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_batch_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_batch_code"("p_payer_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_batch_code"("p_payer_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_batch_code"("p_payer_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_grn_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_grn_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_grn_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_local_purchase_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_local_purchase_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_local_purchase_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_mr_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_mr_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_mr_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_payment_reference"("p_site_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_payment_reference"("p_site_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_payment_reference"("p_site_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_po_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_po_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_po_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_settlement_code"("p_year" integer, "p_week" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_settlement_code"("p_year" integer, "p_week" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_settlement_code"("p_year" integer, "p_week" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_settlement_reference"("p_site_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_settlement_reference"("p_site_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_settlement_reference"("p_site_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_tea_shop_settlement_reference"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_tea_shop_settlement_reference"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_tea_shop_settlement_reference"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_transfer_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_transfer_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_transfer_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_weekly_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_weekly_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_weekly_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_batch_settlement_summary"("batch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_batch_settlement_summary"("batch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_batch_settlement_summary"("batch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_material_count_for_vendor"("p_vendor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_material_count_for_vendor"("p_vendor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_material_count_for_vendor"("p_vendor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_materials_with_variants"("p_category_id" "uuid", "p_include_inactive" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_materials_with_variants"("p_category_id" "uuid", "p_include_inactive" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_materials_with_variants"("p_category_id" "uuid", "p_include_inactive" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_report"("p_site_id" "uuid", "p_year" integer, "p_month" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_report"("p_site_id" "uuid", "p_year" integer, "p_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_report"("p_site_id" "uuid", "p_year" integer, "p_month" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_settlement_batch_sources"("p_settlement_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_settlement_batch_sources"("p_settlement_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_settlement_batch_sources"("p_settlement_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_settlement_laborers"("p_settlement_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_settlement_laborers"("p_settlement_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_settlement_laborers"("p_settlement_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_site_dashboard"("p_site_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_site_dashboard"("p_site_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_site_dashboard"("p_site_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_site_dashboard_detailed"("p_site_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_site_dashboard_detailed"("p_site_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_site_dashboard_detailed"("p_site_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_team_weekly_summary"("p_team_id" "uuid", "p_week_ending" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_weekly_summary"("p_team_id" "uuid", "p_week_ending" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_weekly_summary"("p_team_id" "uuid", "p_week_ending" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unsettled_balance"("p_site_group_id" "uuid", "p_from_site_id" "uuid", "p_to_site_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unsettled_balance"("p_site_group_id" "uuid", "p_from_site_id" "uuid", "p_to_site_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unsettled_balance"("p_site_group_id" "uuid", "p_from_site_id" "uuid", "p_to_site_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_vendor_count_for_material"("p_material_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_vendor_count_for_material"("p_material_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_vendor_count_for_material"("p_material_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_week_attendance_summary"("p_site_id" "uuid", "p_week_ending" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_week_attendance_summary"("p_site_id" "uuid", "p_week_ending" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_week_attendance_summary"("p_site_id" "uuid", "p_week_ending" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_engineer_delivery_pending"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_engineer_delivery_pending"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_engineer_delivery_pending"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_attendance_before_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_attendance_before_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_attendance_before_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_attendance_before_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_attendance_before_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_attendance_before_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_local_purchase_stock"("p_purchase_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_local_purchase_stock"("p_purchase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_local_purchase_stock"("p_purchase_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rebuild_tea_shop_waterfall"("p_tea_shop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rebuild_tea_shop_waterfall"("p_tea_shop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rebuild_tea_shop_waterfall"("p_tea_shop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_price_entry"("p_vendor_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_price" numeric, "p_price_includes_gst" boolean, "p_gst_rate" numeric, "p_transport_cost" numeric, "p_loading_cost" numeric, "p_unloading_cost" numeric, "p_source" "text", "p_source_reference" "text", "p_quantity" numeric, "p_unit" "text", "p_user_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_price_entry"("p_vendor_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_price" numeric, "p_price_includes_gst" boolean, "p_gst_rate" numeric, "p_transport_cost" numeric, "p_loading_cost" numeric, "p_unloading_cost" numeric, "p_source" "text", "p_source_reference" "text", "p_quantity" numeric, "p_unit" "text", "p_user_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_price_entry"("p_vendor_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_price" numeric, "p_price_includes_gst" boolean, "p_gst_rate" numeric, "p_transport_cost" numeric, "p_loading_cost" numeric, "p_unloading_cost" numeric, "p_source" "text", "p_source_reference" "text", "p_quantity" numeric, "p_unit" "text", "p_user_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_price_from_po_item"() TO "anon";
GRANT ALL ON FUNCTION "public"."record_price_from_po_item"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_price_from_po_item"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_price_with_reason"("p_material_id" "uuid", "p_vendor_id" "uuid", "p_brand_id" "uuid", "p_price" numeric, "p_recorded_date" "date", "p_source" "text", "p_change_reason_id" "uuid", "p_change_reason_text" "text", "p_bill_url" "text", "p_bill_number" "text", "p_bill_date" "date", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_price_with_reason"("p_material_id" "uuid", "p_vendor_id" "uuid", "p_brand_id" "uuid", "p_price" numeric, "p_recorded_date" "date", "p_source" "text", "p_change_reason_id" "uuid", "p_change_reason_text" "text", "p_bill_url" "text", "p_bill_number" "text", "p_bill_date" "date", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_price_with_reason"("p_material_id" "uuid", "p_vendor_id" "uuid", "p_brand_id" "uuid", "p_price" numeric, "p_recorded_date" "date", "p_source" "text", "p_change_reason_id" "uuid", "p_change_reason_text" "text", "p_bill_url" "text", "p_bill_number" "text", "p_bill_date" "date", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_settlement_payment"("p_settlement_id" "uuid", "p_amount" numeric, "p_payment_mode" "text", "p_reference_number" "text", "p_recorded_by" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_settlement_payment"("p_settlement_id" "uuid", "p_amount" numeric, "p_payment_mode" "text", "p_reference_number" "text", "p_recorded_by" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_settlement_payment"("p_settlement_id" "uuid", "p_amount" numeric, "p_payment_mode" "text", "p_reference_number" "text", "p_recorded_by" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_deletion"("p_request_id" "uuid", "p_reviewed_by" "uuid", "p_review_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_deletion"("p_request_id" "uuid", "p_reviewed_by" "uuid", "p_review_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_deletion"("p_request_id" "uuid", "p_reviewed_by" "uuid", "p_review_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."request_deletion"("p_table_name" character varying, "p_record_id" "uuid", "p_requested_by" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."request_deletion"("p_table_name" character varying, "p_record_id" "uuid", "p_requested_by" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_deletion"("p_table_name" character varying, "p_record_id" "uuid", "p_requested_by" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_laborer_daily_rate"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_laborer_daily_rate"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_laborer_daily_rate"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_local_purchase_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_local_purchase_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_local_purchase_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_process_local_purchase_stock"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_process_local_purchase_stock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_process_local_purchase_stock"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_tea_shop_entry_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_tea_shop_entry_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_tea_shop_entry_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_tea_shop_settlement_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_tea_shop_settlement_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_tea_shop_settlement_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unlock_batch_for_sharing"("p_inventory_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."unlock_batch_for_sharing"("p_inventory_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unlock_batch_for_sharing"("p_inventory_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_advance_deduction_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_advance_deduction_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_advance_deduction_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_contract_after_payment"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_contract_after_payment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_contract_after_payment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_daily_work_summary_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_daily_work_summary_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_daily_work_summary_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_group_stock_on_daily_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_group_stock_on_daily_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_group_stock_on_daily_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_group_stock_on_purchase"("p_group_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_quantity" numeric, "p_unit_cost" numeric, "p_payment_source" "text", "p_payment_site_id" "uuid", "p_reference_type" "text", "p_reference_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_group_stock_on_purchase"("p_group_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_quantity" numeric, "p_unit_cost" numeric, "p_payment_source" "text", "p_payment_site_id" "uuid", "p_reference_type" "text", "p_reference_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_group_stock_on_purchase"("p_group_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_quantity" numeric, "p_unit_cost" numeric, "p_payment_source" "text", "p_payment_site_id" "uuid", "p_reference_type" "text", "p_reference_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_group_stock_on_purchase"("p_site_group_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_location_id" "uuid", "p_quantity" numeric, "p_unit_cost" numeric, "p_payment_source" "text", "p_payment_source_site_id" "uuid", "p_reference_type" "text", "p_reference_id" "uuid", "p_is_dedicated" boolean, "p_dedicated_site_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_group_stock_on_purchase"("p_site_group_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_location_id" "uuid", "p_quantity" numeric, "p_unit_cost" numeric, "p_payment_source" "text", "p_payment_source_site_id" "uuid", "p_reference_type" "text", "p_reference_id" "uuid", "p_is_dedicated" boolean, "p_dedicated_site_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_group_stock_on_purchase"("p_site_group_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_location_id" "uuid", "p_quantity" numeric, "p_unit_cost" numeric, "p_payment_source" "text", "p_payment_source_site_id" "uuid", "p_reference_type" "text", "p_reference_id" "uuid", "p_is_dedicated" boolean, "p_dedicated_site_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_group_stock_on_usage"("p_site_group_id" "uuid", "p_inventory_id" "uuid", "p_quantity" numeric, "p_usage_site_id" "uuid", "p_work_description" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_group_stock_on_usage"("p_site_group_id" "uuid", "p_inventory_id" "uuid", "p_quantity" numeric, "p_usage_site_id" "uuid", "p_work_description" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_group_stock_on_usage"("p_site_group_id" "uuid", "p_inventory_id" "uuid", "p_quantity" numeric, "p_usage_site_id" "uuid", "p_work_description" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_group_stock_on_usage"("p_group_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_quantity" numeric, "p_usage_site_id" "uuid", "p_work_description" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_group_stock_on_usage"("p_group_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_quantity" numeric, "p_usage_site_id" "uuid", "p_work_description" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_group_stock_on_usage"("p_group_id" "uuid", "p_material_id" "uuid", "p_brand_id" "uuid", "p_quantity" numeric, "p_usage_site_id" "uuid", "p_work_description" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_po_status_on_delivery"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_po_status_on_delivery"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_po_status_on_delivery"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_salary_period_after_payment"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_salary_period_after_payment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_salary_period_after_payment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_settlement_groups_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_settlement_groups_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_settlement_groups_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_site_payers_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_site_payers_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_site_payers_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_stock_on_delivery"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_stock_on_delivery"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_stock_on_delivery"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_stock_on_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_stock_on_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_stock_on_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_stock_on_verified_delivery"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_stock_on_verified_delivery"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_stock_on_verified_delivery"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tea_shop_accounts_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tea_shop_accounts_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tea_shop_accounts_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tea_shop_consumption_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tea_shop_consumption_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tea_shop_consumption_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tea_shop_entries_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tea_shop_entries_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tea_shop_entries_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tea_shop_settlements_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tea_shop_settlements_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tea_shop_settlements_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_delivery"("p_delivery_id" "uuid", "p_user_id" "uuid", "p_verification_photos" "text"[], "p_verification_notes" "text", "p_discrepancies" "jsonb", "p_verification_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_delivery"("p_delivery_id" "uuid", "p_user_id" "uuid", "p_verification_photos" "text"[], "p_verification_notes" "text", "p_discrepancies" "jsonb", "p_verification_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_delivery"("p_delivery_id" "uuid", "p_user_id" "uuid", "p_verification_photos" "text"[], "p_verification_notes" "text", "p_discrepancies" "jsonb", "p_verification_status" "text") TO "service_role";



GRANT ALL ON TABLE "public"."advances" TO "anon";
GRANT ALL ON TABLE "public"."advances" TO "authenticated";
GRANT ALL ON TABLE "public"."advances" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_expense_sync" TO "anon";
GRANT ALL ON TABLE "public"."attendance_expense_sync" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_expense_sync" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."building_sections" TO "anon";
GRANT ALL ON TABLE "public"."building_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."building_sections" TO "service_role";



GRANT ALL ON TABLE "public"."client_payment_plans" TO "anon";
GRANT ALL ON TABLE "public"."client_payment_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."client_payment_plans" TO "service_role";



GRANT ALL ON TABLE "public"."client_payments" TO "anon";
GRANT ALL ON TABLE "public"."client_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."client_payments" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."construction_phases" TO "anon";
GRANT ALL ON TABLE "public"."construction_phases" TO "authenticated";
GRANT ALL ON TABLE "public"."construction_phases" TO "service_role";



GRANT ALL ON TABLE "public"."construction_subphases" TO "anon";
GRANT ALL ON TABLE "public"."construction_subphases" TO "authenticated";
GRANT ALL ON TABLE "public"."construction_subphases" TO "service_role";



GRANT ALL ON TABLE "public"."daily_attendance" TO "anon";
GRANT ALL ON TABLE "public"."daily_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_attendance" TO "service_role";



GRANT ALL ON TABLE "public"."daily_logs" TO "anon";
GRANT ALL ON TABLE "public"."daily_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_logs" TO "service_role";



GRANT ALL ON TABLE "public"."daily_material_usage" TO "anon";
GRANT ALL ON TABLE "public"."daily_material_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_material_usage" TO "service_role";



GRANT ALL ON TABLE "public"."daily_work_summary" TO "anon";
GRANT ALL ON TABLE "public"."daily_work_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_work_summary" TO "service_role";



GRANT ALL ON TABLE "public"."default_building_sections" TO "anon";
GRANT ALL ON TABLE "public"."default_building_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."default_building_sections" TO "service_role";



GRANT ALL ON TABLE "public"."deletion_requests" TO "anon";
GRANT ALL ON TABLE "public"."deletion_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."deletion_requests" TO "service_role";



GRANT ALL ON TABLE "public"."deliveries" TO "anon";
GRANT ALL ON TABLE "public"."deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_items" TO "anon";
GRANT ALL ON TABLE "public"."delivery_items" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_items" TO "service_role";



GRANT ALL ON TABLE "public"."engineer_reimbursements" TO "anon";
GRANT ALL ON TABLE "public"."engineer_reimbursements" TO "authenticated";
GRANT ALL ON TABLE "public"."engineer_reimbursements" TO "service_role";



GRANT ALL ON TABLE "public"."engineer_wallet_batch_usage" TO "anon";
GRANT ALL ON TABLE "public"."engineer_wallet_batch_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."engineer_wallet_batch_usage" TO "service_role";



GRANT ALL ON TABLE "public"."expense_categories" TO "anon";
GRANT ALL ON TABLE "public"."expense_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_categories" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."group_stock_inventory" TO "anon";
GRANT ALL ON TABLE "public"."group_stock_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."group_stock_inventory" TO "service_role";



GRANT ALL ON TABLE "public"."group_stock_transactions" TO "anon";
GRANT ALL ON TABLE "public"."group_stock_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."group_stock_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."import_logs" TO "anon";
GRANT ALL ON TABLE "public"."import_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."import_logs" TO "service_role";



GRANT ALL ON TABLE "public"."inter_site_material_settlements" TO "anon";
GRANT ALL ON TABLE "public"."inter_site_material_settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."inter_site_material_settlements" TO "service_role";



GRANT ALL ON TABLE "public"."inter_site_settlement_items" TO "anon";
GRANT ALL ON TABLE "public"."inter_site_settlement_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inter_site_settlement_items" TO "service_role";



GRANT ALL ON TABLE "public"."inter_site_settlement_payments" TO "anon";
GRANT ALL ON TABLE "public"."inter_site_settlement_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."inter_site_settlement_payments" TO "service_role";



GRANT ALL ON TABLE "public"."labor_categories" TO "anon";
GRANT ALL ON TABLE "public"."labor_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."labor_categories" TO "service_role";



GRANT ALL ON TABLE "public"."labor_payments" TO "anon";
GRANT ALL ON TABLE "public"."labor_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."labor_payments" TO "service_role";



GRANT ALL ON TABLE "public"."labor_roles" TO "anon";
GRANT ALL ON TABLE "public"."labor_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."labor_roles" TO "service_role";



GRANT ALL ON TABLE "public"."laborer_site_assignments" TO "anon";
GRANT ALL ON TABLE "public"."laborer_site_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."laborer_site_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."laborers" TO "anon";
GRANT ALL ON TABLE "public"."laborers" TO "authenticated";
GRANT ALL ON TABLE "public"."laborers" TO "service_role";



GRANT ALL ON TABLE "public"."local_purchase_items" TO "anon";
GRANT ALL ON TABLE "public"."local_purchase_items" TO "authenticated";
GRANT ALL ON TABLE "public"."local_purchase_items" TO "service_role";



GRANT ALL ON TABLE "public"."local_purchases" TO "anon";
GRANT ALL ON TABLE "public"."local_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."local_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."market_laborer_attendance" TO "anon";
GRANT ALL ON TABLE "public"."market_laborer_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."market_laborer_attendance" TO "service_role";



GRANT ALL ON TABLE "public"."material_brands" TO "anon";
GRANT ALL ON TABLE "public"."material_brands" TO "authenticated";
GRANT ALL ON TABLE "public"."material_brands" TO "service_role";



GRANT ALL ON TABLE "public"."material_categories" TO "anon";
GRANT ALL ON TABLE "public"."material_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."material_categories" TO "service_role";



GRANT ALL ON TABLE "public"."material_request_items" TO "anon";
GRANT ALL ON TABLE "public"."material_request_items" TO "authenticated";
GRANT ALL ON TABLE "public"."material_request_items" TO "service_role";



GRANT ALL ON TABLE "public"."material_requests" TO "anon";
GRANT ALL ON TABLE "public"."material_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."material_requests" TO "service_role";



GRANT ALL ON TABLE "public"."material_vendors" TO "anon";
GRANT ALL ON TABLE "public"."material_vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."material_vendors" TO "service_role";



GRANT ALL ON TABLE "public"."materials" TO "anon";
GRANT ALL ON TABLE "public"."materials" TO "authenticated";
GRANT ALL ON TABLE "public"."materials" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."site_payers" TO "anon";
GRANT ALL ON TABLE "public"."site_payers" TO "authenticated";
GRANT ALL ON TABLE "public"."site_payers" TO "service_role";



GRANT ALL ON TABLE "public"."payer_expense_summary" TO "anon";
GRANT ALL ON TABLE "public"."payer_expense_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."payer_expense_summary" TO "service_role";



GRANT ALL ON TABLE "public"."payment_phases" TO "anon";
GRANT ALL ON TABLE "public"."payment_phases" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_phases" TO "service_role";



GRANT ALL ON TABLE "public"."payment_week_allocations" TO "anon";
GRANT ALL ON TABLE "public"."payment_week_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_week_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."price_change_reasons" TO "anon";
GRANT ALL ON TABLE "public"."price_change_reasons" TO "authenticated";
GRANT ALL ON TABLE "public"."price_change_reasons" TO "service_role";



GRANT ALL ON TABLE "public"."price_history" TO "anon";
GRANT ALL ON TABLE "public"."price_history" TO "authenticated";
GRANT ALL ON TABLE "public"."price_history" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_order_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_payment_allocations" TO "anon";
GRANT ALL ON TABLE "public"."purchase_payment_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_payment_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_payments" TO "anon";
GRANT ALL ON TABLE "public"."purchase_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_payments" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."salary_payments" TO "anon";
GRANT ALL ON TABLE "public"."salary_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."salary_payments" TO "service_role";



GRANT ALL ON TABLE "public"."salary_periods" TO "anon";
GRANT ALL ON TABLE "public"."salary_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."salary_periods" TO "service_role";



GRANT ALL ON TABLE "public"."settlement_groups" TO "anon";
GRANT ALL ON TABLE "public"."settlement_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."settlement_groups" TO "service_role";



GRANT ALL ON TABLE "public"."site_clients" TO "anon";
GRANT ALL ON TABLE "public"."site_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."site_clients" TO "service_role";



GRANT ALL ON TABLE "public"."site_engineer_settlements" TO "anon";
GRANT ALL ON TABLE "public"."site_engineer_settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."site_engineer_settlements" TO "service_role";



GRANT ALL ON TABLE "public"."site_engineer_transactions" TO "anon";
GRANT ALL ON TABLE "public"."site_engineer_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."site_engineer_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."site_groups" TO "anon";
GRANT ALL ON TABLE "public"."site_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."site_groups" TO "service_role";



GRANT ALL ON TABLE "public"."site_holidays" TO "anon";
GRANT ALL ON TABLE "public"."site_holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."site_holidays" TO "service_role";



GRANT ALL ON TABLE "public"."site_material_budgets" TO "anon";
GRANT ALL ON TABLE "public"."site_material_budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."site_material_budgets" TO "service_role";



GRANT ALL ON TABLE "public"."site_payment_milestones" TO "anon";
GRANT ALL ON TABLE "public"."site_payment_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."site_payment_milestones" TO "service_role";



GRANT ALL ON TABLE "public"."sites" TO "anon";
GRANT ALL ON TABLE "public"."sites" TO "authenticated";
GRANT ALL ON TABLE "public"."sites" TO "service_role";



GRANT ALL ON TABLE "public"."stock_inventory" TO "anon";
GRANT ALL ON TABLE "public"."stock_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_inventory" TO "service_role";



GRANT ALL ON TABLE "public"."stock_locations" TO "anon";
GRANT ALL ON TABLE "public"."stock_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_locations" TO "service_role";



GRANT ALL ON TABLE "public"."stock_transactions" TO "anon";
GRANT ALL ON TABLE "public"."stock_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."stock_transfer_items" TO "anon";
GRANT ALL ON TABLE "public"."stock_transfer_items" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_transfer_items" TO "service_role";



GRANT ALL ON TABLE "public"."stock_transfers" TO "anon";
GRANT ALL ON TABLE "public"."stock_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_transfers" TO "service_role";



GRANT ALL ON TABLE "public"."subcontract_milestones" TO "anon";
GRANT ALL ON TABLE "public"."subcontract_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."subcontract_milestones" TO "service_role";



GRANT ALL ON TABLE "public"."subcontract_payments" TO "anon";
GRANT ALL ON TABLE "public"."subcontract_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."subcontract_payments" TO "service_role";



GRANT ALL ON TABLE "public"."subcontract_sections" TO "anon";
GRANT ALL ON TABLE "public"."subcontract_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."subcontract_sections" TO "service_role";



GRANT ALL ON TABLE "public"."subcontracts" TO "anon";
GRANT ALL ON TABLE "public"."subcontracts" TO "authenticated";
GRANT ALL ON TABLE "public"."subcontracts" TO "service_role";



GRANT ALL ON TABLE "public"."tea_shop_accounts" TO "anon";
GRANT ALL ON TABLE "public"."tea_shop_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."tea_shop_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."tea_shop_clearances" TO "anon";
GRANT ALL ON TABLE "public"."tea_shop_clearances" TO "authenticated";
GRANT ALL ON TABLE "public"."tea_shop_clearances" TO "service_role";



GRANT ALL ON TABLE "public"."tea_shop_consumption_details" TO "anon";
GRANT ALL ON TABLE "public"."tea_shop_consumption_details" TO "authenticated";
GRANT ALL ON TABLE "public"."tea_shop_consumption_details" TO "service_role";



GRANT ALL ON TABLE "public"."tea_shop_entries" TO "anon";
GRANT ALL ON TABLE "public"."tea_shop_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."tea_shop_entries" TO "service_role";



GRANT ALL ON TABLE "public"."tea_shop_settlement_allocations" TO "anon";
GRANT ALL ON TABLE "public"."tea_shop_settlement_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."tea_shop_settlement_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."tea_shop_settlements" TO "anon";
GRANT ALL ON TABLE "public"."tea_shop_settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."tea_shop_settlements" TO "service_role";



GRANT ALL ON TABLE "public"."team_salary_summaries" TO "anon";
GRANT ALL ON TABLE "public"."team_salary_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."team_salary_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."v_active_attendance" TO "anon";
GRANT ALL ON TABLE "public"."v_active_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."v_active_attendance" TO "service_role";



GRANT ALL ON TABLE "public"."v_all_expenses" TO "anon";
GRANT ALL ON TABLE "public"."v_all_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."v_all_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."v_batch_allocation_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_batch_allocation_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_batch_allocation_summary" TO "service_role";



GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";



GRANT ALL ON TABLE "public"."v_delivery_verification_details" TO "anon";
GRANT ALL ON TABLE "public"."v_delivery_verification_details" TO "authenticated";
GRANT ALL ON TABLE "public"."v_delivery_verification_details" TO "service_role";



GRANT ALL ON TABLE "public"."v_group_stock_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_group_stock_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_group_stock_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_group_usage_by_site" TO "anon";
GRANT ALL ON TABLE "public"."v_group_usage_by_site" TO "authenticated";
GRANT ALL ON TABLE "public"."v_group_usage_by_site" TO "service_role";



GRANT ALL ON TABLE "public"."v_inter_site_balance" TO "anon";
GRANT ALL ON TABLE "public"."v_inter_site_balance" TO "authenticated";
GRANT ALL ON TABLE "public"."v_inter_site_balance" TO "service_role";



GRANT ALL ON TABLE "public"."v_laborer_advance_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_laborer_advance_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_laborer_advance_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_local_purchases_details" TO "anon";
GRANT ALL ON TABLE "public"."v_local_purchases_details" TO "authenticated";
GRANT ALL ON TABLE "public"."v_local_purchases_details" TO "service_role";



GRANT ALL ON TABLE "public"."v_low_stock_alerts" TO "anon";
GRANT ALL ON TABLE "public"."v_low_stock_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."v_low_stock_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."v_material_usage_by_section" TO "anon";
GRANT ALL ON TABLE "public"."v_material_usage_by_section" TO "authenticated";
GRANT ALL ON TABLE "public"."v_material_usage_by_section" TO "service_role";



GRANT ALL ON TABLE "public"."vendor_inventory" TO "anon";
GRANT ALL ON TABLE "public"."vendor_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_inventory" TO "service_role";



GRANT ALL ON TABLE "public"."v_material_vendor_prices" TO "anon";
GRANT ALL ON TABLE "public"."v_material_vendor_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."v_material_vendor_prices" TO "service_role";



GRANT ALL ON TABLE "public"."v_materials_with_variants" TO "anon";
GRANT ALL ON TABLE "public"."v_materials_with_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."v_materials_with_variants" TO "service_role";



GRANT ALL ON TABLE "public"."v_pending_advances" TO "anon";
GRANT ALL ON TABLE "public"."v_pending_advances" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pending_advances" TO "service_role";



GRANT ALL ON TABLE "public"."v_pending_deletions" TO "anon";
GRANT ALL ON TABLE "public"."v_pending_deletions" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pending_deletions" TO "service_role";



GRANT ALL ON TABLE "public"."v_pending_delivery_verifications" TO "anon";
GRANT ALL ON TABLE "public"."v_pending_delivery_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pending_delivery_verifications" TO "service_role";



GRANT ALL ON TABLE "public"."v_pending_inter_site_settlements" TO "anon";
GRANT ALL ON TABLE "public"."v_pending_inter_site_settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pending_inter_site_settlements" TO "service_role";



GRANT ALL ON TABLE "public"."v_pending_purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."v_pending_purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pending_purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."v_pending_reimbursements" TO "anon";
GRANT ALL ON TABLE "public"."v_pending_reimbursements" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pending_reimbursements" TO "service_role";



GRANT ALL ON TABLE "public"."v_price_history_details" TO "anon";
GRANT ALL ON TABLE "public"."v_price_history_details" TO "authenticated";
GRANT ALL ON TABLE "public"."v_price_history_details" TO "service_role";



GRANT ALL ON TABLE "public"."v_price_trends" TO "anon";
GRANT ALL ON TABLE "public"."v_price_trends" TO "authenticated";
GRANT ALL ON TABLE "public"."v_price_trends" TO "service_role";



GRANT ALL ON TABLE "public"."v_salary_periods_detailed" TO "anon";
GRANT ALL ON TABLE "public"."v_salary_periods_detailed" TO "authenticated";
GRANT ALL ON TABLE "public"."v_salary_periods_detailed" TO "service_role";



GRANT ALL ON TABLE "public"."v_section_cost_by_role" TO "anon";
GRANT ALL ON TABLE "public"."v_section_cost_by_role" TO "authenticated";
GRANT ALL ON TABLE "public"."v_section_cost_by_role" TO "service_role";



GRANT ALL ON TABLE "public"."v_section_cost_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_section_cost_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_section_cost_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_settlement_details" TO "anon";
GRANT ALL ON TABLE "public"."v_settlement_details" TO "authenticated";
GRANT ALL ON TABLE "public"."v_settlement_details" TO "service_role";



GRANT ALL ON TABLE "public"."v_site_daily_by_category" TO "anon";
GRANT ALL ON TABLE "public"."v_site_daily_by_category" TO "authenticated";
GRANT ALL ON TABLE "public"."v_site_daily_by_category" TO "service_role";



GRANT ALL ON TABLE "public"."v_site_daily_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_site_daily_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_site_daily_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_site_eligible_batches" TO "anon";
GRANT ALL ON TABLE "public"."v_site_eligible_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."v_site_eligible_batches" TO "service_role";



GRANT ALL ON TABLE "public"."v_site_stock_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_site_stock_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_site_stock_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_stock_by_batch" TO "anon";
GRANT ALL ON TABLE "public"."v_stock_by_batch" TO "authenticated";
GRANT ALL ON TABLE "public"."v_stock_by_batch" TO "service_role";



GRANT ALL ON TABLE "public"."v_tea_shop_weekly" TO "anon";
GRANT ALL ON TABLE "public"."v_tea_shop_weekly" TO "authenticated";
GRANT ALL ON TABLE "public"."v_tea_shop_weekly" TO "service_role";



GRANT ALL ON TABLE "public"."v_team_weekly_by_role" TO "anon";
GRANT ALL ON TABLE "public"."v_team_weekly_by_role" TO "authenticated";
GRANT ALL ON TABLE "public"."v_team_weekly_by_role" TO "service_role";



GRANT ALL ON TABLE "public"."v_team_weekly_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_team_weekly_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_team_weekly_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_unread_notifications" TO "anon";
GRANT ALL ON TABLE "public"."v_unread_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."v_unread_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."v_vendor_inventory_details" TO "anon";
GRANT ALL ON TABLE "public"."v_vendor_inventory_details" TO "authenticated";
GRANT ALL ON TABLE "public"."v_vendor_inventory_details" TO "service_role";



GRANT ALL ON TABLE "public"."vendor_material_categories" TO "anon";
GRANT ALL ON TABLE "public"."vendor_material_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_material_categories" TO "service_role";



GRANT ALL ON TABLE "public"."vendor_price_history" TO "anon";
GRANT ALL ON TABLE "public"."vendor_price_history" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_price_history" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







