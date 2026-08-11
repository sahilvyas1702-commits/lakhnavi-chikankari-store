LAKHNAVI CHIKANKARI — COLLECTION STOREFRONT
===========================================

This is a separate, deploy-ready website inspired by the shopping flow of the
reference collection page. Its branding, wording, products and interface are
original to Lakhnavi Chikankari.

WHAT IS INCLUDED
----------------
- Collection-first homepage with responsive desktop and mobile layouts
- Product search, sorting, colour filters, price filter and quick view
- Dedicated product pages with richer craft, care, fit and ordering guidance
- Separate Our Story, Care Guide, Contact, My Orders and Order Management pages
- Persistent shopping bag and WhatsApp bag ordering
- Newsletter and WhatsApp contact shortcuts
- Supabase sign up, sign in, password reset, profile and order history
- Razorpay Standard Checkout through protected Netlify Functions
- Server-side verification of customer session, signature and paid amount
- Supabase-policy-protected admin order status and tracking updates

FREE WEBSITE ADDRESS
--------------------
Netlify can host this folder with an available address such as:
https://YOUR-SITE-NAME.netlify.app

This is a free provider subdomain, not a free .com or .in registration. Domain
availability, plan limits and Netlify's terms still apply. See
FREE_DOMAIN_DEPLOY.txt for the publishing steps.

FIRST-TIME DATABASE SETUP
-------------------------
In Supabase, open SQL Editor and run supabase_orders.sql once. The script is
safe to run against the older package: it adds missing columns, profile storage
and Row Level Security policies without deleting existing data.

NETLIFY ENVIRONMENT VARIABLES
-----------------------------
Add these server-only values in Netlify:
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- SUPABASE_SECRET_KEY

SUPABASE_SERVICE_ROLE_KEY is also accepted as the final variable name, but use
only one of those two Supabase secret variables.

ORDER MANAGEMENT
----------------
Run the latest supabase_orders.sql before using the admin page. It adds order
status, tracking reference, private admin note and update-time fields without
deleting existing orders. Then replace YOUR-ADMIN-EMAIL in ADMIN_SETUP.sql and
run that statement once. Sign in with the approved email and open
/admin-orders.html. The private administrator list and order rules stay inside
Supabase Row Level Security; customer accounts cannot read other customers'
orders or update fulfilment fields.

Never place a Razorpay secret or Supabase secret/service-role key in config.js,
script.js, HTML, GitHub or chat. The publishable Supabase browser key in
config.js is expected to be public.

SUPABASE AUTH URLS
------------------
In Supabase Authentication → URL Configuration, add the live Netlify URL as
the Site URL and an allowed Redirect URL. Also allow:
https://YOUR-SITE-NAME.netlify.app/reset-password.html

PAYMENT SAFETY
--------------
Test with Razorpay Test Mode first. Rotate any secret that has ever been pasted
into chat or stored in a browser file before switching to Live Mode.
