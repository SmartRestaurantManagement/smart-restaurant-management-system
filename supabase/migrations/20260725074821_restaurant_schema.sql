-- Kaizen restaurant management schema
-- Multi-tenant: every table (except the tenant root `restaurants`) carries
-- restaurant_id and is scoped by Row-Level Security on that column.

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

create type public.user_role as enum ('customer', 'staff', 'admin');

create type public.order_status as enum (
  'pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'
);

create type public.table_status as enum ('free', 'occupied', 'reserved');

create type public.service_request_type as enum ('water', 'server', 'bill');

create type public.service_request_status as enum (
  'pending', 'in_progress', 'resolved', 'cancelled'
);

create type public.bill_split_method as enum ('none', 'equal', 'by_item', 'custom');

-- ============================================================================
-- TABLES
-- ============================================================================

-- restaurants: the tenant root. Not scoped by restaurant_id (it IS the tenant).
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- profiles: one row per auth.users member, always scoped to one restaurant.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  role public.user_role not null default 'customer',
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid references public.menu_categories (id) on delete set null,
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  is_available boolean not null default true,
  -- Live remaining-portion count derived from ingredient stock; null means
  -- the item has no linked recipe and is therefore not stock-tracked.
  remaining_stock integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  stock_qty numeric(12, 3) not null default 0,
  low_stock_threshold numeric(12, 3) not null default 0,
  unit_cost numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Join table driving both live menu-item availability and dish costing.
create table public.menu_item_ingredients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  qty_per_portion numeric(12, 3) not null check (qty_per_portion > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (menu_item_id, ingredient_id)
);

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_number integer not null,
  status public.table_status not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, table_number)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid references public.tables (id) on delete set null,
  session_id uuid not null default gen_random_uuid(),
  customer_id uuid references auth.users (id) on delete set null,
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid not null references public.menu_items (id) on delete restrict,
  qty integer not null check (qty > 0),
  price_at_order numeric(10, 2) not null check (price_at_order >= 0),
  customization_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  customer_id uuid references auth.users (id) on delete set null,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  table_id uuid references public.tables (id) on delete set null,
  reserved_for timestamptz not null,
  party_size integer not null check (party_size > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  total numeric(10, 2) not null check (total >= 0),
  split_method public.bill_split_method not null default 'none',
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid not null references public.tables (id) on delete cascade,
  type public.service_request_type not null,
  status public.service_request_status not null default 'pending',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.weather_cache (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  date date not null,
  forecast jsonb not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, date)
);

create table public.forecast_cache (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  forecast_date date not null,
  predicted_demand numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, menu_item_id, forecast_date)
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  discount_pct numeric(5, 2) not null check (discount_pct > 0 and discount_pct <= 100),
  floor_price numeric(10, 2) not null check (floor_price >= 0),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

