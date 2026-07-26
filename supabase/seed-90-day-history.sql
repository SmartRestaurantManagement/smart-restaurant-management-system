-- ============================================================================
-- 90-day realistic history seed. RUN ONCE in the Supabase SQL Editor.
-- Not a migration - pure data, additive only. Never deletes or touches the
-- 11 existing real test orders (or any other existing row).
--
-- PREREQUISITE: run `node supabase/create-test-accounts.mjs` first. It
-- creates the 5 staff/admin + 18 customer accounts as real, loginable
-- Supabase Auth users via the Admin API, plus their profiles rows. This
-- script no longer creates identities itself - it only looks them up.
--
-- Reference-data sections (categories/ingredients/menu_items/tables) are
-- lookup-or-insert and safe to re-run. The bulk generation sections
-- (orders/reservations/service_requests/weather_cache/forecast_cache/offers)
-- are NOT idempotent - running this twice doubles that data. Run once.
-- ============================================================================

begin;

drop table if exists seed_ctx;
drop table if exists seed_categories;
drop table if exists seed_ingredients;
drop table if exists seed_menu_items;
drop table if exists seed_tables;
drop table if exists seed_staff;
drop table if exists seed_customers;
drop table if exists seed_customer_pool;
drop table if exists seed_weather_flags;
drop table if exists seed_new_orders;

create temp table seed_ctx (restaurant_id uuid);
insert into seed_ctx select id from public.restaurants order by created_at limit 1;

do $$
begin
  if (select restaurant_id from seed_ctx) is null then
    raise exception 'No restaurant found in public.restaurants. Cannot seed.';
  end if;
end $$;

-- ============================================================================
-- 1. MENU CATEGORIES (lookup-or-insert)
-- ============================================================================

do $$
declare
  v_restaurant_id uuid := (select restaurant_id from seed_ctx);
begin
  if not exists (select 1 from public.menu_categories where restaurant_id = v_restaurant_id and name = 'Starters') then
    insert into public.menu_categories (restaurant_id, name, sort_order) values (v_restaurant_id, 'Starters', 1);
  end if;
  if not exists (select 1 from public.menu_categories where restaurant_id = v_restaurant_id and name in ('Main Course', 'Mains')) then
    insert into public.menu_categories (restaurant_id, name, sort_order) values (v_restaurant_id, 'Mains', 2);
  end if;
  if not exists (select 1 from public.menu_categories where restaurant_id = v_restaurant_id and name = 'Breads') then
    insert into public.menu_categories (restaurant_id, name, sort_order) values (v_restaurant_id, 'Breads', 3);
  end if;
  if not exists (select 1 from public.menu_categories where restaurant_id = v_restaurant_id and name = 'Beverages') then
    insert into public.menu_categories (restaurant_id, name, sort_order) values (v_restaurant_id, 'Beverages', 4);
  end if;
  if not exists (select 1 from public.menu_categories where restaurant_id = v_restaurant_id and name = 'Desserts') then
    insert into public.menu_categories (restaurant_id, name, sort_order) values (v_restaurant_id, 'Desserts', 5);
  end if;
end $$;

create temp table seed_categories (label text primary key, id uuid);
insert into seed_categories
select 'Starters', id from public.menu_categories where restaurant_id = (select restaurant_id from seed_ctx) and name = 'Starters'
union all
(select 'Mains', id from public.menu_categories where restaurant_id = (select restaurant_id from seed_ctx) and name in ('Main Course', 'Mains') limit 1)
union all
select 'Breads', id from public.menu_categories where restaurant_id = (select restaurant_id from seed_ctx) and name = 'Breads'
union all
select 'Beverages', id from public.menu_categories where restaurant_id = (select restaurant_id from seed_ctx) and name = 'Beverages'
union all
select 'Desserts', id from public.menu_categories where restaurant_id = (select restaurant_id from seed_ctx) and name = 'Desserts';

-- ============================================================================
-- 2. INGREDIENTS (lookup-or-insert; the 5 existing ones - Paneer, Tomato,
--    Rice, Butter, Naan Dough - are reused as-is, their unit_cost untouched)
-- ============================================================================

