// db.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbFile = path.join(__dirname, "onboarding.db");
const db = new sqlite3.Database(dbFile);

// Wrapper abstraktion om run + ekplicit fejl-logging
function run(sql, params = []) {
  db.run(sql, params, (err) => {
    if (err) console.error("SQLite error:", err.message, "\nSQL:", sql);
  });
}

db.serialize(() => {
  run(`PRAGMA foreign_keys = ON;`);

  // Users
  run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Journeys
  run(`
    CREATE TABLE IF NOT EXISTS journeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT
    );
  `);

  // Journey tasks
  run(`
    CREATE TABLE IF NOT EXISTS journey_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journey_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      event_type TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (journey_id) REFERENCES journeys(id)
    );
  `);

  // User ↔ journeys
  run(`
    CREATE TABLE IF NOT EXISTS user_journeys (
      user_id INTEGER NOT NULL,
      journey_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, journey_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (journey_id) REFERENCES journeys(id)
    );
  `);

  // Progress (idempotent pr bruger/forløb/opgave)
  run(`
    CREATE TABLE IF NOT EXISTS task_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      journey_id INTEGER NOT NULL,
      task_id INTEGER NOT NULL,
      completed_at TEXT NOT NULL, -- ISO-8601 string (new Date().toISOString())
      metadata TEXT,
      UNIQUE (user_id, journey_id, task_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (journey_id) REFERENCES journeys(id),
      FOREIGN KEY (task_id) REFERENCES journey_tasks(id)
    );
  `);

  // ---- Seed data ----
  const DEMO_JOURNEY_ID = 1;

  // Brugere
  run(
    `INSERT OR IGNORE INTO users (id, name, password, is_admin) VALUES (?, ?, ?, ?);`,
    [1, "admin", "admin", 1]
  );
  run(
    `INSERT OR IGNORE INTO users (id, name, password, is_admin) VALUES (?, ?, ?, ?);`,
    [2, "Brian", "password123", 0]
  );
  run(
    `INSERT OR IGNORE INTO users (id, name, password, is_admin) VALUES (?, ?, ?, ?);`,
    [3, "Lotte fra Kvalitet", "password123", 0]
  );
  run(
    `INSERT OR IGNORE INTO users (id, name, password, is_admin) VALUES (?, ?, ?, ?);`,
    [4, "Birthe fra HR", "password123", 0]
  );

  // Journey
  run(
    `INSERT OR IGNORE INTO journeys (id, name, description) VALUES (?, ?, ?);`,
    [
      DEMO_JOURNEY_ID,
      "Ny dokumentansvarlig",
      "Onboarding for ny dokumentansvarlig",
    ]
  );

  // Tasks (uden prepare)
  run(
    `INSERT OR IGNORE INTO journey_tasks (id, journey_id, title, event_type, sort_order)
     VALUES (?, ?, ?, ?, ?);`,
    [1, DEMO_JOURNEY_ID, "Opret første dokument", "document_created", 1]
  );
  run(
    `INSERT OR IGNORE INTO journey_tasks (id, journey_id, title, event_type, sort_order)
     VALUES (?, ?, ?, ?, ?);`,
    [
      2,
      DEMO_JOURNEY_ID,
      "Send dokument til godkendelse",
      "document_submitted_for_approval",
      2,
    ]
  );
  run(
    `INSERT OR IGNORE INTO journey_tasks (id, journey_id, title, event_type, sort_order)
     VALUES (?, ?, ?, ?, ?);`,
    [3, DEMO_JOURNEY_ID, "Godkend et dokument", "document_approved", 3]
  );

  // Tildel demo journey til bruger 3
  run(
    `INSERT OR IGNORE INTO user_journeys (user_id, journey_id) VALUES (?, ?);`,
    [3, DEMO_JOURNEY_ID]
  );
});

module.exports = db;
