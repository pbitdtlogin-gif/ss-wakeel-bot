const TOKEN = process.env.BOT_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID || '8277131084');
const API_URL = 'https://models.inference.ai.azure.com/chat/completions';

const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const fs = require('fs');
const ui = require('./ui');
const selfHeal = require('./self_heal');

if (!TOKEN || !GITHUB_TOKEN) {
  console.error('❌ Missing BOT_TOKEN or GITHUB_TOKEN');
  process.exit(1);
}

const MODELS = [
  { id: 0, name: 'GPT-4o', model: 'gpt-4o', tier: 3 },
  { id: 1, name: 'DeepSeek-R1', model: 'DeepSeek-R1', tier: 3 },
  { id: 2, name: 'GPT-4o-mini', model: 'gpt-4o-mini', tier: 2 },
  { id: 3, name: 'Phi-4', model: 'Phi-4', tier: 2 },
  { id: 4, name: 'Llama-3.1-405B', model: 'Meta-Llama-3.1-405B-Instruct', tier: 2 },
  { id: 5, name: 'Llama-3.1-8B', model: 'Meta-Llama-3.1-8B-Instruct', tier: 1 },
  { id: 6, name: 'Mistral-large', model: 'Mistral-large-2407', tier: 2 },
  { id: 7, name: 'Cohere-command-r+', model: 'Cohere-command-r-plus-08-2024', tier: 2 },
  { id: 8, name: 'DeepSeek-V3', model: 'DeepSeek-V3-0324', tier: 3 },
  { id: 9, name: 'o3-mini', model: 'o3-mini', tier: 3 },
  { id: 10, name: 'o1', model: 'o1', tier: 3 },
  { id: 11, name: 'o1-mini', model: 'o1-mini', tier: 2 },
  { id: 12, name: 'Mistral-small', model: 'Mistral-small-2503', tier: 2 },
  { id: 13, name: 'Ministral-3B', model: 'Ministral-3B-2410', tier: 1 },
  { id: 14, name: 'Grok-3', model: 'grok-3', tier: 3 },
];

let activeModel = MODELS[0];
const users = {};
const userChats = {};
const userSettings = {};
const MAX_HISTORY = 30;
const startTime = Date.now();
let messageCount = 0;
let restartCount = 0;

try {
  const rc = fs.readFileSync('restart_count.txt', 'utf8').trim();
  restartCount = parseInt(rc) || 0;
} catch (e) {}

function saveRestartCount() {
  fs.writeFileSync('restart_count.txt', String(restartCount));
}

const bot = new TelegramBot(TOKEN, { polling: true });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync('bot.log', line);
  console.log(line.trim());
}

async function callAI(messages) {
  const body = { model: activeModel.model, messages, temperature: 0.7, max_tokens: 4096 };
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GITHUB_TOKEN}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

function registerUser(msg) {
  const uid = msg.from.id;
  if (!users[uid]) {
    users[uid] = { id: uid, username: msg.from.username || '', firstName: msg.from.first_name || '', lastName: msg.from.last_name || '', firstSeen: Date.now(), lastSeen: Date.now(), lastMessage: '', messagesCount: 0 };
    userSettings[uid] = { uiMode: 'auto', theme: 'dark' };
  }
  users[uid].lastSeen = Date.now();
  users[uid].lastMessage = msg.text || '(media)';
  users[uid].messagesCount = (users[uid].messagesCount || 0) + 1;
  if (msg.from.username) users[uid].username = msg.from.username;
}

function addChat(uid, role, content) {
  if (!userChats[uid]) userChats[uid] = [];
  userChats[uid].push({ role, content });
  if (userChats[uid].length > MAX_HISTORY) userChats[uid] = userChats[uid].slice(-MAX_HISTORY);
}

function getSystemPrompt(name) {
  return `You are Karkroot, a smart and loyal AI assistant for Telegram. You speak Arabic and English. You are always helpful, concise, and fast. Answer user questions directly without fluff. The user's name is ${name || 'Unknown'}. Current time: ${new Date().toISOString()}`;
}