insert into public.ingredients (restaurant_id, name, stock_qty, low_stock_threshold, unit_cost)
select (select restaurant_id from seed_ctx), v.name, v.stock_qty, v.low_stock_threshold, v.unit_cost
from (values
  ('Chicken', 25.0, 5.0, 180.0),
  ('Mutton', 15.0, 3.0, 450.0),
  ('Onion', 30.0, 5.0, 25.0),
  ('Ginger-Garlic Paste', 8.0, 2.0, 120.0),
  ('Yogurt', 20.0, 4.0, 60.0),
  ('Fresh Cream', 15.0, 3.0, 220.0),
  ('Chickpeas', 20.0, 4.0, 90.0),
  ('Potato', 40.0, 8.0, 20.0),
  ('Cauliflower', 20.0, 4.0, 35.0),
  ('Spinach', 15.0, 3.0, 40.0),
  ('Green Peas', 15.0, 3.0, 50.0),
  ('Red Lentils', 20.0, 4.0, 85.0),
  ('Black Lentils', 15.0, 3.0, 110.0),
  ('Ghee', 10.0, 2.0, 550.0),
  ('Sugar', 25.0, 5.0, 45.0),
  ('Milk', 30.0, 6.0, 55.0),
  ('Tea Leaves', 5.0, 1.0, 400.0),
  ('Coffee Powder', 5.0, 1.0, 600.0),
  ('Mint Leaves', 5.0, 1.0, 30.0),
  ('Coriander Leaves', 5.0, 1.0, 30.0),
  ('Lemon', 10.0, 2.0, 15.0),
  ('Semolina', 15.0, 3.0, 50.0),
  ('Mango Pulp', 12.0, 2.0, 150.0),
  ('Cashew Nuts', 8.0, 2.0, 800.0),
  ('Chocolate Sauce', 8.0, 2.0, 300.0),
  ('Vanilla Essence', 3.0, 1.0, 900.0),
  ('Khoya', 10.0, 2.0, 280.0),
  ('Ice Cream Mix', 10.0, 2.0, 200.0)
) as v(name, stock_qty, low_stock_threshold, unit_cost)
where not exists (
  select 1 from public.ingredients i
  where i.restaurant_id = (select restaurant_id from seed_ctx) and i.name = v.name
);

create temp table seed_ingredients (label text primary key, id uuid);
insert into seed_ingredients
select name, id from public.ingredients where restaurant_id = (select restaurant_id from seed_ctx);

-- ============================================================================
-- 3. MENU ITEMS (lookup-or-insert; 5 existing + 25 new = 30 total)
-- ============================================================================

insert into public.menu_items (restaurant_id, category_id, name, description, price, is_available)
select (select restaurant_id from seed_ctx),
       (select id from seed_categories where label = v.category),
       v.name, v.description, v.price, true
from (values
  ('Starters', 'Veg Spring Rolls', 'Crisp golden rolls stuffed with spiced vegetables.', 180.0),
  ('Starters', 'Chicken 65', 'Deep-fried spicy chicken bites, South Indian style.', 260.0),
  ('Starters', 'Hara Bhara Kebab', 'Spinach and pea patties, shallow-fried.', 220.0),
  ('Starters', 'Chilli Paneer', 'Wok-tossed paneer in a tangy chilli-garlic sauce.', 240.0),
  ('Starters', 'Tandoori Chicken Wings', 'Char-grilled wings marinated in tandoori spices.', 280.0),
  ('Mains', 'Dal Makhani', 'Slow-cooked black lentils finished with cream and butter.', 260.0),
  ('Mains', 'Chana Masala', 'Chickpeas simmered in a spiced onion-tomato gravy.', 220.0),
  ('Mains', 'Butter Chicken', 'Classic tandoori chicken in a rich tomato-butter gravy.', 340.0),
  ('Mains', 'Chicken Curry', 'Home-style chicken curry with onion-tomato masala.', 300.0),
  ('Mains', 'Palak Paneer', 'Cottage cheese cubes in a creamy spinach gravy.', 280.0),
  ('Mains', 'Mutton Rogan Josh', 'Slow-braised mutton in an aromatic Kashmiri gravy.', 420.0),
  ('Mains', 'Vegetable Biryani', 'Fragrant basmati rice layered with spiced vegetables.', 260.0),
  ('Breads', 'Garlic Naan', 'Clay-oven flatbread topped with garlic and herbs.', 70.0),
  ('Breads', 'Tandoori Roti', 'Whole wheat flatbread baked in the tandoor.', 40.0),
  ('Breads', 'Missi Roti', 'Gram-flour flatbread spiced with herbs.', 45.0),
  ('Breads', 'Kulcha', 'Soft leavened flatbread baked in the tandoor.', 60.0),
  ('Beverages', 'Mango Lassi', 'Chilled yogurt drink blended with mango pulp.', 110.0),
  ('Beverages', 'Cold Coffee', 'Blended chilled coffee with milk and sugar.', 130.0),
  ('Beverages', 'Fresh Lime Soda', 'Refreshing lime juice with soda, sweet or salted.', 80.0),
  ('Beverages', 'Filter Coffee', 'South Indian style hot filter coffee.', 70.0),
  ('Desserts', 'Gulab Jamun', 'Soft milk-solid dumplings soaked in sugar syrup.', 120.0),
  ('Desserts', 'Rasmalai', 'Cottage cheese discs in sweetened, cardamom-flavored milk.', 140.0),
  ('Desserts', 'Vanilla Ice Cream', 'Creamy Madagascar vanilla ice cream.', 110.0),
  ('Desserts', 'Kulfi', 'Traditional dense Indian ice cream on a stick.', 100.0),
  ('Desserts', 'Chocolate Brownie', 'Warm fudge brownie with chocolate sauce.', 150.0)
) as v(category, name, description, price)
where not exists (
  select 1 from public.menu_items mi
  where mi.restaurant_id = (select restaurant_id from seed_ctx) and mi.name = v.name
);

