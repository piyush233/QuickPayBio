require('dotenv').config();
const express = require('express');
const path = require('path');
const profileRoutes = require('./routes/profiles');
const { initDb } = require('./services/db');

const app = express();
const port = Number(process.env.PORT) || 3002;
const publicDirectory = path.join(__dirname, '../public');

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
initDb();

app.use(express.static(publicDirectory));
app.get('/health', (req, res) => res.json({ status: 'ok', app: 'QuickPayBio' }));
app.use('/api/profiles', profileRoutes);
app.get('/', (req, res) => res.sendFile(path.join(publicDirectory, 'quickpay.html')));
app.get('/:slug', (req, res, next) => {
  if (req.params.slug.startsWith('api')) return next();
  res.sendFile(path.join(publicDirectory, 'quickpay.html'));
});

if (require.main === module) {
  app.listen(port, () => console.log(`QuickPayBio is running at http://localhost:${port}`));
}

module.exports = app;
