document.documentElement.classList.add('js');

const phone = (window.SHOP_PHONE && window.SHOP_PHONE.wa) || '919899551923';
const products = window.PRODUCTS || {};
let authMode = 'signin';
let supabaseClient = null;
let currentSession = null;
let activeFilter = 'all';
let activeMaxPrice = Number.POSITIVE_INFINITY;
let activeSort = 'featured';
let modalTrigger = null;
let toastTimer = null;

let cart = {};
try {
  const savedCart = JSON.parse(localStorage.getItem('lc_cart') || '{}');
  cart = savedCart && typeof savedCart === 'object' && !Array.isArray(savedCart) ? savedCart : {};
} catch (_error) {
  cart = {};
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

function configuredSupabase() {
  return window.SHOP_CONFIG &&
    window.SHOP_CONFIG.SUPABASE_URL &&
    !window.SHOP_CONFIG.SUPABASE_URL.includes('YOUR-PROJECT') &&
    window.SHOP_CONFIG.SUPABASE_ANON_KEY &&
    !window.SHOP_CONFIG.SUPABASE_ANON_KEY.includes('YOUR-');
}

if (configuredSupabase() && window.supabase?.createClient) {
  supabaseClient = window.supabase.createClient(
    window.SHOP_CONFIG.SUPABASE_URL,
    window.SHOP_CONFIG.SUPABASE_ANON_KEY
  );
}

// Catalogue
function stars(rating) {
  const value = Number(rating) || 0;
  const full = Math.round(value);
  return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
}

function discountPercent(product) {
  const compare = Number(product.compareAt || 0);
  const price = Number(product.price || 0);
  if (!compare || compare <= price) return 0;
  return Math.round(((compare - price) / compare) * 100);
}

function productCard([id, product], index) {
  const number = String(index + 1).padStart(2, '0');
  const percent = discountPercent(product);
  const badge = product.badge || (percent ? `${percent}% off` : 'Handmade');
  const compareAt = product.compareAt && Number(product.compareAt) > Number(product.price)
    ? `<s class="compare-price">${money(product.compareAt)}</s>` : '';
  const rating = product.rating
    ? `<span class="card-rating"><span class="stars" aria-hidden="true">${stars(product.rating)}</span> <em>${Number(product.rating).toFixed(1)} (${product.reviews || 0})</em></span>`
    : '';
  return `<article class="product-card" data-id="${escapeHtml(id)}" data-name="${escapeHtml(product.name.toLowerCase())}" data-category="${escapeHtml(product.category || '')}" data-reveal>
    <button class="product-visual" type="button" data-quick="${escapeHtml(id)}" aria-label="View details for ${escapeHtml(product.name)}">
      <img src="${escapeHtml(product.image)}" width="750" height="1000" alt="${escapeHtml(product.name)}" loading="lazy">
      <span class="tag ${percent ? 'is-sale' : ''}">${escapeHtml(badge)}</span>
      <span class="view-pill">Quick view</span>
    </button>
    <div class="product-info">
      <span class="product-no">KURTI • ${number}</span>
      <h3><a href="product.html?id=${encodeURIComponent(id)}">${escapeHtml(product.name)}</a></h3>
      ${rating}
      <p>${escapeHtml(product.description || '')}</p>
      <div class="product-price-row"><strong class="product-price">${money(product.price)}</strong>${compareAt}<span class="availability">Sizes on request</span></div>
      <div class="product-actions">
        <a class="card-button details" href="product.html?id=${encodeURIComponent(id)}">Full details</a>
        <button class="card-button add" type="button" data-add="${escapeHtml(id)}">Add to bag</button>
      </div>
    </div>
  </article>`;
}

const productGrid = document.getElementById('productGrid');

function sortedProductEntries() {
  const entries = Object.entries(products);
  if (activeSort === 'price-asc') entries.sort(([, a], [, b]) => a.price - b.price);
  if (activeSort === 'price-desc') entries.sort(([, a], [, b]) => b.price - a.price);
  if (activeSort === 'name-asc') entries.sort(([, a], [, b]) => a.name.localeCompare(b.name));
  if (activeSort === 'name-desc') entries.sort(([, a], [, b]) => b.name.localeCompare(a.name));
  return entries;
}

function renderProductGrid() {
  if (!productGrid) return;
  productGrid.innerHTML = sortedProductEntries().map(productCard).join('');
  updateProductResults();
  observeReveals();
}

function updateProductResults() {
  const search = document.getElementById('productSearch')?.value.trim().toLowerCase() || '';
  let visibleCount = 0;

  document.querySelectorAll('.product-card').forEach(card => {
    const categoryMatch = activeFilter === 'all' || card.dataset.category.split(' ').includes(activeFilter);
    const searchMatch = !search || card.dataset.name.includes(search);
    const priceMatch = Number(products[card.dataset.id]?.price || 0) <= activeMaxPrice;
    const show = categoryMatch && searchMatch && priceMatch;
    card.hidden = !show;
    if (show) visibleCount += 1;
  });

  const total = Object.keys(products).length;
  const count = document.getElementById('resultCount');
  if (count) count.textContent = visibleCount === total
    ? `${total} products`
    : `${visibleCount} of ${total} products`;
  document.getElementById('noResults').hidden = visibleCount !== 0;
}

function selectFilter(value) {
  activeFilter = value;
  document.querySelectorAll('.filter').forEach(item => {
    const selected = item.dataset.filter === value;
    item.classList.toggle('active', selected);
    item.setAttribute('aria-pressed', String(selected));
    if (item.getAttribute('role') === 'tab') item.setAttribute('aria-selected', String(selected));
  });
  document.querySelectorAll('input[name="drawerFilter"]').forEach(input => {
    input.checked = input.value === value;
  });
  updateProductResults();
}

document.querySelectorAll('.filter').forEach(filter => {
  filter.addEventListener('click', () => selectFilter(filter.dataset.filter));
});

document.getElementById('productSearch')?.addEventListener('input', updateProductResults);
document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
  const search = document.getElementById('productSearch');
  if (search) search.value = '';
  activeMaxPrice = Number.POSITIVE_INFINITY;
  const maxPrice = document.getElementById('maxPrice');
  if (maxPrice) maxPrice.value = maxPrice.max;
  updatePriceOutput();
  selectFilter('all');
});

