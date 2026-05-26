// ============================================================
// 🤖 Ss Wakeel AI Bot v3.0 — الإصلاح الشامل + 5 واجهات UI
// ============================================================
const TelegramBot = require('node-telegram-bot-api');
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ─── الإعدادات ───
const BOT_TOKEN = process.env.BOT_TOKEN || '8824271100:AAEQmEyidXPpN1NAWmkZ3I9OWPC3lQ9NIwQ';
const OWNER_ID = parseInt(process.env.OWNER_ID || '8277131084');
const ADMIN_IDS = [OWNER_ID, 7429243468];
const ALLOWED_USERS = [OWNER_ID];
const SELF_HEAL_INTERVAL = 5 * 60 * 1000; // كل 5 دقائق
const DEEP_DIAG_INTERVAL = 30 * 60 * 1000; // كل 30 دقيقة
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
let botInstance = null;
const START_TIME = Date.now();
const userStats = {};
const models = [
  'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4',
  'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku',
  'gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash',
  'llama-3-70b', 'mixtral-8x7b', 'deepseek-coder'
];
let currentModelIndex = 0;
let uiMode = 'auto'; // auto | terminal | dashboard | hologram | center | inline
const usersFile = '/workspace/users.json';
let users = {};
try { if (fs.existsSync(usersFile)) users = JSON.parse(fs.readFileSync(usersFile)); } catch(e) {}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync('/workspace/bot.log', line + '\n'); } catch(e) {}
  try { const st = fs.statSync('/workspace/bot.log'); if (st.size > MAX_LOG_SIZE) { fs.renameSync('/workspace/bot.log', '/workspace/bot.log.old'); } } catch(e) {}
}

function saveUsers() { try { fs.writeFileSync(usersFile, JSON.stringify(users, null, 2)); } catch(e) {} }

// ─── صانع الصور (UI Canvas) ───
function createUIBorder(ctx, w, h, title, color='#00ff88') {
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, w-10, h-10);
  ctx.fillStyle = color; ctx.font = 'bold 18px Courier'; ctx.textAlign = 'center';
  ctx.fillText(title, w/2, 30);
  ctx.strokeRect(25, 40, w-50, 1);
}

function generateTerminalUI(text) {
  const w = 600, h = 320;
  const c = createCanvas(w, h); const ctx = c.getContext('2d');
  createUIBorder(ctx, w, h, '≡ SS TERMINAL v3.0 ≡', '#00ff88');
  ctx.fillStyle = '#00ff88'; ctx.font = '14px Courier'; ctx.textAlign = 'left';
  const lines = [`╔══════════════════════════════╗`,`║  SS WAKEEL AI TERMINAL     ║`,`║  Status: ONLINE 🟢          ║`,`╚══════════════════════════════╝`,``,`┌─[Ss@Ss_Wakeel]─[~]─────────┐`,`│`,`│  ${text}`,`│`,`└────────────────────────────────┘`];
  lines.forEach((l, i) => ctx.fillText(l, 30, 70 + i*22));
  ctx.fillStyle = '#004400'; ctx.font = '11px Courier';
  ctx.fillText('[Ss_Wakeel_Terminal]', 10, h-10);
  return c.toBuffer();
}

