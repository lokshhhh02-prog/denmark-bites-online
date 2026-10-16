create type public.app_role as enum ('owner','manager');
create type public.order_type as enum ('dine_in','delivery');
create type public.order_status as enum ('pending','preparing','ready','completed','cancelled');

create table public.branches (
  id int primary key,
  name text not null,
  address text not null default '',
  phone text not null default '',
  gst_percent numeric(5,2) not null default 5 check (gst_percent >= 0 and gst_percent <= 28),
  packing_charge numeric(10,2) not null default 20 check (packing_charge >= 0),
  is_open boolean not null default true,
  updated_at timestamptz not null default now()
);
grant select on public.branches to anon, authenticated;
grant update on public.branches to authenticated;
grant all on public.branches to service_role;
alter table public.branches enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  branch_id int references public.branches(id) on delete cascade,
  unique (user_id, role, branch_id)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.can_manage_branch(_user_id uuid, _branch int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and (role = 'owner' or (role = 'manager' and branch_id = _branch))
  )
$$;

create policy "Own roles or owner sees all" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'));

create policy "Public can view branches" on public.branches for select to anon, authenticated using (true);
create policy "Staff update own branch" on public.branches for update to authenticated
  using (public.can_manage_branch(auth.uid(), id)) with check (public.can_manage_branch(auth.uid(), id));