document.getElementById('sortProducts')?.addEventListener('change', event => {
  activeSort = event.target.value;
  renderProductGrid();
});

let quickQty = 1;
let quickSize = '';

function openProduct(id) {
  const product = products[id];
  if (!product) return;
  quickQty = 1;
  quickSize = '';
  const image = document.getElementById('quickImage');
  image.src = product.image;
  image.alt = product.name;
  document.getElementById('quickTitle').textContent = product.name;
  document.getElementById('quickPrice').textContent = money(product.price);
  const compare = document.getElementById('quickCompare');
  if (product.compareAt && Number(product.compareAt) > Number(product.price)) {
    compare.textContent = money(product.compareAt);
    compare.classList.add('is-sale');
  } else {
    compare.textContent = '';
    compare.classList.remove('is-sale');
  }
  const rating = document.getElementById('quickRating');
  rating.innerHTML = product.rating
    ? `<span class="stars" aria-hidden="true">${stars(product.rating)}</span> <em>${Number(product.rating).toFixed(1)} · ${product.reviews || 0} reviews</em>`
    : '';
  document.getElementById('quickDescription').textContent = product.description || '';
  document.getElementById('quickCategory').textContent = `${(product.category || 'handmade').split(' ')[0].toUpperCase()} EDIT`;
  document.getElementById('quickAddBtn').dataset.productId = id;
  document.getElementById('quickDetailsLink').href = `product.html?id=${encodeURIComponent(id)}`;

  const sizes = Array.isArray(window.PRODUCT_GUIDANCE?.sizes) ? window.PRODUCT_GUIDANCE.sizes : ['S', 'M', 'L', 'XL', 'XXL'];
  const sizeBox = document.getElementById('quickSizes');
  sizeBox.innerHTML = sizes.map(size => `<button type="button" data-qsize="${escapeHtml(size)}" aria-pressed="false">${escapeHtml(size)}</button>`).join('');
  sizeBox.querySelectorAll('[data-qsize]').forEach(button => button.addEventListener('click', () => {
    quickSize = button.dataset.qsize;
    sizeBox.querySelectorAll('[data-qsize]').forEach(option => {
      const active = option === button;
      option.classList.toggle('active', active);
      option.setAttribute('aria-pressed', String(active));
    });
  }));
  document.getElementById('quickSizeNote').textContent = window.PRODUCT_GUIDANCE?.sizeNote || '';
  document.getElementById('quickQty').textContent = '1';

  const message = `Hello Lakhnavi Chikankari, I am interested in the "${product.name}" priced at ${money(product.price)}. Please share current sizes, colours and delivery details.`;
  document.getElementById('quickWhatsAppBtn').href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  openModal('quickViewModal');
}