create temp table seed_menu_items (label text primary key, id uuid);
insert into seed_menu_items
select name, id from public.menu_items where restaurant_id = (select restaurant_id from seed_ctx);

-- ============================================================================
-- 4. RECIPES (menu_item_ingredients) - every one of the 30 items, including
--    the 5 pre-existing ones which have never had a recipe until now.
-- ============================================================================

insert into public.menu_item_ingredients (restaurant_id, menu_item_id, ingredient_id, qty_per_portion)
select (select restaurant_id from seed_ctx),
       (select id from seed_menu_items where label = v.item),
       (select id from seed_ingredients where label = v.ingredient),
       v.qty
from (values
  ('Paneer Tikka', 'Paneer', 0.15), ('Paneer Tikka', 'Yogurt', 0.05), ('Paneer Tikka', 'Ginger-Garlic Paste', 0.01),
  ('Paneer Butter Masala', 'Paneer', 0.2), ('Paneer Butter Masala', 'Tomato', 0.15), ('Paneer Butter Masala', 'Butter', 0.05), ('Paneer Butter Masala', 'Fresh Cream', 0.05),
  ('Butter Naan', 'Naan Dough', 0.12), ('Butter Naan', 'Butter', 0.02), ('Butter Naan', 'Ghee', 0.01),
  ('Veg Pulao', 'Rice', 0.18), ('Veg Pulao', 'Green Peas', 0.03), ('Veg Pulao', 'Ginger-Garlic Paste', 0.01), ('Veg Pulao', 'Ghee', 0.01),
  ('Masala Chai', 'Tea Leaves', 0.01), ('Masala Chai', 'Milk', 0.15), ('Masala Chai', 'Sugar', 0.02),

  ('Veg Spring Rolls', 'Cauliflower', 0.06), ('Veg Spring Rolls', 'Onion', 0.05), ('Veg Spring Rolls', 'Potato', 0.05),
  ('Chicken 65', 'Chicken', 0.2), ('Chicken 65', 'Yogurt', 0.03), ('Chicken 65', 'Ginger-Garlic Paste', 0.02),
  ('Hara Bhara Kebab', 'Spinach', 0.1), ('Hara Bhara Kebab', 'Green Peas', 0.05), ('Hara Bhara Kebab', 'Potato', 0.08), ('Hara Bhara Kebab', 'Coriander Leaves', 0.01),
  ('Chilli Paneer', 'Paneer', 0.18), ('Chilli Paneer', 'Onion', 0.06), ('Chilli Paneer', 'Ginger-Garlic Paste', 0.02),
  ('Tandoori Chicken Wings', 'Chicken', 0.25), ('Tandoori Chicken Wings', 'Yogurt', 0.05), ('Tandoori Chicken Wings', 'Ginger-Garlic Paste', 0.02),

  ('Dal Makhani', 'Black Lentils', 0.15), ('Dal Makhani', 'Red Lentils', 0.05), ('Dal Makhani', 'Butter', 0.04), ('Dal Makhani', 'Fresh Cream', 0.05),
  ('Chana Masala', 'Chickpeas', 0.2), ('Chana Masala', 'Onion', 0.06), ('Chana Masala', 'Tomato', 0.1), ('Chana Masala', 'Ginger-Garlic Paste', 0.01),
  ('Butter Chicken', 'Chicken', 0.25), ('Butter Chicken', 'Butter', 0.06), ('Butter Chicken', 'Fresh Cream', 0.06), ('Butter Chicken', 'Tomato', 0.1),
  ('Chicken Curry', 'Chicken', 0.25), ('Chicken Curry', 'Onion', 0.08), ('Chicken Curry', 'Tomato', 0.08), ('Chicken Curry', 'Ginger-Garlic Paste', 0.02),
  ('Palak Paneer', 'Paneer', 0.18), ('Palak Paneer', 'Spinach', 0.15), ('Palak Paneer', 'Fresh Cream', 0.03),
  ('Mutton Rogan Josh', 'Mutton', 0.22), ('Mutton Rogan Josh', 'Yogurt', 0.05), ('Mutton Rogan Josh', 'Onion', 0.06), ('Mutton Rogan Josh', 'Ginger-Garlic Paste', 0.02),
  ('Vegetable Biryani', 'Rice', 0.2), ('Vegetable Biryani', 'Cauliflower', 0.05), ('Vegetable Biryani', 'Green Peas', 0.04), ('Vegetable Biryani', 'Ghee', 0.02),

  ('Garlic Naan', 'Naan Dough', 0.12), ('Garlic Naan', 'Butter', 0.02), ('Garlic Naan', 'Ginger-Garlic Paste', 0.01),
  ('Tandoori Roti', 'Naan Dough', 0.1), ('Tandoori Roti', 'Ghee', 0.01),
  ('Missi Roti', 'Naan Dough', 0.1), ('Missi Roti', 'Chickpeas', 0.03), ('Missi Roti', 'Ghee', 0.01),
  ('Kulcha', 'Naan Dough', 0.12), ('Kulcha', 'Butter', 0.02),

  ('Mango Lassi', 'Yogurt', 0.2), ('Mango Lassi', 'Mango Pulp', 0.1), ('Mango Lassi', 'Sugar', 0.02),
  ('Cold Coffee', 'Coffee Powder', 0.02), ('Cold Coffee', 'Milk', 0.2), ('Cold Coffee', 'Sugar', 0.02),
  ('Fresh Lime Soda', 'Lemon', 0.5), ('Fresh Lime Soda', 'Sugar', 0.02),
  ('Filter Coffee', 'Coffee Powder', 0.015), ('Filter Coffee', 'Milk', 0.1), ('Filter Coffee', 'Sugar', 0.01),

  ('Gulab Jamun', 'Khoya', 0.08), ('Gulab Jamun', 'Sugar', 0.05), ('Gulab Jamun', 'Ghee', 0.02),
  ('Rasmalai', 'Khoya', 0.1), ('Rasmalai', 'Milk', 0.1), ('Rasmalai', 'Sugar', 0.03), ('Rasmalai', 'Cashew Nuts', 0.01),
  ('Vanilla Ice Cream', 'Ice Cream Mix', 0.12), ('Vanilla Ice Cream', 'Vanilla Essence', 0.01),
  ('Kulfi', 'Milk', 0.15), ('Kulfi', 'Sugar', 0.03), ('Kulfi', 'Cashew Nuts', 0.01),
  ('Chocolate Brownie', 'Semolina', 0.06), ('Chocolate Brownie', 'Chocolate Sauce', 0.05), ('Chocolate Brownie', 'Sugar', 0.03), ('Chocolate Brownie', 'Butter', 0.02)
) as v(item, ingredient, qty)
where not exists (
  select 1 from public.menu_item_ingredients mii
  where mii.menu_item_id = (select id from seed_menu_items where label = v.item)
  and mii.ingredient_id = (select id from seed_ingredients where label = v.ingredient)
);

