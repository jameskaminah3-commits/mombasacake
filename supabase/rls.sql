-- Apply this in the Supabase SQL editor or your migration flow.
-- The app's API server continues to own writes through DATABASE_URL/service credentials.
-- These policies are for direct Supabase access and make the public catalog readable
-- while keeping operational tables locked down.

alter table public.cakes enable row level security;
alter table public.categories enable row level security;
alter table public.blog_posts enable row level security;
alter table public.promotions enable row level security;
alter table public.reviews enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.customers enable row level security;
alter table public.admins enable row level security;
alter table public.admin_password_resets enable row level security;
alter table public.payments enable row level security;

drop policy if exists "Public can read cakes" on public.cakes;
create policy "Public can read cakes"
on public.cakes
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read categories" on public.categories;
create policy "Public can read categories"
on public.categories
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read published blog posts" on public.blog_posts;
create policy "Public can read published blog posts"
on public.blog_posts
for select
to anon, authenticated
using (published = true);

drop policy if exists "Public can read active promotions" on public.promotions;
create policy "Public can read active promotions"
on public.promotions
for select
to anon, authenticated
using (active = true);

drop policy if exists "Public can read approved reviews" on public.reviews;
create policy "Public can read approved reviews"
on public.reviews
for select
to anon, authenticated
using (approved = 1);

-- Leave write access to the API server. If you later move any workflow to direct
-- Supabase client access, add targeted INSERT/UPDATE policies instead of opening
-- these tables globally.
