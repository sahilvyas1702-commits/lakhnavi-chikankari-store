document.getElementById('contactForm')?.addEventListener('submit', event => {
  event.preventDefault();
  const name = document.getElementById('contactName').value.trim();
  const mobile = document.getElementById('contactPhone').value.trim();
  const product = document.getElementById('contactProduct').value.trim();
  const question = document.getElementById('contactMessage').value.trim();
  const status = document.getElementById('contactStatus');
  if (!name || mobile.replace(/\D/g, '').length < 10 || !question) {
    status.textContent = 'Enter your name, a valid mobile number and your question.';
    return;
  }
  const message = [`Hello Lakhnavi Chikankari,`, `Name: ${name}`, `Mobile: ${mobile}`, product && `Product / SKU: ${product}`, `Question: ${question}`].filter(Boolean).join('\n');
  window.open(`https://wa.me/919899551923?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  status.textContent = 'WhatsApp opened with your enquiry.';
});
