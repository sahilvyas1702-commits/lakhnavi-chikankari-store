(() => {
  const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const config = window.SHOP_CONFIG || {};
  const configured = config.SUPABASE_URL && config.SUPABASE_ANON_KEY && !config.SUPABASE_URL.includes('YOUR-PROJECT') && !config.SUPABASE_ANON_KEY.includes('YOUR-');
  const client = configured && window.supabase?.createClient ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY) : null;
  const required = document.getElementById('accountRequired');
  const ordersPanel = document.getElementById('customerOrders');
  const status = document.getElementById('ordersStatus');

  if (!client) {
    required.querySelector('h2').textContent = 'Account service is not configured';
    required.querySelector('p').textContent = 'Contact the store for order assistance while account access is being configured.';
    required.querySelector('a').href = 'contact.html';
    required.querySelector('a').textContent = 'Contact the store';
    return;
  }

  client.auth.getSession().then(({ data }) => showSession(data.session));
  client.auth.onAuthStateChange((_event, session) => showSession(session));

  async function showSession(session) {
    const signedIn = Boolean(session?.user);
    required.hidden = signedIn;
    ordersPanel.hidden = !signedIn;
    if (!signedIn) return;
    document.getElementById('customerEmail').textContent = session.user.email || 'Customer';
    await loadOrders(session.user.id);
  }

  async function loadOrders(userId) {
    status.textContent = 'Loading your secure order history…';
    const { data, error } = await client.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) {
      status.textContent = error.message || 'Could not load your orders.';
      return;
    }
    const orders = Array.isArray(data) ? data : [];
    status.textContent = orders.length ? `Showing ${orders.length} paid ${orders.length === 1 ? 'order' : 'orders'}.` : 'No paid orders are saved for this account yet.';
    document.getElementById('orderCount').textContent = String(orders.length);
    document.getElementById('orderValue').textContent = money(orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0));
    document.getElementById('latestStatus').textContent = orders.length ? readableStatus(orders[0].order_status) : '—';
    document.getElementById('customerOrderList').innerHTML = orders.length ? orders.map(orderCard).join('') : '<div class="empty-order-state"><h3>No orders yet</h3><p>Your paid orders will appear here after payment verification.</p><a class="btn primary" href="index.html#collection">Browse the collection</a></div>';
  }

  function orderCard(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    const current = String(order.order_status || 'pending').toLowerCase();
    const cancelled = current === 'cancelled';
    const steps = ['confirmed', 'processing', 'shipped', 'delivered'];
    const activeIndex = current === 'pending' ? -1 : steps.indexOf(current);
    const date = new Date(order.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    return `<article class="customer-order-card">
      <header><div><span>ORDER #${escapeHtml(order.id)}</span><h2>${money(order.total_amount)}</h2></div><span class="status-badge status-${escapeHtml(current)}">${escapeHtml(readableStatus(current))}</span></header>
      <p class="order-date">Placed ${escapeHtml(date)} · Payment ${escapeHtml(readableStatus(order.payment_status || 'paid'))}</p>
      <ul>${items.map(item => `<li><span>${escapeHtml(item.name || item.id)}</span><b>× ${escapeHtml(item.quantity || 1)}</b></li>`).join('')}</ul>
      ${cancelled ? '<p class="cancelled-note">This order is marked cancelled. Contact the store if you need clarification.</p>' : `<ol class="order-progress">${steps.map((step, index) => `<li class="${index <= activeIndex ? 'complete' : ''}"><span></span><small>${escapeHtml(readableStatus(step))}</small></li>`).join('')}</ol>`}
      ${order.tracking_reference ? `<p class="tracking-line"><strong>Tracking / dispatch reference</strong><span>${escapeHtml(order.tracking_reference)}</span></p>` : ''}
      <footer><span>Payment ID: ${escapeHtml(order.razorpay_payment_id || 'Not available')}</span><a href="https://wa.me/919899551923?text=${encodeURIComponent(`Hello Lakhnavi Chikankari, I need help with order #${order.id}.`)}" target="_blank" rel="noopener">Get help →</a></footer>
    </article>`;
  }

  function readableStatus(value) {
    const text = String(value || 'pending').replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  document.getElementById('refreshOrdersBtn')?.addEventListener('click', async () => {
    const { data } = await client.auth.getSession();
    if (data.session?.user) await loadOrders(data.session.user.id);
  });
  document.getElementById('ordersSignOutBtn')?.addEventListener('click', () => client.auth.signOut());
})();
