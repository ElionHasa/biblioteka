// Databaza SQLite (një skedar i vetëm: data/biblioteka.db), fjalëkalimet dhe të dhënat demo.
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(path.join(dir, 'biblioteka.db'));
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS books (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  title    TEXT NOT NULL,
  author   TEXT NOT NULL,
  category TEXT NOT NULL,
  copies   INTEGER NOT NULL CHECK (copies >= 1),
  is_demo  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS students (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  class_name    TEXT NOT NULL,
  unique_key    TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  registered_at TEXT NOT NULL DEFAULT (date('now','localtime'))
);
CREATE TABLE IF NOT EXISTS loans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  loan_date   TEXT NOT NULL,
  due_date    TEXT NOT NULL,
  return_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_loans_book ON loans(book_id);
CREATE INDEX IF NOT EXISTS idx_loans_active ON loans(return_date);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// Përditësim për databazat e krijuara me versionin e parë
function addColumn(table, column, def) {
  const has = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
}
addColumn('students', 'password_hash', 'TEXT');
addColumn('books', 'is_demo', 'INTEGER NOT NULL DEFAULT 0');

// ---- Fjalëkalimet (hash me scrypt) ----
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return salt.toString('hex') + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}

function verifyPassword(pw, stored) {
  if (typeof pw !== 'string' || typeof stored !== 'string') return false;
  const [saltHex, hashHex] = stored.split(':');
  const test = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64);
  return crypto.timingSafeEqual(test, Buffer.from(hashHex, 'hex'));
}

function setAdminPassword(pw) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES ('admin_password', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(hashPassword(pw));
}

function checkAdminPassword(pw) {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'admin_password'`).get();
  return !!row && verifyPassword(pw, row.value);
}

// Hera e parë: krijo fjalëkalimin e administratorit (nga ADMIN_PASSWORD ose i rastësishëm).
if (!db.prepare(`SELECT 1 FROM settings WHERE key = 'admin_password'`).get()) {
  const generated = !process.env.ADMIN_PASSWORD;
  const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  setAdminPassword(pw);
  if (generated) {
    console.log('\n=============================================');
    console.log(' Fjalëkalimi i administratorit (ruaje!):');
    console.log('   ' + pw);
    console.log(' Për ta ndryshuar: npm run set-password');
    console.log('=============================================\n');
  }
}

// ---- Libra demo (vetëm herën e parë, kur biblioteka është bosh) ----
// Fshihen nga paneli i administratorit me butonin "Fshi librat demo".
const DEMO_BOOKS = [
  ['Gjenerali i ushtrisë së vdekur', 'Ismail Kadare', 'Roman', 3],
  ['Kronikë në gur', 'Ismail Kadare', 'Roman', 2],
  ['Prilli i thyer', 'Ismail Kadare', 'Roman', 2],
  ['Të mjerët', 'Victor Hugo', 'Roman', 2],
  ['Shkëlqimi dhe rënia e shokut Zylo', 'Dritëro Agolli', 'Roman', 2],
  ['Vargjet e lira', 'Migjeni', 'Poezi', 3],
  ['Lahuta e Malcís', 'Gjergj Fishta', 'Poezi', 2],
  ['Princi i vogël', 'Antoine de Saint-Exupéry', 'Fëmijë', 4],
  ['Alisa në Vendin e Çudirave', 'Lewis Carroll', 'Fëmijë', 3],
  ['Pinoku', 'Carlo Collodi', 'Fëmijë', 2],
  ['Robinson Kruzo', 'Daniel Defoe', 'Aventurë', 2],
  ['Ishulli i thesarit', 'Robert Louis Stevenson', 'Aventurë', 2],
  ['Rreth botës për 80 ditë', 'Jules Verne', 'Aventurë', 3],
  ['Harry Potter dhe Guri Filozofal', 'J. K. Rowling', 'Fantazi', 3],
  ['Një histori e shkurtër e kohës', 'Stephen Hawking', 'Shkencë', 2],
  ['Kozmosi', 'Carl Sagan', 'Shkencë', 2],
  ['Historia e Skënderbeut', 'Marin Barleti', 'Histori', 2],
  ['Hamleti', 'William Shakespeare', 'Dramë', 2],
  ['Romeo dhe Zhuljeta', 'William Shakespeare', 'Dramë', 3],
];
if (!db.prepare(`SELECT 1 FROM settings WHERE key = 'demo_seeded'`).get()) {
  if (db.prepare('SELECT COUNT(*) AS n FROM books').get().n === 0) {
    const ins = db.prepare('INSERT INTO books (title, author, category, copies, is_demo) VALUES (?,?,?,?,1)');
    db.exec('BEGIN');
    try { DEMO_BOOKS.forEach((b) => ins.run(...b)); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  db.prepare(`INSERT INTO settings (key, value) VALUES ('demo_seeded', '1')`).run();
}

module.exports = { db, hashPassword, verifyPassword, setAdminPassword, checkAdminPassword };
