-- Aligns the live menu data with the "Kaizen Home/Menu" design handoff:
-- adds image_url + sort_order to menu_items (neither existed before), and
-- updates the 25 dishes the design specifies with its exact copy, photo,
-- and display order. The 5 extra items already in the DB but not part of
-- the design's 25 (Butter Naan, Masala Chai, Paneer Butter Masala, Paneer
-- Tikka, Veg Pulao) are marked unavailable rather than deleted -
-- order_items.menu_item_id is `on delete restrict`, so deleting items with
-- historical orders (from the 90-day seed) would fail outright anyway.

alter table public.menu_items add column if not exists image_url text;
alter table public.menu_items add column if not exists sort_order integer not null default 0;

update public.menu_categories set name = 'Mains' where name = 'Main Course';

-- Starters (01-05)
update public.menu_items set
  description = 'Crispy rolls stuffed with fresh vegetables, served with a tangy sweet chilli dip.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400413/ChatGPT_Image_Jul_30_2026_12_59_09_PM_grav1u.png',
  sort_order = 1
where name = 'Veg Spring Rolls';

update public.menu_items set
  description = 'Spiced, deep-fried chicken tossed with curry leaves and green chillies.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400377/ChatGPT_Image_Jul_30_2026_01_32_53_PM_zctosz.png',
  sort_order = 2
where name = 'Chicken 65';

update public.menu_items set
  description = 'Pan-seared patties of spinach, peas and paneer, finished with mint chutney.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400421/ChatGPT_Image_Jul_30_2026_01_33_02_PM_e0paik.png',
  sort_order = 3
where name = 'Hara Bhara Kebab';

update public.menu_items set
  description = 'Crisp paneer cubes tossed in a bold, spicy soy-chilli glaze.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400316/ChatGPT_Image_Jul_30_2026_01_33_09_PM_ppknuq.png',
  sort_order = 4
where name = 'Chilli Paneer';

update public.menu_items set
  description = 'Smoky, char-grilled wings marinated overnight in tandoori spice.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400309/ChatGPT_Image_Jul_30_2026_01_33_14_PM_ltfk5j.png',
  sort_order = 5
where name = 'Tandoori Chicken Wings';

-- Mains (06-12)
update public.menu_items set
  description = 'Black lentils simmered overnight with butter, cream and slow warmth.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400296/ChatGPT_Image_Jul_30_2026_01_33_39_PM_c38j1v.png',
  sort_order = 6
where name = 'Dal Makhani';

update public.menu_items set
  description = 'Chickpeas simmered in a rich, tangy tomato-onion masala.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400269/ChatGPT_Image_Jul_30_2026_01_34_33_PM_zzfrfv.png',
  sort_order = 7
where name = 'Chana Masala';

update public.menu_items set
  description = 'Tender chicken in a silky tomato-butter sauce, our house signature.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400250/ChatGPT_Image_Jul_30_2026_01_34_44_PM_dqbdnd.png',
  sort_order = 8
where name = 'Butter Chicken';

update public.menu_items set
  description = 'A classic home-style curry, layered with warm whole spices.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400357/ChatGPT_Image_Jul_30_2026_01_34_50_PM_ccbfvp.png',
  sort_order = 9
where name = 'Chicken Curry';

update public.menu_items set
  description = 'Soft paneer cubes folded into a velvety spinach gravy.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400238/ChatGPT_Image_Jul_30_2026_01_34_58_PM_osm1g9.png',
  sort_order = 10
where name = 'Palak Paneer';

update public.menu_items set
  description = 'Slow-braised mutton in an aromatic Kashmiri-spiced curry.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400368/ChatGPT_Image_Jul_30_2026_01_35_04_PM_q8em18.png',
  sort_order = 11
where name = 'Mutton Rogan Josh';

update public.menu_items set
  description = 'Fragrant basmati layered with saffron, ghee and garden vegetables.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400224/ChatGPT_Image_Jul_30_2026_01_35_17_PM_yjonbe.png',
  sort_order = 12
