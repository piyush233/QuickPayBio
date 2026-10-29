const express = require('express');
const crypto = require('crypto');
const { db } = require('../services/db');

const router = express.Router();
const MAX_SERVICES = 8;

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeSlug(value) {
  return cleanText(value, 50)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeServices(value) {
  if (!Array.isArray(value)) return [];
  return value.map((service) => ({
    title: cleanText(service?.title, 100),
    price: service?.price !== '' && service?.price !== undefined && Number.isInteger(Number(service.price)) ? Number(service.price) : NaN
  })).filter((service) => service.title && Number.isInteger(service.price) && service.price >= 0 && service.price <= 10000000);
}

function publicProfile(slug) {
  const profile = db.prepare(`
    SELECT id, slug, business_name, category, whatsapp_phone, upi_id, description, is_pro, created_at
    FROM profiles WHERE slug = ?
  `).get(slug);
  if (!profile) return null;
  profile.services = db.prepare('SELECT title, price FROM services WHERE profile_id = ? ORDER BY sort_order, id').all(profile.id);
  return profile;
}

function validPayload(body, creating = false) {
  const payload = {
    businessName: cleanText(body.businessName, 100),
    category: cleanText(body.category, 50),
    whatsappPhone: cleanText(body.whatsappPhone, 15).replace(/[^\d]/g, ''),
    upiId: cleanText(body.upiId, 100),
    description: cleanText(body.description, 240),
    services: normalizeServices(body.services)
  };
  const slug = normalizeSlug(body.slug || payload.businessName);
  const valid = payload.businessName && payload.category &&
    /^\d{10,15}$/.test(payload.whatsappPhone) &&
    /^[\w.-]{2,256}@[\w.-]{2,64}$/.test(payload.upiId) &&
    (!creating || slug) &&
    (!body.services || (body.services.length <= MAX_SERVICES && payload.services.length === body.services.length));
  return { payload, slug, valid: Boolean(valid) };
}

router.post('/', (req, res) => {
  const { payload, slug, valid } = validPayload(req.body, true);
  if (!valid) return res.status(400).json({ error: 'Check the required fields, phone number, UPI ID and service prices.' });
  if (db.prepare('SELECT 1 FROM profiles WHERE slug = ?').get(slug)) {
    return res.status(409).json({ error: 'That page address is taken. Try another one.' });
  }

  const id = crypto.randomUUID();
  const editToken = crypto.randomBytes(24).toString('hex');
  const insertProfile = db.prepare(`
    INSERT INTO profiles (id, slug, business_name, category, whatsapp_phone, upi_id, description, edit_token_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertService = db.prepare('INSERT INTO services (profile_id, title, price, sort_order) VALUES (?, ?, ?, ?)');

  try {
    db.transaction(() => {
      insertProfile.run(id, slug, payload.businessName, payload.category, payload.whatsappPhone, payload.upiId, payload.description,
        crypto.createHash('sha256').update(editToken).digest('hex'));
      payload.services.forEach((service, index) => insertService.run(id, service.title, service.price, index));
    })();
    return res.status(201).json({ slug, editToken, pageUrl: `/${slug}` });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'That page address was just claimed. Try another one.' });
    console.error('Profile creation failed:', error);
    return res.status(500).json({ error: 'Could not create your page. Please try again.' });
  }
});

router.get('/:slug', (req, res) => {
  const profile = publicProfile(req.params.slug);
  if (!profile) return res.status(404).json({ error: 'Page not found' });
  return res.json(profile);
});

router.put('/:slug', (req, res) => {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  const profile = db.prepare('SELECT id, edit_token_hash FROM profiles WHERE slug = ?').get(req.params.slug);
  const tokenHash = crypto.createHash('sha256').update(token || '').digest('hex');
  const matches = profile && crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(profile.edit_token_hash));
  if (!matches) return res.status(401).json({ error: 'Edit link is invalid. Use the private link from when you created this page.' });

  const { payload, valid } = validPayload(req.body);
  if (!valid) return res.status(400).json({ error: 'Check the required fields, phone number, UPI ID and service prices.' });

  db.transaction(() => {
    db.prepare('UPDATE profiles SET business_name = ?, category = ?, whatsapp_phone = ?, upi_id = ?, description = ? WHERE id = ?')
      .run(payload.businessName, payload.category, payload.whatsappPhone, payload.upiId, payload.description, profile.id);
    db.prepare('DELETE FROM services WHERE profile_id = ?').run(profile.id);
    const insertService = db.prepare('INSERT INTO services (profile_id, title, price, sort_order) VALUES (?, ?, ?, ?)');
    payload.services.forEach((service, index) => insertService.run(profile.id, service.title, service.price, index));
  })();
  return res.json({ profile: publicProfile(req.params.slug) });
});

module.exports = router;
