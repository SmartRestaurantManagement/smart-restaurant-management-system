-- Staff dashboard PIN gate. pin_hash is never readable by any client role,
-- not even its own owner - all access goes through SECURITY DEFINER
-- functions that hash/compare inside Postgres via pgcrypto, so the hash
-- itself never has to be transmitted to the browser in either direction.

create extension if not exists pgcrypto;

alter table public.profiles add column pin_hash text;

-- Sets/changes the caller's own PIN (4-6 digits).
create or replace function public.set_own_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be 4 to 6 digits';
  end if;

  update public.profiles
  set pin_hash = crypt(p_pin, gen_salt('bf'))
  where id = auth.uid();

  if not found then
    raise exception 'No profile found for the current user';
  end if;
end;
$$;

-- Verifies the caller's PIN against their own stored hash. Returns a plain
-- boolean either way (no distinct error for "no PIN set" vs "wrong PIN"),
-- so a caller can't use this to probe whether a PIN has been set.
create or replace function public.verify_own_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  select pin_hash into v_hash from public.profiles where id = auth.uid();
  if v_hash is null then
    return false;
  end if;
  return v_hash = crypt(p_pin, v_hash);
end;
$$;

-- Whether the caller has set a PIN yet - lets the dashboard gate branch
-- between "prompt to set a PIN" and "prompt to enter it" without ever
-- selecting pin_hash itself.
create or replace function public.has_own_pin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select pin_hash is not null from public.profiles where id = auth.uid()
$$;

-- Lock pin_hash down at the column-privilege level: no client role can
-- select or update it directly, through any query shape (including
-- existing `select('*')` call sites elsewhere in the app - PostgREST
-- builds its query against the caller's actual column grants, so those
-- simply stop returning this column, no application code changes needed).
-- Only the SECURITY DEFINER functions above (running as the functions'
-- owner) can still read/write it.
revoke select (pin_hash), update (pin_hash) on public.profiles from authenticated, anon;
