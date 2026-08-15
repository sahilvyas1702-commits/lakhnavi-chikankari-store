// Shared catalogue loader.
// When Supabase is configured, the live product table becomes the source of
// truth for the storefront (window.PRODUCTS is rebuilt in place, so existing
// references stay valid). products.js remains the offline/startup fallback.
window.loadShopCatalog = (function () {
  function configured() {
    return window.SHOP_CONFIG &&
      window.SHOP_CONFIG.SUPABASE_URL &&
      !window.SHOP_CONFIG.SUPABASE_URL.includes('YOUR-PROJECT') &&
      window.SHOP_CONFIG.SUPABASE_ANON_KEY &&
      !window.SHOP_CONFIG.SUPABASE_ANON_KEY.includes('YOUR-') &&
      window.supabase &&
      typeof window.supabase.createClient === 'function';
  }

  async function load() {
    const source = window.PRODUCTS || {};
    if (!configured()) return false;
    const client = window.supabase.createClient(window.SHOP_CONFIG.SUPABASE_URL, window.SHOP_CONFIG.SUPABASE_ANON_KEY);
    const { data, error } = await client
      .from('products')
      .select('id,name,price,compare_at,rating,reviews,badge,image,category,sku,colour,craft,fabric,fit,occasion,description,details')
      .eq('active', true)
      .order('sort_order', { ascending: true });
    if (error || !Array.isArray(data) || !data.length) return false;
    const rebuilt = {};
    data.forEach(row => {
      rebuilt[row.id] = {
        name: row.name,
        price: Number(row.price) || 0,
        compareAt: Number(row.compare_at) || 0,
        rating: Number(row.rating) || 0,
        reviews: Number(row.reviews) || 0,
        badge: row.badge || '',
        image: row.image || 'images/product-1.jpg?v=4',
        category: row.category || '',
        sku: row.sku || '',
        colour: row.colour || '',
        craft: row.craft || '',
        fabric: row.fabric || '',
        fit: row.fit || '',
        occasion: row.occasion || '',
        description: row.description || '',
        details: Array.isArray(row.details) ? row.details : []
      };
    });
    Object.keys(source).forEach(key => delete source[key]);
    Object.assign(source, rebuilt);
    return true;
  }

  return load;
})();
