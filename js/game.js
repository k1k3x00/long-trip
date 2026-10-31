(() => {
const cv = document.getElementById('c'), g = cv.getContext('2d');
const W = 960, H = 540, HY = 190, D = 6, RW = W * .55, CX = W / 2;
const menu = document.getElementById('menu'), volEl = document.getElementById('vol'),
      scoreEl = document.getElementById('score'), playBtn = document.getElementById('play');

/* ---------- AUDIO (rutas en audio/sfx y audio/music) ---------- */
const mk = (f, loop = false) => { const a = new Audio('audio/' + f); a.loop = loop; a.preload = 'auto'; a.onerror = () => {}; return a; };
const S = {
  engine: mk('sfx/engine.mp3', true), horn: mk('sfx/horn.mp3'), crash: mk('sfx/crash.mp3'),
  wiper: mk('sfx/wiper.mp3', true), stat: mk('sfx/radio-static.mp3'), rain: mk('sfx/rain.mp3', true)
};
const BASE = { engine: .5, horn: .9, crash: 1, wiper: .6, stat: .5, rain: .5 };
const stations = [
  { n: 'FM 88.1', a: mk('music/radio1.mp3', true) },
  { n: 'FM 95.5', a: mk('music/radio2.mp3', true) },
  { n: 'FM 101.3', a: mk('music/radio3.mp3', true) }
];
const play = a => { a.currentTime = 0; a.play().catch(() => {}); };
function setVol() {
  const v = +volEl.value;
  for (const k in S) S[k].volume = BASE[k] * v;
  stations.forEach(s => s.a.volume = .8 * v);
}
volEl.oninput = setVol; setVol();

let radioOn = false, st = 0;
function tune() {
  stations.forEach((s, i) => { if (!(radioOn && i === st)) s.a.pause(); });
  if (radioOn) {
    play(S.stat);
    setTimeout(() => { S.stat.pause(); if (radioOn) stations[st].a.play().catch(() => {}); }, 350);
  }
}

/* ---------- ESTADO ---------- */
let on = false, over = false, shown = true, t = 0, px, v, dist, objs, spawnT, treeT, dirt, wipeA, steer,
    wiperOn, rainOn, rainLv, rainWas, overT, best = 0, last = 0;
const keys = {};
try { best = +localStorage.getItem('longtrip') || 0; } catch (e) {}
const COLORS = ['#d33a3a', '#2a6fdb', '#e8c020', '#2faa5a', '#e9e9e9', '#8a3fc7'];
const rc = () => COLORS[Math.random() * COLORS.length | 0];

function reset() {
  px = .5; v = 24; dist = 0; objs = []; spawnT = 1.5; treeT = 0; t = 0; dirt = 0; wipeA = 0; steer = 0;
  wiperOn = false; rainOn = false; rainLv = 0; rainWas = false; over = false; overT = 0; radioOn = false;
  stations.forEach(s => s.a.pause()); S.wiper.pause(); S.rain.pause();
  for (let z = 40; z < 280; z += 22) objs.push(tree(z));
}
const tree = z => ({ k: 'tree', x: (Math.random() < .5 ? -1 : 1) * (1.7 + Math.random() * 2.5), z, vs: 0 });

function spawn() {
  const r = Math.random(), z = 240 + Math.random() * 30;
  if (r < .36) objs.push({ k: 'car', x: -.5 + (Math.random() - .5) * .2, z, vs: -(18 + Math.random() * 14), hw: .24, c: rc(), d: 1 });
  else if (r < .68) objs.push({ k: 'car', x: .5 + (Math.random() - .5) * .2, z, vs: 12 + Math.random() * 9, hw: .24, c: rc(), d: 0 });
  else { const k = ['pot', 'log', 'rock'][Math.random() * 3 | 0];
    objs.push({ k, x: Math.random() * 1.5 - .75, z, vs: 0, hw: { pot: .3, log: .42, rock: .22 }[k] }); }
}

function crash() {
  over = true; overT = 0; shown = false; on = false;
  S.engine.pause(); S.rain.pause(); S.wiper.pause(); stations.forEach(s => s.a.pause());
  play(S.crash);
  const m = Math.floor(dist);
  if (m > best) { best = m; try { localStorage.setItem('longtrip', m); } catch (e) {} }
  scoreEl.textContent = `Distancia: ${m} m   Récord: ${best} m`;
}

/* ---------- UPDATE ---------- */
function update(dt) {
  t += dt;
  const dir = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  px += dir * 1.5 * dt;
  steer += (dir * .6 - steer) * Math.min(1, dt * 8);
  const base = 22 + Math.min(dist / 250, 22);
  const tg = Math.max(14, base + (keys.KeyW ? 14 : 0) - (keys.KeyS ? 16 : 0));
  v += (tg - v) * Math.min(1, dt * 1.5);
  dist += v * dt;
  S.engine.playbackRate = .7 + v / 55;

  rainOn = Math.sin(t * .04) > .4;
  rainLv += ((rainOn ? 1 : 0) - rainLv) * dt * .5;
  if (rainOn !== rainWas) { rainWas = rainOn; rainOn ? S.rain.play().catch(() => {}) : S.rain.pause(); }
  if (rainOn) dirt = Math.min(1, dirt + dt * .2);
  if (wiperOn) { wipeA += dt * 2.4; dirt = Math.max(0, dirt - dt * .5); } else wipeA = 0;

  spawnT -= dt;
  if (spawnT <= 0) { spawn(); spawnT = Math.max(.45, 1.5 - dist / 4000) * (.6 + Math.random() * .8); }
  treeT -= v * dt;
  if (treeT <= 0) { objs.push(tree(280)); treeT = 8 + Math.random() * 10; }

  for (const o of objs) o.z -= (v - o.vs) * dt;
  objs = objs.filter(o => o.z > -8 && o.z < 420);

  if (Math.abs(px) > .95) return crash();
  for (const o of objs)
    if (o.k !== 'tree' && o.z < 2.2 && o.z > -1.5 && Math.abs(o.x - px) < o.hw + .2) return crash();
}

/* ---------- DIBUJO ---------- */
function sky() {
  const gr = g.createLinearGradient(0, 0, 0, HY);
  gr.addColorStop(0, '#4aa3ee'); gr.addColorStop(1, '#d6efff');
  g.fillStyle = gr; g.fillRect(0, 0, W, HY + 2);
  g.fillStyle = '#6f93a8'; g.beginPath(); g.moveTo(0, HY);
  for (let x = 0; x <= W; x += 16) g.lineTo(x, HY - 30 - 16 * Math.sin(x * .011 + px * .4 + 1) - 9 * Math.sin(x * .031 + px * .9));
  g.lineTo(W, HY); g.fill();
}
function road() {
  for (let y = HY; y < H; y += 3) {
    const s = (y - HY) / (H - HY); if (s < .004) continue;
    const p = D / s - D + dist, rw = RW * s, c = CX - px * rw, a = (p / 8 | 0) & 1;
    g.fillStyle = a ? '#3f8f3a' : '#388632'; g.fillRect(0, y, W, 3);
    g.fillStyle = (p / 3 | 0) & 1 ? '#d8d8d8' : '#c0392b'; g.fillRect(c - rw * 1.12, y, rw * 2.24, 3);
    g.fillStyle = a ? '#4a4d54' : '#45484f'; g.fillRect(c - rw, y, rw * 2, 3);
    g.fillStyle = '#e9e9e9'; g.fillRect(c - rw * .96, y, rw * .03, 3); g.fillRect(c + rw * .93, y, rw * .03, 3);
    if ((p / 6 | 0) & 1) { g.fillStyle = '#f2c230'; g.fillRect(c - rw * .015, y, rw * .03, 3); }
  }
}
function drawObj(o) {
  if (o.z < -2) return;
  const s = D / (o.z + D); if (s > 1.4) return;
  const y = HY + (H - HY) * s, rw = RW * s, x = CX + (o.x - px) * rw;
  if (o.k === 'tree') {
    const h = rw * .9, w = rw * .5;
    g.fillStyle = '#5a3b20'; g.fillRect(x - w * .08, y - h * .5, w * .16, h * .5);
    g.fillStyle = '#1f6b2c'; g.beginPath(); g.arc(x, y - h * .8, w * .55, 0, 7); g.fill(); return;
  }
  const w = o.hw * 2 * rw;
  if (o.k === 'car') {
    const h = w * .72;
    g.fillStyle = '#111'; g.fillRect(x - w * .5, y - h * .18, w * .18, h * .18); g.fillRect(x + w * .32, y - h * .18, w * .18, h * .18);
    g.fillStyle = o.c; g.fillRect(x - w / 2, y - h * .65, w, h * .5); g.fillRect(x - w * .38, y - h, w * .76, h * .4);
    g.fillStyle = '#9fd3e8'; g.fillRect(x - w * .32, y - h * .95, w * .64, h * .28);
    g.fillStyle = o.d ? '#fff6b0' : '#ff2b2b';
    g.fillRect(x - w * .46, y - h * .5, w * .16, h * .12); g.fillRect(x + w * .3, y - h * .5, w * .16, h * .12);
  } else if (o.k === 'pot') {
    g.fillStyle = '#17171a'; g.beginPath(); g.ellipse(x, y - w * .05, w * .5, w * .12, 0, 0, 7); g.fill();
    g.fillStyle = '#ff8a1f';
    for (const d of [-1, 1]) { g.beginPath(); g.moveTo(x + d * w * .62, y); g.lineTo(x + d * w * .5, y); g.lineTo(x + d * w * .56, y - w * .3); g.fill(); }
    g.fillRect(x - w * .5, y - w * .36, w, w * .08); g.fillStyle = '#fff'; g.fillRect(x - w * .25, y - w * .36, w * .15, w * .08); g.fillRect(x + w * .1, y - w * .36, w * .15, w * .08);
  } else if (o.k === 'log') {
    g.fillStyle = '#6b4423'; g.fillRect(x - w / 2, y - w * .2, w, w * .2);
    g.fillStyle = '#a67c52'; g.beginPath(); g.ellipse(x + w / 2, y - w * .1, w * .05, w * .1, 0, 0, 7); g.fill();
  } else {
    g.fillStyle = '#7d7f86'; g.beginPath(); g.ellipse(x, y - w * .22, w * .5, w * .26, 0, 0, 7); g.fill();
    g.fillStyle = '#a3a5ab'; g.beginPath(); g.ellipse(x - w * .12, y - w * .3, w * .2, w * .1, 0, 0, 7); g.fill();
  }
}
function cabin() {
  g.fillStyle = '#14161b';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(90, 0); g.lineTo(0, H * .7); g.fill();
  g.beginPath(); g.moveTo(W, 0); g.lineTo(W - 90, 0); g.lineTo(W, H * .7); g.fill();
  g.fillRect(0, 0, W, 20);
  const gr = g.createLinearGradient(0, H - 120, 0, H); gr.addColorStop(0, '#2a2d35'); gr.addColorStop(1, '#0c0d10');
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, H); g.lineTo(0, H - 70); g.quadraticCurveTo(W / 2, H - 125, W, H - 70); g.lineTo(W, H); g.fill();
  // limpiaparabrisas
  const w = (1 - Math.cos(wipeA)) / 2, ang = Math.PI * .97 - w * Math.PI * .94, px0 = W / 2 + 90, py0 = H - 78;
  g.strokeStyle = '#050505'; g.lineWidth = 6; g.beginPath(); g.moveTo(px0, py0);
  g.lineTo(px0 + 300 * Math.cos(ang), py0 - 300 * Math.sin(ang)); g.stroke();
  // volante
  g.save(); g.translate(W / 2, H + 30); g.rotate(steer);
  g.strokeStyle = '#08090b'; g.lineWidth = 16; g.beginPath(); g.arc(0, 0, 92, 0, 7); g.stroke();
  g.lineWidth = 10; g.beginPath(); g.moveTo(-92, 0); g.lineTo(92, 0); g.moveTo(0, 0); g.lineTo(0, -92); g.stroke(); g.restore();
  // instrumentos
  g.textAlign = 'left'; g.fillStyle = '#7fe3ff'; g.font = 'bold 22px "Courier New",monospace';
  g.fillText(Math.round(v * 3.6) + ' km/h', 40, H - 22);
  g.fillStyle = '#05080a'; g.fillRect(W - 230, H - 52, 190, 34);
  g.fillStyle = radioOn ? '#ffb627' : '#4a3a14'; g.font = 'bold 18px "Courier New",monospace';
  g.fillText(radioOn ? '♪ ' + stations[st].n : 'RADIO OFF', W - 218, H - 29);
}
function weather() {
  if (rainLv > .02) { g.fillStyle = `rgba(40,52,72,${rainLv * .28})`; g.fillRect(0, 0, W, H); }
  if (rainOn) {
    g.strokeStyle = 'rgba(200,220,240,.35)'; g.lineWidth = 1; g.beginPath();
    for (let i = 0; i < 50; i++) { const x = i * 397 % W, y = (i * 131 + t * 600) % H; g.moveTo(x, y); g.lineTo(x - 4, y + 14); }
    g.stroke();
  }
  if (dirt > .02) {
    g.fillStyle = `rgba(150,170,190,${dirt * .3})`; g.fillRect(0, 0, W, H - 90);
    g.fillStyle = `rgba(220,235,250,${dirt * .5})`;
    for (let i = 0; i < dirt * 70; i++) { g.beginPath(); g.arc(i * 233 % W, (i * 97 % 370) + 20, 2 + i % 4, 0, 7); g.fill(); }
  }
}
function draw() {
  sky(); road();
  objs.sort((a, b) => b.z - a.z).forEach(drawObj);
  weather(); cabin();
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.shadowColor = '#000'; g.shadowOffsetX = 2; g.shadowOffsetY = 2;
  g.font = 'bold 30px "Courier New",monospace'; g.fillText(Math.floor(dist) + ' m', W / 2, 58);
  if (on && t < 9) {
    g.font = '15px "Courier New",monospace';
    g.fillText('W/S acelerar-frenar · A/D mover · Q limpiaparabrisas · R radio · E/Z estación · Espacio bocina', W / 2, 88);
  }
  g.shadowOffsetX = 0; g.shadowOffsetY = 0;
  if (over) {
    g.fillStyle = `rgba(200,30,30,${Math.max(0, .6 - overT)})`; g.fillRect(0, 0, W, H);
    overT += 1 / 60;
    if (overT > .9 && !shown) { shown = true; playBtn.textContent = 'Play'; menu.classList.remove('hide'); }
  }
}

/* ---------- CONTROLES ---------- */
addEventListener('keydown', e => {
  if (!on) return;
  if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === 'KeyQ') { wiperOn = !wiperOn; wiperOn ? S.wiper.play().catch(() => {}) : S.wiper.pause(); }
  if (e.code === 'KeyR') { radioOn = !radioOn; tune(); }
  if (e.code === 'KeyE' || e.code === 'KeyZ') {
    st = (st + (e.code === 'KeyE' ? 1 : stations.length - 1)) % stations.length;
    stations.forEach(s => s.a.pause()); if (radioOn) tune();
  }
  if (e.code === 'Space' || e.code === 'KeyH') play(S.horn);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

playBtn.onclick = () => {
  reset(); on = true; shown = true; scoreEl.textContent = '';
  menu.classList.add('hide'); playBtn.blur();
  S.engine.play().catch(() => {});
};

function loop(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  try { if (on) update(dt); draw(); } catch (e) { console.error(e); }
  requestAnimationFrame(loop);
}
reset(); requestAnimationFrame(loop);
})();
