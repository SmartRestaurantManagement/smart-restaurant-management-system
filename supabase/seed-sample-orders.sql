-- One-off sample data for testing the Orders tab end-to-end.
-- Not a migration: run manually, don't apply via `supabase db push`.
--
-- Looks up an existing restaurant, one of its tables, up to 3 of its
-- menu_items, and (optionally) a profile - it does not invent any IDs.
-- Uses each menu item's real `price` for price_at_order, so the totals
-- reflect the actual catalog.
--
-- Run this in the Supabase Dashboard's SQL Editor (runs as the `postgres`
-- role, so it bypasses RLS - required, since this script has no logged-in
-- user context to satisfy the staff/admin-only insert policies otherwise):
--   https://supabase.com/dashboard/project/qyxgrzolvrfbmaseycek/sql/new
-- Paste the whole file and click "Run". Check the NOTICE output at the
-- bottom for what was created, or a clear error telling you what to add
-- first (e.g. "no table found").

do $$
declare
  v_restaurant_id uuid;
  v_table_id      uuid;
  v_customer_id   uuid;
  v_item1_id      uuid;
  v_item1_price   numeric;
  v_item2_id      uuid;
  v_item2_price   numeric;
  v_item3_id      uuid;
  v_item3_price   numeric;
  v_order_1       uuid;
  v_order_2       uuid;
  v_item3_used    boolean := false;
begin
  -- 1a. An existing restaurant.
  select id into v_restaurant_id
  from public.restaurants
  order by created_at
  limit 1;

  if v_restaurant_id is null then
    raise exception 'No restaurant found. Insert a row into public.restaurants first.';
  end if;

  -- 1b. An existing table for that restaurant.
  select id into v_table_id
  from public.tables
  where restaurant_id = v_restaurant_id
  order by table_number
  limit 1;

  if v_table_id is null then
    raise exception 'No table found for restaurant %. Insert a row into public.tables first.', v_restaurant_id;
  end if;

  -- 1c. Up to 3 existing menu items for that restaurant (with real prices).
  select id, price into v_item1_id, v_item1_price
  from public.menu_items where restaurant_id = v_restaurant_id
  order by created_at limit 1 offset 0;

  select id, price into v_item2_id, v_item2_price
  from public.menu_items where restaurant_id = v_restaurant_id
  order by created_at limit 1 offset 1;

  select id, price into v_item3_id, v_item3_price
  from public.menu_items where restaurant_id = v_restaurant_id
  order by created_at limit 1 offset 2;

  if v_item1_id is null or v_item2_id is null then
    raise exception 'Need at least 2 menu_items for restaurant %. Currently have %. Insert more menu_items first.',
      v_restaurant_id,
      (select count(*) from public.menu_items where restaurant_id = v_restaurant_id);
  end if;

  -- 1d. customer_id is nullable on orders - use a real profile if one
  -- exists for this restaurant, otherwise these become guest orders.
  select id into v_customer_id
  from public.profiles
  where restaurant_id = v_restaurant_id
  limit 1;

  -- 2. Two sample orders.
  insert into public.orders (restaurant_id, table_id, customer_id, status)
  values (v_restaurant_id, v_table_id, v_customer_id, 'pending')
  returning id into v_order_1;

  insert into public.orders (restaurant_id, table_id, customer_id, status)
  values (v_restaurant_id, v_table_id, v_customer_id, 'confirmed')
  returning id into v_order_2;

  -- 3. Order items - order 1 gets the "no onions" customization note.
  insert into public.order_items
    (restaurant_id, order_id, menu_item_id, qty, price_at_order, customization_notes)
  values
    (v_restaurant_id, v_order_1, v_item1_id, 2, v_item1_price, 'no onions'),
    (v_restaurant_id, v_order_1, v_item2_id, 1, v_item2_price, null);

  insert into public.order_items
    (restaurant_id, order_id, menu_item_id, qty, price_at_order, customization_notes)
  values
    (v_restaurant_id, v_order_2, v_item1_id, 1, v_item1_price, null),
    (v_restaurant_id, v_order_2, v_item2_id, 3, v_item2_price, null);

  if v_item3_id is not null then
    insert into public.order_items
      (restaurant_id, order_id, menu_item_id, qty, price_at_order, customization_notes)
    values
      (v_restaurant_id, v_order_2, v_item3_id, 1, v_item3_price, 'extra spicy');
    v_item3_used := true;
  end if;

  raise notice 'restaurant_id: %', v_restaurant_id;
  raise notice 'table_id: %', v_table_id;
  raise notice 'customer_id: %', coalesce(v_customer_id::text, '<none - guest orders>');
  raise notice 'order 1 (pending): % - 2 items (% x item1 "no onions", 1 x item2)', v_order_1, 2;
  raise notice 'order 2 (confirmed): % - % items', v_order_2, (case when v_item3_used then 3 else 2 end);
end $$;
