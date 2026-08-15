(() => {
  const phone = (window.SHOP_PHONE && window.SHOP_PHONE.wa) || '919899551923';
  const products = window.PRODUCTS || {};
  const guidance = window.PRODUCT_GUIDANCE || {};
  const requestedId = new URLSearchParams(window.location.search).get('id');
  const productId = products[requestedId] ? requestedId : Object.keys(products)[0];
  const product = products[productId];
  let selectedSize = '';
  let toastTimer;

  const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const stars = rating => '★'.repeat(Math.round(Number(rating) || 0)) + '☆'.repeat(Math.max(0, 5 - Math.round(Number(rating) || 0)));

  if (!product) {
    document.getElementById('productTitle').textContent = 'Product not found';
    return;
  }

  document.title = `${product.name} | Lakhnavi Chikankari`;
  document.querySelector('meta[name="description"]').content = `${product.description} View detailed craft, care, size and ordering information.`;
  document.getElementById('breadcrumbProduct').textContent = product.name;
  document.getElementById('productImage').src = product.image;
  document.getElementById('productImage').alt = product.name;
  document.getElementById('productSku').textContent = product.sku;
  document.getElementById('productTitle').textContent = product.name;
  document.getElementById('productPrice').innerHTML = product.compareAt && Number(product.compareAt) > Number(product.price)
    ? `${money(product.price)} <s class="compare-price">${money(product.compareAt)}</s>`
    : money(product.price);
  const ratingTarget = document.getElementById('productPrice');
  const ratingLine = document.createElement('div');
  ratingLine.className = 'detail-rating';
  ratingLine.innerHTML = product.rating
    ? `<span class="stars" aria-hidden="true">${stars(product.rating)}</span> <em>${Number(product.rating).toFixed(1)} · ${product.reviews || 0} reviews</em>`
    : '';
  ratingTarget.parentNode.insertBefore(ratingLine, ratingTarget.nextSibling);
  document.getElementById('productDescription').textContent = product.description;
  document.getElementById('productColour').textContent = product.colour;
  document.getElementById('productCraft').textContent = product.craft;
  document.getElementById('productFabric').textContent = product.fabric;
  document.getElementById('productFit').textContent = product.fit;
  document.getElementById('productOccasion').textContent = product.occasion;
  document.getElementById('productDetails').innerHTML = (product.details || []).map(detail => `<li>${escapeHtml(detail)}</li>`).join('');
  document.getElementById('sizeNote').textContent = guidance.sizeNote || '';
  document.getElementById('pieceStory').textContent = `${product.description} Each listing represents the current design edit; exact fabric composition, garment measurements and stock are confirmed for the piece offered to you.`;
  document.getElementById('careText').textContent = guidance.care || '';
  document.getElementById('deliveryText').textContent = guidance.delivery || '';

  const sizes = Array.isArray(guidance.sizes) ? guidance.sizes : ['S', 'M', 'L', 'XL', 'XXL'];
  document.getElementById('sizeChoices').innerHTML = sizes.map(size => `<button type="button" data-size="${escapeHtml(size)}" aria-pressed="false">${escapeHtml(size)}</button>`).join('');
  document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => {
    selectedSize = button.dataset.size;
    document.querySelectorAll('[data-size]').forEach(option => {
      const active = option === button;
      option.classList.toggle('active', active);
      option.setAttribute('aria-pressed', String(active));
    });
  }));

  const sizeGuideModal = document.getElementById('sizeGuideModal');
  const closeSizeGuide = () => {
    if (!sizeGuideModal) return;
    sizeGuideModal.hidden = true;
    document.body.classList.remove('modal-open');
  };
  document.getElementById('sizeGuideBtn')?.addEventListener('click', () => {
    if (!sizeGuideModal) return;
    sizeGuideModal.hidden = false;
    document.body.classList.add('modal-open');
    sizeGuideModal.querySelector('.modal-close, button, a')?.focus();
  });
  sizeGuideModal?.querySelector('[data-close="sizeGuideModal"]')?.addEventListener('click', closeSizeGuide);
  sizeGuideModal?.addEventListener('click', event => { if (event.target === sizeGuideModal) closeSizeGuide(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sizeGuideModal && !sizeGuideModal.hidden) closeSizeGuide();
  });

  function addToBag() {
    let cart = {};
    try {
      const saved = JSON.parse(localStorage.getItem('lc_cart') || '{}');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) cart = saved;
    } catch (_error) {
      cart = {};
    }
    cart[productId] = Math.min(10, Number(cart[productId] || 0) + 1);
    localStorage.setItem('lc_cart', JSON.stringify(cart));
    const message = document.getElementById('detailMessage');
    message.textContent = `${product.name} added to your bag${selectedSize ? `; preferred size ${selectedSize} noted for your enquiry` : ''}.`;
    showToast('Added to your shopping bag');
    const count = Object.values(cart).reduce((sum, quantity) => sum + (Number(quantity) || 0), 0);
    const badge = document.getElementById('pageCartCount');
    if (badge) badge.textContent = String(count);
  }

  document.getElementById('detailAddBtn').addEventListener('click', addToBag);
  const enquiry = `Hello Lakhnavi Chikankari, I am interested in ${product.name} (${product.sku}) at ${money(product.price)}.${selectedSize ? ` Preferred size: ${selectedSize}.` : ''} Please confirm current measurements, fabric, colour and delivery time.`;
  const whatsapp = document.getElementById('detailWhatsAppBtn');
  whatsapp.href = `https://wa.me/${phone}?text=${encodeURIComponent(enquiry)}`;
  whatsapp.addEventListener('click', () => {
    const liveEnquiry = `Hello Lakhnavi Chikankari, I am interested in ${product.name} (${product.sku}) at ${money(product.price)}.${selectedSize ? ` Preferred size: ${selectedSize}.` : ''} Please confirm current measurements, fabric, colour and delivery time.`;
    whatsapp.href = `https://wa.me/${phone}?text=${encodeURIComponent(liveEnquiry)}`;
  });

  const related = Object.entries(products).filter(([id, item]) => id !== productId && item.category.split(' ').some(category => product.category.includes(category))).slice(0, 3);
  document.getElementById('relatedGrid').innerHTML = related.map(([id, item]) => `<a class="related-card" href="product.html?id=${encodeURIComponent(id)}"><img src="${escapeHtml(item.image)}" width="750" height="1000" loading="lazy" alt="${escapeHtml(item.name)}"><span>${escapeHtml(item.name)}</span><strong>${money(item.price)}</strong></a>`).join('');

  const structuredData = document.createElement('script');
  structuredData.type = 'application/ld+json';
  structuredData.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: product.name, sku: product.sku, image: new URL(product.image, window.location.href).href, description: product.description, brand: { '@type': 'Brand', name: 'Lakhnavi Chikankari' } });
  document.head.appendChild(structuredData);

  function showToast(text) {
    const toast = document.getElementById('toast');
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }
})();
