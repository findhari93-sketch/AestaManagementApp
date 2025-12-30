-- Audit: Find non-rounded settlement amounts and verify salary-only totals
-- Replace :site_id, :from_date, :to_date as needed

-- 1) Settlement groups with non-rounded totals (should be multiples of 100)
select id,
       settlement_reference,
       payment_type,
       settlement_date,
       total_amount
from settlement_groups
where site_id = ':site_id'
  and is_cancelled = false
  and total_amount % 100 <> 0
order by settlement_date asc;

-- 2) Labor payments with non-rounded amounts (contract only)
select id,
       payment_reference,
       actual_payment_date,
       amount,
       settlement_group_id
from labor_payments
where site_id = ':site_id'
  and is_under_contract = true
  and amount % 100 <> 0
order by actual_payment_date asc;

-- 3) Salary-only settlement totals in date range (exclude advances)
--    This should match the table Paid sum after our fix
select sum(sg.total_amount) as salary_settlements_total,
       count(*) as salary_settlement_count
from settlement_groups sg
where sg.site_id = ':site_id'
  and sg.is_cancelled = false
  and sg.payment_type <> 'advance'
  and sg.settlement_date between ':from_date' and ':to_date'
  and sg.id in (
    select distinct settlement_group_id
    from labor_payments lp
    where lp.site_id = ':site_id'
      and lp.is_under_contract = true
      and lp.settlement_group_id is not null
  );

-- 4) Advance totals in date range (for dashboard Advances Given)
select sum(sg.total_amount) as advances_total,
       count(*) as advance_settlement_count
from settlement_groups sg
where sg.site_id = ':site_id'
  and sg.is_cancelled = false
  and sg.payment_type = 'advance'
  and sg.settlement_date between ':from_date' and ':to_date';
