-- Auto-create a profiles row whenever a new auth.users row is created,
-- whether via the real signUp() flow or via the Admin API (createUser).
-- Without this, every new signup had an auth.users row but no profile,
-- leaving current_restaurant_id()/current_user_role() permanently null
-- for that account (see auth-flow audit).
--
-- Single-tenant assumption for now: restaurant_id defaults to the first
-- restaurant unless raw_user_meta_data explicitly provides one. role
-- defaults to 'customer' (matching profiles.role's own column default)
-- unless raw_user_meta_data provides one - this lets admin-created
-- staff/test accounts pass their intended role, while real self-serve
-- signups (which never set this metadata) always land as customers.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_role public.user_role;
begin
  v_restaurant_id := coalesce(
    nullif(new.raw_user_meta_data->>'restaurant_id', '')::uuid,
    (select id from public.restaurants order by created_at limit 1)
  );

  v_role := coalesce(
    nullif(new.raw_user_meta_data->>'role', '')::public.user_role,
    'customer'
  );

  insert into public.profiles (id, restaurant_id, role, full_name)
  values (new.id, v_restaurant_id, v_role, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