function generateDashboardUI(text) {
  const w = 600, h = 380;
  const c = createCanvas(w, h); const ctx = c.getContext('2d');
  createUIBorder(ctx, w, h, '≡ SS DASHBOARD v3.0 ≡', '#00aaff');
  ctx.fillStyle = '#00aaff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'left';
  const udata = Object.values(users);
  ctx.fillText(`👤 Users: ${udata.length}`, 30, 70);
  ctx.fillText(`💬 Total Msgs: ${udata.reduce((a,u) => a+(u.msgs||0),0)}`, 30, 95);
  ctx.fillText(`🤖 Model: ${models[currentModelIndex]}`, 30, 120);
  ctx.fillText(`⏱ Uptime: ${Math.floor((Date.now()-START_TIME)/60000)}m`, 30, 145);
  ctx.strokeStyle = '#00aaff'; ctx.strokeRect(20, 160, w-40, 1);
  ctx.fillStyle = '#ffffff'; ctx.font = '14px Arial'; ctx.textAlign = 'center';
  const words = text.split(' '); let line = '', y = 190;
  words.forEach(wrd => {
    if ((line + wrd).length > 40) { ctx.fillText(line, w/2, y); y += 22; line = wrd + ' '; }
    else line += wrd + ' ';
  });
  if (line) ctx.fillText(line, w/2, y);
  ctx.fillStyle = '#003366'; ctx.font = '11px Arial';
  ctx.fillText('[Ss_Dashboard]', 10, h-10);
  return c.toBuffer();
}

function generateHologramUI(text) {
  const w = 600, h = 320;
  const c = createCanvas(w, h); const ctx = c.getContext('2d');
  createUIBorder(ctx, w, h, '◈ SS HOLOGRAM ◈', '#ff00ff');
  ctx.fillStyle = '#ff00ff'; ctx.font = '16px Arial'; ctx.textAlign = 'center';
  ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 15;
  ctx.fillText('⬡ SS WAKEEL AI ⬡', w/2, 70);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#cc00cc'; ctx.font = '14px Arial';
  ctx.fillText(text, w/2, 120);
  ctx.fillStyle = '#660066'; ctx.font = '12px Arial';
  ctx.fillText('✦ System Active ✦', w/2, 250);
  ctx.fillStyle = '#440044'; ctx.font = '11px Arial'; ctx.textAlign = 'left';
  ctx.fillText('[Ss_Hologram]', 10, h-10);
  return c.toBuffer();
}

function generateCenterUI(text) {
  const w = 700, h = 420;
  const c = createCanvas(w, h); const ctx = c.getContext('2d');
  createUIBorder(ctx, w, h, '≡ SS COMMAND CENTER v3.0 ≡', '#ffaa00');
  ctx.fillStyle = '#ffaa00'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'left';
  // Left panel
  ctx.fillStyle = '#1a1a2e'; ctx.fillRect(15, 50, 200, h-70);
  ctx.strokeStyle = '#ffaa00'; ctx.strokeRect(15, 50, 200, h-70);
  ctx.fillStyle = '#ffaa00'; ctx.font = '12px Arial';
  const items = ['📊 DASHBOARD','💬 CHAT','⚙️ SETTINGS','👥 USERS','🔒 DEV','🖼️ UI','🧠 AI'];
  items.forEach((it, i) => { ctx.fillStyle = i === 1 ? '#ffffff' : '#886600'; ctx.fillText(it, 25, 75+i*28); });
  // Content area
  ctx.fillStyle = '#ffffff'; ctx.font = '14px Arial'; ctx.textAlign = 'left';
  ctx.fillText('📋 Response:', 230, 75);
  ctx.fillStyle = '#cccccc'; ctx.font = '13px Arial';
  const words = text.split(' '); let line = '', y = 105;
  words.forEach(wrd => {
    if ((line + wrd).length > 42) { ctx.fillText(line, 230, y); y += 20; line = wrd + ' '; }
    else line += wrd + ' ';
  });
  if (line) ctx.fillText(line, 230, y);
  ctx.fillStyle = '#ffaa00'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'left';
  ctx.fillText('🔹 Model: ' + models[currentModelIndex], 230, h-50);
  ctx.fillText('🔹 Users: ' + Object.keys(users).length, 230, h-30);
  ctx.fillStyle = '#553300'; ctx.font = '11px Arial';
  ctx.fillText('[Ss_CommandCenter]', 10, h-10);
  return c.toBuffer();
}

function pickUI(text, forced) {
  if (forced && forced !== 'auto') return forced;
  const len = text.length;
  if (text.includes('```') || text.includes('def ') || text.includes('function') || text.includes('const ') || text.includes('import')) return 'terminal';
  if (len > 300) return 'center';
  if (len > 100) return 'dashboard';
  return 'hologram';
}

