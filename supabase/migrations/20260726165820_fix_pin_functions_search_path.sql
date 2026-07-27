-- Corrective migration: set_own_pin/verify_own_pin failed at runtime with
-- "function gen_salt(unknown) does not exist" - pgcrypto is installed in
-- Supabase's dedicated `extensions` schema, not `public`, and these
-- functions' `set search_path = public` excluded it. Widen the search_path
-- to include it.

create or replace function public.set_own_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be 4 to 6 digits';
  end if;

  insert into public.staff_pins (user_id, pin_hash, updated_at)
  values (auth.uid(), crypt(p_pin, gen_salt('bf')), now())
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
end;
$$;

create or replace function public.verify_own_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select pin_hash into v_hash from public.staff_pins where user_id = auth.uid();
  if v_hash is null then
    return false;
  end if;
  return v_hash = crypt(p_pin, v_hash);
end;
$$;
