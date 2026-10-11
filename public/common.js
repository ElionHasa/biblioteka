// Funksione të përbashkëta për të gjitha faqet.
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fold(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

async function api(url, method = 'GET', body) {
  const opts = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try { res = await fetch(url, opts); } catch { throw new Error('Nuk ka lidhje me serverin.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'Ndodhi një gabim.'); e.status = res.status; throw e; }
  return data;
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function toIso(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function daysLate(dueIso) {
  const today = new Date(toIso(new Date()) + 'T00:00:00');
  return Math.round((today - new Date(dueIso + 'T00:00:00')) / 864e5);
}

function debounce(fn, ms = 250) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ---- Ikonat (Heroicons, outline) ----
const ICONS = {
  book: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  loans: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  search: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
  logout: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9',
  back: 'M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  key: 'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z',
};
function icon(name, cls = 'h-5 w-5') {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="${cls}" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="${ICONS[name]}"/></svg>`;
}
document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon, el.dataset.size || 'h-5 w-5'); });

// ---- Ngjyrat e kopertinave sipas kategorisë ----
const COVERS = [
  { cover: 'bg-brand-700 text-brand-50', dot: 'bg-brand-700' },
  { cover: 'bg-indigo-700 text-indigo-50', dot: 'bg-indigo-700' },
  { cover: 'bg-rose-700 text-rose-50', dot: 'bg-rose-700' },
  { cover: 'bg-amber-400 text-amber-950', dot: 'bg-amber-400' },
  { cover: 'bg-violet-700 text-violet-50', dot: 'bg-violet-700' },
  { cover: 'bg-emerald-700 text-emerald-50', dot: 'bg-emerald-700' },
  { cover: 'bg-sky-700 text-sky-50', dot: 'bg-sky-700' },
  { cover: 'bg-orange-600 text-orange-50', dot: 'bg-orange-600' },
];
function coverFor(category) {
  let h = 0;
  for (const c of fold(category)) h = (h * 31 + c.charCodeAt(0)) % COVERS.length;
  return COVERS[h];
}

function loanBadge(l) {
  if (l.return_date) return `<span class="badge badge-muted">Kthyer ${formatDate(l.return_date)}</span>`;
  if (l.overdue) {
    const d = daysLate(l.due_date);
    return `<span class="badge badge-late">Me vonesë ${d} ${d === 1 ? 'ditë' : 'ditë'}</span>`;
  }
  return '<span class="badge badge-busy">I huazuar</span>';
}