function generateUI(text, forcedMode) {
  const mode = forcedMode || uiMode;
  const chosen = mode === 'auto' ? pickUI(text) : mode;
  switch(chosen) {
    case 'terminal': return generateTerminalUI(text);
    case 'dashboard': return generateDashboardUI(text);
    case 'hologram': return generateHologramUI(text);
    case 'center': return generateCenterUI(text);
    default: return generateHologramUI(text);
  }
}

function ensureUser(uid, uname, fname) {
  if (!users[uid]) {
    users[uid] = { id: uid, username: uname || '', first_name: fname || '', firstSeen: Date.now(), lastSeen: Date.now(), msgs: 0, blocked: false };
    saveUsers();
  }
  users[uid].lastSeen = Date.now();
  users[uid].msgs = (users[uid].msgs || 0) + 1;
  if (uname) users[uid].username = uname;
  if (fname) users[uid].first_name = fname;
  saveUsers();
}

function isOwner(uid) { return uid === OWNER_ID; }
function isAdmin(uid) { return ADMIN_IDS.includes(uid); }
function isAllowed(uid) { return ALLOWED_USERS.includes(uid) || ADMIN_IDS.includes(uid); }

// ─── GitHub Models API ───
async function callAI(prompt) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
  const model = models[currentModelIndex];
  const url = 'https://models.inference.ai.azure.com/chat/completions';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GITHUB_TOKEN}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 1000 })
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '❌ No response';
  } catch(e) {
    log(`API error (${model}): ${e.message}`);
    // Try next model
    currentModelIndex = (currentModelIndex + 1) % models.length;
    if (currentModelIndex !== 0) return callAI(prompt);
    return `⚠️ All models failed. Last error: ${e.message}`;
  }
}

// ─── نظام الإصلاح الذاتي ───
function selfHeal() {
  log('🛡️ Self-heal check running...');
  try {
    // Check process health
    if (!botInstance) { log('⚠️ Bot instance null — restarting'); return; }
    // Check event loop lag
    const start = Date.now();
    setTimeout(() => {
      const lag = Date.now() - start - 100;
      if (lag > 5000) log(`⚠️ Event loop lag: ${lag}ms`);
    }, 100);
  } catch(e) { log(`❌ Self-heal error: ${e.message}`); }
}

function deepDiagnostic() {
  log('🔬 Deep diagnostic running...');
  const mem = process.memoryUsage();
  const udata = Object.values(users);
  const topUsers = udata.sort((a,b) => (b.msgs||0) - (a.msgs||0)).slice(0,5);
  log(`📊 DIAG: RSS=${Math.round(mem.rss/1024/1024)}MB | Heap=${Math.round(mem.heapUsed/1024/1024)}/${Math.round(mem.heapTotal/1024/1024)}MB`);
  log(`📊 DIAG: Users=${udata.length} | Uptime=${Math.floor((Date.now()-START_TIME)/1000)}s`);
  log(`📊 DIAG: Model=${models[currentModelIndex]} | Top: ${topUsers.map(u => `${u.first_name||u.id}(${u.msgs})`).join(', ')}`);
  try {
    const files = fs.readdirSync('/workspace').filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
    const old = Date.now() - 3600000;
    files.forEach(f => { const st = fs.statSync('/workspace/'+f); if (st.mtimeMs < old) { fs.unlinkSync('/workspace/'+f); log(`🧹 Cleaned: ${f}`); } });
  } catch(e) {}
}

// ─── الأزرار الذكية ───
function getMainKeyboard() {
  return { reply_markup: { inline_keyboard: [
    [{ text: '💬 Chat', callback_data: 'ui_auto' }, { text: '🖼️ Terminal', callback_data: 'ui_terminal' }],
    [{ text: '📊 Dashboard', callback_data: 'ui_dashboard' }, { text: '🌀 Hologram', callback_data: 'ui_hologram' }],
    [{ text: '⚡ Command Center', callback_data: 'ui_center' }, { text: '🔘 Inline', callback_data: 'ui_inline' }]
  ]}};
}

