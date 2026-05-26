'use strict';

/**
 * 🎨 UI Engine v3.0 — SS Wakeel Bot
 * 5 smart scenarios with intelligent auto-selection
 */
const { createCanvas, registerFont } = require('canvas');

// ── Color Palettes ──
const C = {
  terminal:  { bg: '#0a0e14', fg: '#00ff88', dim: '#2a3a3a', accent: '#ffcc00', grid: '#0f1a1a' },
  hologram:  { bg: '#05001a', fg: '#00f0ff', dim: '#1a0055', accent: '#ff00ff', grid: '#0a0033' },
  dashboard: { bg: '#0f1923', fg: '#ffffff', dim: '#1e2d3d', accent: '#ff4655', card: '#16212e' },
  center:    { bg: '#0d1117', fg: '#c9d1d9', dim: '#21262d', accent: '#58a6ff', gold: '#d29922', green: '#3fb950', card: '#161b22' },
  inline:    { bg: '#0f1923', fg: '#eceff4', dim: '#2e3440', accent: '#88c0d0', green: '#a3be8c' },
};

// ── Helpers ──
function wrapText(ctx, text, x, y, maxW, lineH, maxLines = 999) {
  const lines = [];
  let line = '';
  for (const char of text) {
    const test = line + char;
    if (ctx.measureText(test).width > maxW && line) {
      if (lines.length >= maxLines - 1) { lines.push(line + '…'); break; }
      lines.push(line); line = char;
    } else line = test;
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
  return lines.length * lineH;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawNav(ctx, items, y, w, h) {
  const bw = Math.min(150, (w - 40) / items.length - 10);
  const totalW = items.length * bw + (items.length - 1) * 10;
  const startX = (w - totalW) / 2;
  items.forEach((item, i) => {
    const x = startX + i * (bw + 10);
    ctx.fillStyle = item.active ? item.color || '#58a6ff' : '#21262d';
    roundRect(ctx, x, y, bw, h, 6);
    ctx.fill();
    ctx.fillStyle = item.active ? '#0d1117' : '#c9d1d9';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(item.label, x + bw/2 - ctx.measureText(item.label).width/2, y + h/2 + 4);
  });
}

// ── SCENARIO 1: Terminal AI ──
function terminal(response, model, user) {
  const w = 800, h = 500;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  const cl = C.terminal;

  // Background
  ctx.fillStyle = cl.bg;
  ctx.fillRect(0, 0, w, h);

  // Border glow
  ctx.shadowColor = '#00ff8840';
  ctx.shadowBlur = 15;
  ctx.strokeStyle = cl.dim;
  ctx.lineWidth = 1;
  ctx.strokeRect(8, 8, w-16, h-16);
  ctx.shadowBlur = 0;

  // Title bar
  ctx.fillStyle = '#0f1a1a';
  ctx.fillRect(8, 8, w-16, 32);
  ctx.fillStyle = cl.fg;
  ctx.font = '13px "Courier New", monospace';
  ctx.fillText('┌─[Ss@Ss_Wakeel_Shell]─[~]─────────────────────────┐', 16, 28);
  ctx.fillStyle = cl.dim;
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText(new Date().toLocaleTimeString(), w-140, 28);

  // Header info
  ctx.fillStyle = cl.fg;
  ctx.font = '12px "Courier New", monospace';
  ctx.fillText(`║  ⚡ > AI Engine: ${model} ⭐`, 20, 68);
  ctx.fillText(`║  ⚡ > Operator: ${user}`, 20, 88);

  // Separator
  ctx.fillStyle = cl.dim;
  ctx.fillText(`║  ────────────────────────────────────────`, 20, 115);

  // Response
  const resp = response.length > 350 ? response.slice(0, 350) + '…' : response;
  ctx.fillStyle = cl.fg;
  ctx.font = '13px "Courier New", monospace';

  let yy = 145;
  const lines = resp.split('\n');
  for (const line of lines) {
    if (yy > h - 60) break;
    yy += wrapText(ctx, `«${line}»`, 25, yy, w - 90, 20, 12);
  }

  // Status bar
  ctx.fillStyle = '#0f1a1a';
  ctx.fillRect(8, h - 32, w - 16, 24);
  ctx.fillStyle = cl.dim;
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText(`[STATUS: ACTIVE ✅]  [PID: ${process.pid}]  [${new Date().toLocaleTimeString()}]`, 16, h - 16);

  return c.toBuffer();
}

// ── SCENARIO 2: Dashboard ──
function dashboard(response, model, user, stats) {
  const w = 800, h = 600;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  const cl = C.dashboard;

  ctx.fillStyle = cl.bg;
  ctx.fillRect(0, 0, w, h);

  // Header accent
  ctx.fillStyle = cl.accent;
  ctx.fillRect(0, 0, w, 4);

  // Header
  ctx.fillStyle = cl.card;
  ctx.fillRect(0, 4, w, 55);
  ctx.fillStyle = cl.fg;
  ctx.font = 'bold 22px Arial';
  ctx.fillText('📊  SS WAKEEL DASHBOARD', 25, 42);
  ctx.fillStyle = cl.dim;
  ctx.font = '11px Arial';
  ctx.fillText(`v3.0 | ${new Date().toLocaleString()}`, w - 220, 42);

  // Stats cards
  const cards = [
    { icon: '👤', label: 'USER', value: user, x: 25 },
    { icon: '🧠', label: 'MODEL', value: model, x: 210 },
    { icon: '🟢', label: 'STATUS', value: 'ACTIVE', x: 395 },
    { icon: '👥', label: 'USERS', value: String(stats?.users || 0), x: 580 },
  ];

  cards.forEach(card => {
    ctx.fillStyle = cl.card;
    roundRect(ctx, card.x, 80, 170, 60, 8);
    ctx.fill();
    ctx.fillStyle = cl.dim;
    ctx.font = '10px Arial';
    ctx.fillText(card.label, card.x + 12, 100);
    ctx.fillStyle = cl.fg;
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`${card.icon} ${card.value}`, card.x + 12, 128);
  });

  // Response box
  ctx.fillStyle = cl.card;
  roundRect(ctx, 25, 155, w - 50, h - 210, 10);
  ctx.fill();

  ctx.fillStyle = cl.accent;
  ctx.font = 'bold 14px Arial';
  ctx.fillText('💬  RESPONSE', 40, 185);

  ctx.fillStyle = cl.fg;
  ctx.font = '14px Arial';
  const resp = response.length > 500 ? response.slice(0, 500) + '…' : response;
  let yy = 215;
  for (const line of resp.split('\n')) {
    if (yy > h - 80) break;
    yy += wrapText(ctx, line, 40, yy, w - 100, 22, 14);
  }

  // Footer nav
  ctx.fillStyle = '#1a2430';
  ctx.fillRect(0, h - 45, w, 45);
  drawNav(ctx, [
    { label: '💬 Chat', active: true, color: cl.accent },
    { label: '⚙️ Settings', active: false },
    { label: '👥 Users', active: false },
    { label: '📊 Stats', active: false },
    { label: '🔒 Owner', active: false },
  ], h - 40, w, 34);

  return c.toBuffer();
}

// ── SCENARIO 3: Holographic AI ──
function hologram(response, model, user) {
  const w = 800, h = 500;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  const cl = C.hologram;

  // Gradient background
  const grad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, 400);
  grad.addColorStop(0, '#0a0033');
  grad.addColorStop(1, '#05001a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = '#1a0055';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Title with glow
  ctx.shadowColor = '#00f0ff80';
  ctx.shadowBlur = 40;
  ctx.fillStyle = cl.fg;
  ctx.font = 'bold 28px "Courier New", monospace';
  ctx.fillText('◈  ＳＳ  ＡＩ  ◈', w / 2 - 140, 55);
  ctx.shadowBlur = 20;

  // Separator
  ctx.fillStyle = cl.dim;
  ctx.font = '18px monospace';
  ctx.fillText('═'.repeat(45), 20, 85);

  // System info
  ctx.shadowBlur = 10;
  ctx.fillStyle = cl.fg;
  ctx.font = '13px "Courier New", monospace';
  ctx.fillText('▓▓▓▓ SYSTEM ONLINE ▓▓▓▓', 25, 115);
  ctx.fillStyle = cl.dim;
  ctx.fillText(`▓▓▓▓ ${model} ▓▓▓▓`, 25, 135);
  ctx.font = '18px monospace';
  ctx.fillText('═'.repeat(45), 20, 165);

  // Response
  ctx.shadowColor = '#ff00ff80';
  ctx.shadowBlur = 20;
  ctx.fillStyle = cl.accent;
  ctx.font = '13px "Courier New", monospace';
  ctx.fillText('⚡ RESPONSE:', 25, 195);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#e0e0ff';
  ctx.font = '14px "Courier New", monospace';
  const resp = response.length > 350 ? response.slice(0, 350) + '…' : response;
  let yy = 225;
  for (const line of resp.split('\n')) {
    if (yy > h - 80) break;
    yy += wrapText(ctx, `⟫ ${line}`, 30, yy, w - 80, 22, 10);
  }

  // Footer
  ctx.fillStyle = cl.dim;
  ctx.font = '11px monospace';
  ctx.fillText('─── ◈ ───', w / 2 - 35, h - 50);
  ctx.fillStyle = cl.fg;
  ctx.fillText(`[STATUS: 🟢 ACTIVE]  [OPERATOR: ${user}]`, 25, h - 25);

  return c.toBuffer();
}

// ── SCENARIO 4: Command Center ──
function commandCenter(response, model, user, stats) {
  const w = 900, h = 680;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  const cl = C.center;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0d1117');
  grad.addColorStop(1, '#161b22');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Top accent bar
  ctx.fillStyle = '#1a2332';
  ctx.fillRect(0, 0, w, 3);
  ctx.fillStyle = cl.accent;
  ctx.fillRect(0, 0, w * 0.6, 3);

  // Header
  ctx.fillStyle = '#161b22';
  ctx.fillRect(0, 3, w, 62);
  ctx.fillStyle = cl.accent;
  ctx.font = 'bold 24px Arial';
  ctx.fillText('⚡ SS COMMAND CENTER', 25, 45);
  ctx.fillStyle = cl.gold;
  ctx.font = '11px Arial';
  ctx.fillText('✦ PREMIUM AI TERMINAL', w - 200, 42);
  ctx.fillStyle = cl.dim;
  ctx.fillText(`v3.0 | ${new Date().toLocaleTimeString()}`, w - 200, 58);

  // Info panels (2 rows x 3 cols)
  const panels = [
    { label: '🤖 Model', value: model, color: cl.accent },
    { label: '👤 Operator', value: user, color: cl.green },
    { label: '👥 Users', value: String(stats?.users || 0), color: cl.gold },
    { label: '📨 Messages', value: String(stats?.messages || 0), color: '#bc8cff' },
    { label: '🟢 Status', value: 'Active', color: cl.green },
    { label: '💾 Memory', value: `${stats?.memory || '0'} MB`, color: '#f0883e' },
  ];

  panels.forEach((p, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 25 + col * 295;
    const y = 85 + row * 75;

    ctx.fillStyle = cl.card;
    roundRect(ctx, x, y, 275, 60, 8);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.fillRect(x + 8, y + 5, 30, 3);
    roundRect(ctx, x + 8, y + 5, 30, 3, 2);
    ctx.fill();

    ctx.fillStyle = cl.fg;
    ctx.font = 'bold 13px Arial';
    ctx.fillText(p.label, x + 15, y + 32);
    ctx.fillStyle = p.color;
    ctx.font = 'bold 13px Arial';
    ctx.fillText(p.value, x + 15, y + 52);
  });

  // Response box
  const respY = 240;
  ctx.fillStyle = cl.card;
  roundRect(ctx, 25, respY, w - 50, h - respY - 105, 10);
  ctx.fill();

  ctx.fillStyle = '#30363d';
  ctx.fillRect(35, respY + 10, w - 70, 35);
  roundRect(ctx, 35, respY + 10, w - 70, 35, 5);
  ctx.fill();

  ctx.fillStyle = cl.accent;
  ctx.font = 'bold 13px Arial';
  ctx.fillText('📋  AI Response  █', 50, respY + 33);

  ctx.fillStyle = cl.fg;
  ctx.font = '13px Arial';
  const resp = response.length > 600 ? response.slice(0, 600) + '…' : response;
  let yy = respY + 65;
  for (const line of resp.split('\n')) {
    if (yy > h - 130) break;
    yy += wrapText(ctx, line, 50, yy, w - 120, 20, 16);
  }

  // Footer nav
  ctx.fillStyle = '#161b22';
  ctx.fillRect(0, h - 55, w, 55);
  drawNav(ctx, [
    { label: '💬 Chat', active: true, color: cl.accent },
    { label: '⚙️ Settings', active: false },
    { label: '👥 Users', active: false },
    { label: '📊 Stats', active: false },
    { label: '🔒 Owner', active: false, color: cl.gold },
  ], h - 48, w, 40);

  return c.toBuffer();
}

// ── Smart Selector ──
function selectScenario(response, model, user, stats) {
  const len = response.length;
  const isCode = response.includes('```') || response.includes('function(') || response.includes('class ') || response.includes('=> {');
  const isShort = len < 100;

  if (isCode)      return { type: 'terminal', buffer: terminal(response, model, user) };
  if (len > 300)   return { type: 'command_center', buffer: commandCenter(response, model, user, stats) };
  if (isShort)     return { type: 'hologram', buffer: hologram(response, model, user) };
  return { type: 'dashboard', buffer: dashboard(response, model, user, stats) };
}

module.exports = {
  terminal,
  dashboard,
  hologram,
  commandCenter,
  selectScenario,
};