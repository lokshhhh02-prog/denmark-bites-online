alter table public.orders
  add column payment_method text not null default 'cash_on_delivery',
  add column payment_status text not null default 'cod_pending',
  add column razorpay_order_id text,
  add column razorpay_payment_id text;

alter table public.orders
  add constraint orders_payment_method_check check (payment_method in ('online','cash_on_delivery')),
  add constraint orders_payment_status_check check (payment_status in ('pending_payment','paid','cod_pending'));

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null,
  account_name text not null,
  account_number text not null,
  ifsc text not null,
  branch_label text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.bank_accounts to authenticated;
grant all on public.bank_accounts to service_role;

alter table public.bank_accounts enable row level security;

create policy "Only owners can manage bank accounts"
  on public.bank_accounts
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'owner'))
  with check (public.has_role(auth.uid(), 'owner'));

create or replace function public.guard_bank_accounts_max3()
returns trigger
language plpgsql
security definer
set search_path to public
as $func$
begin
  if (select count(*) from public.bank_accounts) > 3 then
    raise exception 'You can store up to 3 bank accounts';
  end if;
  return coalesce(new, old);
end
$func$;

create trigger bank_accounts_max3
after insert on public.bank_accounts
for each row execute function public.guard_bank_accounts_max3();

create or replace function public.place_order(
  _branch integer,
  _type order_type,
  _name text,
  _phone text,
  _table text,
  _items jsonb,
  _payment text default 'cash_on_delivery'
)
returns json
language plpgsql
security definer
set search_path to public
as $func$
declare
  b public.branches; it jsonb; m public.menu_items; q int;
  lines jsonb := '[]'::jsonb; sub numeric := 0; gst numeric; pack numeric := 0; o public.orders;
  pay_method text; pay_status text;
begin
  select * into b from public.branches where id = _branch;
  if not found then raise exception 'Invalid branch'; end if;
  if not b.is_open then raise exception 'This branch is not accepting orders right now'; end if;
  if coalesce(_payment, 'cash_on_delivery') not in ('online','cash_on_delivery') then
    raise exception 'Invalid payment method';
  end if;
  pay_method := _payment;
  pay_status := case when _payment = 'online' then 'pending_payment' else 'cod_pending' end;
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
  insert into public.orders (branch_id, order_type, customer_name, phone, table_number, items, subtotal, gst_percent, gst_amount, packing_charge, total, payment_method, payment_status)
  values (_branch, _type, _name, _phone, _table, lines, sub, b.gst_percent, gst, pack, sub + gst + pack, pay_method, pay_status)
  returning * into o;
  return json_build_object('id', o.id, 'token', o.cancel_token, 'order_number', o.order_number);
end
$func$;

create or replace function public.get_order_public(_id uuid, _token uuid)
returns json
language sql
stable
security definer
set search_path to public
as $func$
  select json_build_object('id', o.id, 'order_number', o.order_number, 'branch_id', o.branch_id, 'branch_name', b.name,
    'order_type', o.order_type, 'customer_name', o.customer_name, 'table_number', o.table_number, 'items', o.items,
    'subtotal', o.subtotal, 'gst_percent', o.gst_percent, 'gst_amount', o.gst_amount, 'packing_charge', o.packing_charge,
    'total', o.total, 'status', o.status, 'payment_method', o.payment_method, 'payment_status', o.payment_status,
    'created_at', o.created_at)
  from public.orders o join public.branches b on b.id = o.branch_id
  where o.id = _id and o.cancel_token = _token
$func$;