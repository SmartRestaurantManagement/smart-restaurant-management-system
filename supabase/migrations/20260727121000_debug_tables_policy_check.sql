-- Temporary diagnostic: anon PATCH to public.tables succeeded despite the
-- tables_write policy requiring is_staff_or_admin(). This inspects live
-- policy/role state to find out why. Dropped by the very next migration.
create or replace function public.__debug_tables_rls()
returns jsonb
language sql
set search_path = public
as $$
  select jsonb_build_object(
    'policies', (
      select jsonb_agg(jsonb_build_object(
        'polname', pol.polname,
        'permissive', pol.polpermissive,
        'roles', pol.polroles::regrole[]::text[],
        'cmd', pol.polcmd,
        'qual', pg_get_expr(pol.polqual, pol.polrelid),
        'with_check', pg_get_expr(pol.polwithcheck, pol.polrelid)
      ))
      from pg_policy pol
      where pol.polrelid = 'public.tables'::regclass
    ),
    'rls_enabled', (select relrowsecurity from pg_class where oid = 'public.tables'::regclass),
    'rls_forced', (select relforcerowsecurity from pg_class where oid = 'public.tables'::regclass),
    'table_owner', (select pg_get_userbyid(relowner) from pg_class where oid = 'public.tables'::regclass),
    'current_role', current_role,
    'session_user', session_user,
    'current_user', current_user
  )
$$;

grant execute on function public.__debug_tables_rls() to anon, authenticated;
