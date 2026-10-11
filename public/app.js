const $ = (id) => document.getElementById(id);
const state = { q: '', category: '' };

// ---- Orari: ndryshoje këtu ----
const OPEN = { days: [1, 2, 3, 4, 5], from: '08:00', to: '15:00' }; // 0 = e diel
const HOURS = [
  ['E hënë – E premte', '08:00 – 15:00'],
  ['E shtunë – E diel', 'Mbyllur'],
];

function renderHours() {
  $('hours').innerHTML = HOURS.map(([d, t]) =>
    `<div class="flex justify-between py-2"><dt class="text-slate-600">${esc(d)}</dt><dd class="font-semibold">${esc(t)}</dd></div>`).join('');
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const open = OPEN.days.includes(now.getDay()) && hhmm >= OPEN.from && hhmm < OPEN.to;
  $('open-now').innerHTML = open
    ? '<span class="badge badge-ok">Hapur tani</span>'
    : '<span class="badge badge-muted">Mbyllur tani</span>';
}

function bookCard(b) {
  const c = coverFor(b.category);
  const ok = b.available > 0;
  return `<article>
    <div class="relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-l-sm rounded-r-xl p-4 pl-7 shadow-md shadow-slate-900/10 ${c.cover}">
      <span class="absolute inset-y-0 left-0 w-3 bg-black/20"></span>
      <span class="absolute inset-y-0 left-3 w-px bg-white/30"></span>
      <p class="text-xs font-medium opacity-80">${esc(b.category)}</p>
      <h3 class="line-clamp-5 text-lg font-semibold leading-snug sm:text-xl">${esc(b.title)}</h3>
      <p class="text-sm opacity-90">${esc(b.author)}</p>
    </div>
    <div class="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <span class="badge ${ok ? 'badge-ok' : 'badge-busy'}">${ok ? 'I disponueshëm' : 'I huazuar'}</span>
      <span class="text-xs text-slate-500">${b.available} nga ${b.copies} kopje</span>
    </div>
  </article>`;
}

async function loadBooks() {
  const qs = new URLSearchParams({ q: state.q, category: state.category });
  try {
    const books = await api('/api/books?' + qs);
    $('books').innerHTML = books.map(bookCard).join('');
    $('count').textContent = books.length
      ? `${books.length} ${books.length === 1 ? 'libër' : 'libra'}`
      : (state.q || state.category ? 'Nuk u gjet asnjë libër për këtë kërkim.' : 'Biblioteka nuk ka libra të regjistruar ende.');
  } catch (e) {
    $('count').textContent = e.message;
  }
}

function renderChips(categories, titles) {
  const chip = (label, value, count, dot) => {
    const active = state.category === value;
    return `<button type="button" data-cat="${esc(value)}" aria-pressed="${active}" class="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${active ? 'bg-brand-800 text-white' : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'}">
      ${dot ? `<span class="h-2.5 w-2.5 rounded-full ${dot}"></span>` : ''}${esc(label)}<span class="${active ? 'text-brand-200' : 'text-slate-400'}">${count}</span></button>`;
  };
  $('chips').innerHTML = chip('Të gjitha', '', titles, '') + categories.map((c) => chip(c.name, c.name, c.count, coverFor(c.name).dot)).join('');
}

async function loadStats() {
  try {
    const s = await api('/api/stats');
    $('st-titles').textContent = s.titles;
    $('st-available').textContent = s.available;
    $('st-cats').textContent = s.categories.length;
    renderChips(s.categories, s.titles);
  } catch {}
}

$('chips').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-cat]');
  if (!btn) return;
  state.category = btn.dataset.cat;
  await loadStats();
  loadBooks();
});
$('q').addEventListener('input', debounce(() => { state.q = $('q').value; loadBooks(); }));

window.studentReady.then((student) => {
  if (!student) return;
  $('step-1').textContent = 'Ke hyrë në llogarinë tënde. Mund ta shohësh çdo huazim te “Llogaria ime”.';
  $('cta').textContent = 'Llogaria ime';
  $('cta').href = '/llogaria.html';
});

renderHours();
loadStats();
loadBooks();
