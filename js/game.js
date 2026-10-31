(() => {
const cv = document.getElementById('c'), g = cv.getContext('2d');
const W = 960, H = 540, HY = 190, D = 6, RW = W * .55, CX = W / 2;
const menu = document.getElementById('menu'), splashEl = document.getElementById('splash'),
      volEl = document.getElementById('vol'), scoreEl = document.getElementById('score'), playBtn = document.getElementById('play');
const nc = document.createElement('canvas'); nc.width = W; nc.height = H; const ng = nc.getContext('2d');
const mix = (a, b, k) => `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * k))})`;

/* ---------- AUDIO (rutas en audio/sfx y audio/music) ---------- */
const mk = (f, loop = false) => { const a = new Audio('audio/' + f); a.loop = loop; a.preload = 'auto'; a.onerror = () => {}; return a; };
const S = {
  engine: mk('sfx/engine.mp3', true), horn: mk('sfx/horn.mp3'), crash: mk('sfx/crash.mp3'),
  wiper: mk('sfx/wiper.mp3', true), stat: mk('sfx/radio-static.mp3'), rain: mk('sfx/rain.mp3', true),
  welcome: mk('voice/welcome.mp4'), intro: mk('voice/intro.mp4'),
  refuel: mk('sfx/refuel.mp3')
};
const BASE = { engine: .5, horn: .9, crash: 1, wiper: .6, stat: .5, rain: .5, welcome: 1, intro: 1, refuel: .8 };
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
    wiperOn, rainOn, rainLv, rainWas, overT, best = 0, last = 0, briefing = false, introDone = false, fuel = 1, fuelNext = 400, lightsOn = false, dayL = 1;
const keys = {};
try { best = +localStorage.getItem('longtrip') || 0; } catch (e) {}
const COLORS = ['#d33a3a', '#2a6fdb', '#e8c020', '#2faa5a', '#e9e9e9', '#8a3fc7'];
const rc = () => COLORS[Math.random() * COLORS.length | 0];

function reset() {
  px = .5; v = 24; dist = 0; objs = []; spawnT = 1.5; treeT = 0; t = 0; dirt = 0; wipeA = 0; steer = 0;
  fuel = 1; fuelNext = 400; lightsOn = false; dayL = 1;
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

function crash(why) {
  over = true; overT = 0; shown = false; on = false;
  S.engine.pause(); S.rain.pause(); S.wiper.pause(); stations.forEach(s => s.a.pause());
  play(S.crash);
  const m = Math.floor(dist);
  if (m > best) { best = m; try { localStorage.setItem('longtrip', m); } catch (e) {} }
  scoreEl.textContent = `${why ? why + '   ' : ''}Distance: ${m} m   Best: ${best} m`;
}

/* ---------- UPDATE ---------- */
function update(dt) {
  if (!briefing) t += dt;
  const dir = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  px += dir * 1.5 * dt;
  steer += (dir * .6 - steer) * Math.min(1, dt * 8);
  const base = 22 + Math.min(dist / 250, 22);
  const tg = Math.max(14, base + (keys.KeyW ? 14 : 0) - (keys.KeyS ? 16 : 0));
  v += (tg - v) * Math.min(1, dt * 1.5);
  dist += v * dt;
  if (!briefing) fuel -= v * dt * .0008;
  if (fuel <= 0) { fuel = 0; return crash('Out of fuel'); }
  dayL = Math.max(0, Math.min(1, .5 + .8 * Math.cos(t / 60 * Math.PI * 2)));
  if (!briefing && dist >= fuelNext) { objs.push({ k: 'fuel', x: Math.random() < .5 ? -.5 : .5, z: 240, vs: 0, hw: .18 }); fuelNext = dist + 450 + Math.random() * 200; }
  S.engine.playbackRate = .7 + v / 55;

  rainOn = Math.sin(t * .04) > .4;
  rainLv += ((rainOn ? 1 : 0) - rainLv) * dt * .5;
  if (rainOn !== rainWas) { rainWas = rainOn; rainOn ? S.rain.play().catch(() => {}) : S.rain.pause(); }
  if (rainOn) dirt = Math.min(1, dirt + dt * .2);
  if (wiperOn) { wipeA += dt * 2.4; dirt = Math.max(0, dirt - dt * .5); } else wipeA = 0;

  if (!briefing) spawnT -= dt;
  if (spawnT <= 0) { spawn(); spawnT = Math.max(.45, 1.5 - dist / 4000) * (.6 + Math.random() * .8); }
  treeT -= v * dt;
  if (treeT <= 0) { objs.push(tree(280)); treeT = 8 + Math.random() * 10; }

  for (const o of objs) o.z -= (v - o.vs) * dt;
  objs = objs.filter(o => o.z > -8 && o.z < 420);

  if (briefing) px = Math.max(-.9, Math.min(.9, px));
  else if (Math.abs(px) > .95) return crash();
  for (const o of objs) {
    if (o.k === 'tree' || o.z > 2.2 || o.z < -1.5 || Math.abs(o.x - px) >= o.hw + .2) continue;
    if (o.k === 'fuel') { fuel = Math.min(1, fuel + .5); o.z = -99; play(S.refuel); } else return crash();
  }
}

/* ---------- DIBUJO ---------- */
function sky() {
  const gr = g.createLinearGradient(0, 0, 0, HY);
  gr.addColorStop(0, mix([6, 12, 34], [74, 163, 238], dayL)); gr.addColorStop(1, mix([22, 30, 60], [214, 239, 255], dayL));
  g.fillStyle = gr; g.fillRect(0, 0, W, HY + 2);
  g.fillStyle = mix([14, 20, 34], [111, 147, 168], dayL); g.beginPath(); g.moveTo(0, HY);
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
  } else if (o.k === 'fuel') {
    g.fillStyle = '#d62d20'; g.fillRect(x - w * .4, y - w * .75, w * .8, w * .75);
    g.fillStyle = '#9c1d14'; g.fillRect(x - w * .15, y - w * .95, w * .3, w * .2);
    g.fillStyle = '#fff'; g.fillRect(x - w * .06, y - w * .6, w * .12, w * .4); g.fillRect(x - w * .2, y - w * .46, w * .4, w * .12);
  } else if (o.k === 'log') {
    g.fillStyle = '#6b4423'; g.fillRect(x - w / 2, y - w * .2, w, w * .2);
    g.fillStyle = '#a67c52'; g.beginPath(); g.ellipse(x + w / 2, y - w * .1, w * .05, w * .1, 0, 0, 7); g.fill();
  } else {
    g.fillStyle = '#7d7f86'; g.beginPath(); g.ellipse(x, y - w * .22, w * .5, w * .26, 0, 0, 7); g.fill();
    g.fillStyle = '#a3a5ab'; g.beginPath(); g.ellipse(x - w * .12, y - w * .3, w * .2, w * .1, 0, 0, 7); g.fill();
  }
}
function gauge(cx, cy, r, val, ticks) {
  const a0 = Math.PI * .75, sw = Math.PI * 1.5;
  g.fillStyle = '#06080b'; g.beginPath(); g.arc(cx, cy, r + 6, 0, 7); g.fill();
  g.strokeStyle = '#3a3f49'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r + 6, 0, 7); g.stroke();
  g.strokeStyle = '#cfe9f5'; g.lineWidth = 2; g.beginPath();
  for (let i = 0; i <= ticks; i++) { const a = a0 + sw * i / ticks, c = Math.cos(a), sn = Math.sin(a); g.moveTo(cx + c * r * .78, cy + sn * r * .78); g.lineTo(cx + c * r * .94, cy + sn * r * .94); }
  g.stroke();
  const a = a0 + sw * Math.max(0, Math.min(1, val));
  g.strokeStyle = '#ff4b3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r * .86, cy + Math.sin(a) * r * .86); g.stroke();
  g.fillStyle = '#20242b'; g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fill();
}
function chip(txt, x, y, lit, col) {
  g.textAlign = 'center'; g.font = 'bold 12px "Courier New",monospace'; g.fillStyle = lit ? col : '#2b2f36'; g.fillText(txt, x, y);
}
function cabin() {
  g.fillStyle = '#14161b';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(90, 0); g.lineTo(0, H * .7); g.fill();
  g.beginPath(); g.moveTo(W, 0); g.lineTo(W - 90, 0); g.lineTo(W, H * .7); g.fill();
  g.fillRect(0, 0, W, 20);
  g.fillStyle = '#0b0c10'; g.fillRect(W / 2 - 70, 20, 140, 26);
  const gr = g.createLinearGradient(0, H - 190, 0, H); gr.addColorStop(0, '#2a2d35'); gr.addColorStop(1, '#0c0d10');
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, H); g.lineTo(0, H - 85); g.quadraticCurveTo(W / 2, H - 185, W, H - 85); g.lineTo(W, H); g.fill();
  g.strokeStyle = '#3d424d'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, H - 85); g.quadraticCurveTo(W / 2, H - 185, W, H - 85); g.stroke();
  const w = (1 - Math.cos(wipeA)) / 2, ang = Math.PI * .97 - w * Math.PI * .94, px0 = W / 2 + 90, py0 = H - 78;
  g.strokeStyle = '#050505'; g.lineWidth = 6; g.beginPath(); g.moveTo(px0, py0);
  g.lineTo(px0 + 300 * Math.cos(ang), py0 - 300 * Math.sin(ang)); g.stroke();
  gauge(W / 2 - 170, H - 66, 50, v * 3.6 / 240, 8);
  gauge(W / 2 + 170, H - 66, 40, fuel, 4);
  g.textAlign = 'center'; g.fillStyle = '#7fe3ff'; g.font = 'bold 20px "Courier New",monospace';
  g.fillText(Math.round(v * 3.6), W / 2 - 170, H - 40);
  g.font = '11px "Courier New",monospace'; g.fillText('km/h', W / 2 - 170, H - 27);
  g.fillStyle = '#cfe9f5'; g.fillText('E', W / 2 + 170 - 26, H - 46); g.fillText('F', W / 2 + 170 + 26, H - 46); g.fillText('FUEL', W / 2 + 170, H - 36);
  const low = fuel < .25, blink = low && Math.floor(t * 3) % 2 === 0;
  chip('LIGHTS', W / 2 - 62, H - 100, lightsOn, '#5dff7a'); chip('WIPER', W / 2, H - 100, wiperOn, '#5dd0ff'); chip('FUEL', W / 2 + 62, H - 100, blink, '#ff4b3a');
  g.save(); g.translate(W / 2, H + 30); g.rotate(steer);
  g.strokeStyle = '#08090b'; g.lineWidth = 16; g.beginPath(); g.arc(0, 0, 92, 0, 7); g.stroke();
  g.lineWidth = 10; g.beginPath(); g.moveTo(-92, 0); g.lineTo(92, 0); g.moveTo(0, 0); g.lineTo(0, -92); g.stroke(); g.restore();
  g.fillStyle = '#05080a'; g.fillRect(W - 230, H - 52, 190, 34);
  g.textAlign = 'left'; g.fillStyle = radioOn ? '#ffb627' : '#4a3a14'; g.font = 'bold 18px "Courier New",monospace';
  g.fillText(radioOn ? '♪ ' + stations[st].n : 'RADIO OFF', W - 218, H - 29);
}
function glow(o) {
  if (o.k !== 'car' || o.z < -1) return;
  const s = D / (o.z + D); if (s > 1.4) return;
  const y = HY + (H - HY) * s, rw = RW * s, x = CX + (o.x - px) * rw, w = o.hw * 2 * rw, r = Math.max(3, w * (o.d ? .5 : .24));
  for (const d of [-1, 1]) {
    const lx = x + d * w * .38, ly = y - w * .72 * .44;
    const gr = g.createRadialGradient(lx, ly, 0, lx, ly, r);
    gr.addColorStop(0, o.d ? 'rgba(255,250,200,.95)' : 'rgba(255,60,50,.9)'); gr.addColorStop(1, 'rgba(255,200,100,0)');
    g.fillStyle = gr; g.fillRect(lx - r, ly - r, r * 2, r * 2);
  }
}
function night() {
  const dk = 1 - dayL; if (dk < .02) return;
  ng.globalCompositeOperation = 'source-over'; ng.globalAlpha = 1; ng.clearRect(0, 0, W, H);
  ng.fillStyle = `rgba(4,7,18,${dk * .94})`; ng.fillRect(0, 0, W, H);
  if (lightsOn) {
    ng.globalCompositeOperation = 'destination-out'; ng.globalAlpha = .5;
    const gr = ng.createLinearGradient(0, H, 0, HY + 10);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.55, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ng.fillStyle = gr;
    for (const k of [1, .72, .45]) { ng.beginPath(); ng.moveTo(CX - 480 * k, H); ng.lineTo(CX + 480 * k, H); ng.lineTo(CX + 60 * k, HY + 10); ng.lineTo(CX - 60 * k, HY + 10); ng.fill(); }
    ng.globalAlpha = 1; ng.globalCompositeOperation = 'source-over';
  }
  g.drawImage(nc, 0, 0);
  g.fillStyle = '#fff';
  for (let i = 0; i < 45; i++) { g.globalAlpha = dk * (i % 3 ? .5 : .85); g.fillRect((i * 211) % W, (i * 67) % (HY - 50) + 8, 2, 2); }
  g.globalAlpha = 1;
  if (dk > .05) objs.forEach(glow);
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
  weather(); night(); cabin();
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.shadowColor = '#000'; g.shadowOffsetX = 2; g.shadowOffsetY = 2;
  g.font = 'bold 30px "Courier New",monospace'; g.fillText((briefing ? 0 : Math.floor(dist)) + ' m', W / 2, 58);
  if (on && t < 9) {
    g.font = '14px "Courier New",monospace';
    g.fillText('W/S accelerate-brake · A/D steer · L lights · Q wipers · R radio · E/Z station · Space horn', W / 2, 88);
  }
  if (briefing) { g.font = 'bold 22px "Courier New",monospace'; g.fillText('Listen to the intro…  (Enter to skip)', W / 2, 140); }
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
  if (briefing && (e.code === 'Enter' || e.code === 'NumpadEnter')) { startRun(); return; }
  if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (briefing && e.code !== 'KeyL') return;
  if (e.code === 'KeyQ') { wiperOn = !wiperOn; wiperOn ? S.wiper.play().catch(() => {}) : S.wiper.pause(); }
  if (e.code === 'KeyR') { radioOn = !radioOn; tune(); }
  if (e.code === 'KeyL') lightsOn = !lightsOn;
  if (e.code === 'KeyE' || e.code === 'KeyZ') {
    st = (st + (e.code === 'KeyE' ? 1 : stations.length - 1)) % stations.length;
    stations.forEach(s => s.a.pause()); if (radioOn) tune();
  }
  if (e.code === 'Space' || e.code === 'KeyH') play(S.horn);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

/* ---------- GESTIÓN DE BIENVENIDA Y AUDIO ---------- */
function handleFirstInteraction(e) {
  if (e && e.target.tagName === 'BUTTON') return;

  // 1. Ocultamos el splash y mostramos el menú principal primero
  splashEl.classList.add('hide');
  menu.classList.remove('hide');

  // 2. Reproducimos el audio de bienvenida inmediatamente después de quitar el wrapper
  S.welcome.play().then(() => {
    introDone = true;
  }).catch((err) => {
    console.log("Audio de bienvenida bloqueado o falló:", err);
  });

  // 3. Limpiamos los eventos globales
  removeEventListener('pointerdown', handleFirstInteraction);
  removeEventListener('keydown', handleFirstInteraction);
}

addEventListener('pointerdown', handleFirstInteraction);
addEventListener('keydown', handleFirstInteraction);

function startRun() {
  if (!briefing) return;
  briefing = false; S.intro.pause();
  dist = 0; t = 0; fuel = 1; fuelNext = 400; spawnT = 1.5;
  S.engine.play().catch(() => {});
}
S.intro.onended = startRun;
playBtn.onclick = () => {
  introDone = true;
  reset(); on = true; shown = true; scoreEl.textContent = '';
  menu.classList.add('hide'); playBtn.blur();
  briefing = true;
  S.intro.currentTime = 0;
  S.intro.play().catch(startRun);
};

function loop(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  try { if (on) update(dt); draw(); } catch (e) { console.error(e); }
  requestAnimationFrame(loop);
}
reset(); requestAnimationFrame(loop);
})();