(() => {
  document.documentElement.classList.add('js');
  const phone = '919899551923';
  const headerTarget = document.getElementById('pageHeader');
  const footerTarget = document.getElementById('pageFooter');

  if (headerTarget) {
    headerTarget.innerHTML = `
      <a class="skip-link" href="#main">Skip to content</a>
      <div class="offer-bar"><span>THE HANDMADE EDIT</span><p>Personal size assistance • WhatsApp ordering available</p></div>
      <header class="site-header page-header" id="siteHeader">
        <a class="brand" href="index.html" aria-label="Lakhnavi Chikankari home"><img src="logo.svg" alt="Lakhnavi Chikankari"></a>
        <nav id="nav" aria-label="Primary navigation">
          <a href="index.html#collection">Shop</a>
          <a href="about.html">Our story</a>
          <a href="care-guide.html">Care guide</a>
          <a href="contact.html">Contact</a>
          <a href="orders.html">My orders</a>
        </nav>
        <div class="header-actions">
          <a class="account-entry" href="index.html?open=account" aria-label="Sign in or create an account">
            <span class="account-entry-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.7-4 2.9-6 6.5-6s5.8 2 6.5 6"/></svg></span>
            <span class="account-entry-copy"><small>Account</small><strong>Sign in / Sign up</strong></span>
          </a>
          <a class="icon-button bag-button" href="index.html?open=cart" aria-label="Open shopping bag">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 8h12l1 12H5L6 8Zm3 0V6a3 3 0 0 1 6 0v2"/></svg>
            <span id="pageCartCount" class="cart-count" aria-label="0 items">0</span>
          </a>
          <button class="menu" id="menuBtn" type="button" aria-label="Open menu" aria-controls="nav" aria-expanded="false"><span></span><span></span><span></span></button>
        </div>
      </header>`;
  }

  if (footerTarget) {
    footerTarget.innerHTML = `
      <footer>
        <div class="footer-grid">
          <div class="footer-brand"><img src="logo.svg" alt="Lakhnavi Chikankari"><p>Handmade women’s kurtis with a colourful Lakhnavi touch.</p></div>
          <div><h3>Shop</h3><a href="index.html#collection">All kurtis</a><a href="product.html?id=p1">Featured piece</a><a href="orders.html">My orders</a><a href="index.html?open=cart">Shopping bag</a></div>
          <div><h3>About</h3><a href="about.html">Our story</a><a href="care-guide.html">Care guide</a><a href="contact.html">Contact us</a><a href="admin-orders.html">Order management</a></div>
          <div><h3>Personal help</h3><p>Ask us about sizes, colours, availability, care and delivery before ordering.</p><a class="footer-chat" href="https://wa.me/${phone}" target="_blank" rel="noopener">Chat on WhatsApp →</a></div>
        </div>
        <div class="footer-bottom"><span>© 2026 Lakhnavi Chikankari</span><span>Made with care in India</span></div>
      </footer>
      <a class="floating-chat" href="https://wa.me/${phone}?text=Hello%20Lakhnavi%20Chikankari%2C%20I%20would%20like%20help%20with%20the%20collection." target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp"><span aria-hidden="true">◉</span> Chat</a>`;
  }

  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.page-header nav a').forEach(link => {
    const linkedFile = new URL(link.href).pathname.split('/').pop();
    if (linkedFile === currentFile) link.setAttribute('aria-current', 'page');
  });

  let count = 0;
  try {
    const cart = JSON.parse(localStorage.getItem('lc_cart') || '{}');
    count = Object.values(cart && typeof cart === 'object' ? cart : {}).reduce((sum, quantity) => sum + Math.max(0, Number(quantity) || 0), 0);
  } catch (_error) {
    count = 0;
  }
  const cartCount = document.getElementById('pageCartCount');
  if (cartCount) {
    cartCount.textContent = String(count);
    cartCount.setAttribute('aria-label', `${count} ${count === 1 ? 'item' : 'items'}`);
  }

  const header = document.getElementById('siteHeader');
  const menuButton = document.getElementById('menuBtn');
  menuButton?.addEventListener('click', () => {
    const isOpen = !header.classList.contains('nav-open');
    header.classList.toggle('nav-open', isOpen);
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  });
  document.querySelectorAll('.page-header nav a').forEach(link => link.addEventListener('click', () => {
    header?.classList.remove('nav-open');
    menuButton?.setAttribute('aria-expanded', 'false');
  }));
})();
