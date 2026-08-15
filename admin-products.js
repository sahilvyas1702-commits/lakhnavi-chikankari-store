(() => {
  const config = window.SHOP_CONFIG || {};
  const configured = config.SUPABASE_URL && config.SUPABASE_ANON_KEY && !config.SUPABASE_URL.includes('YOUR-PROJECT') && !config.SUPABASE_ANON_KEY.includes('YOUR-');
  const client = configured && window.supabase?.createClient ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY) : null;
  const gate = document.getElementById('adminGate');
  const panel = document.getElementById('adminPanel');
  const editor = document.getElementById('productEditor');
  const status = document.getElementById('adminStatus');
  let session = null;
  let products = [];
  let editingId = null;
  let pendingPhoto = null;

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
      editor.hidden = true;
      return;
    }

    const { data: allowed, error } = await client.rpc('is_order_admin');
    if (error || !allowed) {
      gate.hidden = false;
      panel.hidden = true;
      editor.hidden = true;
      gate.querySelector('h2').textContent = 'Administrator access not approved';
      gate.querySelector('p').textContent = 'This signed-in account is not approved for the product workspace.';
      gate.querySelector('a').textContent = 'Return to the shop';
      gate.querySelector('a').href = 'index.html';
      return;
    }

    gate.hidden = true;
    panel.hidden = false;
    document.getElementById('adminEmail').textContent = session.user.email || 'Product administrator';
    await loadProducts();
  }

  async function loadProducts() {
    status.textContent = 'Loading catalogue…';
    const { data, error } = await client.from('products').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (error) {
      products = [];
      status.textContent = error.message || 'Could not load the product catalogue.';
      render();
      return;
    }
    products = Array.isArray(data) ? data : [];
    status.textContent = `${products.length} ${products.length === 1 ? 'product' : 'products'} in the catalogue.`;
    render();
  }

  function render() {
    const list = document.getElementById('productList');
    list.innerHTML = products.length ? products.map(productRow).join('') : '<div class="empty-order-state"><h3>No products yet</h3><p>Use “Add product” to create the first catalogue entry.</p></div>';
  }

  function productRow(product) {
    const active = Boolean(product.active);
    const image = escapeHtml(product.image || '');
    const category = escapeHtml(product.category || '');
    const badge = escapeHtml(product.badge || '');
    const sku = escapeHtml(product.sku || '');
    const compare = Number(product.compare_at || 0) > Number(product.price || 0) ? `<s>${money(product.compare_at)}</s> ` : '';
    return `<article class="product-row" data-id="${escapeHtml(product.id)}">
      <img class="product-thumb" src="${image || 'logo.svg'}" alt="${escapeHtml(product.name || 'Product')}" width="90" height="120" loading="lazy">
      <div class="product-row-info"><h3>${escapeHtml(product.name || 'Untitled')}</h3><p>${sku}${category ? ` · ${category}` : ''}${badge ? ` · <b>${badge}</b>` : ''}</p><strong>${money(product.price)} ${compare}</strong></div>
      <span class="status-badge ${active ? 'status-confirmed' : ''}">${active ? 'Active' : 'Inactive'}</span>
      <div class="product-row-actions">
        <button class="btn secondary" type="button" data-edit="${escapeHtml(product.id)}">Edit</button>
        <button class="btn secondary" type="button" data-toggle="${escapeHtml(product.id)}">${active ? 'Hide' : 'Show'}</button>
        <button class="btn secondary danger" type="button" data-delete="${escapeHtml(product.id)}">Delete</button>
      </div>
    </article>`;
  }

  function openEditor(product) {
    editingId = product ? product.id : null;
    document.getElementById('peId').value = editingId || '';
    document.getElementById('peTitle').textContent = editingId ? 'Edit product' : 'Add product';
    document.getElementById('peDeleteBtn').hidden = !editingId;
    document.getElementById('peMessage').textContent = '';
    pendingPhoto = null;
    const pePhoto = document.getElementById('pePhoto');
    pePhoto.value = '';

    fillField('peName', product?.name);
    fillField('pePrice', product?.price);
    fillField('peCompareAt', product?.compare_at);
    fillField('peRating', product?.rating);
    fillField('peReviews', product?.reviews);
    fillField('peBadge', product?.badge);
    fillField('peSku', product?.sku);
    fillField('peSortOrder', product?.sort_order);
    fillField('peImageUrl', product?.image);
    fillField('peColour', product?.colour);
    fillField('peCraft', product?.craft);
    fillField('peFabric', product?.fabric);
    fillField('peFit', product?.fit);
    fillField('peOccasion', product?.occasion);
    fillField('peDescription', product?.description);
    fillField('peDetails', Array.isArray(product?.details) ? product.details.join('\n') : '');
    document.getElementById('peActive').checked = product ? Boolean(product.active) : true;

    const categories = String(product?.category || '').split(/\s+/).filter(Boolean);
    ['peCatPastel', 'peCatBright', 'peCatClassic'].forEach(id => {
      document.getElementById(id).checked = categories.includes(document.getElementById(id).value);
    });

    const preview = document.getElementById('pePreview');
    const previewImg = document.getElementById('pePreviewImg');
    if (product?.image) {
      preview.hidden = false;
      previewImg.src = product.image;
    } else {
      preview.hidden = true;
      previewImg.removeAttribute('src');
    }

    panel.hidden = true;
    editor.hidden = false;
    document.getElementById('main').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeEditor() {
    editor.hidden = true;
    panel.hidden = false;
    document.getElementById('main').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function fillField(id, value) {
    const field = document.getElementById(id);
    if (field) field.value = value == null ? '' : String(value);
  }

  function readCategoryTokens() {
    return ['peCatPastel', 'peCatBright', 'peCatClassic']
      .filter(id => document.getElementById(id).checked)
      .map(id => document.getElementById(id).value)
      .join(' ');
  }

  async function saveProduct(event) {
    event.preventDefault();
    const message = document.getElementById('peMessage');
    const name = document.getElementById('peName').value.trim();
    const price = Number(document.getElementById('pePrice').value);
    message.textContent = 'Saving product…';
    if (!name) {
      message.textContent = 'Please enter a product name.';
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      message.textContent = 'Please enter a valid price.';
      return;
    }

    const id = editingId || `p${Date.now().toString(36)}`;
    const payload = {
      id,
      name,
      price,
      compare_at: document.getElementById('peCompareAt').value === '' ? null : Math.max(0, Number(document.getElementById('peCompareAt').value) || 0),
      rating: document.getElementById('peRating').value === '' ? 0 : Math.max(0, Math.min(5, Number(document.getElementById('peRating').value) || 0)),
      reviews: document.getElementById('peReviews').value === '' ? 0 : Math.max(0, Number(document.getElementById('peReviews').value) || 0),
      badge: document.getElementById('peBadge').value.trim(),
      category: readCategoryTokens(),
      sku: document.getElementById('peSku').value.trim(),
      sort_order: document.getElementById('peSortOrder').value === '' ? 0 : Math.max(0, Number(document.getElementById('peSortOrder').value) || 0),
      image: document.getElementById('peImageUrl').value.trim(),
      colour: document.getElementById('peColour').value.trim(),
      craft: document.getElementById('peCraft').value.trim(),
      fabric: document.getElementById('peFabric').value.trim(),
      fit: document.getElementById('peFit').value.trim(),
      occasion: document.getElementById('peOccasion').value.trim(),
      description: document.getElementById('peDescription').value.trim(),
      details: document.getElementById('peDetails').value.split('\n').map(line => line.trim()).filter(Boolean),
      active: document.getElementById('peActive').checked,
      updated_at: new Date().toISOString()
    };

    try {
      if (pendingPhoto) {
        message.textContent = 'Uploading photo…';
        payload.image = await uploadPhoto(pendingPhoto, id);
      } else if (!payload.image) {
        payload.image = '';
      }

      if (editingId) {
        const { error } = await client.from('products').update(payload).eq('id', editingId);
        if (error) throw new Error(error.message || 'Could not update the product.');
      } else {
        const { error } = await client.from('products').insert(payload);
        if (error) throw new Error(error.message || 'Could not add the product.');
      }
      status.textContent = editingId ? 'Product updated. It is live in the shop.' : 'Product added. It is live in the shop.';
      closeEditor();
      await loadProducts();
    } catch (error) {
      message.textContent = error.message;
    }
  }

  async function deleteProduct(id) {
    const product = products.find(item => String(item.id) === String(id));
    if (!product) return;
    if (!window.confirm(`Delete “${product.name}” from the catalogue? This cannot be undone.`)) return;
    const message = document.getElementById('peMessage');
    message.textContent = 'Deleting product…';
    try {
      await removeStoredImage(product.image);
      const { error } = await client.from('products').delete().eq('id', id);
      if (error) throw new Error(error.message || 'Could not delete the product.');
      status.textContent = 'Product deleted.';
      closeEditor();
      await loadProducts();
    } catch (error) {
      message.textContent = error.message;
    }
  }

  async function toggleActive(id) {
    const product = products.find(item => String(item.id) === String(id));
    if (!product) return;
    const next = !Boolean(product.active);
    const { error } = await client.from('products').update({ active: next, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      status.textContent = error.message || 'Could not update the product.';
      return;
    }
    status.textContent = next ? 'Product is now visible in the shop.' : 'Product is hidden from the shop.';
    await loadProducts();
  }

  async function removeStoredImage(image) {
    if (!image) return;
    const marker = '/object/public/product-images/';
    const index = image.indexOf(marker);
    if (index < 0) return;
    const path = decodeURIComponent(image.slice(index + marker.length)).replace(/^\/+/, '');
    if (!path) return;
    await client.storage.from('product-images').remove([path]);
  }

  async function downscaleFile(file) {
    let bitmap = null;
    try {
      bitmap = await createImageBitmap(file);
    } catch (_error) {
      return file;
    }
    const max = 1000;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    bitmap.close();
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  }

  async function uploadPhoto(file, productId) {
    const prepared = await downscaleFile(file);
    const path = `products/${productId}-${Date.now()}.jpg`;
    const { error } = await client.storage.from('product-images').upload(path, prepared, { contentType: prepared.type || 'image/jpeg' });
    if (error) throw new Error(error.message || 'Photo upload failed.');
    return client.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  }

  document.getElementById('addProductBtn').addEventListener('click', () => openEditor(null));
  document.getElementById('adminRefreshBtn').addEventListener('click', loadProducts);
  document.getElementById('peCancelBtn').addEventListener('click', closeEditor);
  document.getElementById('productForm').addEventListener('submit', saveProduct);
  document.getElementById('peDeleteBtn').addEventListener('click', () => { if (editingId) deleteProduct(editingId); });
  document.getElementById('productList').addEventListener('click', event => {
    const edit = event.target.closest('[data-edit]');
    const toggle = event.target.closest('[data-toggle]');
    const remove = event.target.closest('[data-delete]');
    if (edit) {
      const product = products.find(item => String(item.id) === String(edit.dataset.edit));
      if (product) openEditor(product);
    } else if (toggle) {
      toggleActive(toggle.dataset.toggle);
    } else if (remove) {
      deleteProduct(remove.dataset.delete);
    }
  });
  document.getElementById('pePhoto').addEventListener('change', event => {
    const file = event.target.files && event.target.files[0];
    const preview = document.getElementById('pePreview');
    const previewImg = document.getElementById('pePreviewImg');
    if (!file) {
      pendingPhoto = null;
      preview.hidden = true;
      return;
    }
    pendingPhoto = file;
    previewImg.src = URL.createObjectURL(file);
    preview.hidden = false;
  });
})();
