-- Breads and Beverages both had sort_order = 3 (pre-existing data quirk),
-- making their relative order ambiguous. Assigns explicit 1-5 order
-- matching the Kaizen Menu design: Starters, Mains, Breads, Beverages,
-- Desserts.
update public.menu_categories set sort_order = 1 where name = 'Starters';
update public.menu_categories set sort_order = 2 where name = 'Mains';
update public.menu_categories set sort_order = 3 where name = 'Breads';
update public.menu_categories set sort_order = 4 where name = 'Beverages';
update public.menu_categories set sort_order = 5 where name = 'Desserts';