async function safeReply(chatId, text, opts = {}) {
  try {
    const maxLen = 4000;
    if (text.length > maxLen) {
      for (let i = 0; i < text.length; i += maxLen)
        await bot.sendMessage(chatId, text.substring(i, i + maxLen), { ...opts, parse_mode: 'Markdown' });
    } else await bot.sendMessage(chatId, text, { ...opts, parse_mode: 'Markdown' });
  } catch (e) {
    try { await bot.sendMessage(chatId, text.replace(/[*_`]/g, ''), opts); } catch (e2) {}
  }
}

async function sendUIGreeting(chatId, msg) {
  const us = userSettings[msg.from.id] || { uiMode: 'auto' };
  const response = `🤖 *مرحباً! أنا Karkroot* 🚀\n\n🧠 النشط: *${activeModel.name}*\n🎨 الواجهة: *${us.uiMode === 'auto' ? 'ذكية (تلقائية)' : us.uiMode}*\n\n📋 5 سيناريوهات UI ذكية:\n1️⃣ Terminal AI — واجهة الطرفية\n2️⃣ Dashboard — لوحة المعلومات\n3️⃣ Hologram — الهولوجرام\n4️⃣ Command Center — مركز القيادة\n5️⃣ Inline Mode — الأزرار الذكية\n\n🔄 البوت يختار الأنسب تلقائياً!\n🛡️ بروتوكول الإصلاح الذاتي نشط 🟢\n\n📌 /help للمساعدة`;
  try {
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
      [{ text: '💬 اسألني', callback_data: 'chat' }, { text: '🎨 Terminal', callback_data: 'ui_terminal' }],
      [{ text: '📊 Dashboard', callback_data: 'ui_dashboard' }, { text: '🌀 Hologram', callback_data: 'ui_hologram' }],
      [{ text: '⚡ Command Center', callback_data: 'ui_center' }, { text: '🔄 تلقائي', callback_data: 'ui_auto' }],
    ]}});
  } catch (e) { await safeReply(chatId, response); }
}

async function sendUIResponse(chatId, response, modelName, userName, stats, forceMode) {
  const mode = forceMode || 'auto';
  try {
    await bot.sendChatAction(chatId, 'upload_photo');
    let buffer;
    const caption = response.length > 900 ? response.slice(0, 900) + '…' : response;
    switch (mode) {
      case 'terminal': buffer = ui.renderTerminal(response, modelName, userName); break;
      case 'dashboard': buffer = ui.renderDashboard(response, modelName, userName, stats); break;
      case 'hologram': buffer = ui.renderHologram(response, modelName, userName); break;
      case 'center': buffer = ui.renderCommandCenter(response, modelName, userName, stats); break;
      default: buffer = ui.selectScenario(response, modelName, userName, stats).buffer; break;
    }
    const imgPath = `/tmp/ui_${chatId}_${Date.now()}.png`;
    fs.writeFileSync(imgPath, buffer);
    await bot.sendPhoto(chatId, imgPath, {
      caption: `<b>🧠 ${modelName}</b>\n\n${caption.replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 900)}`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '💬 رد نصي', callback_data: 'text_reply' }, { text: '🎨 غير الواجهة', callback_data: 'change_ui' }]] }
    });
    try { fs.unlinkSync(imgPath); } catch(e) {}
  } catch (e) {
    log(`UI render failed: ${e.message}`);
    await safeReply(chatId, response);
  }
}

// Callbacks
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const uid = query.from.id;
  const data = query.data;
  try {
    await bot.answerCallbackQuery(query.id);
    if (data.startsWith('ui_')) {
      userSettings[uid] = userSettings[uid] || {};
      userSettings[uid].uiMode = data.replace('ui_', '');
      await safeReply(chatId, `✅ الواجهة: *${userSettings[uid].uiMode === 'auto' ? 'تلقائية' : userSettings[uid].uiMode}*`);
    }
    if (data === 'change_ui') {
      await bot.sendMessage(chatId, '🎨 *اختر واجهة:*', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
        [{ text: '🔄 تلقائي', callback_data: 'ui_auto' }, { text: '💻 Terminal', callback_data: 'ui_terminal' }],
        [{ text: '📊 Dashboard', callback_data: 'ui_dashboard' }, { text: '🌀 Hologram', callback_data: 'ui_hologram' }],
        [{ text: '⚡ Command Center', callback_data: 'ui_center' }],
      ]}});
    }
    if (data === 'chat') await safeReply(chatId, '💬 أرسل لي سؤالك!');
    try { await bot.deleteMessage(chatId, query.message.message_id); } catch(e) {}
  } catch (e) { log(`Callback error: ${e.message}`); }
});

// Owner commands text
const OWNER_CMDS = `🔐 *لوحة تحكم المطور — SS WAKEEL v2.0* 🚀

📊 *الإدارة*
• /status — حالة البوت الكاملة
• /restart — إعادة تشغيل
• /uptime — مدة التشغيل
• /pid — رقم العملية

🧠 *النماذج*
• /models — عرض النماذج
• /active — النموذج النشط
• /setmodel <رقم> — تغيير النموذج
• /testmodel <رقم> — اختبار
• /swap — تدوير تلقائي

👥 *المستخدمين*
• /users — قائمة المستخدمين
• /uid <اسم> — البحث
• /reply <id> <رسالة> — الرد
• /send <id> <رسالة> — إرسال
• /broadcast <رسالة> — بث
• /export — تصدير CSV

🎨 *واجهات UI*
• /ui — اختيار واجهة
• /ui_terminal | /ui_dashboard | /ui_hologram | /ui_center | /ui_inline | /ui_auto

🛡️ *الإصلاح الذاتي*
• /heal — فحص وإصلاح فوري
• /diag — تقرير تشخيص كامل
• /cleanup — تنظيف مؤقت
• /logs — آخر السجلات
• /clearlogs — مسح

⚙️ /say <رسالة> | /reset | /stats

🔒 *مخصص للمالك فقط*`;

// Main handler
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const uid = msg.from.id;
    const text = (msg.text || '').trim();
    const isOwner = uid === OWNER_ID;
    const isPrivate = msg.chat.type === 'private';

    if (!isOwner || !isPrivate) registerUser(msg);
    messageCount++;

    if (isOwner && isPrivate) {
      if (text === '/owner' || text === '/dev') return await safeReply(chatId, OWNER_CMDS);

      // Self-heal
      if (text === '/heal') {
        await safeReply(chatId, '🛡️ *بدء الإصلاح الذاتي...*');
        const result = await selfHeal.autoRepair();
        return await safeReply(chatId, result.success ? `✅ *تم الإصلاح* → ${result.model} 🚀` : '❌ فشل الإصلاح');
      }
      if (text === '/diag') return await safeReply(chatId, await selfHeal.getFullReport());
      if (text === '/cleanup') {
        let cleaned = 0;
        try {
          const files = fs.readdirSync('/tmp').filter(f => f.startsWith('ui_'));
          files.forEach(f => { try { fs.unlinkSync(`/tmp/${f}`); cleaned++; } catch(e) {} });
          const logs = fs.readdirSync('.').filter(f => f.startsWith('bot_') || f.startsWith('heal_'));
          logs.sort().slice(0, -3).forEach(f => { try { fs.unlinkSync(f); cleaned++; } catch(e) {} });
        } catch(e) {}
        return await safeReply(chatId, `🧹 *تنظيف:* حذف ${cleaned} ملف`);
      }

      // UI
      if (text === '/ui') {
        return await bot.sendMessage(chatId, '🎨 *اختر واجهة البوت:*', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
          [{ text: '🔄 تلقائي (ذكي)', callback_data: 'ui_auto' }, { text: '💻 Terminal AI', callback_data: 'ui_terminal' }],
          [{ text: '📊 Dashboard', callback_data: 'ui_dashboard' }, { text: '🌀 Hologram', callback_data: 'ui_hologram' }],
          [{ text: '⚡ Command Center', callback_data: 'ui_center' }, { text: '🔘 Inline', callback_data: 'ui_inline' }],
        ]}});
      }
      for (const m of ['terminal', 'dashboard', 'hologram', 'center', 'inline', 'auto']) {
        if (text === `/ui_${m}`) {
          userSettings[uid] = userSettings[uid] || {};
          userSettings[uid].uiMode = m;
          return await safeReply(chatId, `✅ واجهة *${m}* مفعلة!`);
        }
      }

      if (text === '/status') {
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = uptime % 60;
        const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        return await safeReply(chatId, `📊 *حالة البوت*\n\n🤖 *@Ss_Wakeel_bot*\n• 🟢 شغال\n• PID: \`${process.pid}\`\n• وقت: ${h}h ${m}m ${s}s\n• إعادة: #${restartCount}\n• رسائل: ${messageCount}\n• مستخدمين: ${Object.keys(users).length}\n\n🧠 *${activeModel.name}* ⭐\n🎨 واجهة: *${userSettings[uid]?.uiMode || 'auto'}*\n💾 ذاكرة: ${mem} MB\n🛡️ Heal: ${selfHeal.consecutiveFails === 0 ? '🟢' : '🔴'}`);
      }
      if (text === '/uptime') {
        const t = Math.floor((Date.now() - startTime) / 1000);
        return await safeReply(chatId, `🕐 *مدة التشغيل:* ${Math.floor(t/3600)}h ${Math.floor((t%3600)/60)}m ${t%60}s\n🔄 إعادة: #${restartCount}\n📊 رسائل: ${messageCount}`);
      }
      if (text === '/pid') return await safeReply(chatId, `📌 *PID:* \`${process.pid}\``);
      if (text === '/stats') {
        const t = Math.floor((Date.now() - startTime) / 1000);
        const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        const topUsers = Object.values(users).sort((a,b) => (b.messagesCount||0) - (a.messagesCount||0)).slice(0, 5);
        return await safeReply(chatId, `📊 *إحصائيات*\n\n⏱ ${Math.floor(t/3600)}h ${Math.floor((t%3600)/60)}m ${t%60}s\n🔄 إعادة: #${restartCount}\n💬 رسائل: ${messageCount}\n👥 مستخدمين: ${Object.keys(users).length}\n🧠 ${activeModel.name}\n💾 ${mem} MB\n\n🏆 *الأكثر نشاطاً:*\n${topUsers.map(u => `• ${u.firstName}: ${u.messagesCount||0}`).join('\n') || '(لا يوجد)'}`);
      }
      if (text === '/export') {
        const list = Object.values(users);
        if (!list.length) return await safeReply(chatId, '📭 ولا مستخدم');
        let csv = 'ID,Username,FirstName,LastName,FirstSeen,LastSeen,Messages,LastMessage\n';
        list.forEach(u => { csv += `${u.id},${u.username||''},${u.firstName||''},${u.lastName||''},${new Date(u.firstSeen).toISOString()},${new Date(u.lastSeen).toISOString()},${u.messagesCount||0},${(u.lastMessage||'').replace(/,/g,' ')}\n`; });
        fs.writeFileSync('/tmp/users_export.csv', csv);
        try { await bot.sendDocument(chatId, '/tmp/users_export.csv', { caption: '📋 بيانات المستخدمين' }); } catch(e) { await safeReply(chatId, `📋 ${list.length} مستخدم`); }
        return;
      }
      if (text === '/models') {
        return await safeReply(chatId, '🧠 *النماذج*\n\n' + MODELS.map(m => `${m.id}. ${m.name} ${'🔥'.repeat(m.tier)}${m.id === activeModel.id ? ' ⭐' : ''}`).join('\n'));
      }
      if (text === '/active') return await safeReply(chatId, `⭐ *النشط:* ${activeModel.name}\n📌 \`${activeModel.model}\``);
      if (text.startsWith('/setmodel ')) {
        const m = MODELS.find(x => x.id === parseInt(text.split(' ')[1]));
        if (!m) return await safeReply(chatId, '❌ رقم خطأ');
        activeModel = m; log(`Model changed to ${m.name}`);
        return await safeReply(chatId, `✅ *${m.name}* ⭐`);
      }
      if (text.startsWith('/testmodel ')) {
        const m = MODELS.find(x => x.id === parseInt(text.split(' ')[1]));
        if (!m) return await safeReply(chatId, '❌ رقم خطأ');
        const prev = activeModel; activeModel = m;
        try { const t0 = Date.now(); const r = await callAI([{role:'system',content:'OK'},{role:'user',content:'test'}]); await safeReply(chatId, `✅ *${m.name}* — ${Date.now()-t0}ms\n\`${r}\``); } catch (e) { await safeReply(chatId, `❌ *${m.name}*: ${e.message.slice(0,100)}`); }
        activeModel = prev; return;
      }
      if (text === '/swap') {
        await safeReply(chatId, '🔄 جاري البحث...');
        for (const m of MODELS) {
          if (m.id === activeModel.id) continue;
          try { activeModel = m; await callAI([{role:'system',content:'OK'},{role:'user',content:'t'}]); log(`Auto-switched to ${m.name}`); return await safeReply(chatId, `✅ *${m.name}* 🚀`); } catch (e) {}
        }
        return await safeReply(chatId, '❌ ما لقيت بديل');
      }
      if (text === '/users') {
        const list = Object.values(users);
        if (!list.length) return await safeReply(chatId, '👥 ولا مستخدم');
        return await safeReply(chatId, `👥 *${list.length} مستخدم*\n\n` + list.map((u,i) => `${i+1}. ${u.firstName}${u.lastName?' '+u.lastName:''} ${u.username?'@'+u.username:''}\n   \`${u.id}\` | ${u.messagesCount||0} رسالة`).join('\n'));
      }
      if (text.startsWith('/uid ')) {
        const q = text.slice(5).toLowerCase();
        const f = Object.values(users).filter(u => u.firstName.toLowerCase().includes(q) || (u.username||'').toLowerCase().includes(q) || String(u.id).includes(q));
        if (!f.length) return await safeReply(chatId, '❌ ما لقيت');
        return await safeReply(chatId, '🔍 ' + f.map(u => `• ${u.firstName} (@${u.username||'—'}) — \`${u.id}\` — ${u.messagesCount||0} رسالة`).join('\n'));
      }
      if (text.startsWith('/reply ')) {
        const p = text.split(' '), id = parseInt(p[1]), rt = p.slice(2).join(' ');
        if (!id || !rt) return await safeReply(chatId, '❌ /reply <id> <رسالة>');
        try { await bot.sendMessage(id, `📨 *من المطور:*\n\n${rt}`, {parse_mode:'Markdown'}); log(`Replied to ${id}`); await safeReply(chatId, `✅ \`${id}\``); } catch (e) { await safeReply(chatId, `❌ ${e.message.slice(0,100)}`); }
        return;
      }
      if (text.startsWith('/send ')) {
        const p = text.split(' '), id = parseInt(p[1]), st = p.slice(2).join(' ');
        if (!id || !st) return await safeReply(chatId, '❌ /send <id> <رسالة>');
        try { await bot.sendMessage(id, st); await safeReply(chatId, `✅ \`${id}\``); } catch (e) { await safeReply(chatId, `❌ ${e.message.slice(0,100)}`); }
        return;
      }
      if (text.startsWith('/broadcast ')) {
        const bc = text.slice(11); const ids = Object.keys(users);
        let ok = 0, no = 0; await safeReply(chatId, `📢 بث لـ ${ids.length}...`);
        for (const id of ids) { try { await bot.sendMessage(parseInt(id), `📢 *إعلان:*\n\n${bc}`, {parse_mode:'Markdown'}); ok++; } catch (e) { no++; } }
        return await safeReply(chatId, `✅ تم: ${ok} | فشل: ${no}`);
      }
      if (text === '/logs') {
        try { const l = fs.readFileSync('bot.log','utf8').split('\n').slice(-20).join('\n'); await safeReply(chatId, `📋 *آخر السجلات:*\n\`\`\`\n${l||'(فارغ)'}\n\`\`\``); } catch (e) { await safeReply(chatId, '📋 السجل فارغ'); }
        return;
      }
      if (text === '/clearlogs') { fs.writeFileSync('bot.log',''); fs.writeFileSync('heal.log',''); return await safeReply(chatId, '✅ مسح'); }
      if (text === '/restart') { await safeReply(chatId, '🔄 ...'); setTimeout(() => process.exit(0), 500); return; }
      if (text === '/reset') { Object.keys(users).forEach(k=>delete users[k]); Object.keys(userChats).forEach(k=>delete userChats[k]); messageCount=0; return await safeReply(chatId, '✅ *إعادة ضبط*'); }
      if (text.startsWith('/say ')) return await safeReply(chatId, `💬 ${text.slice(5)}`);
    }

    // User commands
    if (text === '/start') return await sendUIGreeting(chatId, msg);
    if (text === '/help') return await safeReply(chatId, `❓ *مساعدة*\n\n🧠 النموذج: *${activeModel.name}*\n📬 /admin <رسالة> — تواصل مع المطور\n🔄 /new — بدء محادثة جديدة\n🎨 5 واجهات UI ذكية!\n🛡️ نظام الإصلاح الذاتي نشط\n💡 فقط اسألني!`);
    if (text === '/models') return await safeReply(chatId, '🧠 *النماذج*\n\n' + MODELS.map(m => `${m.id}. ${m.name} ${'🔥'.repeat(m.tier)}${m.id === activeModel.id?' ⭐':''}`).join('\n') + `\n\n📌 النشط: *${activeModel.name}*`);
    if (text === '/active') return await safeReply(chatId, `⭐ *${activeModel.name}*`);
    if (text === '/new') { userChats[uid] = []; return await safeReply(chatId, '🔄 *محادثة جديدة* ✅'); }
    if (text.startsWith('/admin ')) {
      const m = text.slice(7);
      try { await bot.sendMessage(OWNER_ID, `📬 *من مستخدم:* ${msg.from.first_name||''} ${msg.from.username?'@'+msg.from.username:''}\n🆔 \`${uid}\`\n💬 ${m}\n\n📌 /reply ${uid} ...`); await safeReply(chatId, '✅ *أرسلت للمطور!*'); } catch (e) { await safeReply(chatId, '❌ فشل الإرسال'); }
      return;
    }

    // AI response
    if (text && !text.startsWith('/')) {
      await bot.sendChatAction(chatId, 'typing');
      addChat(uid, 'user', text);
      const name = msg.from.first_name || 'مستخدم';
      const ctx = [{ role: 'system', content: getSystemPrompt(name) }, ...(userChats[uid] || [])];
      try {
        const reply = await callAI(ctx);
        addChat(uid, 'assistant', reply);
        const us = userSettings[uid] || { uiMode: 'auto' };
        if (us.uiMode === 'inline' || (us.uiMode === 'auto' && reply.length < 80 && !reply.includes('```'))) {
          await safeReply(chatId, reply);
        } else {
          const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
          await sendUIResponse(chatId, reply, activeModel.name, name, { users: Object.keys(users).length, messages: messageCount, memory: mem }, us.uiMode === 'auto' ? null : us.uiMode);
        }
      } catch (e) {
        log(`AI error: ${e.message}`);
        let ok = false;
        for (const m of MODELS) {
          if (m.id === activeModel.id) continue;
          const prev = activeModel; activeModel = m;
          try { const r = await callAI(ctx); addChat(uid,'assistant',r); await safeReply(chatId, `⚠️ حولت لـ *${m.name}*\n\n${r}`); ok = true; selfHeal.consecutiveFails=0; log(`Fallback to ${m.name} OK`); break; } catch (e2) { activeModel = prev; }
        }
        if (!ok) {
          selfHeal.consecutiveFails++;
          await safeReply(chatId, `❌ خطأ: ${e.message.slice(0,80)}\nجرب /new`);
          if (selfHeal.consecutiveFails >= 3) { log('Auto-triggering self-heal'); selfHeal.autoRepair().catch(()=>{}); }
        }
      }
    }
  } catch (err) { log(`ERROR: ${err.message}\n${err.stack}`); }
});

