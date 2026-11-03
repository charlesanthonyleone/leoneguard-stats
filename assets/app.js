/* Renders stats.json (written by the LeoneGuard server). Aggregates only; nothing is invented when a field is missing. */
(() => {
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n || 0).toLocaleString('en-US');
const pretty = (t) => String(t).replace(/_/g, '-');
const ET = (ts) => new Date(ts).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET';
const dayLabel = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd, 12)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };
const sum = (rs, k) => Object.values(rs || {}).reduce((a, v) => a + (Number(v && v[k]) || 0), 0);
const empty = (cols, msg) => `<tr><td colspan="${cols}" class="empty">${msg}</td></tr>`;
const RAR = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

function render(s) {
  const upd = s.updated ? new Date(s.updated) : null;
  $('upd').textContent = upd && !isNaN(upd) ? 'Last updated ' + ET(upd.getTime()) : 'Update time not published';
  const st = s.status || {}, live = st.callouts === 'live';
  $('livedot').classList.toggle('live', live);
  $('livetxt').textContent = live ? 'Live · callouts on' : 'Public statistics';

  const days = Object.entries(s.days || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const room = {}, tac = {}; let M = 0, C = 0, K = 0;
  for (const [, rs] of days) for (const [r, v] of Object.entries(rs || {})) {
    const o = room[r] ||= { m: 0, c: 0, k: 0 };
    o.m += v.messages || 0; o.c += v.catches || 0; o.k += v.callouts || 0;
    M += v.messages || 0; C += v.catches || 0; K += v.callouts || 0;
    for (const [t, n] of Object.entries(v.tactics || {})) tac[t] = (tac[t] || 0) + n;
  }
  const today = days.length ? days[days.length - 1] : null;
  const rooms = st.liveRooms || [];
  const kp = [
    ['Messages seen', num(M), days.length ? `across ${days.length} day${days.length === 1 ? '' : 's'}` : 'no days published yet'],
    ['Messages today', today ? num(sum(today[1], 'messages')) : '—', today ? dayLabel(today[0]) : ''],
    ['Callouts', num(K), today ? `${num(sum(today[1], 'callouts'))} today` : ''],
    ['Catches', num(C), Object.keys(tac).length ? `${Object.keys(tac).length} tactics` : ''],
    ['Callout status', `<span class="${live ? 'ok' : 'off'}">${esc(st.callouts ? st.callouts[0].toUpperCase() + st.callouts.slice(1) : '—')}</span>`, rooms.length ? 'in ' + rooms.map(esc).join(', ') : 'no live rooms'],
  ];
  $('kpis').innerHTML = kp.map(([l, v, sub]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${sub || '&nbsp;'}</div></div>`).join('');

  const last = days.slice(-14);
  if (!last.length) $('chart').innerHTML = '<p class="empty" style="width:100%">No daily counts published yet.</p>';
  else { const mx = Math.max(1, ...last.map(([, rs]) => sum(rs, 'messages')));
    $('chart').innerHTML = last.map(([d, rs]) => { const v = sum(rs, 'messages'); return `<div class="col" title="${esc(d)}: ${num(v)} messages"><div class="b" style="height:${(88 * v / mx).toFixed(1)}%"><span>${num(v)}</span></div><div class="d">${esc(dayLabel(d))}</div></div>`; }).join(''); }

  const rows = last.slice().reverse().flatMap(([d, rs]) => Object.entries(rs || {}).map(([r, v]) => [d, r, v]));
  $('daily').tBodies[0].innerHTML = rows.map(([d, r, v]) => `<tr><td>${esc(dayLabel(d))}</td><td><span class="room">${esc(r)}</span></td><td class="n">${num(v.messages)}</td><td class="n">${num(v.catches)}</td><td class="n">${num(v.callouts)}</td></tr>`).join('') || empty(5, 'No daily counts published yet.');
  $('rooms').tBodies[0].innerHTML = Object.entries(room).sort((a, b) => b[1].m - a[1].m).map(([r, v]) => `<tr><td><span class="room">${esc(r)}</span></td><td class="n">${num(v.m)}</td><td class="n">${num(v.c)}</td><td class="n">${num(v.k)}</td></tr>`).join('') || empty(4, 'No rooms published yet.');

  const tl = Object.entries(tac).sort((a, b) => b[1] - a[1]), tm = Math.max(1, ...tl.map((x) => x[1]));
  const GL = Array.isArray(s.glossary) ? s.glossary : [], GT = Object.fromEntries(GL.map((g) => [g.key, g.title]));
  $('tactics').innerHTML = tl.map(([t, n]) => `<li><span class="t">${esc(GT[t] || pretty(t))}</span><span class="track"><span class="fill" style="width:${(100 * n / tm).toFixed(1)}%;display:block"></span></span><span class="c">${num(n)}</span></li>`).join('') || '<li class="empty" style="display:block">No tactics caught yet.</li>';

  const AC = Array.isArray(s.achievements) ? s.achievements : [], AM = Object.fromEntries(AC.map((a) => [a.key, a]));
  $('lb').tBodies[0].innerHTML = (s.leaderboard || []).map((p) => `<tr><td class="n">${num(p.rank)}</td><td>${esc(p.display)}</td><td class="n">${num(p.level)}</td><td class="n">${num(p.xp)}</td><td>${(p.achievements || []).map((k) => AM[k] ? `<span title="${esc(AM[k].title)}">${esc(AM[k].icon)}</span>` : '').join(' ')}</td></tr>`).join('') || empty(5, 'Nobody yet. Type !optin in a Guard room to join.');

  const color = {}; for (const a of AC) if (a.color && !color[a.rarity]) color[a.rarity] = a.color;
  const secret = AC.filter((a) => a.secret).length;
  $('achsum').textContent = AC.length ? `${AC.length} total${secret ? ` · ${secret} secret` : ''}` : '';
  let filt = 'all';
  const drawAch = () => {
    const list = AC.filter((a) => filt === 'all' || a.rarity === filt).sort((a, b) => RAR.indexOf(a.rarity) - RAR.indexOf(b.rarity));
    $('ach').innerHTML = list.map((a) => { const lock = !a.unlocked; return `<div class="a${lock ? ' lock' : ''}" style="--c:${esc(a.color || '#9ca3af')}"><span class="i">${esc(a.icon)}</span><span class="t">${esc(a.title)}</span><span class="r">${esc(a.rarity)}${a.tier ? ' · ' + esc(a.tier) : ''}${a.secret ? ' · secret' : ''}</span><span class="d">${esc(a.desc)}</span><span class="u">${a.unlocked ? `Unlocked by ${num(a.unlocked)}` : 'Not unlocked yet'}</span></div>`; }).join('') || '<p class="empty">No achievements published yet.</p>';
  };
  const present = RAR.filter((r) => AC.some((a) => a.rarity === r));
  $('rarf').innerHTML = present.length ? ['all', ...present].map((r) => `<button type="button" data-r="${r}" aria-pressed="${r === 'all'}">${r === 'all' ? 'All' : `<i style="--c:${esc(color[r])}"></i>${r[0].toUpperCase() + r.slice(1)}`}</button>`).join('') : '';
  $('rarf').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; filt = b.dataset.r; for (const x of $('rarf').children) x.setAttribute('aria-pressed', String(x === b)); drawAch(); };
  drawAch();

  $('glsum').textContent = GL.length ? `${GL.length} tactics explained` : '';
  $('gloss').innerHTML = GL.slice().sort((a, b) => String(a.title || a.key).localeCompare(String(b.title || b.key))).map((g) => `<div class="g"><b>${esc(g.title || pretty(g.key))}</b>${g.aliases && g.aliases.length ? `<span class="al">aka ${esc(g.aliases.join(', '))}</span>` : ''}<p>${esc(g.def || String(g.line || '').replace(/^[^:]*:\s*/, ''))}</p></div>`).join('') || '<p class="empty">No glossary published yet.</p>';
}
fetch('stats.json?' + Date.now(), { cache: 'no-store' }).then((r) => { if (!r.ok) throw 0; return r.json(); }).then(render).catch(() => {
  render({});
  $('upd').textContent = 'Stats not published yet.';
});
})();
