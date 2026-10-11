const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { db, hashPassword, verifyPassword, checkAdminPassword } = require('./db');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_MS = 8 * 60 * 60 * 1000;
const STUDENT_MS = 7 * 24 * 60 * 60 * 1000;

const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  });
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Ndihmës ----------
const fold = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const clean = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max + 1) : '');
const fail = (res, code, msg) => res.status(code).json({ error: msg });
const today = () => db.prepare(`SELECT date('now','localtime') AS d`).get().d;
const validDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00'));
const one = (sql, ...p) => db.prepare(sql).get(...p).n;
const titleCase = (s) => s.toLocaleLowerCase('sq').replace(/(^|[ '-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('sq'));

function limiter(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    let h = hits.get(req.ip);
    if (!h || h.reset < now) { h = { n: 0, reset: now + windowMs }; hits.set(req.ip, h); }
    if (++h.n > max) return fail(res, 429, 'Shumë tentativa. Provo përsëri më vonë.');
    next();
  };
}

function matches(q, ...fields) {
  const needle = fold(q || '').trim();
  return !needle || fields.some((f) => fold(f).includes(needle));
}

// ---------- Sesionet (administratori dhe nxënësit kanë cookie të ndara) ----------
const adminSessions = new Map(); // token -> { id, exp }
const studentSessions = new Map();

function cookieValue(req, name) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${name}=([A-Za-z0-9_-]+)`));
  return m && m[1];
}
function startSession(req, res, map, name, id, ms) {
  const token = crypto.randomBytes(32).toString('base64url');
  map.set(token, { id, exp: Date.now() + ms });
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.append('Set-Cookie', `${name}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ms / 1000}${secure}`);
}
function endSession(req, res, map, name) {
  map.delete(cookieValue(req, name));
  res.append('Set-Cookie', `${name}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}
function sessionOf(req, map, name) {
  const t = cookieValue(req, name);
  const s = t && map.get(t);
  if (!s || s.exp < Date.now()) { if (t) map.delete(t); return null; }
  return s;
}
setInterval(() => {
  const now = Date.now();
  for (const m of [adminSessions, studentSessions]) for (const [t, s] of m) if (s.exp < now) m.delete(t);
}, 60 * 60 * 1000).unref();

function requireAdmin(req, res, next) {
  if (!sessionOf(req, adminSessions, 'asid')) return fail(res, 401, 'Duhet të hysh si administrator.');
  next();
}
function requireStudent(req, res, next) {
  const s = sessionOf(req, studentSessions, 'ssid');
  if (!s) return fail(res, 401, 'Duhet të hysh në llogari.');
  req.studentId = s.id;
  next();
}

// ---------- Libra (publike) ----------
const BOOKS_SQL = `
  SELECT b.id, b.title, b.author, b.category, b.copies, b.is_demo,
         b.copies - (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id AND l.return_date IS NULL) AS available
  FROM books b ORDER BY b.title COLLATE NOCASE`;

function listBooks(q, category) {
  const cat = category ? fold(category) : '';
  return db.prepare(BOOKS_SQL).all()
    .filter((b) => (!cat || fold(b.category) === cat) && matches(q, b.title, b.author));
}

app.get('/api/books', (req, res) => res.json(listBooks(req.query.q, req.query.category)));

app.get('/api/stats', (req, res) => {
  const rows = db.prepare(BOOKS_SQL).all();
  const cats = new Map();
  for (const b of rows) {
    const k = fold(b.category);
    cats.set(k, { name: cats.get(k)?.name || b.category, count: (cats.get(k)?.count || 0) + 1 });
  }
  res.json({
    titles: rows.length,
    copies: rows.reduce((n, b) => n + b.copies, 0),
    available: rows.reduce((n, b) => n + b.available, 0),
    categories: [...cats.values()].sort((a, b) => a.name.localeCompare(b.name, 'sq')),
  });
});

