const form = document.getElementById('form');
const msg = document.getElementById('msg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  msg.className = 'notice-err';
  if (data.password !== data.password2) { msg.textContent = 'Fjalëkalimet nuk përputhen.'; return; }
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  msg.className = 'hidden';
  try {
    delete data.password2;
    await api('/api/students', 'POST', data);
    location.href = '/llogaria.html';
  } catch (err) {
    msg.className = 'notice-err';
    msg.textContent = err.message;
    btn.disabled = false;
  }
});
