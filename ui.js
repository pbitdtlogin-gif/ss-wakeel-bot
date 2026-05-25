const { createCanvas } = require('canvas');

const COLORS = {
  terminal: { bg: '#0a0e14', fg: '#00ff88', dim: '#2a3a3a', accent: '#ffcc00' },
  hologram: { bg: '#05001a', fg: '#00f0ff', dim: '#1a0055', accent: '#ff00ff' },
  dashboard: { bg: '#0f1923', fg: '#ffffff', dim: '#1e2d3d', accent: '#ff4655', card: '#16212e' },
  center: { bg: '#0d1117', fg: '#c9d1d9', dim: '#21262d', accent: '#58a6ff', gold: '#d29922', green: '#3fb950' },
};

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = []; let line = '';
  for (const char of text) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = char; }
    else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return lines.length * lineHeight;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// SCENARIO 1: Terminal AI
function renderTerminal(response, modelName, userName) {
  const w = 800, h = 500; const c = createCanvas(w, h); const ctx = c.getContext('2d'); const cl = COLORS.terminal;
  ctx.fillStyle = cl.bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = cl.dim; ctx.lineWidth = 2; ctx.strokeRect(10, 10, w-20, h-20);
  ctx.fillStyle = '#1a1f2e'; ctx.fillRect(10, 10, w-20, 35);
  ctx.fillStyle = cl.fg; ctx.font = '14px "Courier New", monospace';
  ctx.fillText('┌─[Ss@Ss_Wakeel_Shell]─[~]─────────────────────┐', 20, 32);
  ctx.fillStyle = cl.dim; ctx.font = '11px "Courier New", monospace';
  ctx.fillText(new Date().toLocaleTimeString(), w-150, 32);
  ctx.fillStyle = cl.fg; ctx.font = '13px "Courier New", monospace';
  ctx.fillText(`║  ⚡ > AI Engine [${modelName}] ⭐`, 20, 70);
  ctx.fillText(`║  ⚡ > Operator: ${userName} ✅`, 20, 90);
  ctx.fillText(`║  ⚡ > Response Ready:`, 20, 115);
  ctx.fillStyle = cl.dim; ctx.fillText(`║  ────────────────────────────────────────`, 20, 140);
  ctx.fillStyle = cl.fg; ctx.font = '14px "Courier New", monospace';
  let yy = 165; const resp = response.length > 350 ? response.slice(0,350)+'…' : response;
  for (const line of resp.split('\n')) { if (yy > h-50) break; yy += wrapText(ctx, `«${line}»`, 25, yy, w-80, 22); }
  ctx.fillStyle = '#1a1f2e'; ctx.fillRect(10, h-40, w-20, 30);
  ctx.fillStyle = cl.dim; ctx.font = '11px "Courier New", monospace';
  ctx.fillText(`[STATUS: ACTIVE ✅]  [PID: ${process.pid}]  [${new Date().toLocaleTimeString()}]`, 20, h-18);
  return c.toBuffer();
}

