-- Run this in the Supabase SQL editor to add or update an admin account.
-- Replace the email, name, and password before running.
create extension if not exists pgcrypto;

insert into public.admins (email, name, password_hash)
values (
  lower('admin@example.com'),
  'Admin',
  crypt('replace-with-a-private-password', gen_salt('bf', 12))
)
on conflict (email) do update
set
  name = excluded.name,
  password_hash = excluded.password_hash;