where name = 'Vegetable Biryani';

-- Breads (13-16)
update public.menu_items set
  description = 'Soft leavened naan brushed with garlic butter and herbs.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400194/ChatGPT_Image_Jul_30_2026_01_35_27_PM_k196ql.png',
  sort_order = 13
where name = 'Garlic Naan';

update public.menu_items set
  description = 'Whole-wheat flatbread, baked fresh in the tandoor.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400356/ChatGPT_Image_Jul_30_2026_01_35_32_PM_evwjok.png',
  sort_order = 14
where name = 'Tandoori Roti';

update public.menu_items set
  description = 'Gram-flour roti spiced with ajwain and fresh coriander.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400246/ChatGPT_Image_Jul_30_2026_01_35_37_PM_olcncc.png',
  sort_order = 15
where name = 'Missi Roti';

update public.menu_items set
  description = 'Pillowy stuffed bread, baked until lightly charred.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400245/ChatGPT_Image_Jul_30_2026_01_35_42_PM_oqswbn.png',
  sort_order = 16
where name = 'Kulcha';

-- Beverages (17-20)
update public.menu_items set
  description = 'Chilled yogurt blended with ripe Alphonso mango.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400231/ChatGPT_Image_Jul_30_2026_01_35_50_PM_jb1dyy.png',
  sort_order = 17
where name = 'Mango Lassi';

update public.menu_items set
  description = 'Iced coffee blended smooth with a touch of cream.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400416/ChatGPT_Image_Jul_30_2026_01_35_54_PM_xl0co0.png',
  sort_order = 18
where name = 'Cold Coffee';

update public.menu_items set
  description = 'Sparkling soda with fresh lime, sweet or salted.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400177/ChatGPT_Image_Jul_30_2026_01_38_07_PM_he4ynn.png',
  sort_order = 19
where name = 'Fresh Lime Soda';

update public.menu_items set
  description = 'South Indian filter coffee, strong and aromatic.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785399947/ChatGPT_Image_Jul_30_2026_01_40_58_PM_xzonku.png',
  sort_order = 20
where name = 'Filter Coffee';

-- Desserts (21-25)
update public.menu_items set
  description = 'Warm milk dumplings soaked in rose-cardamom syrup.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400120/ChatGPT_Image_Jul_30_2026_01_42_28_PM_wydana.png',
  sort_order = 21
where name = 'Gulab Jamun';

update public.menu_items set
  description = 'Soft cottage cheese patties in sweetened, saffron milk.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400180/ChatGPT_Image_Jul_30_2026_01_44_19_PM_vlohe3.png',
  sort_order = 22
where name = 'Rasmalai';

update public.menu_items set
  description = 'Classic, creamy vanilla scoops made in-house.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785399961/ChatGPT_Image_Jul_30_2026_01_45_44_PM_wau9ro.png',
  sort_order = 23
where name = 'Vanilla Ice Cream';

update public.menu_items set
  description = 'Traditional dense, slow-churned frozen dessert.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785399963/ChatGPT_Image_Jul_30_2026_01_47_15_PM_ykdbbu.png',
  sort_order = 24
where name = 'Kulfi';

update public.menu_items set
  description = 'Rich, fudgy brownie served warm with chocolate sauce.',
  image_url = 'https://res.cloudinary.com/gbkjyccx/image/upload/v1785400173/ChatGPT_Image_Jul_30_2026_01_48_51_PM_tdwybd.png',
  sort_order = 25
where name = 'Chocolate Brownie';

-- Not part of the design's 25-dish menu; keep the rows (order_items
-- restricts deletion, and the 90-day seed history references some of
-- these) but hide them from the customer-facing menu.
update public.menu_items set is_available = false
where name in ('Butter Naan', 'Masala Chai', 'Paneer Butter Masala', 'Paneer Tikka', 'Veg Pulao');
