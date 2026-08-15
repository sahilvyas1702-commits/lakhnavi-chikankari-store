import { PRODUCTS } from './_products.js';

const DEFAULT_SUPABASE_URL = 'https://tmuzndpbjvmtcuwmneow.supabase.co';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const body = await request.json().catch(() => ({}));
    const {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
      order
    } = body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return json(400, { verified: false, error: 'Missing payment details.' });
    }

    const razorpayKeyId = env.RAZORPAY_KEY_ID;
    const razorpaySecret = env.RAZORPAY_KEY_SECRET;
    const supabaseSecret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
    if (!razorpayKeyId || !razorpaySecret) {
      return json(500, { verified: false, error: 'Razorpay is not configured on the server.' });
    }
    if (!supabaseSecret) {
      return json(500, { verified: false, error: 'Order storage is not configured on the server.' });
    }

    const expectedSignature = await hmacSha256Hex(razorpaySecret, `${razorpayOrderId}|${razorpayPaymentId}`);
    if (!safeEqualHex(expectedSignature, String(razorpaySignature))) {
      return json(400, { verified: false, error: 'Payment signature verification failed.' });
    }

    const accessToken = String(request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!accessToken) {
      return json(401, { verified: false, error: 'Sign in again before verifying payment.' });
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseSecret, Authorization: `Bearer ${accessToken}` }
    });
    const user = await userResponse.json().catch(() => ({}));
    if (!userResponse.ok || !user.id) {
      return json(401, { verified: false, error: 'Your customer session has expired. Please sign in again.' });
    }

    const customerName = cleanText(order?.customer_name, 120);
    const customerPhone = cleanText(order?.phone, 30);
    const customerAddress = cleanText(order?.address, 1000);
    if (!customerName || customerPhone.replace(/\D/g, '').length < 10 || !customerAddress) {
      return json(400, { verified: false, error: 'Complete customer and delivery details are required.' });
    }

    const normalizedItems = normalizeItems(order?.items);
    if (!normalizedItems.length) {
      return json(400, { verified: false, error: 'The paid order does not contain valid items.' });
    }
    const totalAmount = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const razorpayAuth = btoa(`${razorpayKeyId}:${razorpaySecret}`);
    const razorpayResponse = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(razorpayOrderId)}`, {
      headers: { Authorization: `Basic ${razorpayAuth}` }
    });
    const razorpayOrder = await razorpayResponse.json().catch(() => ({}));
    if (!razorpayResponse.ok) {
      return json(502, { verified: false, error: 'Could not confirm the paid amount with Razorpay.' });
    }
    if (
      razorpayOrder.id !== razorpayOrderId ||
      razorpayOrder.currency !== 'INR' ||
      Number(razorpayOrder.amount) !== totalAmount * 100 ||
      Number(razorpayOrder.amount_paid) < Number(razorpayOrder.amount) ||
      String(razorpayOrder.notes?.user_id || '') !== String(user.id)
    ) {
      return json(400, { verified: false, error: 'The paid amount does not match the order total.' });
    }

    const payload = {
      user_id: user.id,
      customer_name: customerName,
      phone: customerPhone,
      address: customerAddress,
      city: '',
      state: '',
      pincode: '',
      items: normalizedItems,
      total_amount: totalAmount,
      amount: totalAmount * 100,
      currency: 'INR',
      payment_status: 'paid',
      order_status: 'pending',
      status: 'paid',
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      updated_at: new Date().toISOString()
    };

    const databaseResponse = await fetch(`${supabaseUrl}/rest/v1/orders?on_conflict=razorpay_order_id`, {
      method: 'POST',
      headers: {
        apikey: supabaseSecret,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal'
      },
      body: JSON.stringify(payload)
    });

    if (!databaseResponse.ok) {
      const details = await databaseResponse.text();
      console.error('Supabase order insert failed:', databaseResponse.status, details);
      return json(500, {
        verified: true,
        saved: false,
        paymentId: razorpayPaymentId,
        error: 'Payment was verified, but the order could not be saved. Please contact the shop with your payment ID.'
      });
    }

    return json(200, {
      verified: true,
      saved: true,
      paymentId: razorpayPaymentId
    });
  } catch (error) {
    console.error('verify-payment error:', error);
    return json(500, { verified: false, error: 'Could not verify payment.' });
  }
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  const normalized = [];
  for (const item of items) {
    const id = String(item?.id || '');
    const product = PRODUCTS[id];
    if (!product) return [];
    const quantity = Math.max(1, Math.min(10, Number(item.quantity) || 1));
    normalized.push({ id, name: product.name, price: product.price, quantity });
  }
  return normalized;
}

function cleanText(value, maximumLength) {
  return String(value || '').trim().slice(0, maximumLength);
}

function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
