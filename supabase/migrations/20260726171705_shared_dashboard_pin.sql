-- Replaces the per-account PIN approach (staff_pins table + set_own_pin/
-- verify_own_pin/has_own_pin, from 20260726165542 and 20260726165820) with
-- a single shared PIN per restaurant, not tied to any profile. Dashboard
-- access no longer requires being logged in at all - the PIN alone gates
-- it. profiles.role stays in the schema for future analytics use, it just
-- no longer participates in gating dashboard access.

-- ---- drop the old per-account approach entirely ----
drop function if exists public.set_own_pin(text);
drop function if exists public.verify_own_pin(text);
drop function if exists public.has_own_pin();
drop table if exists public.staff_pins;

-- ---- new: one shared PIN per restaurant ----
-- Same lockdown pattern that worked for staff_pins: no grants to
-- anon/authenticated at all, RLS enabled with zero policies. Only the
-- SECURITY DEFINER functions below (running as their owner) can touch it.
create table public.restaurant_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  dashboard_pin_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.restaurant_settings enable row level security;
revoke all on public.restaurant_settings from authenticated, anon;

-- Sets/changes the shared dashboard PIN for "the" restaurant (this app is
-- single-tenant in practice right now - same first-restaurant convention
-- already used elsewhere, e.g. lib/api/restaurant.ts, the cart page).
-- Callable pre-login: the Next.js route calling this independently
-- requires the caller to already hold a valid unlock cookie, since knowing
-- the current PIN (not a login) is what authorizes changing it now.
create or replace function public.set_dashboard_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_restaurant_id uuid;
begin
  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be 4 to 6 digits';
  end if;

  select id into v_restaurant_id from public.restaurants order by created_at limit 1;
  if v_restaurant_id is null then
    raise exception 'No restaurant found';
  end if;

  insert into public.restaurant_settings (restaurant_id, dashboard_pin_hash, updated_at)
  values (v_restaurant_id, crypt(p_pin, gen_salt('bf')), now())
  on conflict (restaurant_id) do update
    set dashboard_pin_hash = excluded.dashboard_pin_hash, updated_at = now();
end;
$$;

-- Verifies a PIN against the shared hash. No user/session context needed -
-- this is exactly what makes pre-login gating possible.
create or replace function public.verify_dashboard_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select dashboard_pin_hash into v_hash
  from public.restaurant_settings
  order by created_at
  limit 1;

  if v_hash is null then
    return false;
  end if;

  return v_hash = crypt(p_pin, v_hash);
end;
$$;

-- Both must be callable by completely unauthenticated (anon) requests -
-- that's the entire point of removing the login requirement.
grant execute on function public.set_dashboard_pin(text) to anon, authenticated;
grant execute on function public.verify_dashboard_pin(text) to anon, authenticated;

-- Seed a default PIN for the existing restaurant so the gate is usable
-- immediately. CHANGE THIS after deploying - default is 1234.
-- (Schema-qualified crypt/gen_salt here since a plain DO block has no
-- search_path override like the functions above do - pgcrypto lives in
-- Supabase's `extensions` schema, not `public`.)
do $$
declare
  v_restaurant_id uuid;
begin
  select id into v_restaurant_id from public.restaurants order by created_at limit 1;
  if v_restaurant_id is not null then
    insert into public.restaurant_settings (restaurant_id, dashboard_pin_hash)
    values (v_restaurant_id, extensions.crypt('1234', extensions.gen_salt('bf')))
    on conflict (restaurant_id) do nothing;
  end if;
end $$;
