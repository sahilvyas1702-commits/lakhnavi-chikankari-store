// Legacy endpoint intentionally disabled.
// Paid orders are written only by verify-payment.js after Razorpay signature,
// amount and customer-session verification.
exports.handler = async () => ({
  statusCode: 410,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify({ error: 'This endpoint is no longer available.' })
});