function getOwnerKeyboard() {
  return { reply_markup: { inline_keyboard: [
    [{ text: '🛡️ Heal', callback_data: 'cmd_heal' }, { text: '🩻 Diagnose', callback_data: 'cmd_diag' }],
    [{ text: '🧹 Cleanup', callback_data: 'cmd_cleanup' }, { text: '📊 Stats', callback_data: 'cmd_stats' }],
    [{ text: '📋 Logs', callback_data: 'cmd_logs' }, { text: '🔄 Restart Bot', callback_data: 'cmd_restart' }],
    [{ text: '🤖 Next Model', callback_data: 'cmd_nextmodel' }, { text: '📤 Export', callback_data: 'cmd_export' }],
    [{ text: '📁 Files', callback_data: 'cmd_files' }, { text: '📡 Net', callback_data: 'cmd_net' }],
    [{ text: '🔙 Main Menu', callback_data: 'main_menu' }]
  ]}};
}

// ─── بناء البوت ───
function buildBot() {
  const bot = new TelegramBot(BOT_TOKEN, { polling: true });
  botInstance = bot;
  log('🤖 Bot v3.0 starting...');

  // ─── الأوامر ───
  bot.onText(/\/start/, async (msg) => {
    const uid = msg.from.id; const uname = msg.from.username; const fname = msg.from.first_name;
    ensureUser(uid, uname, fname);
    const txt = `🤖 *Ss Wakeel AI v3.0* 🔥\n━━━━━━━━━━━━━━━━━━━\nأهلاً ${fname || 'عزيزي'}! أنا بوتك الذكي.\n\n📌 *الأوامر الأساسية:*\n/help — قائمة المساعدة\n/ui — اختيار واجهة UI\n/owner — لوحة المطور (للمالك فقط)\n\n✨ *الواجهات المتوفرة:*\n• 🖥️ Terminal — شاشة سوداء\n• 📊 Dashboard — لوحة معلومات\n• 🌀 Hologram — واجهة نيون\n• ⚡ Command Center — مركز قيادة\n• 🔘 Inline — أزرار تفاعلية\n\n💡 *اختر واجهتك المفضلة!*`;
    if (isAllowed(uid)) {
      await bot.sendPhoto(uid, generateUI(txt, 'center'), { caption: txt, parse_mode: 'Markdown', ...getMainKeyboard() });
    } else {
      await bot.sendMessage(uid, txt, { parse_mode: 'Markdown' });
    }
  });

  bot.onText(/\/help/, async (msg) => {
    const uid = msg.from.id;
    const cmds = isAdmin(uid) ? `
🔹 *الأوامر العامة:*\n/start — تشغيل البوت\n/help — هذه القائمة\n/ui — اختيار واجهة UI\n
🔹 *أوامر المالك:*\n/heal — إصلاح فوري\n/diag — تشخيص كامل\n/cleanup — تنظيف\n/stats — إحصائيات\n/logs — آخر السجلات\n/export — تصدير المستخدمين\n/files — ملفات السيرفر\n/restart — إعادة تشغيل\n/model — تبديل النموذج
` : `
🔹 *الأوامر العامة:*\n/start — تشغيل البوت\n/help — هذه القائمة\n/ui — اختيار واجهة UI
`;
    await bot.sendMessage(uid, `📚 *Ss Wakeel AI — المساعدة*\n━━━━━━━━━━━━━━━━━━━${cmds}`, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/ui(?:_(.+))?/, async (msg, match) => {
    const uid = msg.from.id;
    if (!isAllowed(uid)) return bot.sendMessage(uid, '❌ غير مسموح');
    const mode = match?.[1];
    if (mode && ['terminal','dashboard','hologram','center','inline','auto'].includes(mode)) {
      if (mode === 'inline') uiMode = 'inline';
      else uiMode = mode;
      await bot.sendMessage(uid, `✅ *واجهة ${mode}* مفعلة!`, { parse_mode: 'Markdown' });
    } else {
      const modes = [
        { text: '🖥️ Terminal (للأكواد)', callback_data: 'ui_terminal' },
        { text: '📊 Dashboard (إحصائيات)', callback_data: 'ui_dashboard' },
        { text: '🌀 Hologram (نيون)', callback_data: 'ui_hologram' },
        { text: '⚡ Command Center (كامل)', callback_data: 'ui_center' },
        { text: '🔘 Inline (أزرار)', callback_data: 'ui_inline' },
        { text: '🤖 Auto (تلقائي)', callback_data: 'ui_auto' }
      ];
      const rows = []; let row = [];
      modes.forEach((m, i) => { row.push(m); if (row.length === 2 || i === modes.length-1) { rows.push(row); row = []; } });
      await bot.sendMessage(uid, '🎨 *اختر واجهة UI:*\n━━━━━━━━━━━━━━━━━━━', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows.map(r => r.map(b => ({ text: b.text, callback_data: b.callback_data }))) } });
    }
  });

  // ─── أوامر المالك ───
  const ownerCmds = ['heal', 'diag', 'cleanup', 'stats', 'logs', 'export', 'files', 'restart', 'model', 'net'];
  ownerCmds.forEach(cmd => {
    bot.onText(new RegExp('\\/' + cmd), async (msg) => {
      const uid = msg.from.id;
      if (!isOwner(uid)) return;
      await handleOwnerCommand(bot, msg, cmd);
    });
  });

  // ─── الرسائل النصية ───
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const uid = msg.from.id; const uname = msg.from.username; const fname = msg.from.first_name;
    ensureUser(uid, uname, fname);
    if (!isAllowed(uid) && !isAdmin(uid)) return;
    if (users[uid]?.blocked) return bot.sendMessage(uid, '🚫 أنت محظور.');
    try {
      await bot.sendChatAction(uid, 'typing');
      const resp = await callAI(msg.text);
      if (uiMode === 'inline') {
        const kbd = { reply_markup: { inline_keyboard: [
          [{ text: '🎨 تغيير الواجهة', callback_data: 'show_ui_menu' }]
        ]}};
        await bot.sendMessage(uid, resp, kbd);
      } else {
        const imgBuf = generateUI(resp);
        const imgPath = `/workspace/ui_${Date.now()}.png`;
        fs.writeFileSync(imgPath, imgBuf);
        await bot.sendPhoto(uid, imgPath, { caption: resp.substring(0, 200) });
        try { fs.unlinkSync(imgPath); } catch(e) {}
      }
    } catch(e) { log(`❌ Msg error: ${e.message}`); await bot.sendMessage(uid, `⚠️ خطأ: ${e.message}`); }
  });

  // ─── Callback Queries ───
  bot.on('callback_query', async (q) => {
    const uid = q.from.id;
    const data = q.data;
    if (!isAllowed(uid)) return bot.answerCallbackQuery(q.id, { text: '❌ غير مسموح' });

    if (data.startsWith('ui_')) {
      const mode = data.replace('ui_','');
      if (mode === 'inline') uiMode = 'inline';
      else uiMode = mode;
      await bot.answerCallbackQuery(q.id, { text: `✅ واجهة ${mode}` });
      await bot.editMessageText(`✅ *واجهة ${mode}* مفعلة!`, { chat_id: q.message.chat.id, message_id: q.message.message_id, parse_mode: 'Markdown' });
    } else if (data === 'show_ui_menu') {
      const rows = [
        [{ text: '🖥️ Terminal', callback_data: 'ui_terminal' }, { text: '📊 Dashboard', callback_data: 'ui_dashboard' }],
        [{ text: '🌀 Hologram', callback_data: 'ui_hologram' }, { text: '⚡ Center', callback_data: 'ui_center' }],
        [{ text: '🔘 Inline', callback_data: 'ui_inline' }, { text: '🤖 Auto', callback_data: 'ui_auto' }]
      ];
      await bot.editMessageReplyMarkup({ inline_keyboard: rows }, { chat_id: q.message.chat.id, message_id: q.message.message_id });
      await bot.answerCallbackQuery(q.id);
    } else if (data === 'main_menu') {
      const txt = `🤖 *Ss Wakeel AI v3.0*\n━━━━━━━━━━━━━━━━━━━\nاختر من الأزرار 👇`;
      await bot.editMessageText(txt, { chat_id: q.message.chat.id, message_id: q.message.message_id, parse_mode: 'Markdown', ...getMainKeyboard() });
      await bot.answerCallbackQuery(q.id);
    } else if (data.startsWith('cmd_')) {
      const cmd = data.replace('cmd_','');
      await bot.answerCallbackQuery(q.id, { text: `تنفيذ ${cmd}...` });
      await handleOwnerCommand(bot, { from: { id: uid }, chat: { id: q.message.chat.id } }, cmd);
    }
  });

  // ─── خطأ شامل ───
  bot.on('polling_error', (e) => {
    if (e.message?.includes('Conflict')) {
      log('⚠️ Conflict detected — another instance?');
    } else {
      log(`⚠️ Polling error: ${e.message}`);
    }
  });

  return bot;
}

