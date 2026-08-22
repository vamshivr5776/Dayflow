// Database layer built on Node's built-in `node:sqlite` (stable enough for
// this project, still marked experimental upstream — see README). A single
// file database lives in ./data/dayflow.db and is created on first run.

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const { hashPassword } = require('./utils/password');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'dayflow.db');

// `--reset` lets you wipe local data during development: node src/db.js --reset
if (process.argv.includes('--reset') && fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('Removed existing database file.');
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id       TEXT NOT NULL UNIQUE,
    email             TEXT NOT NULL UNIQUE,
    password_hash     TEXT NOT NULL,
    role              TEXT NOT NULL CHECK (role IN ('employee','admin')),
    email_verified    INTEGER NOT NULL DEFAULT 0,
    verification_code TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS profiles (
    user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL DEFAULT '',
    phone           TEXT NOT NULL DEFAULT '',
    address         TEXT NOT NULL DEFAULT '',
    job_title       TEXT NOT NULL DEFAULT '',
    department      TEXT NOT NULL DEFAULT '',
    date_of_joining TEXT,
    profile_picture_url TEXT NOT NULL DEFAULT '',
    documents       TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS salaries (
    user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    basic       REAL NOT NULL DEFAULT 0,
    hra         REAL NOT NULL DEFAULT 0,
    allowances  REAL NOT NULL DEFAULT 0,
    deductions  REAL NOT NULL DEFAULT 0,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date       TEXT NOT NULL,
    check_in   TEXT,
    check_out  TEXT,
    status     TEXT NOT NULL CHECK (status IN ('present','absent','half-day','leave')),
    UNIQUE(user_id, date)
  );

  CREATE TABLE IF NOT EXISTS leave_requests (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type    TEXT NOT NULL CHECK (leave_type IN ('paid','sick','unpaid')),
    start_date    TEXT NOT NULL,
    end_date      TEXT NOT NULL,
    remarks       TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    admin_comment TEXT NOT NULL DEFAULT '',
    decided_by    INTEGER REFERENCES users(id),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at    TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
`);

function seed() {
  const existing = db.prepare('SELECT id FROM users WHERE employee_id = ?')
    .get(process.env.SEED_ADMIN_EMPLOYEE_ID || 'DF-0001');
  if (existing) return;

  const employeeId = process.env.SEED_ADMIN_EMPLOYEE_ID || 'DF-0001';
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@dayflow.io';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';

  const info = db.prepare(`
    INSERT INTO users (employee_id, email, password_hash, role, email_verified)
    VALUES (?, ?, ?, 'admin', 1)
  `).run(employeeId, email, hashPassword(password));

  db.prepare(`
    INSERT INTO profiles (user_id, full_name, job_title, department, date_of_joining)
    VALUES (?, 'Dayflow Admin', 'HR Officer', 'People Operations', date('now'))
  `).run(info.lastInsertRowid);

  db.prepare(`
    INSERT INTO salaries (user_id, basic, hra, allowances, deductions)
    VALUES (?, 60000, 15000, 5000, 3000)
  `).run(info.lastInsertRowid);

  console.log(`Seeded admin account -> email: ${email}  password: ${password}`);
  console.log('Change this password in production.');
}

seed();

module.exports = { db };
