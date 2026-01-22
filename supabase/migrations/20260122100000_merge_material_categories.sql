-- Migration: Merge Material Settlement and Material Purchasing into Material Expenses
-- Purpose: Consolidate the two material categories into one unified "Material Expenses" category
-- for consistency with the All Site Expenses view

DO $$
DECLARE
  v_new_id uuid;
  v_old_settlement_id uuid;
  v_old_purchasing_id uuid;
BEGIN
  -- Get old category IDs
  SELECT id INTO v_old_settlement_id FROM expense_categories
    WHERE name = 'Material Settlement' AND module = 'miscellaneous';
  SELECT id INTO v_old_purchasing_id FROM expense_categories
    WHERE name = 'Material Purchasing' AND module = 'miscellaneous';

  -- Insert new unified category
  INSERT INTO expense_categories (name, module, description, display_order, is_active, is_recurring)
  VALUES ('Material Expenses', 'miscellaneous',
          'Material purchases and settlements for this site', 3, true, false)
  RETURNING id INTO v_new_id;

  -- Migrate existing records to new category (if any exist)
  IF v_old_settlement_id IS NOT NULL OR v_old_purchasing_id IS NOT NULL THEN
    UPDATE misc_expenses
    SET category_id = v_new_id
    WHERE category_id IN (v_old_settlement_id, v_old_purchasing_id);
  END IF;

  -- Deactivate old categories (soft delete for data integrity)
  UPDATE expense_categories
  SET is_active = false
  WHERE id IN (v_old_settlement_id, v_old_purchasing_id);

  -- Adjust display_order for categories after the merged one
  -- (Rental was 5, now becomes 4; Tea & Snacks was 6, now becomes 5; etc.)
  UPDATE expense_categories
  SET display_order = display_order - 1
  WHERE module = 'miscellaneous'
    AND display_order > 4
    AND is_active = true;
END $$;