create table public.staff_invites (
  email text primary key,
  branch_id int not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now()
);
grant select, delete on public.staff_invites to authenticated;
grant all on public.staff_invites to service_role;
alter table public.staff_invites enable row level security;
create policy "Owner views invites" on public.staff_invites for select to authenticated using (public.has_role(auth.uid(), 'owner'));
create policy "Owner deletes invites" on public.staff_invites for delete to authenticated using (public.has_role(auth.uid(), 'owner'));

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  branch_id int not null references public.branches(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  category text not null,
  cuisine text not null default 'Arabian',
  price numeric(10,2) not null check (price >= 0),
  in_stock boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.menu_items (branch_id, sort);
grant select on public.menu_items to anon, authenticated;
grant insert, update, delete on public.menu_items to authenticated;
grant all on public.menu_items to service_role;
alter table public.menu_items enable row level security;
create policy "Public views menu" on public.menu_items for select to anon, authenticated using (true);
create policy "Staff insert menu" on public.menu_items for insert to authenticated with check (public.can_manage_branch(auth.uid(), branch_id));
create policy "Staff update menu" on public.menu_items for update to authenticated using (public.can_manage_branch(auth.uid(), branch_id)) with check (public.can_manage_branch(auth.uid(), branch_id));
create policy "Staff delete menu" on public.menu_items for delete to authenticated using (public.can_manage_branch(auth.uid(), branch_id));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity,
  branch_id int not null references public.branches(id),
  order_type public.order_type not null,
  customer_name text not null,
  phone text not null,
  table_number text,
  items jsonb not null,
  subtotal numeric(10,2) not null,
  gst_percent numeric(5,2) not null,
  gst_amount numeric(10,2) not null,
  packing_charge numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  status public.order_status not null default 'pending',
  cancel_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders (branch_id, created_at desc);
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "Staff view branch orders" on public.orders for select to authenticated using (public.can_manage_branch(auth.uid(), branch_id));
create policy "Staff update branch orders" on public.orders for update to authenticated using (public.can_manage_branch(auth.uid(), branch_id)) with check (public.can_manage_branch(auth.uid(), branch_id));

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
create trigger branches_touch before update on public.branches for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.orders;

-- Customer places order: prices, GST and packing computed on the server
create or replace function public.place_order(_branch int, _type public.order_type, _name text, _phone text, _table text, _items jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  b public.branches; it jsonb; m public.menu_items; q int;
  lines jsonb := '[]'::jsonb; sub numeric := 0; gst numeric; pack numeric := 0; o public.orders;
begin
  select * into b from public.branches where id = _branch;
  if not found then raise exception 'Invalid branch'; end if;
  if not b.is_open then raise exception 'This branch is not accepting orders right now'; end if;
  _name := btrim(coalesce(_name,'')); _phone := btrim(coalesce(_phone,'')); _table := nullif(btrim(coalesce(_table,'')),'');
  if char_length(_name) < 2 or char_length(_name) > 60 then raise exception 'Please enter a valid name'; end if;
  if _phone !~ '^[0-9+ ]{10,15}$' then raise exception 'Please enter a valid phone number'; end if;
  if _type = 'dine_in' then
    if _table is null or char_length(_table) > 10 then raise exception 'Please enter your table number'; end if;
  else _table := null; end if;
  if jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 or jsonb_array_length(_items) > 100 then raise exception 'Your cart is empty'; end if;
  for it in select * from jsonb_array_elements(_items) loop
    q := (it->>'qty')::int;
    if q is null or q < 1 or q > 50 then raise exception 'Invalid quantity'; end if;
    select * into m from public.menu_items where id = (it->>'id')::uuid and branch_id = _branch;
    if not found then raise exception 'An item in your cart is no longer available'; end if;
    if not m.in_stock then raise exception '% is out of stock', m.name; end if;
    lines := lines || jsonb_build_object('id', m.id, 'name', m.name, 'price', m.price, 'qty', q);
    sub := sub + m.price * q;
  end loop;
  gst := round(sub * b.gst_percent / 100, 2);
  if _type = 'delivery' then pack := b.packing_charge; end if;
  insert into public.orders (branch_id, order_type, customer_name, phone, table_number, items, subtotal, gst_percent, gst_amount, packing_charge, total)
  values (_branch, _type, _name, _phone, _table, lines, sub, b.gst_percent, gst, pack, sub + gst + pack)
  returning * into o;
  return json_build_object('id', o.id, 'token', o.cancel_token, 'order_number', o.order_number);
end $$;

create or replace function public.get_order_public(_id uuid, _token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', o.id, 'order_number', o.order_number, 'branch_id', o.branch_id, 'branch_name', b.name,
    'order_type', o.order_type, 'customer_name', o.customer_name, 'table_number', o.table_number, 'items', o.items,
    'subtotal', o.subtotal, 'gst_percent', o.gst_percent, 'gst_amount', o.gst_amount, 'packing_charge', o.packing_charge,
    'total', o.total, 'status', o.status, 'created_at', o.created_at)
  from public.orders o join public.branches b on b.id = o.branch_id
  where o.id = _id and o.cancel_token = _token
$$;

create or replace function public.cancel_order_public(_id uuid, _token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status = 'cancelled' where id = _id and cancel_token = _token and status = 'pending';
  if not found then raise exception 'This order can no longer be cancelled — it is already being prepared'; end if;
  return true;
end $$;

-- Staff management (owner only)
create or replace function public.assign_manager(_email text, _branch int)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.has_role(auth.uid(), 'owner') then raise exception 'Only the owner can manage branch staff'; end if;
  _email := lower(btrim(_email));
  select id into uid from auth.users where lower(email) = _email;
  if uid is not null then
    insert into public.user_roles (user_id, role, branch_id) values (uid, 'manager', _branch) on conflict do nothing;
    return 'assigned';
  end if;
  insert into public.staff_invites (email, branch_id) values (_email, _branch)
    on conflict (email) do update set branch_id = excluded.branch_id;
  return 'invited';
end $$;

create or replace function public.remove_manager(_user_id uuid, _branch int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'owner') then raise exception 'Only the owner can manage branch staff'; end if;
  delete from public.user_roles where user_id = _user_id and role = 'manager' and branch_id = _branch;
end $$;

create or replace function public.list_staff()
returns table(user_id uuid, email text, role public.app_role, branch_id int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'owner') then raise exception 'Only the owner can view staff'; end if;
  return query select r.user_id, u.email::text, r.role, r.branch_id from public.user_roles r join auth.users u on u.id = r.user_id order by r.role, r.branch_id;
end $$;

-- First account becomes owner; invited emails become branch managers
create or replace function public.handle_new_staff()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv public.staff_invites;
begin
  if not exists (select 1 from public.user_roles where role = 'owner') then
    insert into public.user_roles (user_id, role) values (new.id, 'owner');
  else
    select * into inv from public.staff_invites where email = lower(new.email);
    if found then
      insert into public.user_roles (user_id, role, branch_id) values (new.id, 'manager', inv.branch_id) on conflict do nothing;
      delete from public.staff_invites where email = inv.email;
    end if;
  end if;
  return new;
end $$;
create trigger on_auth_user_created_staff after insert on auth.users for each row execute function public.handle_new_staff();

revoke execute on function public.place_order, public.get_order_public, public.cancel_order_public from public;
grant execute on function public.place_order, public.get_order_public, public.cancel_order_public to anon, authenticated;
revoke execute on function public.assign_manager, public.remove_manager, public.list_staff from public, anon;
grant execute on function public.assign_manager, public.remove_manager, public.list_staff to authenticated;

insert into public.branches (id, name, address, phone) values
 (1, 'Branch 1 — Chennai', 'Anna Salai, Chennai, Tamil Nadu', '+91 90000 00001'),
 (2, 'Branch 2 — Madurai', 'Bypass Road, Madurai, Tamil Nadu', '+91 90000 00002'),
 (3, 'Branch 3 — Coimbatore', 'Avinashi Road, Coimbatore, Tamil Nadu', '+91 90000 00003');

insert into public.menu_items (branch_id, name, category, cuisine, price, sort)
select b.id, v.name, v.category, v.cuisine, v.price, v.ord
from public.branches b
cross join (select *, row_number() over () as ord from (values
 ('Chicken Alfaham Full','Arabian Grills','Arabian',520),('Chicken Alfaham Half','Arabian Grills','Arabian',280),
 ('Peri Peri Alfaham Full','Arabian Grills','Arabian',560),('Peri Peri Alfaham Half','Arabian Grills','Arabian',300),
 ('Chicken Shish Tawook','Arabian Grills','Arabian',320),('Lamb Kofta Kebab','Arabian Grills','Arabian',380),
 ('Mixed Grill Platter','Arabian Grills','Arabian',890),('Chicken Kebab Platter','Arabian Grills','Arabian',450),
 ('Lamb Chops Grill','Arabian Grills','Arabian',620),('Arabian Grilled Fish','Arabian Grills','Arabian',480),
 ('Grilled Chicken Wings','Arabian Grills','Arabian',260),('Charcoal Chicken Quarter','Arabian Grills','Arabian',160),
 ('Chicken Shawarma Roll','Shawarma','Arabian',120),('Chicken Shawarma Plate','Shawarma','Arabian',220),
 ('Mexican Shawarma','Shawarma','Arabian',150),('Spicy Shawarma Roll','Shawarma','Arabian',130),
 ('Cheese Shawarma Roll','Shawarma','Arabian',150),('Mutton Shawarma Roll','Shawarma','Arabian',180),
 ('Shawarma Platter','Shawarma','Arabian',280),('Kuboos Shawarma','Shawarma','Arabian',140),
 ('Turkish Shawarma','Shawarma','Arabian',160),('Jumbo Shawarma','Shawarma','Arabian',200),
 ('Chicken Mandi Quarter','Mandi & Biryani','Arabian',280),('Chicken Mandi Half','Mandi & Biryani','Arabian',520),
 ('Chicken Mandi Full','Mandi & Biryani','Arabian',980),('Mutton Mandi Quarter','Mandi & Biryani','Arabian',420),
 ('Mutton Mandi Half','Mandi & Biryani','Arabian',790),('Alfaham Mandi','Mandi & Biryani','Arabian',340),
 ('Fish Mandi','Mandi & Biryani','Arabian',380),('Chicken Kabsa','Mandi & Biryani','Arabian',320),
 ('Chicken Majboos','Mandi & Biryani','Arabian',330),('Mutton Biryani','Mandi & Biryani','Tamil Nadu',320),
 ('Chicken Dum Biryani','Mandi & Biryani','Tamil Nadu',240),('Prawn Biryani','Mandi & Biryani','Tamil Nadu',340),
 ('Hummus Beiruti','Arabian Sides','Arabian',160),('Chicken Hummus','Arabian Sides','Arabian',220),
 ('Fattoush Salad','Arabian Sides','Arabian',150),('Garlic Toum Dip','Arabian Sides','Arabian',60),
 ('Kuboos (2 pcs)','Arabian Sides','Arabian',30),('Chicken Fatayer','Arabian Sides','Arabian',180),
 ('Lamb Arayes','Arabian Sides','Arabian',260),('Arabic Chicken Soup','Arabian Sides','Arabian',140),
 ('Dragon Chicken','Chinese Starters','Chinese',280),('Chilli Chicken Dry','Chinese Starters','Chinese',260),
 ('Chicken 65','Chinese Starters','Chinese',220),('Chicken Lollipop','Chinese Starters','Chinese',240),
 ('Pepper Chicken','Chinese Starters','Chinese',260),('Honey Chilli Chicken','Chinese Starters','Chinese',280),
 ('Szechuan Chicken','Chinese Starters','Chinese',270),('Crispy Fried Prawns','Chinese Starters','Chinese',340),
 ('Chilli Prawns','Chinese Starters','Chinese',360),('Salt & Pepper Squid','Chinese Starters','Chinese',360),
 ('Golden Fried Fish','Chinese Starters','Chinese',320),('Chicken Manchurian Dry','Chinese Starters','Chinese',250),
 ('Chicken Spring Rolls','Chinese Starters','Chinese',210),('Chicken Momos','Chinese Starters','Chinese',180),
 ('Kung Pao Chicken','Chinese Mains','Chinese',300),('Chicken in Hot Garlic Sauce','Chinese Mains','Chinese',290),
 ('Chilli Chicken Gravy','Chinese Mains','Chinese',280),('Chicken Manchurian Gravy','Chinese Mains','Chinese',280),
 ('Sweet & Sour Chicken','Chinese Mains','Chinese',290),('Prawns in Black Bean Sauce','Chinese Mains','Chinese',380),
 ('Fish in Lemon Sauce','Chinese Mains','Chinese',340),('Mongolian Lamb','Chinese Mains','Chinese',380),
 ('Thai Red Curry Chicken','Chinese Mains','Chinese',320),('Ginger Garlic Crab','Chinese Mains','Chinese',520),
 ('Chicken Fried Rice','Noodles & Fried Rice','Chinese',200),('Egg Fried Rice','Noodles & Fried Rice','Chinese',170),
 ('Schezwan Chicken Fried Rice','Noodles & Fried Rice','Chinese',220),('Mixed Meat Fried Rice','Noodles & Fried Rice','Chinese',260),
 ('Prawn Fried Rice','Noodles & Fried Rice','Chinese',260),('Burnt Garlic Chicken Rice','Noodles & Fried Rice','Chinese',230),
 ('Chicken Hakka Noodles','Noodles & Fried Rice','Chinese',210),('Egg Noodles','Noodles & Fried Rice','Chinese',180),
 ('Schezwan Chicken Noodles','Noodles & Fried Rice','Chinese',230),('Mixed Meat Noodles','Noodles & Fried Rice','Chinese',270),
 ('Prawn Noodles','Noodles & Fried Rice','Chinese',270),('Chicken Chopsuey','Noodles & Fried Rice','Chinese',280),
 ('Chicken Sweet Corn Soup','Soups','Chinese',140),('Chicken Hot & Sour Soup','Soups','Chinese',150),
 ('Chicken Manchow Soup','Soups','Chinese',150),('Lung Fung Soup','Soups','Chinese',170),
 ('Seafood Clear Soup','Soups','Chinese',190),('Chicken Wonton Soup','Soups','Chinese',170),
 ('Chettinad Chicken Fry','Tamil Nadu Specials','Tamil Nadu',260),('Nattu Kozhi Pepper Fry','Tamil Nadu Specials','Tamil Nadu',340),
 ('Mutton Chukka','Tamil Nadu Specials','Tamil Nadu',360),('Vanjaram Fish Fry','Tamil Nadu Specials','Tamil Nadu',420),
 ('Prawn Thokku','Tamil Nadu Specials','Tamil Nadu',360),('Crab Masala','Tamil Nadu Specials','Tamil Nadu',480),
 ('Kola Urundai','Tamil Nadu Specials','Tamil Nadu',220),('Mutton Sukka Varuval','Tamil Nadu Specials','Tamil Nadu',380),
 ('Kunafa','Desserts & Drinks','Arabian',240),('Umm Ali','Desserts & Drinks','Arabian',200),
 ('Mint Lemonade','Desserts & Drinks','Arabian',90),('Arabic Mint Tea','Desserts & Drinks','Arabian',60),
 ('Fresh Lime Soda','Desserts & Drinks','Tamil Nadu',70),('Watermelon Juice','Desserts & Drinks','Tamil Nadu',110),
 ('Sulaimani Tea','Desserts & Drinks','Arabian',40),('Date Shake','Desserts & Drinks','Arabian',150)
) as t(name, category, cuisine, price)) v;