-- ============================================================================
-- 5. TABLES (expand to 12 total; schema has no capacity/size column, so
--    "mixed sizes" is only reflected as more tables, not a stored attribute)
-- ============================================================================

insert into public.tables (restaurant_id, table_number, status)
select (select restaurant_id from seed_ctx), n, 'free'
from generate_series(1, 12) as n
where not exists (
  select 1 from public.tables t
  where t.restaurant_id = (select restaurant_id from seed_ctx) and t.table_number = n
);

create temp table seed_tables (id uuid);
insert into seed_tables select id from public.tables where restaurant_id = (select restaurant_id from seed_ctx);

-- ============================================================================
-- 6. STAFF & CUSTOMER PROFILES
--    These are no longer created here. Run `node supabase/create-test-accounts.mjs`
--    FIRST - it creates the 5 staff/admin + 18 customer accounts via the
--    Supabase Admin API (real, loginable accounts) and their profiles rows.
--    This section only looks up whatever staff/customer profiles already
--    exist for this restaurant.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from public.profiles
    where restaurant_id = (select restaurant_id from seed_ctx) and role in ('staff', 'admin')
  ) then
    raise exception 'No staff/admin profiles found. Run node supabase/create-test-accounts.mjs first.';
  end if;
  if not exists (
    select 1 from public.profiles
    where restaurant_id = (select restaurant_id from seed_ctx) and role = 'customer'
  ) then
    raise exception 'No customer profiles found. Run node supabase/create-test-accounts.mjs first.';
  end if;