// ---------- Llogaritë e nxënësve ----------
const NAME_RE = /^\p{L}[\p{L}' -]*$/u;
function parseIdentity(body) {
  const first = clean(body.first_name, 50);
  const last = clean(body.last_name, 50);
  const cls = clean(body.class_name, 10);
  if (!first || !last || first.length > 50 || last.length > 50 || !NAME_RE.test(first) || !NAME_RE.test(last))
    return { error: 'Shkruaj emrin dhe mbiemrin vetëm me shkronja.' };
  const m = cls.match(/^(\d{1,2})\s*[-\/ ]?\s*([A-Za-z]?)$/);
  if (!m) return { error: 'Klasa nuk është e vlefshme. Shkruaje si 7/A ose 7.' };
  const className = m[2] ? `${parseInt(m[1], 10)}/${m[2].toUpperCase()}` : String(parseInt(m[1], 10));
  return { first: titleCase(first), last: titleCase(last), className, key: `${fold(first)}|${fold(last)}|${className}` };
}
const validPassword = (pw) => typeof pw === 'string' && pw.length >= 6 && pw.length <= 100;
const PW_ERROR = 'Fjalëkalimi duhet të ketë të paktën 6 karaktere.';
const DUMMY_HASH = hashPassword('asnjë-nxënës');

app.post('/api/students', limiter(30, 60 * 60 * 1000), (req, res) => {
  const id = parseIdentity(req.body);
  if (id.error) return fail(res, 400, id.error);
  if (!validPassword(req.body.password)) return fail(res, 400, PW_ERROR);
  let newId;
  try {
    const r = db.prepare('INSERT INTO students (first_name, last_name, class_name, unique_key, password_hash) VALUES (?,?,?,?,?)')
      .run(id.first, id.last, id.className, id.key, hashPassword(req.body.password));
    newId = Number(r.lastInsertRowid);
  } catch (e) {
    if (/UNIQUE constraint failed/.test(e.message)) return fail(res, 409, 'Ky nxënës është regjistruar tashmë. Hyr në llogarinë ekzistuese.');
    throw e;
  }
  startSession(req, res, studentSessions, 'ssid', newId, STUDENT_MS);
  res.status(201).json({ ok: true });
});

app.post('/api/login', limiter(20, 15 * 60 * 1000), (req, res) => {
  const id = parseIdentity(req.body);
  const row = id.error ? null : db.prepare('SELECT id, password_hash FROM students WHERE unique_key = ?').get(id.key);
  const ok = verifyPassword(req.body.password, (row && row.password_hash) || DUMMY_HASH); // gjithmonë kontrollo, për kohë të njëjtë
  if (row && !row.password_hash) return fail(res, 403, 'Kjo llogari nuk ka fjalëkalim. Kërkoji bibliotekarit ta vendosë.');
  if (!row || !ok) return fail(res, 401, 'Të dhënat nuk janë të sakta.');
  startSession(req, res, studentSessions, 'ssid', row.id, STUDENT_MS);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  endSession(req, res, studentSessions, 'ssid');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const s = sessionOf(req, studentSessions, 'ssid');
  const student = s && db.prepare('SELECT id, first_name, last_name, class_name FROM students WHERE id = ?').get(s.id);
  res.json({ student: student || null });
});

app.get('/api/me/loans', requireStudent, (req, res) => {
  res.json(db.prepare(`
    SELECT l.id, l.loan_date, l.due_date, l.return_date, b.title, b.author, b.category,
           CASE WHEN l.return_date IS NULL AND l.due_date < date('now','localtime') THEN 1 ELSE 0 END AS overdue
    FROM loans l JOIN books b ON b.id = l.book_id
    WHERE l.student_id = ?
    ORDER BY (l.return_date IS NULL) DESC, l.due_date ASC, l.return_date DESC`).all(req.studentId));
});

// ---------- Hyrja e administratorit ----------
app.post('/api/admin/login', limiter(10, 15 * 60 * 1000), (req, res) => {
  if (!checkAdminPassword(req.body.password)) return fail(res, 401, 'Fjalëkalimi nuk është i saktë.');
  startSession(req, res, adminSessions, 'asid', 0, ADMIN_MS);
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => {
  endSession(req, res, adminSessions, 'asid');
  res.json({ ok: true });
});
app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ ok: true }));