// SCENARIO 2: Dashboard
function renderDashboard(response, modelName, userName, stats) {
  const w = 800, h = 600; const c = createCanvas(w, h); const ctx = c.getContext('2d'); const cl = COLORS.dashboard;
  ctx.fillStyle = cl.bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = cl.accent; ctx.fillRect(0, 0, w, 5);
  ctx.fillStyle = cl.card; ctx.fillRect(0, 5, w, 55);
  ctx.fillStyle = cl.fg; ctx.font = 'bold 22px Arial'; ctx.fillText('📊  SS WAKEEL DASHBOARD', 25, 42);
  ctx.fillStyle = cl.dim; ctx.font = '12px Arial'; ctx.fillText(`v2.0 | ${new Date().toLocaleString()}`, w-220, 42);
  const cards = [
    { label:'USER', value:userName, icon:'👤', x:25 },
    { label:'MODEL', value:modelName, icon:'🧠', x:210 },
    { label:'STATUS', value:'🟢 ACTIVE', icon:'', x:395 },
    { label:'USERS', value:String(stats?.users||0), icon:'👥', x:580 },
  ];
  cards.forEach(card => {
    ctx.fillStyle = cl.card; roundRect(ctx, card.x, 80, 170, 60, 8); ctx.fill();
    ctx.fillStyle = cl.dim; ctx.font = '11px Arial'; ctx.fillText(card.label, card.x+12, 100);
    ctx.fillStyle = cl.fg; ctx.font = 'bold 14px Arial'; ctx.fillText(`${card.icon} ${card.value}`, card.x+12, 128);
  });
  ctx.fillStyle = cl.card; roundRect(ctx, 25, 155, w-50, h-210, 8); ctx.fill();
  ctx.fillStyle = cl.accent; ctx.font = 'bold 14px Arial'; ctx.fillText('💬  RESPONSE', 40, 185);
  ctx.fillStyle = cl.fg; ctx.font = '14px Arial';
  let yy = 215; const resp = response.length > 500 ? response.slice(0,500)+'…' : response;
  for (const line of resp.split('\n')) { if (yy > h-70) break; yy += wrapText(ctx, line, 40, yy, w-100, 22); }
  ctx.fillStyle = '#1a2430'; ctx.fillRect(0, h-45, w, 45);
  ctx.fillStyle = cl.dim; ctx.font = '12px Arial';
  ['💬 Chat','⚙️ Settings','👥 Users','📊 Stats','🔒 Owner'].forEach((b,i) => {
    ctx.fillStyle = i===0 ? cl.accent : cl.dim; roundRect(ctx, 25+i*155, h-38, 140, 32, 5); ctx.fill();
    ctx.fillStyle = i===0 ? '#fff' : cl.fg; ctx.font = 'bold 12px Arial'; ctx.fillText(b, 25+i*155+70-ctx.measureText(b).width/2, h-16);
  });
  return c.toBuffer();
}

// SCENARIO 3: Holographic AI
function renderHologram(response, modelName, userName) {
  const w = 800, h = 500; const c = createCanvas(w, h); const ctx = c.getContext('2d'); const cl = COLORS.hologram;
  const grad = ctx.createRadialGradient(w/2, h/2, 50, w/2, h/2, 400);
  grad.addColorStop(0, '#0a0033'); grad.addColorStop(1, '#05001a');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  ctx.shadowColor = '#00f0ff40'; ctx.shadowBlur = 30;
  ctx.fillStyle = cl.fg; ctx.font = 'bold 28px "Courier New", monospace'; ctx.shadowBlur = 40;
  ctx.fillText('◈  ＳＳ  ＡＩ  ◈', w/2-140, 55); ctx.shadowBlur = 30;
  ctx.fillStyle = cl.dim; ctx.font = '20px monospace'; ctx.fillText('═'.repeat(45), 20, 85);
  ctx.fillStyle = cl.fg; ctx.font = '14px "Courier New", monospace'; ctx.fillText('▓▓▓▓ SYSTEM ONLINE ▓▓▓▓', 25, 115);
  ctx.fillStyle = cl.dim; ctx.fillText(`▓▓▓▓ ${modelName} ▓▓▓▓`, 25, 135);
  ctx.fillStyle = cl.dim; ctx.font = '20px monospace'; ctx.fillText('═'.repeat(45), 20, 165);
  ctx.fillStyle = cl.accent; ctx.font = '14px "Courier New", monospace'; ctx.shadowColor='#ff00ff80'; ctx.shadowBlur=20;
  ctx.fillText('⚡ RESPONSE:', 25, 195); ctx.shadowBlur=10;
  ctx.fillStyle = '#e0e0ff'; ctx.font = '15px "Courier New", monospace';
  let yy = 225; const resp = response.length > 350 ? response.slice(0,350)+'…' : response;
  for (const line of resp.split('\n')) { if (yy > h-80) break; yy += wrapText(ctx, `⟫ ${line}`, 30, yy, w-80, 24); }
  ctx.shadowBlur=0; ctx.fillStyle = cl.dim; ctx.font='12px monospace';
  ctx.fillText('─── ◈ ───', w/2-40, h-50);
  ctx.fillStyle = cl.fg; ctx.fillText(`[STATUS: 🟢 ACTIVE]  [OPERATOR: ${userName}]`, 25, h-25);
  return c.toBuffer();
}