end $$;

create temp table seed_staff (id uuid);
insert into seed_staff
select p.id from public.profiles p
where p.restaurant_id = (select restaurant_id from seed_ctx) and p.role in ('staff', 'admin');

create temp table seed_customers (id uuid, weight int);
insert into seed_customers (id, weight)
select p.id, case when p.full_name in ('Rohan Kapoor', 'Priya Nair', 'Aditya Bhatt', 'Meera Iyer', 'Karan Malhotra') then 8 else 1 end
from public.profiles p
where p.restaurant_id = (select restaurant_id from seed_ctx) and p.role = 'customer';

create temp table seed_customer_pool (customer_id uuid);
insert into seed_customer_pool (customer_id)
select id from seed_customers, generate_series(1, weight);

-- ============================================================================
-- 7. WEATHER_CACHE backfill for the 90-day window, plus a flags table used
--    to correlate order item selection with rainy/hot days.
-- ============================================================================

create temp table seed_weather_flags (date date primary key, is_rainy boolean, is_hot boolean, condition text, temp_max numeric, temp_min numeric);

insert into seed_weather_flags (date, is_rainy, is_hot, condition, temp_max, temp_min)
select d::date,
       (random() < 0.22) as is_rainy,
       (random() < 0.35) as is_hot,
       null, null, null
from generate_series(current_date - 90, current_date - 1, interval '1 day') as d;

update seed_weather_flags set
  condition = case
    when is_rainy and random() < 0.4 then 'Thunderstorm'
    when is_rainy then 'Moderate rain'
    when is_hot then 'Clear sky'
    when random() < 0.5 then 'Partly cloudy'
    else 'Overcast'
  end,
  temp_max = case when is_rainy then 26 + random() * 4 when is_hot then 33 + random() * 4 else 28 + random() * 5 end,
  temp_min = case when is_rainy then 21 + random() * 3 when is_hot then 27 + random() * 3 else 23 + random() * 4 end;

insert into public.weather_cache (restaurant_id, date, forecast, fetched_at)
select (select restaurant_id from seed_ctx), w.date,
  jsonb_build_object(
    'current', jsonb_build_object('temperatureC', round(w.temp_max, 1), 'condition', w.condition),
    'forecast', jsonb_build_array(
      jsonb_build_object('date', w.date::text, 'tempMaxC', round(w.temp_max, 1), 'tempMinC', round(w.temp_min, 1), 'condition', w.condition),
      jsonb_build_object('date', (w.date + 1)::text, 'tempMaxC', round(w.temp_max, 1), 'tempMinC', round(w.temp_min, 1), 'condition', w.condition),
      jsonb_build_object('date', (w.date + 2)::text, 'tempMaxC', round(w.temp_max, 1), 'tempMinC', round(w.temp_min, 1), 'condition', w.condition)
    )
  ),
  w.date::timestamptz + interval '6 hours'
from seed_weather_flags w
where not exists (
  select 1 from public.weather_cache wc
  where wc.restaurant_id = (select restaurant_id from seed_ctx) and wc.date = w.date
);

-- ============================================================================
-- 8. ORDERS, ORDER_ITEMS, ORDER_STATUS_HISTORY for 90 days.
--    Weekday/weekend volume shaping, lunch/dinner hour weighting, weather
--    correlation on item selection, mostly-completed historical statuses.
-- ============================================================================

create temp table seed_new_orders (id uuid, order_date date);

do $$
declare
  v_restaurant_id uuid := (select restaurant_id from seed_ctx);
  v_day date;
  v_is_weekend boolean;
  v_is_rainy boolean;
  v_is_hot boolean;
  v_order_count int;
  v_i int;
  v_hour int;
  v_created timestamptz;
  v_order_id uuid;
  v_customer_id uuid;
  v_table_id uuid;
  v_status public.order_status;
  v_num_items int;
  v_j int;
  v_item_label text;
  v_menu_item_id uuid;
  v_price numeric;
  v_qty int;
  v_note text;
  v_confirmed_at timestamptz;
  v_preparing_at timestamptz;
  v_ready_at timestamptz;
  v_served_at timestamptz;
  v_completed_at timestamptz;
  v_roll numeric;
  v_notes text[] := array['no onions', 'extra spicy', 'less oil', 'no cilantro', 'extra gravy on the side', 'go easy on salt'];
  v_hot_items text[] := array['Mango Lassi', 'Cold Coffee', 'Fresh Lime Soda', 'Vanilla Ice Cream', 'Kulfi'];
  v_rainy_items text[] := array['Masala Chai', 'Filter Coffee', 'Dal Makhani', 'Chicken Curry', 'Mutton Rogan Josh'];
  v_all_items text[];
