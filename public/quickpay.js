const app = document.getElementById('app');
const toast = document.getElementById('toast');
const installButton = document.getElementById('install-button');
let profileData = null;
let deferredInstallPrompt = null;
let toastTimer;

const categories = ['Electrician', 'Tutor', 'Plumber', 'Yoga instructor', 'Beauty & wellness', 'Repair service', 'Fitness coach', 'Photographer', 'Independent creator', 'Other'];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function slugify(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
}

function serviceRows(services = [{ title: '', price: '' }]) {
  return services.map((service) => `
    <div class="service-row">
      <input name="serviceTitle" maxlength="100" placeholder="Service name" value="${escapeHtml(service.title)}" aria-label="Service name">
      <input name="servicePrice" type="number" min="0" max="10000000" step="1" inputmode="numeric" placeholder="Price ₹" value="${escapeHtml(service.price)}" aria-label="Price in rupees">
      <button class="remove-service" type="button" aria-label="Remove service">×</button>
    </div>`).join('');
}

function formMarkup(profile = null) {
  const selectedCategory = profile?.category || '';
  return `
    <form id="profile-form">
      <div class="field-grid two-up">
        <div class="field"><label for="business-name">Your name or business</label><input id="business-name" name="businessName" maxlength="100" placeholder="e.g. Rohan's AC Care" value="${escapeHtml(profile?.business_name || '')}" autocomplete="organization" required></div>
        <div class="field"><label for="category">What do you do?</label><select id="category" name="category" required><option value="" disabled ${selectedCategory ? '' : 'selected'}>Choose your work</option>${categories.map((category) => `<option ${selectedCategory === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}</select></div>
      </div>
      <div class="field-grid two-up">
        <div class="field"><label for="phone">WhatsApp number</label><input id="phone" name="whatsappPhone" type="tel" inputmode="tel" maxlength="15" placeholder="98765 43210" value="${escapeHtml(profile?.whatsapp_phone || '')}" autocomplete="tel" required><small class="field-hint">Include country code if outside India.</small></div>
        <div class="field"><label for="upi">Your UPI ID</label><input id="upi" name="upiId" maxlength="100" placeholder="name@bank" value="${escapeHtml(profile?.upi_id || '')}" autocomplete="off" required><small class="field-hint">Payments go directly to this UPI ID.</small></div>
      </div>
      ${profile ? '' : `<div class="field"><label for="slug">Your page address</label><div class="slug-control"><span class="slug-base">quickpaybio.in/</span><input id="slug" name="slug" maxlength="50" placeholder="your-name" autocomplete="off" required></div></div>`}
      <div class="field"><label for="description">A short introduction <span class="field-hint" style="display:inline">(optional)</span></label><textarea id="description" name="description" maxlength="240" placeholder="Tell customers what you can help with...">${escapeHtml(profile?.description || '')}</textarea></div>
      <div class="services-head"><label>Your services & prices</label><button class="text-button" id="add-service" type="button">+ Add service</button></div>
      <div id="service-rows">${serviceRows(profile?.services?.length ? profile.services : [{ title: '', price: '' }])}</div>
      <button class="primary-button" type="submit">${profile ? 'Save changes' : 'CREATE MY PAGE NOW'} <span aria-hidden="true">→</span></button>
      ${profile ? '' : '<p class="privacy-note">Free to create. No account or password needed.</p>'}
    </form>`;
}

function renderCreate() {
  document.title = 'Create your page | QuickPayBio';
  app.innerHTML = `
    <div class="create-layout">
      <section class="intro">
        <span class="eyebrow">A small page. A more professional you.</span>
        <h1>Your work,<br>ready to <em>share.</em></h1>
        <p class="intro-copy">Put your services, prices and UPI payment link in one simple page. Send it to any customer on WhatsApp.</p>
        <div class="time-note"><strong>01 / QUICK SETUP</strong><span>Usually takes less than a minute</span></div>
        <div class="trust-strip"><span>No app account needed</span><span>UPI goes straight to you</span><span>Free to start</span></div>
      </section>
      <section class="form-panel">
        <div class="form-heading"><div><h2>Make your page</h2><p>Just the details your customers need.</p></div><span class="step-mark">01 — 01</span></div>
        <div class="offline-note" id="offline-note">You're offline. Your public page may be available from this device's cache.</div>
        ${formMarkup()}
      </section>
    </div>`;
  bindForm();
  const nameInput = document.getElementById('business-name');
  const slugInput = document.getElementById('slug');
  nameInput.addEventListener('input', () => {
    if (!slugInput.dataset.edited) slugInput.value = slugify(nameInput.value);
  });
  slugInput.addEventListener('input', () => { slugInput.dataset.edited = 'true'; });
  updateOfflineNote();
}

function collectForm(form) {
  const values = new FormData(form);
  const titles = values.getAll('serviceTitle');
  const prices = values.getAll('servicePrice');
  const services = titles.map((title, index) => ({ title: title.trim(), price: prices[index] === '' ? '' : Number(prices[index]) }))
    .filter((service) => service.title || service.price !== '');
  return {
    businessName: values.get('businessName').trim(),
    category: values.get('category'),
    whatsappPhone: values.get('whatsappPhone').trim(),
    upiId: values.get('upiId').trim(),
    description: values.get('description').trim(),
    services,
    ...(values.get('slug') ? { slug: slugify(values.get('slug')) } : {})
  };
}

function bindForm(profile = null) {
  const form = document.getElementById('profile-form');
  form.querySelector('#add-service').addEventListener('click', () => {
    const rows = document.getElementById('service-rows');
    if (rows.children.length >= 8) return showToast('You can add up to 8 services.');
    rows.insertAdjacentHTML('beforeend', serviceRows([{ title: '', price: '' }]));
  });
  form.addEventListener('click', (event) => {
    if (!event.target.matches('.remove-service')) return;
    const rows = document.getElementById('service-rows');
    if (rows.children.length === 1) {
      rows.firstElementChild.querySelectorAll('input').forEach((input) => { input.value = ''; });
    } else {
      event.target.closest('.service-row').remove();
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = profile ? 'Saving…' : 'Creating your page…';
    const payload = collectForm(form);
    try {
      const response = await fetch(profile ? `/api/profiles/${encodeURIComponent(profile.slug)}` : '/api/profiles', {
        method: profile ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(profile ? { Authorization: `Bearer ${getEditToken()}` } : {}) },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save your page.');
      if (!profile) {
        history.replaceState(null, '', `/${encodeURIComponent(result.slug)}#edit=${result.editToken}`);
        showToast('Your page is live. Save this private link to edit it later.');
        await loadProfile(result.slug);
      } else {
        profileData = result.profile;
        renderProfile(profileData, true);
        showToast('Your changes are live.');
      }
    } catch (error) {
      showToast(error.message || 'Could not connect. Check your connection and try again.');
      button.disabled = false;
      button.innerHTML = profile ? 'Save changes <span aria-hidden="true">→</span>' : 'CREATE MY PAGE NOW <span aria-hidden="true">→</span>';
    }
  });
}

