-- Pin search_path on get_site_supervisor_cost to satisfy Supabase
-- security linter (0011_function_search_path_mutable). Uses SET clause
-- so the function always resolves table names against public, regardless
-- of the caller's search_path.
create or replace function public.get_site_supervisor_cost(p_site_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(sp.amount), 0)::numeric
  from public.subcontract_payments sp
  join public.subcontracts s on s.id = sp.contract_id
  where s.site_id = p_site_id
    and s.contract_type = 'mesthri';
$$;

grant execute on function public.get_site_supervisor_cost(uuid) to authenticated;