document.getElementById('quickQtyMinus')?.addEventListener('click', () => {
  quickQty = Math.max(1, quickQty - 1);
  document.getElementById('quickQty').textContent = String(quickQty);
});
document.getElementById('quickQtyPlus')?.addEventListener('click', () => {
  quickQty = Math.min(10, quickQty + 1);
  document.getElementById('quickQty').textContent = String(quickQty);
});

productGrid?.addEventListener('click', event => {
  const quickButton = event.target.closest('[data-quick]');
  const addButton = event.target.closest('[data-add]');
  if (quickButton) openProduct(quickButton.dataset.quick);
  if (addButton) addToCart(addButton.dataset.add);
});

document.getElementById('quickAddBtn')?.addEventListener('click', event => {
  const id = event.currentTarget.dataset.productId;
  if (!id) return;
  addToCart(id, quickQty);
  const product = products[id];
  const sizeNote = quickSize ? ` Preferred size ${quickSize} noted for your enquiry.` : '';
  showToast(`${product.name} added to your bag.${sizeNote}`);
  closeModal('quickViewModal');
  openModal('cartModal');
});

// Mobile navigation
const siteHeader = document.getElementById('siteHeader');
const menuButton = document.getElementById('menuBtn');

function setMenu(open) {
  siteHeader?.classList.toggle('nav-open', open);
  menuButton?.setAttribute('aria-expanded', String(open));
  menuButton?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

menuButton?.addEventListener('click', () => setMenu(!siteHeader.classList.contains('nav-open')));
document.querySelectorAll('#nav a').forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('click', event => {
  if (siteHeader?.classList.contains('nav-open') && !siteHeader.contains(event.target)) setMenu(false);
});

document.getElementById('headerSearchBtn')?.addEventListener('click', () => {
  document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => document.getElementById('productSearch')?.focus(), 450);
});

document.querySelectorAll('[data-category-link]').forEach(link => {
  link.addEventListener('click', () => selectFilter(link.dataset.categoryLink));
});

// Collection filter drawer
const filterDrawer = document.getElementById('filterDrawer');
const filterBackdrop = document.getElementById('filterBackdrop');
const filterOpenButton = document.getElementById('filterOpenBtn');
const maxPriceInput = document.getElementById('maxPrice');
const catalogueMaximumPrice = Math.max(...Object.values(products).map(product => product.price));

function updatePriceOutput() {
  const output = document.getElementById('maxPriceOutput');
  if (output && maxPriceInput) output.textContent = money(maxPriceInput.value);
}

function setFilterDrawer(open) {
  if (!filterDrawer || !filterBackdrop) return;
  filterDrawer.hidden = !open;
  filterBackdrop.hidden = !open;
  document.body.classList.toggle('drawer-open', open);
  filterOpenButton?.setAttribute('aria-expanded', String(open));
  if (open) requestAnimationFrame(() => document.getElementById('filterCloseBtn')?.focus());
}

filterOpenButton?.addEventListener('click', () => setFilterDrawer(true));
document.getElementById('filterCloseBtn')?.addEventListener('click', () => setFilterDrawer(false));
filterBackdrop?.addEventListener('click', () => setFilterDrawer(false));
maxPriceInput?.addEventListener('input', updatePriceOutput);
document.getElementById('filterApplyBtn')?.addEventListener('click', () => {
  const selected = document.querySelector('input[name="drawerFilter"]:checked')?.value || 'all';
  activeMaxPrice = Number(maxPriceInput?.value || catalogueMaximumPrice);
  selectFilter(selected);
  setFilterDrawer(false);
});
document.getElementById('filterClearBtn')?.addEventListener('click', () => {
  activeMaxPrice = Number.POSITIVE_INFINITY;
  if (maxPriceInput) maxPriceInput.value = String(catalogueMaximumPrice);
  const search = document.getElementById('productSearch');
  if (search) search.value = '';
  updatePriceOutput();
  selectFilter('all');
  setFilterDrawer(false);
});
updatePriceOutput();