// Gjithçka poshtë kërkon hyrje si administrator
app.use('/api/admin', requireAdmin);

app.get('/api/admin/stats', (req, res) => {
  res.json({
    titles: one('SELECT COUNT(*) AS n FROM books'),
    copies: one('SELECT COALESCE(SUM(copies),0) AS n FROM books'),
    students: one('SELECT COUNT(*) AS n FROM students'),
    active_loans: one('SELECT COUNT(*) AS n FROM loans WHERE return_date IS NULL'),
    overdue: one(`SELECT COUNT(*) AS n FROM loans WHERE return_date IS NULL AND due_date < date('now','localtime')`),
    demo_books: one('SELECT COUNT(*) AS n FROM books WHERE is_demo = 1'),
  });
});

// ---------- Librat (admin) ----------
function readBook(body) {
  const title = clean(body.title, 200);
  const author = clean(body.author, 120);
  const category = clean(body.category, 60);
  const copies = Number(body.copies);
  if (!title || title.length > 200 || !author || author.length > 120 || !category || category.length > 60)
    return { error: 'Plotëso titullin, autorin dhe kategorinë.' };
  if (!Number.isInteger(copies) || copies < 1 || copies > 1000)
    return { error: 'Numri i kopjeve duhet të jetë një numër i plotë, të paktën 1.' };
  return { title, author, category, copies };
}
const activeCount = (bookId) => one('SELECT COUNT(*) AS n FROM loans WHERE book_id = ? AND return_date IS NULL', bookId);

app.get('/api/admin/books', (req, res) => res.json(listBooks(req.query.q, req.query.category)));

app.post('/api/admin/books', (req, res) => {
  const b = readBook(req.body);
  if (b.error) return fail(res, 400, b.error);
  db.prepare('INSERT INTO books (title, author, category, copies) VALUES (?,?,?,?)').run(b.title, b.author, b.category, b.copies);
  res.status(201).json({ ok: true });
});

app.put('/api/admin/books/:id', (req, res) => {
  const id = Number(req.params.id);
  const b = readBook(req.body);
  if (b.error) return fail(res, 400, b.error);
  if (!db.prepare('SELECT 1 FROM books WHERE id = ?').get(id)) return fail(res, 404, 'Libri nuk u gjet.');
  const out = activeCount(id);
  if (b.copies < out) return fail(res, 400, `Ky libër ka ${out} kopje të huazuara. Kopjet nuk mund të jenë më pak se kaq.`);
  db.prepare('UPDATE books SET title=?, author=?, category=?, copies=?, is_demo=0 WHERE id=?').run(b.title, b.author, b.category, b.copies, id);
  res.json({ ok: true });
});

app.delete('/api/admin/demo-books', (req, res) => {
  const r = db.prepare(`DELETE FROM books WHERE is_demo = 1 AND id NOT IN (SELECT book_id FROM loans WHERE return_date IS NULL)`).run();
  res.json({ deleted: r.changes });
});

app.delete('/api/admin/books/:id', (req, res) => {
  const id = Number(req.params.id);
  if (activeCount(id) > 0) return fail(res, 409, 'Libri ka kopje të pakthyera. Regjistro fillimisht kthimin.');
  const r = db.prepare('DELETE FROM books WHERE id = ?').run(id);
  if (!r.changes) return fail(res, 404, 'Libri nuk u gjet.');
  res.json({ ok: true });
});

// ---------- Nxënësit (admin) ----------
app.get('/api/admin/students', (req, res) => {
  const rows = db.prepare(`
    SELECT s.id, s.first_name, s.last_name, s.class_name, s.registered_at,
           (s.password_hash IS NOT NULL) AS has_password,
           (SELECT COUNT(*) FROM loans l WHERE l.student_id = s.id AND l.return_date IS NULL) AS active_loans
    FROM students s ORDER BY s.last_name COLLATE NOCASE, s.first_name COLLATE NOCASE`).all();
  res.json(rows.filter((s) => matches(req.query.q, s.first_name + ' ' + s.last_name, s.last_name + ' ' + s.first_name, s.class_name)));
});