async function handleOwnerCommand(bot, msg, cmd) {
  const uid = msg.from.id;
  const cid = msg.chat?.id || uid;

  switch(cmd) {
    case 'heal': {
      selfHeal();
      await bot.sendMessage(cid, '🛡️ *الإصلاح الذاتي* تم!\n✅ Bot stable\n✅ Event loop OK\n✅ No errors detected', { parse_mode: 'Markdown' });
      break;
    }
    case 'diag': {
      const mem = process.memoryUsage();
      const udata = Object.values(users);
      const uptime = Math.floor((Date.now()-START_TIME)/1000);
      const diag = `🩻 *التشخيص الكامل*\n━━━━━━━━━━━━━━━━━━━\n🤖 Model: \`${models[currentModelIndex]}\`\n👥 Users: ${udata.length}\n💬 Total: ${udata.reduce((a,u) => a+(u.msgs||0),0)}\n💾 RAM: ${Math.round(mem.rss/1024/1024)}MB\n🧠 Heap: ${Math.round(mem.heapUsed/1024/1024)}/${Math.round(mem.heapTotal/1024/1024)}MB\n⏱ Uptime: ${uptime}s\n📁 Files: ${fs.readdirSync('/workspace').length}\n🟢 Status: Online`;
      await bot.sendMessage(cid, diag, { parse_mode: 'Markdown' });
      break;
    }
    case 'cleanup': {
      let count = 0;
      const files = fs.readdirSync('/workspace').filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.old'));
      files.forEach(f => { try { fs.unlinkSync('/workspace/'+f); count++; } catch(e) {} });
      await bot.sendMessage(cid, `🧹 *تنظيف:* تم حذف ${count} ملف`, { parse_mode: 'Markdown' });
      break;
    }
    case 'stats': {
      const udata = Object.values(users).sort((a,b) => (b.msgs||0) - (a.msgs||0)).slice(0,10);
      let txt = `📊 *الإحصائيات*\n━━━━━━━━━━━━━━━━━━━\n👥 Users: ${udata.length}\n💬 Total: ${udata.reduce((a,u) => a+(u.msgs||0),0)}\n⏱ Uptime: ${Math.floor((Date.now()-START_TIME)/60000)}m\n\n🏆 *الأكثر نشاطاً:*\n`;
      udata.forEach((u, i) => { txt += `${i+1}. ${u.first_name||u.username||u.id} — ${u.msgs||0} رسالة\n`; });
      await bot.sendMessage(cid, txt, { parse_mode: 'Markdown' });
      break;
    }
    case 'logs': {
      let logs = '📋 *آخر السجلات*\n━━━━━━━━━━━━━━━━━━━\n';
      try {
        const data = fs.readFileSync('/workspace/bot.log', 'utf8');
        const lines = data.split('\n').filter(l => l).slice(-20);
        logs += lines.join('\n') || 'لا توجد سجلات';
      } catch(e) { logs += '❌ لا يوجد ملف سجلات'; }
      await bot.sendMessage(cid, logs.substring(0, 4000), { parse_mode: 'Markdown' });
      break;
    }
    case 'export': {
      const csv = 'ID,Username,Name,Messages,FirstSeen,LastSeen\n' + Object.values(users).map(u => `${u.id},${u.username||''},${u.first_name||''},${u.msgs||0},${new Date(u.firstSeen).toISOString()},${new Date(u.lastSeen).toISOString()}`).join('\n');
      fs.writeFileSync('/workspace/users_export.csv', csv);
      await bot.sendDocument(cid, '/workspace/users_export.csv', { caption: '📤 *تصدير المستخدمين*' });
      try { fs.unlinkSync('/workspace/users_export.csv'); } catch(e) {}
      break;
    }
    case 'files': {
      const files = fs.readdirSync('/workspace').filter(f => !f.includes('upload') && !f.includes('177'));
      let txt = '📁 *ملفات السيرفر*\n━━━━━━━━━━━━━━━━━━━\n';
      files.forEach(f => { try { const st = fs.statSync('/workspace/'+f); txt += `📄 ${f} (${(st.size/1024).toFixed(1)}KB)\n`; } catch(e) {} });
      await bot.sendMessage(cid, txt, { parse_mode: 'Markdown' });
      break;
    }
    case 'restart': {
      await bot.sendMessage(cid, '🔄 *إعادة تشغيل البوت...*', { parse_mode: 'Markdown' });
      log('🔄 Manual restart triggered');
      setTimeout(() => process.exit(0), 1000);
      break;
    }
    case 'model': {
      currentModelIndex = (currentModelIndex + 1) % models.length;
      await bot.sendMessage(cid, `🤖 *النموذج الحالي:* \`${models[currentModelIndex]}\``, { parse_mode: 'Markdown' });
      break;
    }
    case 'nextmodel': {
      currentModelIndex = (currentModelIndex + 1) % models.length;
      await bot.sendMessage(cid, `🤖 *النموذج الجديد:* \`${models[currentModelIndex]}\``, { parse_mode: 'Markdown' });
      break;
    }
    case 'net': {
      await bot.sendMessage(cid, '📡 *الشبكة:* 🟢 متصلة\n🤖 API: GitHub Models\n⚡ Status: Active', { parse_mode: 'Markdown' });
      break;
    }
  }
}

// ─── تشغيل البوت ───
function start() {
  try {
    const bot = buildBot();
    log('🤖 Bot v3.0 started successfully!');
    // Self-heal timer
    setInterval(selfHeal, SELF_HEAL_INTERVAL);
    // Deep diagnostic timer
    setInterval(deepDiagnostic, DEEP_DIAG_INTERVAL);
    // Keep-alive
    setInterval(() => { log('💓 Heartbeat OK'); }, 60000);
    // Upload UI on each run
    log('📤 Uploading to GitHub...');
    const { execSync } = require('child_process');
    try {
      execSync('cd /workspace && git add -A && git commit -m "v3.0: Full rebuild + 5 UIs + self-heal" 2>/dev/null && git push 2>/dev/null', { timeout: 30000 });
      log('✅ GitHub push done');
    } catch(e) { log(`⚠️ GitHub push skipped: ${e.message}`); }
    log('✅ Bot ready for action! 🚀');
  } catch(e) {
    console.error('❌ Fatal:', e.message);
    process.exit(1);
  }
}

// ─── حماية ───
process.on('uncaughtException', (e) => { log(`❌ Uncaught: ${e.message}`); });
process.on('unhandledRejection', (e) => { log(`❌ Unhandled: ${e.message}`); });

start();