// Process handlers
process.on('uncaughtException', (err) => { log(`UNCAUGHT: ${err.message}\n${err.stack}`); setTimeout(() => process.exit(1), 1000); });
process.on('unhandledRejection', (err) => { log(`UNHANDLED: ${err.message}`); });

log(`✅ Bot PID: ${process.pid} | Model: ${activeModel.name} | Owner: ${OWNER_ID}`);

// Init self-healing
selfHeal.init(bot, OWNER_ID, { activeModel, MODELS, users, userChats, messageCount, startTime, restartCount, callAI });

// Bot commands
bot.setMyCommands([
  { command: 'start', description: '🤖 بدء المحادثة' },
  { command: 'help', description: '❓ المساعدة' },
  { command: 'models', description: '🧠 النماذج' },
  { command: 'active', description: '⭐ النموذج النشط' },
  { command: 'new', description: '🔄 محادثة جديدة' },
  { command: 'admin', description: '📬 مراسلة المطور' },
]).catch(() => {});

bot.sendMessage(OWNER_ID, `🚀 *البوت شغال!*\n🧠 ${activeModel.name}\n🔄 #${restartCount}\n🎨 5 واجهات UI\n🛡️ بروتوكول الإصلاح الذاتي 🟢\n📌 PID: \`${process.pid}\``, { parse_mode: 'Markdown' }).catch(() => {});

restartCount++;
saveRestartCount();