// Cart
function cartItems() {
  return Object.entries(cart).filter(([id, quantity]) => products[id] && Number(quantity) > 0);
}

function cartTotal() {
  return cartItems().reduce((total, [id, quantity]) => total + products[id].price * quantity, 0);
}

function saveCart() {
  localStorage.setItem('lc_cart', JSON.stringify(cart));
  updateCartUI();
}

function addToCart(id, quantity = 1) {
  if (!products[id]) return;
  const amount = Math.max(1, Math.min(10, Number(quantity) || 1));
  cart[id] = Math.min(10, Number(cart[id] || 0) + amount);
  saveCart();
  showToast(`${products[id].name} added to your bag`);
}

function removeFromCart(id) {
  delete cart[id];
  saveCart();
}

function changeQuantity(id, delta) {
  const next = Number(cart[id] || 0) + delta;
  if (next <= 0) removeFromCart(id);
  else {
    cart[id] = Math.min(10, next);
    saveCart();
  }
}

function updateCartUI() {
  const items = cartItems();
  const countValue = items.reduce((total, [, quantity]) => total + Number(quantity), 0);
  const count = document.getElementById('cartCount');
  count.textContent = countValue;
  count.setAttribute('aria-label', `${countValue} ${countValue === 1 ? 'item' : 'items'}`);

  const mobileBar = document.getElementById('mobileBagBar');
  const mobileCount = document.getElementById('mobileBagCount');
  const mobileTotal = document.getElementById('mobileBagTotal');
  if (mobileCount) mobileCount.textContent = countValue;
  if (mobileTotal) mobileTotal.textContent = money(cartTotal());
  if (mobileBar) mobileBar.hidden = countValue === 0;

  const box = document.getElementById('cartItems');
  if (!box) return;

  if (!items.length) {
    box.innerHTML = '<div class="empty-cart">Your bag is empty. Add a kurti to get started.</div>';
  } else {
    box.innerHTML = items.map(([id, quantity]) => {
      const product = products[id];
      return `<div class="cart-line">
        <img class="cart-thumb" src="${escapeHtml(product.image)}" alt="">
        <div><b>${escapeHtml(product.name)}</b><small>${money(product.price)} each</small></div>
        <div class="qty" aria-label="Quantity for ${escapeHtml(product.name)}">
          <button type="button" data-quantity="${escapeHtml(id)}" data-delta="-1" aria-label="Decrease quantity">−</button>
          <span>${quantity}</span>
          <button type="button" data-quantity="${escapeHtml(id)}" data-delta="1" aria-label="Increase quantity">+</button>
          <button type="button" class="remove" data-remove="${escapeHtml(id)}">Remove</button>
        </div>
      </div>`;
    }).join('');
  }

  box.querySelectorAll('[data-quantity]').forEach(button => {
    button.addEventListener('click', () => changeQuantity(button.dataset.quantity, Number(button.dataset.delta)));
  });
  box.querySelectorAll('[data-remove]').forEach(button => {
    button.addEventListener('click', () => removeFromCart(button.dataset.remove));
  });

  document.getElementById('cartTotal').textContent = money(cartTotal());
  document.getElementById('payBtn').disabled = !items.length || cartTotal() <= 0;
  document.getElementById('whatsappCartBtn').disabled = !items.length;
}

// Accessible modals
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modalTrigger = document.activeElement;
  setMenu(false);
  modal.hidden = false;
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => modal.querySelector('.modal-close, input, button, a')?.focus());
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = true;
  if (![...document.querySelectorAll('.modal-backdrop')].some(item => !item.hidden)) {
    document.body.classList.remove('modal-open');
  }
  if (modalTrigger && typeof modalTrigger.focus === 'function') modalTrigger.focus();
}

document.querySelectorAll('[data-close]').forEach(button => {
  button.addEventListener('click', () => closeModal(button.dataset.close));
});

