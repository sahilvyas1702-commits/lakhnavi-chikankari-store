-- Run this after supabase_orders.sql to approve a store administrator.
-- Replace the placeholder with the email used to sign in to the storefront.

insert into public.order_admins (email)
values (lower('YOUR-ADMIN-EMAIL'))
on conflict (email) do nothing;
