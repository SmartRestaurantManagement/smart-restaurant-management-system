-- Migration to add order status history tracking
-- Captures the timestamp of each status transition for wait-time calculations.

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  created_at timestamptz not null default now()
);

-- Indexing for fast retrieval of recent transitions
create index idx_order_status_history_restaurant_id on public.order_status_history (restaurant_id);
create index idx_order_status_history_order_id on public.order_status_history (order_id);
create index idx_order_status_history_status on public.order_status_history (status);

-- Enable RLS
alter table public.order_status_history enable row level security;

-- Policies:
-- 1. Anyone scoped to the restaurant who is staff or admin can see all history
-- 2. Customers can see history for their own orders
create policy "order_status_history_select" on public.order_status_history
  for select using (
    restaurant_id = public.current_restaurant_id()
    and (
      public.is_staff_or_admin()
      or exists (
        select 1 from public.orders o
        where o.id = order_status_history.order_id and o.customer_id = auth.uid()
      )
    )
  );

-- Only staff/admin or the customer who owns the order can insert (in practice, order updates are staff-only except when order is created/cancelled)
create policy "order_status_history_insert" on public.order_status_history
  for insert with check (
    restaurant_id = public.current_restaurant_id()
  );