document.querySelectorAll('.modal-backdrop').forEach(modal => {
  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal(modal.id);
  });
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const openModals = [...document.querySelectorAll('.modal-backdrop')].filter(item => !item.hidden);
  if (openModals.length) closeModal(openModals.at(-1).id);
  else if (filterDrawer && !filterDrawer.hidden) setFilterDrawer(false);
  else setMenu(false);
});

document.getElementById('cartBtn')?.addEventListener('click', () => {
  updateCartUI();
  openModal('cartModal');
});
document.getElementById('mobileBagOpen')?.addEventListener('click', () => {
  updateCartUI();
  openModal('cartModal');
});
document.getElementById('quickSizeGuideBtn')?.addEventListener('click', () => openModal('sizeGuideModal'));
document.getElementById('authBtn')?.addEventListener('click', openAccount);

// Authentication
function updateAuthUI(session) {
  currentSession = session || null;
  const button = document.getElementById('authBtn');
  const label = button?.querySelector('.header-button-label');
  if (label) label.textContent = session?.user ? 'My account' : 'Sign in / Sign up';
  button?.classList.toggle('is-signed-in', Boolean(session?.user));
  button?.setAttribute('aria-label', session?.user ? 'Open my account' : 'Sign in or create an account');
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('.auth-tab').forEach(tab => {
    const selected = tab.dataset.authMode === mode;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
  });
  document.querySelector('#authSubmit span').textContent = mode === 'signin' ? 'Sign in securely' : 'Create my account';
  document.getElementById('authTitle').textContent = mode === 'signin' ? 'Welcome back' : 'Join Lakhnavi';
  document.getElementById('authIntro').textContent = mode === 'signin'
    ? 'Sign in to pay securely and see your saved orders.'
    : 'Create an account for faster checkout and a complete order history.';
  const nameField = document.getElementById('authNameField');
  const nameInput = document.getElementById('authName');
  nameField.hidden = mode !== 'signup';
  nameInput.required = mode === 'signup';
  document.getElementById('authPassword').autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
  document.getElementById('resetPasswordBtn').style.display = mode === 'signin' ? '' : 'none';
  document.getElementById('authMessage').textContent = '';
}

document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => setAuthMode(tab.dataset.authMode));
});

function setAccountTab(name) {
  document.querySelectorAll('.account-tab').forEach(tab => {
    const selected = tab.dataset.accountTab === name;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
  });
  document.querySelectorAll('.account-pane').forEach(pane => {
    pane.hidden = pane.dataset.accountPane !== name;
  });
}

document.querySelectorAll('.account-tab').forEach(tab => {
  tab.addEventListener('click', () => setAccountTab(tab.dataset.accountTab));
});

const AUTH_EMAIL_COOLDOWN_MS = 60 * 1000;
const AUTH_EMAIL_COOLDOWN_KEY = 'lc_auth_email_cooldown';

function getAuthEmailCooldown() {
  const until = Number(localStorage.getItem(AUTH_EMAIL_COOLDOWN_KEY) || 0);
  return Math.max(0, until - Date.now());
}

function startAuthEmailCooldown() {
  localStorage.setItem(AUTH_EMAIL_COOLDOWN_KEY, String(Date.now() + AUTH_EMAIL_COOLDOWN_MS));
}

function friendlyAuthError(error) {
  const text = String(error?.message || error || '');
  if (/rate limit|rate_limit|too many requests|email rate/i.test(text)) {
    return 'Email limit reached. Please wait a few minutes before requesting another email, then use the latest message you receive.';
  }
  return text || 'Something went wrong. Please try again.';
}

function formatWait(milliseconds) {
  return `${Math.max(1, Math.ceil(milliseconds / 1000))} seconds`;
}

