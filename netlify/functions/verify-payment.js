const crypto = require('crypto');
const PRODUCTS = require('./_products');

const SUPABASE_URL = 'https://usachjujxgnkcqwtbqsq.supabase.co';

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
      order
    } = body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return json(400, { verified: false, error: 'Missing payment details.' });
    }

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
    const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!razorpayKeyId || !razorpaySecret) {
      return json(500, { verified: false, error: 'Razorpay is not configured on the server.' });
    }
    if (!supabaseSecret) {
      return json(500, { verified: false, error: 'Order storage is not configured on the server.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', razorpaySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(String(razorpaySignature), 'utf8');
    if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return json(400, { verified: false, error: 'Payment signature verification failed.' });
    }

    const accessToken = String(event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
    if (!accessToken) {
      return json(401, { verified: false, error: 'Sign in again before verifying payment.' });
    }

    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: supabaseSecret,
        Authorization: `Bearer ${accessToken}`
      }
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

    const razorpayAuth = Buffer.from(`${razorpayKeyId}:${razorpaySecret}`).toString('base64');
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

    const databaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders?on_conflict=razorpay_order_id`, {
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
};

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
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}
