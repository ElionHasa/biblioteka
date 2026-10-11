const $ = (id) => document.getElementById(id);
let allBooks = [], books = [], students = [], shownStudents = [], loans = [];

// ---------- Njoftime ----------
function notify(text, ok = true) {
  const n = $('notice');
  n.textContent = text;
  n.className = 'mt-6 ' + (ok ? 'notice-ok' : 'notice-err');
}
function clearNotice() { $('notice').className = 'mt-6 hidden'; $('notice').textContent = ''; }
function handle(e) {
  if (e.status === 401) return showLogin();
  notify(e.message, false);
}

// ---------- Hyrja / dalja ----------
function showLogin() {
  $('app').hidden = true;
  $('login-view').hidden = false;
  $('password').focus();
}
async function showApp() {
  $('login-view').hidden = true;
  $('app').hidden = false;
  $('loan-date').value = toIso(new Date());
  setDue();
  await refresh();
}
$('login').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-msg').className = 'hidden';
  try {
    await api('/api/admin/login', 'POST', { password: $('password').value });
    $('password').value = '';
    await showApp();
  } catch (err) {
    $('login-msg').className = 'notice-err';
    $('login-msg').textContent = err.message;
  }
});
$('logout').addEventListener('click', async () => {
  await api('/api/admin/logout', 'POST', {}).catch(() => {});
  showLogin();
});

// ---------- Seksionet ----------
document.querySelectorAll('[data-tab]').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    for (const t of ['loans', 'books', 'students']) $('tab-' + t).hidden = t !== btn.dataset.tab;
    clearNotice();
  }));

// ---------- Ngarkimi i të dhënave ----------
async function refresh() {
  try {
    [allBooks, students] = await Promise.all([api('/api/admin/books'), api('/api/admin/students')]);
    await Promise.all([renderStats(), renderBooks(), renderStudents(), renderLoans()]);
    fillLoanForm();
    $('categories').innerHTML = [...new Set(allBooks.map((b) => b.category))].sort().map((c) => `<option value="${esc(c)}">`).join('');
  } catch (e) { handle(e); }
}

async function renderStats() {
  const s = await api('/api/admin/stats');
  const card = (label, value, sub, cls = '') =>
    `<div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p class="text-sm text-slate-600">${label}</p>
      <p class="mt-1 font-display text-3xl font-semibold ${cls}">${value}</p>
      <p class="mt-0.5 min-h-[1rem] text-xs text-slate-500">${sub}</p></div>`;
  $('stats').innerHTML =
    card('Tituj', s.titles, `${s.copies} kopje gjithsej`) +
    card('Nxënës të regjistruar', s.students, '') +
    card('Të huazuara tani', s.active_loans, '') +
    card('Me vonesë', s.overdue, s.overdue ? 'Kërkoju t’i kthejnë' : 'Asnjë vonesë', s.overdue ? 'text-rose-700' : '');
  $('demo-banner').hidden = s.demo_books === 0;
  $('demo-text').textContent = `Ke ${s.demo_books} libra demo në bibliotekë. Mund t’i fshish të gjithë njëherësh.`;
}

// ---------- Huazimet ----------
function setDue() {
  const d = new Date($('loan-date').value + 'T00:00:00');
  if (isNaN(d)) return;
  d.setDate(d.getDate() + 14);
  $('due-date').value = toIso(d);
}
$('loan-date').addEventListener('change', setDue);

function fillLoanForm() {
  const needle = fold($('student-search').value).trim();
  const keep = $('loan-student').value;
  $('loan-student').innerHTML = students
    .filter((s) => !needle || fold(`${s.first_name} ${s.last_name} ${s.last_name} ${s.first_name} ${s.class_name}`).includes(needle))
    .map((s) => `<option value="${s.id}">${esc(s.first_name)} ${esc(s.last_name)} — ${esc(s.class_name)}</option>`)
    .join('');
  if (keep) $('loan-student').value = keep;

  const bookKeep = $('loan-book').value;
  $('loan-book').innerHTML = '<option value="" disabled selected>Zgjidh librin</option>' + allBooks
    .filter((b) => b.available > 0)
    .map((b) => `<option value="${b.id}">${esc(b.title)} — ${esc(b.author)}</option>`).join('');
  if (bookKeep) $('loan-book').value = bookKeep;
}
$('student-search').addEventListener('input', fillLoanForm);

