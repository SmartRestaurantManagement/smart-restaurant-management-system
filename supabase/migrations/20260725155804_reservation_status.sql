-- Add a lifecycle status to reservations. A booking existing is not the
-- same as it being honored: a customer can no-show, staff can seat early,
-- etc. Needed for the reservations API's status filter/update.

create type public.reservation_status as enum (
  'pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'
);

alter table public.reservations
  add column status public.reservation_status not null default 'pending';

create index idx_reservations_status on public.reservations (status);
