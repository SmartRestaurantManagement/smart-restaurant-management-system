-- Add unique constraint to public.offers on (restaurant_id, menu_item_id)
-- so upserts from staff dashboard work seamlessly without Postgres ON CONFLICT errors.

ALTER TABLE public.offers 
DROP CONSTRAINT IF EXISTS offers_restaurant_id_menu_item_id_key;

ALTER TABLE public.offers 
ADD CONSTRAINT offers_restaurant_id_menu_item_id_key UNIQUE (restaurant_id, menu_item_id);