$('loan-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/loans', 'POST', {
      student_id: parseInt($('loan-student').value, 10),
      book_id: parseInt($('loan-book').value, 10),
      loan_date: $('loan-date').value,
      due_date: $('due-date').value,
    });
    $('loan-book').value = '';
    notify('Huazimi u regjistrua.');
    await refresh();
  } catch (err) { handle(err); }
});

async function renderLoans() {
  const qs = new URLSearchParams({ status: $('loan-status').value, q: $('loan-q').value });
  loans = await api('/api/admin/loans?' + qs);
  $('loan-rows').innerHTML = loans.length ? loans.map((l) => `<tr class="${l.overdue ? 'bg-rose-50/60' : ''}">
      <td><p class="font-semibold">${esc(l.title)}</p><p class="text-slate-500">${esc(l.author)}</p></td>
      <td class="whitespace-nowrap">${esc(l.first_name)} ${esc(l.last_name)}</td>
      <td>${esc(l.class_name)}</td>
      <td class="whitespace-nowrap">${formatDate(l.loan_date)}</td>
      <td class="whitespace-nowrap">${formatDate(l.due_date)}</td>
      <td>${loanBadge(l)}</td>
      <td class="text-right">${l.return_date ? '' : `<button type="button" class="btn btn-ghost btn-sm whitespace-nowrap" data-return="${l.id}">Regjistro kthimin</button>`}</td>
    </tr>`).join('')
    : '<tr><td colspan="7" class="px-4 py-10 text-center text-slate-500">Nuk ka huazime për t’u shfaqur.</td></tr>';
}
$('loan-status').addEventListener('change', () => renderLoans().catch(handle));
$('loan-q').addEventListener('input', debounce(() => renderLoans().catch(handle)));
$('loan-rows').addEventListener('click', async (e) => {
  const id = e.target.dataset.return;
  if (!id) return;
  try {
    await api(`/api/admin/loans/${id}/return`, 'POST', {});
    notify('Kthimi u regjistrua.');
    await refresh();
  } catch (err) { handle(err); }
});

// ---------- Librat ----------
async function renderBooks() {
  books = await api('/api/admin/books?q=' + encodeURIComponent($('book-q').value));
  $('book-rows').innerHTML = books.length ? books.map((b) => `<tr>
    <td><span class="font-semibold">${esc(b.title)}</span>${b.is_demo ? ' <span class="badge badge-muted ml-1">Demo</span>' : ''}</td>
    <td>${esc(b.author)}</td>
    <td><span class="inline-flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full ${coverFor(b.category).dot}"></span>${esc(b.category)}</span></td>
    <td>${b.copies}</td>
    <td>${b.available}</td>
    <td class="whitespace-nowrap text-right">
      <button type="button" class="btn btn-ghost btn-sm" data-edit="${b.id}">Modifiko</button>
      <button type="button" class="btn btn-danger btn-sm" data-del="${b.id}">Fshi</button>
    </td></tr>`).join('')
    : '<tr><td colspan="6" class="px-4 py-10 text-center text-slate-500">Nuk ka libra. Shto të parin me formularin më sipër.</td></tr>';
}
$('book-q').addEventListener('input', debounce(() => renderBooks().catch(handle)));

function resetBookForm() {
  $('book-form').reset();
  $('book-id').value = '';
  $('b-copies').value = 1;
  $('book-form-title').textContent = 'Shto libër';
  $('book-save').textContent = 'Shto librin';
  $('book-cancel').hidden = true;
}
$('book-cancel').addEventListener('click', resetBookForm);

