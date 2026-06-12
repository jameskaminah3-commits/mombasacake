-- Apply this in Supabase to create the payment settings row used by checkout.
-- The API server will keep this table in sync if it already exists.

create table if not exists public.payment_settings (
  id serial primary key,
  settings_key text not null default 'default',
  provider text not null default 'mpesa',
  display_name text not null default 'MPesa',
  business_short_code text not null default '174379',
  transaction_type text not null default 'CustomerPayBillOnline',
  account_reference_prefix text not null default 'Order',
  instructions text not null default 'You will receive an MPesa prompt on your phone after clicking Pay. If the prompt does not arrive, use the business shortcode and order reference shown in the checkout screen.',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.payment_settings add column if not exists settings_key text not null default 'default';
alter table public.payment_settings add column if not exists provider text not null default 'mpesa';
alter table public.payment_settings add column if not exists display_name text not null default 'MPesa';
alter table public.payment_settings add column if not exists business_short_code text not null default '174379';
alter table public.payment_settings add column if not exists transaction_type text not null default 'CustomerPayBillOnline';
alter table public.payment_settings add column if not exists account_reference_prefix text not null default 'Order';
alter table public.payment_settings add column if not exists instructions text not null default 'You will receive an MPesa prompt on your phone after clicking Pay. If the prompt does not arrive, use the business shortcode and order reference shown in the checkout screen.';
alter table public.payment_settings add column if not exists created_at timestamp with time zone not null default now();
alter table public.payment_settings add column if not exists updated_at timestamp with time zone not null default now();

insert into public.payment_settings (
  settings_key,
  provider,
  display_name,
  business_short_code,
  transaction_type,
  account_reference_prefix,
  instructions
)
select
  'default',
  'mpesa',
  'MPesa',
  '174379',
  'CustomerPayBillOnline',
  'Order',
  'You will receive an MPesa prompt on your phone after clicking Pay. If the prompt does not arrive, use the business shortcode and order reference shown in the checkout screen.'
where not exists (
  select 1 from public.payment_settings where settings_key = 'default'
);
