-- Follow-up diagnostic: is the RLS-disabled state on public.tables/
-- public.ingredients isolated, or schema-wide? Read-only, dropped by the
-- very next migration.
create or replace function public.__debug_all_rls()
returns jsonb
language sql
set search_path = public
as $$
  select jsonb_agg(jsonb_build_object(
    'table', relname,
    'rls_enabled', relrowsecurity,
    'rls_forced', relforcerowsecurity
  ) order by relname)
  from pg_class
  where relnamespace = 'public'::regnamespace
    and relkind = 'r'
$$;

grant execute on function public.__debug_all_rls() to anon, authenticated;