begin
  select array_agg(label) into v_all_items from seed_menu_items;

  for v_day in select generate_series(current_date - 90, current_date - 1, interval '1 day')::date loop
    v_is_weekend := extract(dow from v_day) in (0, 5, 6);
    select is_rainy, is_hot into v_is_rainy, v_is_hot from seed_weather_flags where date = v_day;

    v_order_count := case when v_is_weekend then 16 + floor(random() * 8)::int else 10 + floor(random() * 6)::int end;

    for v_i in 1..v_order_count loop
      -- weighted hour: lunch (12-14) and dinner (19-22) peaks
      v_hour := (array[11,12,12,12,13,13,14,15,17,19,19,19,20,20,20,21,21,22])[floor(random()*18)::int + 1];
      v_created := v_day::timestamptz + (v_hour || ' hours')::interval + (floor(random()*60) || ' minutes')::interval;

      v_customer_id := null;
      if random() < 0.6 then
        select customer_id into v_customer_id from seed_customer_pool order by random() limit 1;
      end if;

      v_table_id := null;
      if random() < 0.8 then
        select id into v_table_id from seed_tables order by random() limit 1;
      end if;

      v_roll := random();
      v_status := case
        when v_roll < 0.85 then 'completed'
        when v_roll < 0.95 then 'cancelled'
        else 'served'
      end;

      insert into public.orders (restaurant_id, table_id, customer_id, status, created_at, updated_at)
      values (v_restaurant_id, v_table_id, v_customer_id, v_status, v_created, v_created)
      returning id into v_order_id;

      insert into seed_new_orders (id, order_date) values (v_order_id, v_day);

      -- order items: 1-5 lines, weather-correlated selection
      v_num_items := 1 + floor(random() * 5)::int;
      for v_j in 1..v_num_items loop
        v_roll := random();
        if v_is_rainy and v_roll < 0.35 then
          v_item_label := v_rainy_items[floor(random() * array_length(v_rainy_items, 1))::int + 1];
        elsif v_is_hot and v_roll < 0.35 then
          v_item_label := v_hot_items[floor(random() * array_length(v_hot_items, 1))::int + 1];
        else
          v_item_label := v_all_items[floor(random() * array_length(v_all_items, 1))::int + 1];
        end if;

        select id, price into v_menu_item_id, v_price from public.menu_items where id = (select id from seed_menu_items where label = v_item_label);
        v_qty := 1 + floor(random() * 3)::int;
        v_note := null;
        if random() < 0.15 then
          v_note := v_notes[floor(random() * array_length(v_notes, 1))::int + 1];
        end if;

        insert into public.order_items (restaurant_id, order_id, menu_item_id, qty, price_at_order, customization_notes, created_at, updated_at)
        values (v_restaurant_id, v_order_id, v_menu_item_id, v_qty, v_price, v_note, v_created, v_created);
      end loop;

      -- order_status_history trail
      if v_status = 'cancelled' then
        insert into public.order_status_history (restaurant_id, order_id, status, created_at) values
          (v_restaurant_id, v_order_id, 'pending', v_created),
          (v_restaurant_id, v_order_id, 'cancelled', v_created + (1 + floor(random()*9) || ' minutes')::interval);
      else
        v_confirmed_at := v_created + (1 + floor(random()*4) || ' minutes')::interval;
        v_preparing_at := v_confirmed_at + (1 + floor(random()*4) || ' minutes')::interval;
        v_ready_at := v_preparing_at + (8 + floor(random()*17) || ' minutes')::interval;
        v_served_at := v_ready_at + (2 + floor(random()*6) || ' minutes')::interval;
        v_completed_at := v_served_at + (15 + floor(random()*30) || ' minutes')::interval;

        insert into public.order_status_history (restaurant_id, order_id, status, created_at) values
          (v_restaurant_id, v_order_id, 'pending', v_created),
          (v_restaurant_id, v_order_id, 'confirmed', v_confirmed_at),
          (v_restaurant_id, v_order_id, 'preparing', v_preparing_at),
          (v_restaurant_id, v_order_id, 'ready', v_ready_at),
          (v_restaurant_id, v_order_id, 'served', v_served_at);

        if v_status = 'completed' then
          insert into public.order_status_history (restaurant_id, order_id, status, created_at)
          values (v_restaurant_id, v_order_id, 'completed', v_completed_at);
        end if;
      end if;

      -- bill for completed orders
      if v_status = 'completed' then
        insert into public.bills (restaurant_id, order_id, total, split_method, payment_reference, created_at, updated_at)
        select v_restaurant_id, v_order_id,
               (select coalesce(sum(price_at_order * qty), 0) from public.order_items where order_id = v_order_id),
               (case
                 when random() < 0.5 then 'none'
                 when random() < 0.75 then 'equal'
                 when random() < 0.9 then 'by_item'
                 else 'custom'
               end)::public.bill_split_method,
               'UPI-' || upper(substr(md5(random()::text), 1, 8)),
               v_completed_at, v_completed_at;
      end if;
    end loop;
  end loop;
