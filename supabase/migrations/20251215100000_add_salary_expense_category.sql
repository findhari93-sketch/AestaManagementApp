-- Add "Salary Settlement" expense category under "labor" module
-- This is required for the createSalaryExpense function to work
-- The function creates expense records when salary payments are made

-- Insert only if category doesn't already exist
INSERT INTO expense_categories (name, description, module, is_active, display_order)
SELECT 'Salary Settlement', 'Labor salary payments and settlements', 'labor', true, 1
WHERE NOT EXISTS (
    SELECT 1 FROM expense_categories WHERE name = 'Salary Settlement'
);

-- Also add a general "Labor" category as fallback
INSERT INTO expense_categories (name, description, module, is_active, display_order)
SELECT 'Labor', 'General labor expenses', 'labor', true, 2
WHERE NOT EXISTS (
    SELECT 1 FROM expense_categories WHERE name = 'Labor'
);
