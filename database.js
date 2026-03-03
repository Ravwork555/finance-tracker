const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./finance.db", (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to SQLite database.");
  }
});

// Create tables if not exist
db.serialize(() => {

  /* ===== INCOME TABLE ===== */
  db.run(`
    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL,
      source TEXT,
      date TEXT
    )
  `);

  /* ===== EXPENSE TABLE ===== */
  db.run(`
    CREATE TABLE IF NOT EXISTS expense (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL,
      category TEXT,
      date TEXT
    )
  `);

  /* ===== EMI TABLE (UPDATED STRUCTURE — MUST MATCH server.js) ===== */
  db.run(`
    CREATE TABLE IF NOT EXISTS emi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      total_amount REAL,
      monthly_amount REAL,
      total_months INTEGER,
      months_paid INTEGER DEFAULT 0,
      remaining_amount REAL,
      start_month TEXT,
      status TEXT DEFAULT 'Active'
    )
  `);

});

module.exports = db;