end $$;

-- ============================================================================
-- 9. SERVICE_REQUESTS tied to real historical dine-in orders (mostly
--    resolved, a handful left open/in-progress on the most recent day).
-- ============================================================================

do $$
declare
  v_restaurant_id uuid := (select restaurant_id from seed_ctx);
  v_candidate record;
  v_target int;
  v_k int;
  v_type public.service_request_type;
  v_requested timestamptz;
  v_resolved timestamptz;
  v_is_open boolean;
begin
  for v_candidate in
    select o.id as order_id, o.table_id, o.created_at
    from public.orders o
    join seed_new_orders sno on sno.id = o.id
    where o.table_id is not null
    order by random()
    limit 130
  loop
    v_target := 1 + floor(random() * 3)::int; -- 1-3 requests for this order's table

    for v_k in 1..v_target loop
      v_type := (array['water','server','bill'])[floor(random()*3)::int + 1]::public.service_request_type;
      v_requested := v_candidate.created_at + (5 + floor(random()*40) || ' minutes')::interval;

      -- last few days get some still-open requests
      v_is_open := (v_candidate.created_at > now() - interval '2 days') and (random() < 0.25);

      if v_is_open then
        insert into public.service_requests (restaurant_id, table_id, type, status, requested_at, resolved_at)
        values (v_restaurant_id, v_candidate.table_id, v_type, (case when random() < 0.5 then 'pending' else 'in_progress' end)::public.service_request_status, v_requested, null);
      else
        v_resolved := v_requested + (1 + floor(random()*8) || ' minutes')::interval;
        insert into public.service_requests (restaurant_id, table_id, type, status, requested_at, resolved_at)
        values (v_restaurant_id, v_candidate.table_id, v_type, 'resolved', v_requested, v_resolved);
      end if;
    end loop;
  end loop;
end $$;

-- ============================================================================
-- 10. RESERVATIONS: past mix (completed/cancelled/no_show) + upcoming
--     (pending/confirmed).
-- ============================================================================

do $$
declare
  v_restaurant_id uuid := (select restaurant_id from seed_ctx);
  v_names text[] := array['Rohan Kapoor','Priya Nair','Aditya Bhatt','Meera Iyer','Karan Malhotra','Sanya Gupta','Rahul Verma','Ishita Sharma','Devansh Patel','Nikita Joshi','Aryan Chawla','Pooja Reddy','Siddharth Rao','Tanvi Mehta','Yash Agarwal','Riya Sen','Kabir Khanna','Anjali Pillai'];
  v_day date;
  v_reserved_for timestamptz;
  v_status public.reservation_status;
  v_roll numeric;
  v_name text;
  v_table_id uuid;
