-- Lets a customer occupy a table when they select it for dine-in on the
-- customer menu. tables_write (20260725074821_restaurant_schema.sql) only
-- allows staff/admin to write to public.tables, so an anon/customer PATCH
-- to /api/tables/[id] is rejected by RLS - this SECURITY DEFINER RPC is the
-- narrow bypass, scoped to just flipping a table to 'occupied'. Same
-- pattern as the dashboard PIN functions in
-- 20260726171705_shared_dashboard_pin.sql.
create or replace function public.occupy_table(p_table_id uuid)
returns public.tables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_table public.tables;
begin
  -- current_restaurant_id() resolves via profiles.id = auth.uid(), which is
  -- null for anon customers - fall back to the single-tenant "first
  -- restaurant" convention used elsewhere (e.g. lib/api/restaurant.ts).
  v_restaurant_id := public.current_restaurant_id();
  if v_restaurant_id is null then
    select id into v_restaurant_id from public.restaurants order by created_at limit 1;
  end if;

  if v_restaurant_id is null then
    raise exception 'No restaurant found';
  end if;

  update public.tables
  set status = 'occupied'
  where id = p_table_id
    and restaurant_id = v_restaurant_id
  returning * into v_table;

  if v_table.id is null then
    raise exception 'Table not found';
  end if;

  return v_table;
end;
$$;

grant execute on function public.occupy_table(uuid) to anon, authenticated;