document.getElementById('authForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const message = document.getElementById('authMessage');
  const submit = document.getElementById('authSubmit');
  if (!supabaseClient) {
    message.textContent = 'Account login is not configured yet.';
    return;
  }

  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const fullName = document.getElementById('authName').value.trim();
  if (!email || !password) return;

  message.textContent = 'Please wait…';
  submit.disabled = true;
  try {
    const result = authMode === 'signin'
      ? await supabaseClient.auth.signInWithPassword({ email, password })
      : await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName }
        }
      });

    if (result.error) {
      message.textContent = friendlyAuthError(result.error);
    } else {
      if (authMode === 'signup' && result.data?.user && !result.data?.session) startAuthEmailCooldown();
      message.textContent = authMode === 'signin'
        ? 'Signed in successfully.'
        : result.data?.session
          ? 'Account created and signed in.'
          : 'Account created. Check your email if confirmation is enabled.';
    }
    if (!result.error && authMode === 'signin') setTimeout(() => closeModal('authModal'), 650);
  } catch (error) {
    message.textContent = friendlyAuthError(error);
  } finally {
    submit.disabled = false;
  }
});

document.getElementById('resetPasswordBtn')?.addEventListener('click', async () => {
  const email = document.getElementById('authEmail').value.trim();
  const message = document.getElementById('authMessage');
  const button = document.getElementById('resetPasswordBtn');
  if (!supabaseClient) {
    message.textContent = 'Account login is not configured yet.';
    return;
  }
  if (!email) {
    message.textContent = 'Enter your email first.';
    return;
  }
  const remaining = getAuthEmailCooldown();
  if (remaining > 0) {
    message.textContent = `Please wait ${formatWait(remaining)} before requesting another email.`;
    return;
  }

  button.disabled = true;
  message.textContent = 'Sending reset email…';
  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password.html`
    });
    if (error) message.textContent = friendlyAuthError(error);
    else {
      startAuthEmailCooldown();
      message.textContent = 'Password reset email sent. Check your inbox and spam folder.';
    }
  } catch (error) {
    message.textContent = friendlyAuthError(error);
  } finally {
    button.disabled = false;
  }
});

if (supabaseClient) {
  supabaseClient.auth.getSession().then(({ data }) => updateAuthUI(data.session));
  supabaseClient.auth.onAuthStateChange((_event, session) => updateAuthUI(session));
}

document.getElementById('signOutBtn')?.addEventListener('click', async () => {
  const message = document.getElementById('accountMessage');
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  message.textContent = error ? friendlyAuthError(error) : 'You have been signed out.';
  if (!error) setTimeout(() => closeModal('accountModal'), 500);
});

// Customer profile and order history
async function loadProfile() {
  if (!supabaseClient || !currentSession?.user) return;
  const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', currentSession.user.id).maybeSingle();
  if (error) {
    console.error('Profile load failed:', error.message);
    return;
  }
  const profile = data || {};
  document.getElementById('profileName').value = profile.full_name || '';
  document.getElementById('profilePhone').value = profile.phone || '';
  document.getElementById('profileAddress').value = profile.address || '';
  document.getElementById('profileCity').value = profile.city || '';
  document.getElementById('profileState').value = profile.state || '';
  document.getElementById('profilePincode').value = profile.pincode || '';
  if (profile.full_name) document.getElementById('customerName').value = profile.full_name;
  if (profile.phone) document.getElementById('customerPhone').value = profile.phone;
  if (profile.address) {
    document.getElementById('customerAddress').value = [profile.address, profile.city, profile.state, profile.pincode].filter(Boolean).join(', ');
  }
}

async function loadOrders() {
  const box = document.getElementById('ordersList');
  if (!box || !supabaseClient || !currentSession?.user) return;
  box.innerHTML = '<p class="modal-note">Loading orders…</p>';
  const { data, error } = await supabaseClient
    .from('orders')
    .select('*')
    .eq('user_id', currentSession.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    box.innerHTML = `<p class="form-message">${escapeHtml(friendlyAuthError(error))}</p>`;
    return;
  }
  if (!data?.length) {
    box.innerHTML = '<p class="modal-note">No paid orders yet.</p>';
    return;
  }

  box.innerHTML = data.map(order => {
    const date = new Date(order.created_at).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const items = Array.isArray(order.items) ? order.items : [];
    return `<div class="order-card">
      <strong>Order #${escapeHtml(String(order.id))} — ${money(order.total_amount)}</strong>
      <small>${date} · Payment: ${escapeHtml(order.payment_status || 'pending')} · Status: <span class="order-status">${escapeHtml(order.order_status || 'pending')}</span></small>
      ${items.length ? `<ul class="order-items">${items.map(item => `<li>${escapeHtml(item.name || item.id)} × ${escapeHtml(String(item.quantity || 1))}</li>`).join('')}</ul>` : ''}
    </div>`;
  }).join('');
}

document.getElementById('profileForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const message = document.getElementById('accountMessage');
  if (!supabaseClient || !currentSession?.user) {
    message.textContent = 'Please sign in first.';
    return;
  }
  const profile = {
    id: currentSession.user.id,
    full_name: document.getElementById('profileName').value.trim(),
    phone: document.getElementById('profilePhone').value.trim(),
    address: document.getElementById('profileAddress').value.trim(),
    city: document.getElementById('profileCity').value.trim(),
    state: document.getElementById('profileState').value.trim(),
    pincode: document.getElementById('profilePincode').value.trim(),
    updated_at: new Date().toISOString()
  };

  message.textContent = 'Saving…';
  const { error } = await supabaseClient.from('profiles').upsert(profile, { onConflict: 'id' });
  message.textContent = error ? friendlyAuthError(error) : 'Your details have been saved.';
  if (!error) {
    document.getElementById('customerName').value = profile.full_name;
    document.getElementById('customerPhone').value = profile.phone;
    document.getElementById('customerAddress').value = [profile.address, profile.city, profile.state, profile.pincode].filter(Boolean).join(', ');
  }
});

async function openAccount() {
  if (!currentSession?.user) {
    openModal('authModal');
    return;
  }
  document.getElementById('accountEmail').textContent = currentSession.user.email || 'Signed in';
  setAccountTab('orders');
  openModal('accountModal');
  await Promise.all([loadProfile(), loadOrders()]);
}

// Checkout
async function payNow() {
  const items = cartItems();
  const message = document.getElementById('checkoutMessage');

  if (!supabaseClient || !currentSession?.user || !currentSession.access_token) {
    closeModal('cartModal');
    openModal('authModal');
    document.getElementById('authMessage').textContent = 'Sign in before secure checkout. Your bag will stay saved.';
    return;
  }
  if (!window.Razorpay) {
    message.textContent = 'Secure checkout did not load. Please refresh or order on WhatsApp.';
    return;
  }

  const name = document.getElementById('customerName').value.trim();
  const mobile = document.getElementById('customerPhone').value.trim();
  const address = document.getElementById('customerAddress').value.trim();

  if (!items.length) {
    message.textContent = 'Your bag is empty.';
    return;
  }
  if (!name || mobile.replace(/\D/g, '').length < 10 || !address) {
    message.textContent = 'Enter your name, 10-digit mobile number and delivery address.';
    return;
  }

  message.textContent = 'Creating secure payment…';
  const payButton = document.getElementById('payBtn');
  payButton.disabled = true;

  try {
    const response = await fetch('/api/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentSession.access_token}`
      },
      body: JSON.stringify({ items: items.map(([id, quantity]) => ({ id, quantity })) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not start payment.');

    const options = {
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      name: 'Lakhnavi Chikankari',
      description: 'Handmade women’s kurtis',
      order_id: data.orderId,
      prefill: { name, contact: mobile, email: currentSession.user.email || '' },
      notes: { delivery_address: address },
      theme: { color: '#2c3e6b' },
      retry: { enabled: true },
      timeout: 900,
      handler: async payment => {
        message.textContent = 'Verifying payment…';
        const verify = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentSession.access_token}`
          },
          body: JSON.stringify({
            ...payment,
            order: {
              customer_name: name,
              phone: mobile,
              address,
              items: items.map(([id, quantity]) => ({ id, quantity }))
            }
          })
        });
        const result = await verify.json().catch(() => ({}));
        if (!verify.ok || !result.verified || !result.saved) {
          throw new Error(result.error || 'Payment was received but the order could not be saved. Please contact us.');
        }

        Object.keys(cart).forEach(key => delete cart[key]);
        saveCart();
        message.textContent = 'Payment successful. Your order is saved in My Account.';
        showToast('Order paid successfully');
      },
      modal: {
        ondismiss: () => {
          message.textContent = 'Payment window closed. Your bag is still saved.';
        }
      }
    };

    const checkout = new window.Razorpay(options);
    checkout.on('payment.failed', responseData => {
      message.textContent = responseData?.error?.description || 'Payment failed. Please try again.';
    });
    checkout.open();
  } catch (error) {
    console.error('Checkout error:', error);
    message.textContent = error.message || 'Could not connect to the payment service.';
  } finally {
    payButton.disabled = !cartItems().length;
  }
}

document.getElementById('payBtn')?.addEventListener('click', payNow);
document.getElementById('whatsappCartBtn')?.addEventListener('click', () => {
  const items = cartItems();
  if (!items.length) return;
  const lines = items.map(([id, quantity]) => `• ${products[id].name} × ${quantity} — ${money(products[id].price * quantity)}`).join('\n');
  const name = document.getElementById('customerName').value.trim();
  const mobile = document.getElementById('customerPhone').value.trim();
  const address = document.getElementById('customerAddress').value.trim();
  const customer = [name && `Name: ${name}`, mobile && `Phone: ${mobile}`, address && `Address: ${address}`].filter(Boolean).join('\n');
  const message = `Hello Lakhnavi Chikankari, I would like to order:\n\n${lines}\n\nBag total: ${money(cartTotal())}${customer ? `\n\n${customer}` : ''}\n\nPlease confirm sizes, availability and delivery details.`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
});

function showToast(text) {
  const toast = document.getElementById('toast');
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

document.getElementById('newsletterForm')?.addEventListener('submit', event => {
  event.preventDefault();
  const email = document.getElementById('newsletterEmail');
  showToast(`Thank you — ${email.value.trim()} is on the update list`);
  event.currentTarget.reset();
});

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Gentle reveal motion. Content remains visible when JavaScript is unavailable.
function observeReveals() {
  const items = document.querySelectorAll('[data-reveal]:not(.is-visible)');
  if (!items.length) return;
  if ('IntersectionObserver' in window && !prefersReducedMotion()) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: .12 });
    items.forEach(item => revealObserver.observe(item));
  } else {
    items.forEach(item => item.classList.add('is-visible'));
  }
}
observeReveals();

// Hero slider
const heroSlider = document.getElementById('heroSlider');
const heroSlides = heroSlider ? [...heroSlider.querySelectorAll('.hero-slide')] : [];
const heroDots = document.getElementById('heroDots');
let heroIndex = 0;
let heroTimer = null;

function renderHeroDots() {
  if (!heroDots || !heroSlides.length) return;
  heroDots.innerHTML = heroSlides.map((_slide, index) =>
    `<button class="hero-dot ${index === heroIndex ? 'is-active' : ''}" type="button" data-slide="${index}" role="tab" aria-label="Go to slide ${index + 1}" aria-selected="${index === heroIndex}"></button>`
  ).join('');
  heroDots.querySelectorAll('[data-slide]').forEach(dot => dot.addEventListener('click', () => goToSlide(Number(dot.dataset.slide))));
}

function goToSlide(index) {
  if (!heroSlides.length) return;
  heroIndex = (index + heroSlides.length) % heroSlides.length;
  heroSlides.forEach((slide, slideIndex) => {
    const active = slideIndex === heroIndex;
    slide.classList.toggle('is-active', active);
    slide.setAttribute('aria-hidden', String(!active));
  });
  renderHeroDots();
  restartHeroTimer();
}

function nextSlide() { goToSlide(heroIndex + 1); }
function restartHeroTimer() {
  if (heroTimer) clearTimeout(heroTimer);
  if (prefersReducedMotion() || heroSlides.length < 2) return;
  heroTimer = setTimeout(nextSlide, 6000);
}

document.getElementById('heroPrev')?.addEventListener('click', () => goToSlide(heroIndex - 1));
document.getElementById('heroNext')?.addEventListener('click', nextSlide);
if (heroSlides.length) {
  heroSlides.forEach((slide, index) => slide.setAttribute('aria-hidden', String(index !== 0)));
  renderHeroDots();
  restartHeroTimer();
}

// FAQ summary marker rotation is handled in CSS via details[open].

renderProductGrid();
updateCartUI();

// Allow navigation from secondary pages to open account or bag directly.
const entryAction = new URLSearchParams(window.location.search).get('open');
if (entryAction === 'account') setTimeout(openAccount, 50);
if (entryAction === 'cart') setTimeout(() => {
  updateCartUI();
  openModal('cartModal');
}, 50);
