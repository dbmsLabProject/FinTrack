-- Optional note attached to a transaction. The default keeps existing rows valid.
alter table public.transactions
  add column if not exists comment text not null default '';

comment on column public.transactions.comment is
  'Optional user-provided note for the transaction.';
