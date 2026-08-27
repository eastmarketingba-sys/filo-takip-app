const path = require('path');
const Database = require('better-sqlite3');
const { app } = require('electron');

const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS cars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        plate TEXT,
        photo TEXT,
        avg_price REAL,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_cars_plate ON cars(plate);

      CREATE TABLE IF NOT EXISTS rentals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        price_per_day REAL NOT NULL,
        renter_name TEXT,
        renter_photo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_rentals_car_id ON rentals(car_id);
      CREATE INDEX IF NOT EXISTS idx_rentals_dates ON rentals(start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_rentals_renter_name ON rentals(renter_name);
    `
  },
  {
    version: 2,
    sql: `
      ALTER TABLE rentals ADD COLUMN start_time TEXT;
      ALTER TABLE rentals ADD COLUMN end_time TEXT;
    `
  },
  {
    version: 3,
    sql: `
      ALTER TABLE rentals ADD COLUMN renter_phone TEXT;
    `
  },
  {
    version: 4,
    sql: `
      ALTER TABLE rentals ADD COLUMN note TEXT;
    `
  },
  {
    version: 5,
    sql: `
      ALTER TABLE rentals ADD COLUMN destination TEXT;
    `
  },
  {
    version: 6,
    sql: `
      ALTER TABLE cars ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
    `
  },
  {
    version: 7,
    sql: `
      ALTER TABLE rentals ADD COLUMN price_mode TEXT NOT NULL DEFAULT 'daily';
      ALTER TABLE rentals ADD COLUMN price_total REAL;
    `
  },
  {
    version: 8,
    sql: `
      ALTER TABLE rentals ADD COLUMN delivered_at TEXT;
      ALTER TABLE rentals ADD COLUMN delivered_note TEXT;
      ALTER TABLE rentals ADD COLUMN returned_at TEXT;
      ALTER TABLE rentals ADD COLUMN returned_note TEXT;
    `
  }
];

let db = null;

function getDbPath() {
  return path.join(app.getPath('userData'), 'filo-takip.db');
}

function getDb() {
  if (db) return db;
  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function runMigrations(database) {
  database.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`);
  const row = database.prepare('SELECT version FROM schema_version LIMIT 1').get();
  let current = row ? row.version : 0;
  if (!row) database.prepare('INSERT INTO schema_version (version) VALUES (0)').run();

  const pending = MIGRATIONS.filter(m => m.version > current).sort((a, b) => a.version - b.version);
  if (pending.length === 0) return;

  const applyAll = database.transaction(() => {
    for (const m of pending) {
      database.exec(m.sql);
      current = m.version;
    }
    database.prepare('UPDATE schema_version SET version = ?').run(current);
  });
  applyAll();
}

module.exports = { getDb, getDbPath, closeDb };
