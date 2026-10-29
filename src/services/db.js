const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDirectory = path.join(__dirname, '../../data');
fs.mkdirSync(dataDirectory, { recursive: true });

const db = new Database(path.join(dataDirectory, 'quickpaybio.sqlite'));
db.pragma('foreign_keys = ON');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      business_name TEXT NOT NULL,
      category TEXT NOT NULL,
      whatsapp_phone TEXT NOT NULL,
      upi_id TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      edit_token_hash TEXT NOT NULL,
      is_pro INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id TEXT NOT NULL,
      title TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
  `);
}

module.exports = { db, initDb };
