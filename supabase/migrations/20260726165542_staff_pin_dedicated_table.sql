-- Corrective migration: column-level REVOKE SELECT/UPDATE (pin_hash) on
-- public.profiles (see 20260726164912) was verified NOT to take effect in
-- this environment - direct client queries could still read and overwrite
-- pin_hash after that migration ran. Rather than keep fighting Postgres
-- column-ACL behavior that isn't being reliably enforced here, pin storage
-- moves to its own table that is never granted to anon/authenticated at
-- all, with RLS enabled and zero policies as a second, independent layer.
-- Only the SECURITY DEFINER functions below (running as the functions'
-- owner, which bypasses both the missing grant and RLS) can touch it.

create table public.staff_pins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_pins enable row level security;
revoke all on public.staff_pins from authenticated, anon;

-- Drop the now-unused, briefly-exposed column from the previous approach.
alter table public.profiles drop column if exists pin_hash;

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

  insert into public.staff_pins (user_id, pin_hash, updated_at)
  values (auth.uid(), crypt(p_pin, gen_salt('bf')), now())
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
end;
$$;

create or replace function public.verify_own_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
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

create or replace function public.has_own_pin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff_pins where user_id = auth.uid())
$$;
