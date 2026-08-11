(() => {
  const config = window.SHOP_CONFIG || {};
  const configured = config.SUPABASE_URL && config.SUPABASE_ANON_KEY && !config.SUPABASE_URL.includes('YOUR-PROJECT') && !config.SUPABASE_ANON_KEY.includes('YOUR-');
  const client = configured && window.supabase?.createClient ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY) : null;
  const gate = document.getElementById('adminGate');
  const panel = document.getElementById('adminPanel');
  const status = document.getElementById('adminStatus');
  let session = null;
  let orders = [];

  const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  if (!client) {
    gate.querySelector('h2').textContent = 'Administration is not configured';
    gate.querySelector('p').textContent = 'The Supabase browser configuration is missing.';
    return;
  }

  client.auth.getSession().then(({ data }) => handleSession(data.session));
  client.auth.onAuthStateChange((_event, nextSession) => handleSession(nextSession));

  async function handleSession(nextSession) {
    session = nextSession || null;
    if (!session?.user) {
      gate.hidden = false;
      panel.hidden = true;
      return;
    }

    const { data: allowed, error } = await client.rpc('is_order_admin');
    if (error || !allowed) {
      gate.hidden = false;
      panel.hidden = true;
      gate.querySelector('h2').textContent = 'Administrator access not approved';
      gate.querySelector('p').textContent = 'This signed-in account is not approved for the private order workspace. Customer order history remains available from My orders.';
      gate.querySelector('a').textContent = 'Return to the shop';
      gate.querySelector('a').href = 'index.html';
      return;
    }

    gate.hidden = true;
    panel.hidden = false;
    document.getElementById('adminEmail').textContent = session.user.email || 'Order administrator';
    await loadOrders();
  }

  async function loadOrders() {
    status.textContent = 'Loading protected order data…';
    const fields = 'id,user_id,customer_name,phone,address,city,state,pincode,items,total_amount,amount,currency,payment_status,order_status,status,razorpay_order_id,razorpay_payment_id,tracking_reference,admin_note,created_at,updated_at';
    const { data, error } = await client.from('orders').select(fields).order('created_at', { ascending: false }).limit(250);
    if (error) {
      orders = [];
      status.textContent = error.message || 'Could not load order management.';
      render();
      return;
    }
    orders = Array.isArray(data) ? data : [];
    status.textContent = `Loaded ${orders.length} ${orders.length === 1 ? 'order' : 'orders'}.`;
    updateMetrics();
    render();
  }

  function filteredOrders() {
    const query = document.getElementById('adminSearch').value.trim().toLowerCase();
    const filter = document.getElementById('adminStatusFilter').value;
    return orders.filter(order => {
      const haystack = [order.id, order.customer_name, order.phone, order.razorpay_payment_id, order.razorpay_order_id].join(' ').toLowerCase();
      return (!query || haystack.includes(query)) && (filter === 'all' || String(order.order_status || 'pending') === filter);
    });
  }

  function render() {
    const visible = filteredOrders();
    document.getElementById('adminOrderList').innerHTML = visible.length ? visible.map(orderCard).join('') : '<div class="empty-order-state"><h3>No matching orders</h3><p>Change the search or status filter, then try again.</p></div>';
  }

  function orderCard(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    const current = String(order.order_status || 'pending').toLowerCase();
    const date = new Date(order.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const options = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map(item => `<option value="${item}" ${item === current ? 'selected' : ''}>${readable(item)}</option>`).join('');
    return `<article class="admin-order-card" data-order-id="${escapeHtml(order.id)}">
      <header><div><span>ORDER #${escapeHtml(order.id)} · ${escapeHtml(date)}</span><h2>${escapeHtml(order.customer_name || 'Customer')} — ${money(order.total_amount)}</h2></div><span class="status-badge status-${escapeHtml(current)}">${escapeHtml(readable(current))}</span></header>
      <div class="admin-order-grid"><div><h3>Customer</h3><p><a href="tel:${escapeHtml(order.phone || '')}">${escapeHtml(order.phone || 'No phone')}</a><br>${escapeHtml(order.address || 'No address')}</p><a href="https://wa.me/${String(order.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hello, this is Lakhnavi Chikankari regarding order #${order.id}.`)}" target="_blank" rel="noopener">Message customer →</a></div><div><h3>Items</h3><ul>${items.map(item => `<li>${escapeHtml(item.name || item.id)} <b>× ${escapeHtml(item.quantity || 1)}</b></li>`).join('')}</ul></div><div><h3>Payment</h3><p>${escapeHtml(readable(order.payment_status || 'paid'))}<br><small>${escapeHtml(order.razorpay_payment_id || 'No payment ID')}</small></p></div></div>
      <form class="order-update-form"><label>Status<select name="order_status">${options}</select></label><label>Tracking / dispatch reference<input name="tracking_reference" value="${escapeHtml(order.tracking_reference || '')}" maxlength="160" placeholder="Courier and tracking number"></label><label>Private admin note<textarea name="admin_note" rows="2" maxlength="500" placeholder="Internal note">${escapeHtml(order.admin_note || '')}</textarea></label><button class="btn primary" type="submit">Save update</button><p class="form-message" role="status"></p></form>
    </article>`;
  }

  async function saveOrder(form) {
    const card = form.closest('[data-order-id]');
    const message = form.querySelector('.form-message');
    const button = form.querySelector('button[type=submit]');
    message.textContent = 'Saving update…';
    button.disabled = true;
    const payload = {
      order_id: card.dataset.orderId,
      order_status: form.elements.order_status.value,
      tracking_reference: form.elements.tracking_reference.value,
      admin_note: form.elements.admin_note.value
    };
    try {
      const { data, error } = await client.from('orders').update({
        order_status: payload.order_status,
        tracking_reference: payload.tracking_reference.trim().slice(0, 160),
        admin_note: payload.admin_note.trim().slice(0, 500),
        updated_at: new Date().toISOString()
      }).eq('id', payload.order_id).select().single();
      if (error) throw new Error(error.message || 'Could not update order.');
      const index = orders.findIndex(order => String(order.id) === String(payload.order_id));
      if (index >= 0) orders[index] = { ...orders[index], ...data };
      message.textContent = 'Order updated successfully.';
      updateMetrics();
      render();
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  }

  function updateMetrics() {
    document.getElementById('adminTotalOrders').textContent = String(orders.length);
    document.getElementById('adminPaidValue').textContent = money(orders.filter(order => order.payment_status === 'paid').reduce((sum, order) => sum + Number(order.total_amount || 0), 0));
    document.getElementById('adminNeedsAction').textContent = String(orders.filter(order => ['pending', 'confirmed', 'processing'].includes(order.order_status || 'pending')).length);
    document.getElementById('adminDelivered').textContent = String(orders.filter(order => order.order_status === 'delivered').length);
  }

  function exportCsv() {
    if (!orders.length) return;
    const rows = [['Order', 'Created', 'Customer', 'Phone', 'Amount INR', 'Payment', 'Status', 'Payment ID', 'Tracking']];
    orders.forEach(order => rows.push([order.id, order.created_at, order.customer_name, order.phone, order.total_amount, order.payment_status, order.order_status, order.razorpay_payment_id, order.tracking_reference]));
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `lakhnavi-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const readable = value => { const text = String(value || 'pending').replace(/_/g, ' '); return text.charAt(0).toUpperCase() + text.slice(1); };
  document.getElementById('adminOrderList').addEventListener('submit', event => { if (event.target.matches('.order-update-form')) { event.preventDefault(); saveOrder(event.target); } });
  document.getElementById('adminSearch').addEventListener('input', render);
  document.getElementById('adminStatusFilter').addEventListener('change', render);
  document.getElementById('adminRefreshBtn').addEventListener('click', loadOrders);
  document.getElementById('exportOrdersBtn').addEventListener('click', exportCsv);
})();