$('book-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('book-id').value;
  const body = {
    title: $('b-title').value, author: $('b-author').value,
    category: $('b-category').value, copies: parseInt($('b-copies').value, 10),
  };
  try {
    if (id) await api('/api/admin/books/' + id, 'PUT', body);
    else await api('/api/admin/books', 'POST', body);
    notify(id ? 'Libri u ruajt.' : 'Libri u shtua.');
    resetBookForm();
    await refresh();
  } catch (err) { handle(err); }
});

$('book-rows').addEventListener('click', async (e) => {
  const edit = e.target.dataset.edit, del = e.target.dataset.del;
  if (edit) {
    const b = books.find((x) => x.id === Number(edit));
    $('book-id').value = b.id;
    $('b-title').value = b.title;
    $('b-author').value = b.author;
    $('b-category').value = b.category;
    $('b-copies').value = b.copies;
    $('book-form-title').textContent = 'Modifiko librin';
    $('book-save').textContent = 'Ruaj ndryshimet';
    $('book-cancel').hidden = false;
    $('book-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('b-title').focus();
  } else if (del) {
    const b = books.find((x) => x.id === Number(del));
    if (!confirm(`Të fshihet libri “${b.title}”? Historiku i huazimeve të tij do të fshihet gjithashtu.`)) return;
    try {
      await api('/api/admin/books/' + del, 'DELETE');
      notify('Libri u fshi.');
      if ($('book-id').value === del) resetBookForm();
      await refresh();
    } catch (err) { handle(err); }
  }
});

$('clear-demo').addEventListener('click', async () => {
  if (!confirm('Të fshihen të gjithë librat demo? Librat që ke modifikuar vetë nuk preken.')) return;
  try {
    const r = await api('/api/admin/demo-books', 'DELETE');
    notify(`U fshinë ${r.deleted} libra demo.`);
    await refresh();
  } catch (err) { handle(err); }
});

// ---------- Nxënësit ----------
async function renderStudents() {
  shownStudents = await api('/api/admin/students?q=' + encodeURIComponent($('student-q').value));
  $('student-rows').innerHTML = shownStudents.length ? shownStudents.map((s) => `<tr>
    <td class="font-semibold">${esc(s.last_name)} ${esc(s.first_name)}${s.has_password ? '' : ' <span class="badge badge-late ml-1">Pa fjalëkalim</span>'}</td>
    <td>${esc(s.class_name)}</td>
    <td class="whitespace-nowrap">${formatDate(s.registered_at)}</td>
    <td>${s.active_loans}</td>
    <td class="whitespace-nowrap text-right"><button type="button" class="btn btn-ghost btn-sm" data-pw="${s.id}">Ndrysho fjalëkalimin</button></td></tr>`).join('')
    : '<tr><td colspan="5" class="px-4 py-10 text-center text-slate-500">Nuk ka nxënës të regjistruar.</td></tr>';
}
$('student-q').addEventListener('input', debounce(async () => {
  try { await renderStudents(); } catch (e) { handle(e); }
}));

let pwTarget = null;
$('student-rows').addEventListener('click', (e) => {
  const id = e.target.dataset.pw;
  if (!id) return;
  pwTarget = shownStudents.find((s) => s.id === Number(id));
  $('pw-who').textContent = `${pwTarget.first_name} ${pwTarget.last_name} — klasa ${pwTarget.class_name}`;
  $('pw-new').value = '';
  $('pw-err').className = 'hidden';
  $('pw-dialog').showModal();
  $('pw-new').focus();
});
$('pw-cancel').addEventListener('click', () => $('pw-dialog').close());
$('pw-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api(`/api/admin/students/${pwTarget.id}/password`, 'PUT', { password: $('pw-new').value });
    $('pw-dialog').close();
    notify(`Fjalëkalimi i ${pwTarget.first_name} ${pwTarget.last_name} u ndryshua.`);
    await refresh();
  } catch (err) {
    if (err.status === 401) { $('pw-dialog').close(); return showLogin(); }
    $('pw-err').className = 'notice-err';
    $('pw-err').textContent = err.message;
  }
});

// ---------- Fillimi ----------
api('/api/admin/me').then(showApp).catch(showLogin);