begin
  -- past reservations, roughly 0-1 per day
  for v_day in select generate_series(current_date - 90, current_date - 1, interval '3 days')::date loop
    if random() < 0.7 then
      v_name := v_names[floor(random() * array_length(v_names,1))::int + 1];
      v_reserved_for := v_day::timestamptz + ((12 + floor(random()*10)) || ' hours')::interval;
      select id into v_table_id from seed_tables order by random() limit 1;
      v_roll := random();
      v_status := case
        when v_roll < 0.75 then 'completed'
        when v_roll < 0.9 then 'cancelled'
        else 'no_show'
      end;

      insert into public.reservations (restaurant_id, customer_name, customer_phone, customer_email, table_id, reserved_for, party_size, status)
      values (
        v_restaurant_id, v_name,
        '+91' || (7000000000 + floor(random()*999999999))::bigint,
        lower(replace(v_name, ' ', '.')) || '@example.com',
        v_table_id, v_reserved_for, 2 + floor(random()*5)::int, v_status
      );
    end if;
  end loop;

  -- upcoming reservations
  for v_day in select generate_series(current_date + 1, current_date + 14, interval '2 days')::date loop
    v_name := v_names[floor(random() * array_length(v_names,1))::int + 1];
    v_reserved_for := v_day::timestamptz + ((12 + floor(random()*10)) || ' hours')::interval;
    select id into v_table_id from seed_tables order by random() limit 1;
    v_status := (case when random() < 0.6 then 'confirmed' else 'pending' end)::public.reservation_status;

    insert into public.reservations (restaurant_id, customer_name, customer_phone, customer_email, table_id, reserved_for, party_size, status)
    values (
      v_restaurant_id, v_name,
      '+91' || (7000000000 + floor(random()*999999999))::bigint,
      lower(replace(v_name, ' ', '.')) || '@example.com',
      v_table_id, v_reserved_for, 2 + floor(random()*5)::int, v_status
    );
  end loop;
end $$;

-- ============================================================================
-- 11. FORECAST_CACHE: approximate predicted demand from the just-generated
--     order history (simple recent-average, not a re-implementation of the
--     exact recency-weighted formula in lib/forecasting/demand.ts, but
--     directionally consistent with it).
-- ============================================================================

insert into public.forecast_cache (restaurant_id, menu_item_id, forecast_date, predicted_demand)
select (select restaurant_id from seed_ctx), mi.id, fd.forecast_date,
       coalesce((
         select round(avg(daily.qty), 2)
         from (
           select oi.created_at::date as d, sum(oi.qty) as qty
           from public.order_items oi
           join seed_new_orders sno on sno.id = oi.order_id
           where oi.menu_item_id = mi.id and oi.created_at >= now() - interval '14 days'
           group by oi.created_at::date
         ) as daily
       ), 1.0)
from public.menu_items mi
cross join (select generate_series(current_date + 1, current_date + 3, interval '1 day')::date as forecast_date) as fd
where mi.restaurant_id = (select restaurant_id from seed_ctx)
on conflict (restaurant_id, menu_item_id, forecast_date) do nothing;

-- ============================================================================
-- 12. SMART OFFERS: 2-3 active rows, computed from real post-seed cost/price
--     data, targeting items with comfortable remaining_stock relative to
--     recent average daily demand (overstock-triggered, floored above cost).
-- ============================================================================

insert into public.offers (restaurant_id, menu_item_id, discount_pct, floor_price, active, expires_at)
select (select restaurant_id from seed_ctx), c.menu_item_id, c.discount_pct, c.floor_price, true, (current_date + 1)::timestamptz + interval '23 hours'
from (
  select
    mic.menu_item_id,
    mic.price,
    mic.cost_per_portion,
    mi.remaining_stock,
    greatest(mic.cost_per_portion * 1.1, mic.price * 0.5) as floor_price,
    greatest(10, least(30, round(((mic.price - greatest(mic.cost_per_portion * 1.1, mic.price * 0.5)) / mic.price) * 100)))::numeric as discount_pct,
    row_number() over (order by (mi.remaining_stock is not null) desc, mi.remaining_stock desc nulls last) as rn
  from public.menu_item_costs mic
  join public.menu_items mi on mi.id = mic.menu_item_id
  where mic.restaurant_id = (select restaurant_id from seed_ctx)
    and not exists (select 1 from public.offers o where o.menu_item_id = mic.menu_item_id and o.active)
) as c
where c.rn <= 3;

commit;

-- ============================================================================
-- Sanity-check counts (run separately after the block above completes)
-- ============================================================================
select 'restaurants' as t, count(*) from public.restaurants
union all select 'profiles', count(*) from public.profiles
union all select 'menu_categories', count(*) from public.menu_categories
union all select 'menu_items', count(*) from public.menu_items
union all select 'ingredients', count(*) from public.ingredients
union all select 'menu_item_ingredients', count(*) from public.menu_item_ingredients
union all select 'tables', count(*) from public.tables
union all select 'orders', count(*) from public.orders
union all select 'order_items', count(*) from public.order_items
union all select 'order_status_history', count(*) from public.order_status_history
union all select 'reservations', count(*) from public.reservations
union all select 'bills', count(*) from public.bills
union all select 'service_requests', count(*) from public.service_requests
union all select 'weather_cache', count(*) from public.weather_cache
union all select 'forecast_cache', count(*) from public.forecast_cache
union all select 'offers', count(*) from public.offers;
