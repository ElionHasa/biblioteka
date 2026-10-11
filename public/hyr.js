const form = document.getElementById('form');
const msg = document.getElementById('msg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  msg.className = 'hidden';
  try {
    await api('/api/login', 'POST', Object.fromEntries(new FormData(form)));
    location.href = '/llogaria.html';
  } catch (err) {
    msg.className = 'notice-err';
    msg.textContent = err.message;
    btn.disabled = false;
  }
});
