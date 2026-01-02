alter table "public"."tea_shop_entries" drop constraint "tea_shop_entries_entry_mode_check";

alter table "public"."tea_shop_entries" add constraint "tea_shop_entries_entry_mode_check" CHECK (((entry_mode)::text = ANY ((ARRAY['simple'::character varying, 'detailed'::character varying])::text[]))) not valid;

alter table "public"."tea_shop_entries" validate constraint "tea_shop_entries_entry_mode_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.approve_deletion(p_request_id uuid, p_reviewed_by uuid, p_review_notes text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.auto_create_site_sections()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Copy default sections to new site
    PERFORM copy_default_sections_to_site(NEW.id);
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_milestone_amount()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_salary_period(p_laborer_id uuid, p_week_ending date, p_calculated_by uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.can_access_site(p_site_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.copy_default_sections_to_site(p_site_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_audit_log(p_table_name character varying, p_record_id uuid, p_action public.audit_action, p_old_data jsonb DEFAULT NULL::jsonb, p_new_data jsonb DEFAULT NULL::jsonb, p_changed_by uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_local_purchase_reimbursement(p_purchase_id uuid, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.generate_local_purchase_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.generate_payment_reference(p_site_id uuid)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.generate_settlement_reference(p_site_id uuid)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.generate_weekly_notifications()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_current_user_id()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id
    FROM users
    WHERE auth_id = auth.uid();
    
    RETURN v_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_material_count_for_vendor(p_vendor_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM vendor_inventory
    WHERE vendor_id = p_vendor_id
      AND is_available = TRUE
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_monthly_report(p_site_id uuid, p_year integer, p_month integer)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_site_dashboard(p_site_id uuid, p_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_site_dashboard_detailed(p_site_id uuid, p_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_team_weekly_summary(p_team_id uuid, p_week_ending date)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS public.user_role
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_role user_role;
BEGIN
    SELECT role INTO v_role
    FROM users
    WHERE auth_id = auth.uid();
    
    RETURN v_role;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_vendor_count_for_material(p_material_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT vendor_id)
    FROM vendor_inventory
    WHERE material_id = p_material_id
      AND is_available = TRUE
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_week_attendance_summary(p_site_id uuid, p_week_ending date)
 RETURNS TABLE(laborer_id uuid, laborer_name character varying, laborer_phone character varying, role_name character varying, category_name character varying, team_id uuid, team_name character varying, total_days numeric, total_earnings numeric, pending_advances numeric, extras numeric, net_payable numeric)
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN get_user_role() = 'admin';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_engineer_delivery_pending()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.process_attendance_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.process_attendance_before_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.process_local_purchase_stock(p_purchase_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.record_price_entry(p_vendor_id uuid, p_material_id uuid, p_brand_id uuid, p_price numeric, p_price_includes_gst boolean, p_gst_rate numeric, p_transport_cost numeric, p_loading_cost numeric, p_unloading_cost numeric, p_source text, p_source_reference text, p_quantity numeric, p_unit text, p_user_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.record_price_from_po_item()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.reject_deletion(p_request_id uuid, p_reviewed_by uuid, p_review_notes text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.request_deletion(p_table_name character varying, p_record_id uuid, p_requested_by uuid, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_laborer_daily_rate()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Only set if daily_rate is 0 or NULL
    IF NEW.daily_rate IS NULL OR NEW.daily_rate = 0 THEN
        SELECT default_daily_rate INTO NEW.daily_rate
        FROM labor_roles
        WHERE id = NEW.role_id;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_local_purchase_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.purchase_number IS NULL THEN
    NEW.purchase_number := generate_local_purchase_number();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_process_local_purchase_stock()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'completed' AND NEW.add_to_stock = TRUE AND NEW.stock_added = FALSE THEN
    PERFORM process_local_purchase_stock(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_advance_deduction_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_contract_after_payment()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Update milestone status if milestone payment
    IF NEW.milestone_id IS NOT NULL THEN
        UPDATE contract_milestones
        SET status = 'paid', updated_at = NOW()
        WHERE id = NEW.milestone_id;
    END IF;
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_daily_work_summary_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_group_stock_on_daily_usage()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_group_stock_on_purchase(p_group_id uuid, p_material_id uuid, p_brand_id uuid, p_quantity numeric, p_unit_cost numeric, p_payment_source text, p_payment_site_id uuid, p_reference_type text, p_reference_id uuid, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_group_stock_on_usage(p_group_id uuid, p_material_id uuid, p_brand_id uuid, p_quantity numeric, p_usage_site_id uuid, p_work_description text, p_reference_type text, p_reference_id uuid, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_salary_period_after_payment()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_stock_on_verified_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_tea_shop_accounts_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_tea_shop_consumption_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_tea_shop_entries_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_tea_shop_settlements_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_delivery(p_delivery_id uuid, p_user_id uuid, p_verification_photos text[], p_verification_notes text, p_discrepancies jsonb DEFAULT NULL::jsonb, p_verification_status text DEFAULT 'verified'::text)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
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
$function$
;


