const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

let db;

function openDatabase(filePath) {
  if (db) db.close();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  return db;
}

function getDatabase() {
  if (!db) throw new Error('Database is not available.');
  return db;
}

module.exports = { openDatabase, getDatabase };
