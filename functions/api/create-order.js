import { PRODUCTS } from './_products.js';

const DEFAULT_SUPABASE_URL = 'https://tmuzndpbjvmtcuwmneow.supabase.co';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const keyId = env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET;
    const supabaseSecret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
    if (!keyId || !keySecret) return json(503, { error: 'Secure payment is not configured yet.' });
    if (!supabaseSecret) return json(503, { error: 'Customer verification is not configured yet.' });

    const user = await authenticatedUser(request, supabaseUrl, supabaseSecret);
    if (!user) return json(401, { error: 'Sign in again before starting payment.' });

    const body = await request.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length || items.length > 20) {
      return json(400, { error: 'Your bag is empty or contains too many lines.' });
    }

    // Validate against the live catalogue when it is reachable, otherwise fall
    // back to the static mirror so checkout still works during deployment.
    const catalog = (await fetchCatalog(supabaseUrl, supabaseSecret)) || PRODUCTS;

    let amount = 0;
    const normalizedItems = [];
    for (const item of items) {
      const id = String(item?.id || '');
      const product = catalog[id];
      const quantity = Math.max(1, Math.min(10, Number(item?.quantity) || 1));
      if (!product) return json(400, { error: `A product in your bag is no longer available (${id}).` });
      amount += product.price * quantity;
      normalizedItems.push({ id, quantity, name: product.name, price: product.price });
    }

    const amountPaise = amount * 100;
    if (amountPaise < 100) return json(400, { error: 'Minimum order amount is ₹1.' });
    if (amountPaise > 50000000) return json(400, { error: 'Order amount is too high.' });

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: `lc_${Date.now()}`,
        notes: { shop: 'Lakhnavi Chikankari', user_id: user.id }
      })
    });

    const data = await razorpayResponse.json().catch(() => ({}));
    if (razorpayResponse.status === 401) {
      return json(502, { error: 'Payment authentication failed on the server.' });
    }
    if (!razorpayResponse.ok) {
      return json(502, { error: data.error?.description || 'Could not create a payment order.' });
    }

    return json(200, {
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      keyId,
      items: normalizedItems
    });
  } catch (error) {
    console.error('create-order error:', error);
    return json(500, { error: 'Server error while creating the payment order.' });
  }
}

async function fetchCatalog(supabaseUrl, supabaseSecret) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/products?select=id,name,price&active=eq.true&order=sort_order`, {
      headers: { apikey: supabaseSecret, Authorization: `Bearer ${supabaseSecret}` }
    });
    if (!response.ok) return null;
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    const catalog = {};
    rows.forEach(row => { catalog[row.id] = { name: row.name, price: Number(row.price) || 0 }; });
    return catalog;
  } catch (_error) {
    return null;
  }
}

async function authenticatedUser(request, supabaseUrl, supabaseSecret) {
  const token = String(request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseSecret, Authorization: `Bearer ${token}` }
  });
  const user = await response.json().catch(() => ({}));
  return response.ok && user.id ? user : null;
}

function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
