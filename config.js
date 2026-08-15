// Lakhnavi Chikankari - browser configuration
// Keep Secret/service_role keys OUT of this file.
window.SHOP_CONFIG = {
  SUPABASE_URL: "https://tmuzndpbjvmtcuwmneow.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtdXpuZHBianZtdGN1d21uZW93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2ODQ0ODYsImV4cCI6MjEwMjI2MDQ4Nn0.CPv8rP1lE56jiCfsUXV8WDprXYmRBUHpSQE7W8vRIjo",
  SHOP_NAME: "Lakhnavi Chikankari",
  PHONE_10: "9899551923"
};

// Phone helpers: store a plain 10-digit number above and derive every
// WhatsApp / tel format automatically.
window.SHOP_PHONE = (function () {
  const raw = String(window.SHOP_CONFIG && window.SHOP_CONFIG.PHONE_10 || '9899551923');
  const digits = raw.replace(/\D/g, '').slice(-10);
  const display = digits.length === 10 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
  return {
    digits: digits || '9899551923',
    display: display || '98995 51923',
    wa: `91${digits || '9899551923'}`,
    tel: `+91${digits || '9899551923'}`
  };
})();