app.put('/api/admin/students/:id/password', (req, res) => {
  const id = Number(req.params.id);
  if (!validPassword(req.body.password)) return fail(res, 400, PW_ERROR);
  const r = db.prepare('UPDATE students SET password_hash = ? WHERE id = ?').run(hashPassword(req.body.password), id);
  if (!r.changes) return fail(res, 404, 'Nxënësi nuk u gjet.');
  for (const [t, s] of studentSessions) if (s.id === id) studentSessions.delete(t); // dil nga sesionet e vjetra
  res.json({ ok: true });
});

// ---------- Huazimet (admin) ----------
app.get('/api/admin/loans', (req, res) => {
  const rows = db.prepare(`
    SELECT l.id, l.loan_date, l.due_date, l.return_date,
           b.title, b.author, s.first_name, s.last_name, s.class_name,
           CASE WHEN l.return_date IS NULL AND l.due_date < date('now','localtime') THEN 1 ELSE 0 END AS overdue
    FROM loans l JOIN books b ON b.id = l.book_id JOIN students s ON s.id = l.student_id
    ORDER BY (l.return_date IS NULL) DESC,
             CASE WHEN l.return_date IS NULL THEN l.due_date END ASC,
             l.return_date DESC, l.id DESC`).all();
  const status = req.query.status;
  res.json(rows.filter((r) =>
    (status === 'active' ? !r.return_date : status === 'overdue' ? r.overdue : true) &&
    matches(req.query.q, r.title, r.author, r.first_name + ' ' + r.last_name, r.last_name + ' ' + r.first_name)));
});

function borrow(bookId, studentId, loanDate, dueDate) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const book = db.prepare('SELECT copies FROM books WHERE id = ?').get(bookId);
    let result = {};
    if (!book) result = { code: 404, error: 'Libri nuk u gjet.' };
    else if (!db.prepare('SELECT 1 FROM students WHERE id = ?').get(studentId)) result = { code: 404, error: 'Nxënësi nuk u gjet.' };
    else if (book.copies - activeCount(bookId) < 1) result = { code: 409, error: 'Nuk ka kopje të lira të këtij libri.' };
    else db.prepare('INSERT INTO loans (book_id, student_id, loan_date, due_date) VALUES (?,?,?,?)').run(bookId, studentId, loanDate, dueDate);
    db.exec(result.error ? 'ROLLBACK' : 'COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

app.post('/api/admin/loans', (req, res) => {
  const { book_id, student_id, loan_date, due_date } = req.body;
  if (!Number.isInteger(book_id) || !Number.isInteger(student_id)) return fail(res, 400, 'Zgjidh nxënësin dhe librin.');
  if (!validDate(loan_date) || !validDate(due_date)) return fail(res, 400, 'Datat nuk janë të vlefshme.');
  if (due_date < loan_date) return fail(res, 400, 'Afati i kthimit nuk mund të jetë para datës së huazimit.');
  const r = borrow(book_id, student_id, loan_date, due_date);
  if (r.error) return fail(res, r.code, r.error);
  res.status(201).json({ ok: true });
});

app.post('/api/admin/loans/:id/return', (req, res) => {
  const date = req.body.return_date || today();
  if (!validDate(date)) return fail(res, 400, 'Data nuk është e vlefshme.');
  const r = db.prepare('UPDATE loans SET return_date = ? WHERE id = ? AND return_date IS NULL').run(date, Number(req.params.id));
  if (!r.changes) return fail(res, 404, 'Huazimi nuk u gjet ose libri është kthyer tashmë.');
  res.json({ ok: true });
});

// ---------- Gabimet ----------
app.use('/api', (req, res) => fail(res, 404, 'Nuk u gjet.'));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') return fail(res, 400, 'Kërkesë e pavlefshme.');
  console.error(err);
  fail(res, 500, 'Ndodhi një gabim. Provo përsëri.');
});

app.listen(PORT, HOST, () => console.log(`Biblioteka "Genc Leka" po punon në http://localhost:${PORT}`));
