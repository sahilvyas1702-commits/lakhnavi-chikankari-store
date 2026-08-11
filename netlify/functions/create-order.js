const PRODUCTS = require('./_products');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://usachjujxgnkcqwtbqsq.supabase.co';

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!keyId || !keySecret) return json(503, { error: 'Secure payment is not configured yet.' });
    if (!supabaseSecret) return json(503, { error: 'Customer verification is not configured yet.' });

    const user = await authenticatedUser(event, supabaseSecret);
    if (!user) return json(401, { error: 'Sign in again before starting payment.' });

    const body = JSON.parse(event.body || '{}');
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length || items.length > 20) return json(400, { error: 'Your bag is empty or contains too many lines.' });

    let amount = 0;
    const normalizedItems = [];
    for (const item of items) {
      const id = String(item?.id || '');
      const product = PRODUCTS[id];
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
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
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
    if (razorpayResponse.status === 401) return json(502, { error: 'Payment authentication failed on the server.' });
    if (!razorpayResponse.ok) return json(502, { error: data.error?.description || 'Could not create a payment order.' });

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
};

async function authenticatedUser(event, supabaseSecret) {
  const token = String(event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: supabaseSecret, Authorization: `Bearer ${token}` }
  });
  const user = await response.json().catch(() => ({}));
  return response.ok && user.id ? user : null;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}