function getEditToken() {
  const match = location.hash.match(/^#edit=([a-f0-9]+)$/);
  return match?.[1] || '';
}

function upiLink(profile, service = null) {
  const query = new URLSearchParams({ pa: profile.upi_id, pn: profile.business_name, cu: 'INR', tn: service ? service.title : `Payment to ${profile.business_name}` });
  if (service?.price > 0) query.set('am', String(service.price));
  return `upi://pay?${query.toString()}`;
}

function renderProfile(profile, openEditor = false) {
  profileData = profile;
  document.title = `${profile.business_name} | QuickPayBio`;
  const editor = getEditToken();
  const services = profile.services || [];
  const phoneDigits = profile.whatsapp_phone.replace(/\D/g, '');
  const phone = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
  const hello = `Hi ${profile.business_name}, I found your page on QuickPayBio. I'd like to know more.`;
  app.innerHTML = `
    <div class="profile-layout">
      <div class="profile-top"><span class="profile-label">QUICKPAYBIO / ${escapeHtml(profile.slug)}</span>${editor ? '<div><button class="edit-link" id="copy-edit-link" type="button">Copy private link</button><button class="edit-link" id="toggle-edit" type="button">Edit page</button></div>' : '<button class="edit-link" id="share-page" type="button">Share page</button>'}</div>
      <div class="profile-panel">
        <section class="profile-hero"><div class="profile-avatar" aria-hidden="true">${escapeHtml(profile.business_name.trim().charAt(0).toUpperCase())}</div><span class="category-pill">${escapeHtml(profile.category)}</span><h1>${escapeHtml(profile.business_name)}</h1><p class="profile-description">${escapeHtml(profile.description || 'Independent professional, ready to help.')}</p></section>
        ${services.length ? `<section class="service-list"><h2>Services & pricing</h2>${services.map((service) => `<div class="public-service"><p class="public-service-title">${escapeHtml(service.title)}</p><a class="public-service-price" href="${escapeHtml(upiLink(profile, service))}" aria-label="Pay ${money(service.price)} for ${escapeHtml(service.title)}">Pay ${money(service.price)} <span aria-hidden="true">→</span></a></div>`).join('')}</section>` : ''}
        <div class="profile-actions"><a class="pay-button" href="${escapeHtml(upiLink(profile, services.length === 1 ? services[0] : null))}"><span aria-hidden="true">↗</span> Pay with UPI</a><a class="whatsapp-button" href="https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(hello)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">◉</span> Book on WhatsApp</a></div>
        <div class="profile-foot">UPI payments go directly to ${escapeHtml(profile.business_name)}. No wallet in between.</div>
      </div>
      ${editor ? `<section class="edit-panel" id="edit-panel" ${openEditor ? '' : 'hidden'}><h2>Edit your page</h2>${formMarkup(profile)}</section>` : ''}
    </div>`;
  document.getElementById('share-page')?.addEventListener('click', sharePage);
  document.getElementById('copy-edit-link')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      showToast('Private edit link copied. Keep it somewhere safe.');
    } catch (error) {
      showToast('Copy the full address bar link to keep your edit access.');
    }
  });
  document.getElementById('toggle-edit')?.addEventListener('click', () => {
    const panel = document.getElementById('edit-panel');
    panel.hidden = !panel.hidden;
    if (!panel.hidden) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  if (editor) bindForm(profile);
}

async function sharePage() {
  const shareData = { title: `${profileData.business_name} | QuickPayBio`, text: `Services and UPI payments for ${profileData.business_name}`, url: location.href.split('#')[0] };
  if (navigator.share) {
    try { await navigator.share(shareData); } catch (error) { if (error.name !== 'AbortError') showToast('Could not open sharing.'); }
  } else {
    await navigator.clipboard.writeText(shareData.url);
    showToast('Page link copied.');
  }
}

async function loadProfile(slug) {
  app.innerHTML = '<div class="loading-state"><span class="eyebrow">QUICKPAYBIO</span><p>Loading this page…</p></div>';
  try {
    const response = await fetch(`/api/profiles/${encodeURIComponent(slug)}`);
    if (!response.ok) throw new Error(response.status === 404 ? 'This page does not exist yet.' : 'Could not load this page.');
    renderProfile(await response.json());
  } catch (error) {
    app.innerHTML = `<section class="error-state"><span class="eyebrow">QUICKPAYBIO</span><h1>Page unavailable</h1><p>${escapeHtml(error.message)}${navigator.onLine ? '' : ' Reconnect to load this page.'}</p><a class="primary-button" href="/">Create your own page <span aria-hidden="true">→</span></a></section>`;
  }
}

function updateOfflineNote() {
  const note = document.getElementById('offline-note');
  if (note) note.classList.toggle('visible', !navigator.onLine);
}

const slug = decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, ''));
if (slug) loadProfile(slug);
else renderCreate();

window.addEventListener('online', updateOfflineNote);
window.addEventListener('offline', updateOfflineNote);
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) {
    showToast('In Safari, tap Share, then Add to Home Screen.');
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (isIos && !isStandalone) {
  installButton.textContent = 'Add to Home Screen';
  installButton.hidden = false;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(() => {}));
}