create index idx_profiles_restaurant_id on public.profiles (restaurant_id);
create index idx_menu_categories_restaurant_id on public.menu_categories (restaurant_id);
create index idx_menu_items_restaurant_id on public.menu_items (restaurant_id);
create index idx_menu_items_category_id on public.menu_items (category_id);
create index idx_ingredients_restaurant_id on public.ingredients (restaurant_id);
create index idx_menu_item_ingredients_restaurant_id on public.menu_item_ingredients (restaurant_id);
create index idx_menu_item_ingredients_menu_item_id on public.menu_item_ingredients (menu_item_id);
create index idx_menu_item_ingredients_ingredient_id on public.menu_item_ingredients (ingredient_id);
create index idx_tables_restaurant_id on public.tables (restaurant_id);
create index idx_orders_restaurant_id on public.orders (restaurant_id);
create index idx_orders_table_id on public.orders (table_id);
create index idx_orders_customer_id on public.orders (customer_id);
create index idx_order_items_restaurant_id on public.order_items (restaurant_id);
create index idx_order_items_order_id on public.order_items (order_id);
create index idx_order_items_menu_item_id on public.order_items (menu_item_id);
create index idx_reservations_restaurant_id on public.reservations (restaurant_id);
create index idx_reservations_table_id on public.reservations (table_id);
create index idx_reservations_customer_id on public.reservations (customer_id);
create index idx_bills_restaurant_id on public.bills (restaurant_id);
create index idx_bills_order_id on public.bills (order_id);
create index idx_service_requests_restaurant_id on public.service_requests (restaurant_id);
create index idx_service_requests_table_id on public.service_requests (table_id);
create index idx_weather_cache_restaurant_id on public.weather_cache (restaurant_id);
create index idx_forecast_cache_restaurant_id on public.forecast_cache (restaurant_id);
create index idx_forecast_cache_menu_item_id on public.forecast_cache (menu_item_id);
create index idx_offers_restaurant_id on public.offers (restaurant_id);
create index idx_offers_menu_item_id on public.offers (menu_item_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Returns the restaurant_id of the currently authenticated user.
-- SECURITY DEFINER so it can read `profiles` even though profiles itself
-- has RLS enabled (the function runs as the table owner, which bypasses RLS).
create or replace function public.current_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('staff', 'admin'), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

-- Generic updated_at maintenance.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- updated_at TRIGGERS
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'restaurants', 'profiles', 'menu_categories', 'menu_items', 'ingredients',
    'menu_item_ingredients', 'tables', 'orders', 'order_items', 'reservations',
    'bills', 'service_requests', 'weather_cache', 'forecast_cache', 'offers'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end;
$$;

-- ============================================================================
-- LIVE STOCK: menu_items.remaining_stock derived from ingredient stock
-- ============================================================================

create or replace function public.recalc_menu_item_stock(p_menu_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_has_recipe boolean;
begin
  select
    exists (select 1 from public.menu_item_ingredients where menu_item_id = p_menu_item_id),
    floor(min(i.stock_qty / mii.qty_per_portion))::integer
  into v_has_recipe, v_stock
  from public.menu_item_ingredients mii
  join public.ingredients i on i.id = mii.ingredient_id
  where mii.menu_item_id = p_menu_item_id;

  update public.menu_items
  set remaining_stock = case
    when v_has_recipe then greatest(coalesce(v_stock, 0), 0)
    else null
  end
  where id = p_menu_item_id;
end;
$$;

create or replace function public.trg_recalc_stock_on_recipe_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.recalc_menu_item_stock(old.menu_item_id);
    return old;
  end if;

  perform public.recalc_menu_item_stock(new.menu_item_id);
  if TG_OP = 'UPDATE' and old.menu_item_id is distinct from new.menu_item_id then
    perform public.recalc_menu_item_stock(old.menu_item_id);
  end if;
  return new;
end;
$$;

create trigger recalc_stock_on_recipe_change
after insert or update or delete on public.menu_item_ingredients
for each row execute function public.trg_recalc_stock_on_recipe_change();

create or replace function public.trg_recalc_stock_on_ingredient_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select distinct menu_item_id
    from public.menu_item_ingredients
    where ingredient_id = new.id
  loop
    perform public.recalc_menu_item_stock(r.menu_item_id);
  end loop;
  return new;
end;
$$;

create trigger recalc_stock_on_ingredient_change
after update of stock_qty on public.ingredients
for each row
when (old.stock_qty is distinct from new.stock_qty)
execute function public.trg_recalc_stock_on_ingredient_change();

-- ============================================================================
-- DISH COSTING VIEW (menu_item_ingredients -> per-portion cost & margin)
-- ============================================================================

create view public.menu_item_costs
with (security_invoker = true) as
select
  mi.id as menu_item_id,
  mi.restaurant_id,
  mi.name as menu_item_name,
  mi.price,
  coalesce(sum(mii.qty_per_portion * i.unit_cost), 0)::numeric(10, 2) as cost_per_portion,
  (mi.price - coalesce(sum(mii.qty_per_portion * i.unit_cost), 0))::numeric(10, 2) as margin_per_portion
from public.menu_items mi
left join public.menu_item_ingredients mii on mii.menu_item_id = mi.id
left join public.ingredients i on i.id = mii.ingredient_id
group by mi.id, mi.restaurant_id, mi.name, mi.price;

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================

alter table public.restaurants enable row level security;
alter table public.profiles enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.ingredients enable row level security;
alter table public.menu_item_ingredients enable row level security;
alter table public.tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.reservations enable row level security;
alter table public.bills enable row level security;
alter table public.service_requests enable row level security;
alter table public.weather_cache enable row level security;
alter table public.forecast_cache enable row level security;
alter table public.offers enable row level security;

-- restaurants: readable by members, mutable by admins only.
-- No insert/delete policy is defined on purpose: tenant provisioning is a
-- privileged operation performed with the service_role key, which bypasses RLS.
create policy "restaurants_select" on public.restaurants
  for select using (id = public.current_restaurant_id());

create policy "restaurants_update" on public.restaurants
  for update using (id = public.current_restaurant_id() and public.is_admin())
  with check (id = public.current_restaurant_id() and public.is_admin());

-- profiles: a user always sees/edits their own row; restaurant members can
-- see each other; only admins can edit/remove other members' rows.
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or restaurant_id = public.current_restaurant_id());

create policy "profiles_insert" on public.profiles
  for insert with check (id = auth.uid());

create policy "profiles_update" on public.profiles
  for update using (
    id = auth.uid() or (restaurant_id = public.current_restaurant_id() and public.is_admin())
  )
  with check (
    id = auth.uid() or (restaurant_id = public.current_restaurant_id() and public.is_admin())
  );

create policy "profiles_delete" on public.profiles
  for delete using (restaurant_id = public.current_restaurant_id() and public.is_admin());

-- menu_categories / menu_items: tenant members can browse, staff/admin manage.
create policy "menu_categories_select" on public.menu_categories
  for select using (restaurant_id = public.current_restaurant_id());
create policy "menu_categories_write" on public.menu_categories
  for all using (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin())
  with check (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin());

create policy "menu_items_select" on public.menu_items
  for select using (restaurant_id = public.current_restaurant_id());
create policy "menu_items_write" on public.menu_items
  for all using (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin())
  with check (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin());

-- ingredients / menu_item_ingredients: business-sensitive (cost, recipes) -
-- staff/admin only, no customer visibility.
create policy "ingredients_all" on public.ingredients
  for all using (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin())
  with check (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin());

create policy "menu_item_ingredients_all" on public.menu_item_ingredients
  for all using (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin())
  with check (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin());

-- tables: tenant members can view (e.g. to see availability), staff/admin manage.
create policy "tables_select" on public.tables
  for select using (restaurant_id = public.current_restaurant_id());
create policy "tables_write" on public.tables
  for all using (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin())
  with check (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin());

-- orders: customers see/create their own, staff/admin see and manage all.
create policy "orders_select" on public.orders
  for select using (
    restaurant_id = public.current_restaurant_id()
    and (public.is_staff_or_admin() or customer_id = auth.uid())
  );
create policy "orders_insert" on public.orders
  for insert with check (
    restaurant_id = public.current_restaurant_id()
    and (public.is_staff_or_admin() or customer_id = auth.uid())
  );
create policy "orders_update" on public.orders
  for update using (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin())
  with check (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin());
create policy "orders_delete" on public.orders
  for delete using (restaurant_id = public.current_restaurant_id() and public.is_admin());

-- order_items: follow the parent order's ownership.
create policy "order_items_select" on public.order_items
  for select using (
    restaurant_id = public.current_restaurant_id()
    and (
      public.is_staff_or_admin()
      or exists (
        select 1 from public.orders o
        where o.id = order_items.order_id and o.customer_id = auth.uid()
      )
    )
  );
create policy "order_items_insert" on public.order_items
  for insert with check (
    restaurant_id = public.current_restaurant_id()
    and (
      public.is_staff_or_admin()
      or exists (
        select 1 from public.orders o
        where o.id = order_items.order_id and o.customer_id = auth.uid()
      )
    )
  );
create policy "order_items_update" on public.order_items
  for update using (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin())
  with check (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin());
create policy "order_items_delete" on public.order_items
  for delete using (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin());

-- reservations: customers see/create their own, staff/admin manage all.
create policy "reservations_select" on public.reservations
  for select using (
    restaurant_id = public.current_restaurant_id()
    and (public.is_staff_or_admin() or customer_id = auth.uid())
  );
create policy "reservations_insert" on public.reservations
  for insert with check (
    restaurant_id = public.current_restaurant_id()
    and (public.is_staff_or_admin() or customer_id = auth.uid())
  );
create policy "reservations_update" on public.reservations
  for update using (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin())
  with check (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin());
create policy "reservations_delete" on public.reservations
  for delete using (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin());

-- bills: staff/admin manage; a customer can view a bill for their own order.
create policy "bills_select" on public.bills
  for select using (
    restaurant_id = public.current_restaurant_id()
    and (
      public.is_staff_or_admin()
      or exists (
        select 1 from public.orders o
        where o.id = bills.order_id and o.customer_id = auth.uid()
      )
    )
  );
create policy "bills_write" on public.bills
  for all using (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin())
  with check (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin());

-- service_requests: any tenant member can raise one (e.g. a customer at a
-- table), only staff/admin can update/resolve or delete.
create policy "service_requests_select" on public.service_requests
  for select using (restaurant_id = public.current_restaurant_id());
create policy "service_requests_insert" on public.service_requests
  for insert with check (restaurant_id = public.current_restaurant_id());
create policy "service_requests_update" on public.service_requests
  for update using (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin())
  with check (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin());
create policy "service_requests_delete" on public.service_requests
  for delete using (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin());

-- weather_cache / forecast_cache: read-only reference data for the tenant,
-- writes restricted to staff/admin (in practice populated by a backend job
-- using the service_role key, which bypasses RLS entirely).
create policy "weather_cache_select" on public.weather_cache
  for select using (restaurant_id = public.current_restaurant_id());
create policy "weather_cache_write" on public.weather_cache
  for all using (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin())
  with check (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin());

create policy "forecast_cache_select" on public.forecast_cache
  for select using (restaurant_id = public.current_restaurant_id());
create policy "forecast_cache_write" on public.forecast_cache
  for all using (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin())
  with check (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin());

-- offers: tenant members can see active offers, staff/admin manage them.
create policy "offers_select" on public.offers
  for select using (restaurant_id = public.current_restaurant_id());
create policy "offers_write" on public.offers
  for all using (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin())
  with check (restaurant_id = public.current_restaurant_id() and public.is_staff_or_admin());
