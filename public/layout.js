// Header-i dhe footer-i i përbashkët për faqet publike.
window.studentReady = api('/api/me').then((r) => r.student).catch(() => null);

(async function () {
  const student = await window.studentReady;
  const here = location.pathname;
  const link = (href, label) =>
    `<a href="${href}" ${here === href ? 'aria-current="page"' : ''} class="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-ink aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-800">${label}</a>`;

  const actions = student
    ? `${link('/llogaria.html', 'Llogaria ime')}<button id="logout" type="button" class="btn btn-ghost btn-sm">Dil</button>`
    : `${link('/hyr.html', 'Hyr')}<a href="/regjistrohu.html" class="btn btn-primary btn-sm">Regjistrohu</a>`;

  document.getElementById('site-header').innerHTML = `
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <a href="/" class="flex items-center gap-3">
          <span class="grid h-10 w-10 place-items-center rounded-xl bg-brand-700 text-white">${icon('book', 'h-6 w-6')}</span>
          <span class="leading-tight">
            <span class="block font-display text-lg font-semibold">Genc Leka</span>
            <span class="block text-xs text-slate-500">Biblioteka e shkollës</span>
          </span>
        </a>
        <nav class="flex items-center gap-1 text-sm font-semibold">${link('/', 'Librat')}${actions}</nav>
      </div>
    </header>`;

  document.getElementById('site-footer').innerHTML = `
    <footer class="mt-16 border-t border-slate-200 bg-white">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500 sm:px-6">
        <p>Biblioteka e shkollës “Genc Leka”</p>
        <a href="/admin.html" class="text-slate-400 hover:text-slate-600">Hyrja e administratorit</a>
      </div>
    </footer>`;

  const out = document.getElementById('logout');
  if (out) out.addEventListener('click', async () => {
    await api('/api/logout', 'POST', {}).catch(() => {});
    location.href = '/';
  });
})();
