const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

let db;

function openDatabase(filePath) {
  if (db && db.open) db.close();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const organizationColumns = new Set(db.pragma('table_info(organizations)').map(column => column.name));
  if (!organizationColumns.has('payment_due_day')) {
    db.exec('ALTER TABLE organizations ADD COLUMN payment_due_day INTEGER CHECK (payment_due_day BETWEEN 1 AND 31)');
  }
  const legacyDueDates = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='payment_due_dates'").get();
  if (legacyDueDates) {
    db.exec(`UPDATE organizations
      SET payment_due_day=(
        SELECT CAST(substr(due_date,9,2) AS INTEGER)
        FROM payment_due_dates
        WHERE oid=organizations.oid
        ORDER BY (for_month=strftime('%Y-%m','now')) DESC,for_month DESC
        LIMIT 1
      )
      WHERE payment_due_day IS NULL
        AND EXISTS (SELECT 1 FROM payment_due_dates WHERE oid=organizations.oid)`);
  }
  const sessionColumns = new Set(db.pragma('table_info(sessions)').map(column => column.name));
  if (!sessionColumns.has('hall_id')) {
    db.exec('ALTER TABLE sessions ADD COLUMN hall_id INTEGER REFERENCES halls(hall_id)');
  }
  if (!sessionColumns.has('is_special')) {
    db.exec('ALTER TABLE sessions ADD COLUMN is_special INTEGER NOT NULL DEFAULT 0 CHECK (is_special IN (0,1))');
  }
  return db;
}

function getDatabase() {
  if (!db) throw new Error('Database is not available.');
  return db;
}

module.exports = { openDatabase, getDatabase };
