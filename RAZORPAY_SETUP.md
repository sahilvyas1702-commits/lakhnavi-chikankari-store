# Razorpay + Netlify setup

The store uses two active Netlify Functions:

- `/api/create-order` calculates the amount from the server-side catalogue and creates an INR Razorpay order.
- `/api/verify-payment` validates the Razorpay signature, the signed-in Supabase customer, the paid amount and then stores the paid order.

The old `/api/save-order` endpoint is disabled so browser clients cannot insert arbitrary orders.

## Netlify environment variables

Add these in **Project configuration → Environment variables**:

1. `RAZORPAY_KEY_ID`
2. `RAZORPAY_KEY_SECRET`
3. `SUPABASE_SECRET_KEY`

`SUPABASE_SERVICE_ROLE_KEY` is accepted as an alternative name for the third value. Do not add both.

Never put either secret in `config.js`, `script.js`, HTML, GitHub or chat. The Supabase project URL and publishable browser key in `config.js` are public configuration.

## Before accepting payments

1. Run `supabase_orders.sql` in Supabase SQL Editor.
2. Use Razorpay Test Mode credentials.
3. Redeploy after adding or changing environment variables.
4. Create a customer account, add an item and complete an official Razorpay test payment.
5. Confirm the order appears in **My Account** and in the Supabase `orders` table.
6. Rotate any key secret that has ever been shared in chat before switching to Live Mode.