// SCENARIO 4: Command Center
function renderCommandCenter(response, modelName, userName, stats) {
  const w = 900, h = 680; const c = createCanvas(w, h); const ctx = c.getContext('2d'); const cl = COLORS.center;
  const grad = ctx.createLinearGradient(0,0,0,h); grad.addColorStop(0,'#0d1117'); grad.addColorStop(1,'#161b22');
  ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
  ctx.fillStyle = '#1a2332'; ctx.fillRect(0,0,w,4);
  ctx.fillStyle = '#161b22'; ctx.fillRect(0,4,w,65);
  ctx.fillStyle = cl.accent; ctx.font = 'bold 24px Arial'; ctx.fillText('⚡ SS COMMAND CENTER', 25, 45);
  ctx.fillStyle = cl.gold; ctx.font='12px Arial'; ctx.fillText('✦ PREMIUM AI TERMINAL', w-200, 45);
  ctx.fillStyle = cl.dim; ctx.fillText(`v2.0 | ${new Date().toLocaleTimeString()}`, w-200, 62);
  const panels = [
    { label:'🤖 Model', value:modelName, color:cl.accent },
    { label:'👤 Operator', value:userName, color:cl.green },
    { label:'📊 Users', value:String(stats?.users||0), color:cl.gold },
    { label:'📨 Messages', value:String(stats?.messages||0), color:'#bc8cff' },
    { label:'🟢 Status', value:'Active', color:cl.green },
    { label:'💾 Memory', value:`${stats?.memory||'0'} MB`, color:'#f0883e' },
  ];
  panels.forEach((p,i) => {
    const col=i%3, row=Math.floor(i/3), x=25+col*290, y=85+row*75;
    ctx.fillStyle='#21262d'; roundRect(ctx,x,y,270,60,8); ctx.fill();
    ctx.fillStyle=p.color; ctx.fillRect(x+8,y+5,40,3); roundRect(ctx,x+8,y+5,40,3,2); ctx.fill();
    ctx.fillStyle=cl.fg; ctx.font='bold 14px Arial'; ctx.fillText(p.label,x+15,y+32);
    ctx.fillStyle=p.color; ctx.font='bold 13px Arial'; ctx.fillText(p.value,x+15,y+52);
  });
  const respBoxY=250;
  ctx.fillStyle='#21262d'; roundRect(ctx,25,respBoxY,w-50,h-respBoxY-105,10); ctx.fill();
  ctx.fillStyle='#30363d'; ctx.fillRect(35,respBoxY+10,w-70,35); roundRect(ctx,35,respBoxY+10,w-70,35,5); ctx.fill();
  ctx.fillStyle=cl.accent; ctx.font='bold 13px Arial'; ctx.fillText('📋  AI Response  █',50,respBoxY+33);
  ctx.fillStyle=cl.fg; ctx.font='14px Arial';
  let yy=respBoxY+65; const resp=response.length>600?response.slice(0,600)+'…':response;
  for (const line of resp.split('\n')) { if (yy>h-120) break; yy+=wrapText(ctx,line,50,yy,w-120,22); }
  ctx.fillStyle='#161b22'; ctx.fillRect(0,h-55,w,55);
  const navItems=[
    { label:'💬 Chat', color:cl.accent, x:25 },
    { label:'⚙️ Settings', color:'#30363d', x:175 },
    { label:'👥 Users', color:'#30363d', x:350 },
    { label:'📊 Stats', color:'#30363d', x:510 },
    { label:'🔒 Owner', color:cl.gold, x:670 },
  ];
  navItems.forEach(item => {
    ctx.fillStyle=item.color; roundRect(ctx,item.x,h-48,130,40,6); ctx.fill();
    ctx.fillStyle=item.color===cl.accent||item.color===cl.gold?'#0d1117':cl.fg;
    ctx.font='bold 13px Arial'; ctx.fillText(item.label,item.x+65-ctx.measureText(item.label).width/2,h-20);
  });
  return c.toBuffer();
}

// Smart selector
function selectScenario(response, modelName, userName, stats) {
  const len = response.length;
  const isCode = response.includes('```')||response.includes('function')||response.includes('class ');
  if (isCode) return { type:'terminal', buffer:renderTerminal(response,modelName,userName) };
  if (len>300 && stats) return { type:'command_center', buffer:renderCommandCenter(response,modelName,userName,stats) };
  if (len<100) return { type:'hologram', buffer:renderHologram(response,modelName,userName) };
  return { type:'dashboard', buffer:renderDashboard(response,modelName,userName,stats) };
}

module.exports = { renderTerminal, renderDashboard, renderHologram, renderCommandCenter, selectScenario };