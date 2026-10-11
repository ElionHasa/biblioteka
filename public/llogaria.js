(async function () {
  const student = await window.studentReady;
  if (!student) { location.href = '/hyr.html'; return; }

  const initials = (student.first_name[0] + student.last_name[0]).toLocaleUpperCase('sq');
  document.getElementById('profile').innerHTML = `
    <span class="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-700 font-display text-xl font-semibold text-white">${esc(initials)}</span>
    <div>
      <h1 class="text-2xl font-semibold sm:text-3xl">${esc(student.first_name)} ${esc(student.last_name)}</h1>
      <p class="text-slate-600">Klasa ${esc(student.class_name)}</p>
    </div>`;

  let loans = [];
  try { loans = await api('/api/me/loans'); } catch (e) { if (e.status === 401) location.href = '/hyr.html'; }

  const current = loans.filter((l) => !l.return_date);
  const past = loans.filter((l) => l.return_date);

  document.getElementById('current').innerHTML = current.length
    ? current.map((l) => {
        const c = coverFor(l.category);
        return `<article class="flex gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ${l.overdue ? 'ring-rose-300' : 'ring-slate-200'}">
          <div class="relative h-24 w-16 shrink-0 overflow-hidden rounded-l-sm rounded-r-lg ${c.cover}"><span class="absolute inset-y-0 left-0 w-2 bg-black/20"></span></div>
          <div class="min-w-0">
            <h3 class="font-semibold leading-snug">${esc(l.title)}</h3>
            <p class="text-sm text-slate-600">${esc(l.author)}</p>
            <p class="mt-2 text-sm text-slate-600">Kthe deri më <strong class="text-ink">${formatDate(l.due_date)}</strong></p>
            <div class="mt-2">${loanBadge(l)}</div>
          </div>
        </article>`;
      }).join('')
    : '<p class="rounded-2xl bg-white p-6 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200 sm:col-span-2">Nuk ke asnjë libër të huazuar. <a href="/" class="font-semibold text-brand-700 hover:underline">Shfleto librat</a> dhe shko te bibliotekari për ta huazuar.</p>';

  document.getElementById('history').innerHTML = past.length
    ? past.map((l) => `<div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
        <div><p class="font-semibold">${esc(l.title)}</p><p class="text-slate-500">${esc(l.author)}</p></div>
        <p class="text-slate-500">${formatDate(l.loan_date)} – ${formatDate(l.return_date)}</p></div>`).join('')
    : '<p class="px-5 py-6 text-sm text-slate-600">Historiku është bosh.</p>';
})();
