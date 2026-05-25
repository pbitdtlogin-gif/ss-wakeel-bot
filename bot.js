const TOKEN = process.env.BOT_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID || '8277131084');
const API_URL = 'https://models.inference.ai.azure.com/chat/completions';

const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');

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
const MAX_HISTORY = 20;
const startTime = Date.now();
let messageCount = 0;
let restartCount = 0;
const fs = require('fs');
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
  const body = { model: activeModel.model, messages, temperature: 0.7, max_tokens: 2048 };
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GITHUB_TOKEN}` },
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
    users[uid] = {
      id: uid, username: msg.from.username || '',
      firstName: msg.from.first_name || '', lastName: msg.from.last_name || '',
      firstSeen: Date.now(), lastSeen: Date.now(), lastMessage: '',
    };
  }
  users[uid].lastSeen = Date.now();
  users[uid].lastMessage = msg.text || '(media)';
  if (msg.from.username) users[uid].username = msg.from.username;
}

function addChat(uid, role, content) {
  if (!userChats[uid]) userChats[uid] = [];
  userChats[uid].push({ role, content });
  if (userChats[uid].length > MAX_HISTORY) {
    userChats[uid] = userChats[uid].slice(-MAX_HISTORY);
  }
}

function getSystemPrompt(name) {
  return `You are Karkroot, a smart and loyal AI assistant for Telegram. You speak Arabic and English. You are always helpful, concise, and fast. Answer the user's questions directly without fluff. The user's name is ${name || 'Unknown'}.`;
}

async function safeReply(chatId, text, opts = {}) {
  try {
    const maxLen = 4000;
    if (text.length > maxLen) {
      for (let i = 0; i < text.length; i += maxLen) {
        await bot.sendMessage(chatId, text.substring(i, i + maxLen), { ...opts, parse_mode: 'Markdown' });
      }
    } else {
      await bot.sendMessage(chatId, text, { ...opts, parse_mode: 'Markdown' });
    }
  } catch (e) {
    try {
      await bot.sendMessage(chatId, text.replace(/[*_`]/g, ''), opts);
    } catch (e2) {}
  }
}

const OWNER_CMDS = [
  '🔐 *لوحة تحكم المطور — Karkroot*\n',
  '📊 *الإدارة*',
  '• /status — حالة البوت الكاملة',
  '• /restart — إعادة تشغيل البوت',
  '• /uptime — مدة التشغيل',
  '• /pid — رقم العملية',
  '',
  '🧠 *النماذج*',
  '• /models — عرض النماذج المتاحة',
  '• /active — النموذج النشط حالياً',
  '• /setmodel <رقم> — تغيير النموذج',
  '• /testmodel <رقم> — اختبار نموذج',
  '• /swap — تدوير تلقائي بين النماذج',
  '',
  '👥 *المستخدمين*',
  '• /users — قائمة المستخدمين',
  '• /uid <اسم> — البحث عن مستخدم',
  '• /reply <id> <رسالة> — الرد على مستخدم',
  '• /send <id> <رسالة> — إرسال مباشر',
  '• /broadcast <رسالة> — بث للجميع',
  '',
  '⚙️ *متقدم*',
  '• /logs — آخر 20 سطر سجل',
  '• /clearlogs — مسح السجل',
  '• /say <رسالة> — البوت يتكلم نيابة عنك',
  '• /reset — إعادة ضبط البوت (مسح كل البيانات)',
  '• /stats — إحصائيات البوت',
  '• /export — تصدير بيانات المستخدمين',
  '',
  '🔒 *هذه الأوامر مخصصة للمالك فقط*',
].join('\n');

bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const uid = msg.from.id;
    const text = (msg.text || '').trim();
    const isOwner = uid === OWNER_ID;
    const isPrivate = msg.chat.type === 'private';

    if (!isOwner || !isPrivate) registerUser(msg);
    messageCount++;

    // ===== OWNER COMMANDS =====
    if (isOwner && isPrivate) {
      if (text === '/owner' || text === '/dev') return await safeReply(chatId, OWNER_CMDS);

      if (text === '/status') {
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = uptime % 60;
        const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        return await safeReply(chatId,
          `📊 *حالة البوت*\n\n🤖 *@Ss_Wakeel_bot*\n• 🟢 شغال\n• PID: \`${process.pid}\`\n• وقت: ${h}h ${m}m ${s}s\n• إعادة: #${restartCount}\n• رسائل: ${messageCount}\n• مستخدمين: ${Object.keys(users).length}\n\n🧠 *${activeModel.name}* ⭐\n💾 ذاكرة: ${mem} MB\n📌 الموديل: \`${activeModel.model}\``);
      }

      if (text === '/uptime') {
        const t = Math.floor((Date.now() - startTime) / 1000);
        const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
        return await safeReply(chatId, `🕐 *مدة التشغيل:* ${h}h ${m}m ${s}s\n🔄 *إعادة:* #${restartCount}\n📊 *رسائل:* ${messageCount}`);
      }

      if (text === '/pid') return await safeReply(chatId, `📌 *PID:* \`${process.pid}\``);

      if (text === '/stats') {
        const t = Math.floor((Date.now() - startTime) / 1000);
        const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
        const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        return await safeReply(chatId,
          `📊 *إحصائيات البوت*\n\n⏱ التشغيل: ${h}h ${m}m ${s}s\n🔄 إعادة تشغيل: #${restartCount}\n💬 رسائل: ${messageCount}\n👥 مستخدمين: ${Object.keys(users).length}\n🧠 النموذج: ${activeModel.name}\n💾 الذاكرة: ${mem} MB\n📌 PID: \`${process.pid}\``);
      }

      if (text === '/export') {
        const list = Object.values(users);
        if (!list.length) return await safeReply(chatId, '📭 ولا مستخدم للتصدير');
        let csv = 'ID,Username,FirstName,LastName,FirstSeen,LastSeen,LastMessage\n';
        list.forEach(u => {
          csv += `${u.id},${u.username||''},${u.firstName||''},${u.lastName||''},${new Date(u.firstSeen).toISOString()},${new Date(u.lastSeen).toISOString()},${(u.lastMessage||'').replace(/,/g,' ')}\n`;
        });
        const fPath = '/tmp/users_export.csv';
        fs.writeFileSync(fPath, csv);
        try { await bot.sendDocument(chatId, fPath, { caption: '📋 بيانات المستخدمين' }); } catch(e) { await safeReply(chatId, `📋 ${list.length} مستخدم`); }
        return;
      }

      if (text === '/models') {
        let list = '🧠 *النماذج*\n\n';
        MODELS.forEach(m => {
          list += `${m.id}. ${m.name} ${'🔥'.repeat(m.tier)}${m.id === activeModel.id ? ' ⭐' : ''}\n`;
        });
        return await safeReply(chatId, list);
      }

      if (text === '/active') return await safeReply(chatId, `⭐ *النشط:* ${activeModel.name}\n📌 \`${activeModel.model}\``);

      if (text.startsWith('/setmodel ')) {
        const num = parseInt(text.split(' ')[1]);
        const m = MODELS.find(x => x.id === num);
        if (!m) return await safeReply(chatId, '❌ رقم خطأ');
        activeModel = m;
        log(`Model changed to ${m.name}`);
        return await safeReply(chatId, `✅ *${m.name}* ⭐`);
      }

      if (text.startsWith('/testmodel ')) {
        const num = parseInt(text.split(' ')[1]);
        const m = MODELS.find(x => x.id === num);
        if (!m) return await safeReply(chatId, '❌ رقم خطأ');
        const prev = activeModel;
        activeModel = m;
        const t0 = Date.now();
        try {
          const r = await callAI([{ role: 'system', content: 'Reply OK' }, { role: 'user', content: 'test' }]);
          await safeReply(chatId, `✅ *${m.name}* — ${Date.now() - t0}ms\n\`${r}\``);
        } catch (e) { await safeReply(chatId, `❌ *${m.name}*: ${e.message.slice(0, 100)}`); }
        activeModel = prev;
        return;
      }

      if (text === '/swap') {
        await safeReply(chatId, '🔄 جاري البحث...');
        for (const m of MODELS) {
          if (m.id === activeModel.id) continue;
          try {
            activeModel = m;
            await callAI([{ role: 'system', content: 'OK' }, { role: 'user', content: 't' }]);
            log(`Auto-switched to ${m.name}`);
            return await safeReply(chatId, `✅ *${m.name}* 🚀`);
          } catch (e) {}
        }
        return await safeReply(chatId, '❌ ما لقيت بديل');
      }

      if (text === '/users') {
        const list = Object.values(users);
        if (!list.length) return await safeReply(chatId, '👥 ولا مستخدم');
        let out = `👥 *${list.length} مستخدم*\n\n`;
        list.forEach((u, i) => {
          out += `${i + 1}. ${u.firstName}${u.lastName ? ' ' + u.lastName : ''} ${u.username ? '@' + u.username : ''}\n   \`${u.id}\`\n`;
        });
        return await safeReply(chatId, out);
      }

      if (text.startsWith('/uid ')) {
        const q = text.slice(5).toLowerCase();
        const f = Object.values(users).filter(u =>
          u.firstName.toLowerCase().includes(q) ||
          (u.username || '').toLowerCase().includes(q) ||
          String(u.id).includes(q)
        );
        if (!f.length) return await safeReply(chatId, '❌ ما لقيت');
        return await safeReply(chatId, '🔍 ' + f.map(u => `• ${u.firstName} (@${u.username || '—'}) — \`${u.id}\``).join('\n'));
      }

      if (text.startsWith('/reply ')) {
        const p = text.split(' '), id = parseInt(p[1]), rt = p.slice(2).join(' ');
        if (!id || !rt) return await safeReply(chatId, '❌ /reply <id> <رسالة>');
        try {
          await bot.sendMessage(id, `📨 *من المطور:*\n\n${rt}`, { parse_mode: 'Markdown' });
          log(`Replied to user ${id}: ${rt.slice(0, 50)}`);
          await safeReply(chatId, `✅ أرسلت لـ \`${id}\``);
        } catch (e) { await safeReply(chatId, `❌ ${e.message.slice(0, 100)}`); }
        return;
      }

      if (text.startsWith('/send ')) {
        const p = text.split(' '), id = parseInt(p[1]), st = p.slice(2).join(' ');
        if (!id || !st) return await safeReply(chatId, '❌ /send <id> <رسالة>');
        try { await bot.sendMessage(id, st); await safeReply(chatId, `✅ لـ \`${id}\``); } catch (e) { await safeReply(chatId, `❌ ${e.message.slice(0, 100)}`); }
        return;
      }

      if (text.startsWith('/broadcast ')) {
        const bc = text.slice(11);
        const ids = Object.keys(users);
        let ok = 0, no = 0;
        await safeReply(chatId, `📢 بث لـ ${ids.length}...`);
        for (const id of ids) {
          try { await bot.sendMessage(parseInt(id), `📢 *إعلان:*\n\n${bc}`, { parse_mode: 'Markdown' }); ok++; } catch (e) { no++; }
        }
        return await safeReply(chatId, `✅ تم: ${ok} | فشل: ${no}`);
      }

      if (text === '/logs') {
        try {
          const l = fs.readFileSync('bot.log', 'utf8').split('\n').slice(-20).join('\n');
          await safeReply(chatId, `📋 *آخر السجلات:*\n\`\`\`\n${l || '(فارغ)'}\n\`\`\``);
        } catch (e) { await safeReply(chatId, '📋 السجل فارغ'); }
        return;
      }

      if (text === '/clearlogs') { fs.writeFileSync('bot.log', ''); return await safeReply(chatId, '✅ مسح'); }

      if (text === '/restart') { await safeReply(chatId, '🔄 ...'); setTimeout(() => process.exit(0), 500); return; }

      if (text === '/reset') {
        Object.keys(users).forEach(k => delete users[k]);
        Object.keys(userChats).forEach(k => delete userChats[k]);
        messageCount = 0;
        return await safeReply(chatId, '✅ *إعادة ضبط* — كل البيانات مسحت');
      }

      if (text.startsWith('/say ')) return await safeReply(chatId, `💬 ${text.slice(5)}`);
    }

    // ===== USER COMMANDS =====
    if (text === '/start') {
      return await safeReply(chatId,
        `🤖 *مرحباً! أنا Karkroot*\n\nأقوى بوت ذكاء اصطناعي على تيليجرام 🧠\nالنشط: *${activeModel.name}*\n\n*الأوامر:*\n/help — مساعدة\n/models — النماذج\n/active — النموذج النشط\n/new — محادثة جديدة\n/admin — مراسلة المطور\n\nأرسل لي أي سؤال! 🚀`);
    }

    if (text === '/help') {
      return await safeReply(chatId,
        `❓ *مساعدة*\n\n🧠 النموذج: *${activeModel.name}*\n📬 /admin <رسالة> — تواصل مع المطور\n🔄 /new — بدء محادثة جديدة\n💡 فقط اسألني!`);
    }

    if (text === '/models') {
      let list = '🧠 *النماذج*\n\n';
      MODELS.forEach(m => { list += `${m.id}. ${m.name} ${'🔥'.repeat(m.tier)}${m.id === activeModel.id ? ' ⭐' : ''}\n`; });
      list += `\n📌 النشط: *${activeModel.name}*`;
      return await safeReply(chatId, list);
    }

    if (text === '/active') return await safeReply(chatId, `⭐ *${activeModel.name}*`);

    if (text === '/new') { userChats[uid] = []; return await safeReply(chatId, '🔄 *محادثة جديدة* ✅'); }

    if (text.startsWith('/admin ')) {
      const m = text.slice(7);
      try {
        await bot.sendMessage(OWNER_ID, `📬 *من مستخدم:* ${msg.from.first_name || ''} ${msg.from.username ? '@' + msg.from.username : ''}\n🆔 \`${uid}\`\n💬 ${m}\n\n📌 /reply ${uid} ...`);
        await safeReply(chatId, '✅ *أرسلت للمطور!*');
      } catch (e) { await safeReply(chatId, '❌ فشل الإرسال'); }
      return;
    }

    // ===== AI RESPONSE =====
    if (text && !text.startsWith('/')) {
      await bot.sendChatAction(chatId, 'typing');
      addChat(uid, 'user', text);
      const name = msg.from.first_name || 'مستخدم';
      const ctx = [
        { role: 'system', content: getSystemPrompt(name) },
        ...(userChats[uid] || []),
      ];
      try {
        const reply = await callAI(ctx);
        addChat(uid, 'assistant', reply);
        await safeReply(chatId, reply);
      } catch (e) {
        log(`AI error: ${e.message}`);
        let ok = false;
        for (const m of MODELS) {
          if (m.id === activeModel.id) continue;
          const prev = activeModel;
          activeModel = m;
          try {
            const r = await callAI(ctx);
            addChat(uid, 'assistant', r);
            await safeReply(chatId, `⚠️ حولت لـ *${m.name}*\n\n${r}`);
            ok = true;
            log(`Fallback to ${m.name} OK`);
            break;
          } catch (e2) { activeModel = prev; }
        }
        if (!ok) await safeReply(chatId, `❌ خطأ: ${e.message.slice(0, 80)}\nجرب /new`);
      }
    }
  } catch (err) {
    log(`ERROR: ${err.message}\n${err.stack}`);
  }
});

process.on('uncaughtException', (err) => {
  log(`UNCAUGHT: ${err.message}\n${err.stack}`);
  setTimeout(() => process.exit(1), 1000);
});
process.on('unhandledRejection', (err) => {
  log(`UNHANDLED: ${err.message}`);
});

log(`✅ Bot PID: ${process.pid} | Model: ${activeModel.name} | Owner: ${OWNER_ID}`);
log(`START | PID: ${process.pid} | Model: ${activeModel.name} | Restart #${restartCount}`);

bot.setMyCommands([
  { command: 'start', description: '🤖 بدء المحادثة' },
  { command: 'help', description: '❓ المساعدة' },
  { command: 'models', description: '🧠 النماذج' },
  { command: 'active', description: '⭐ النموذج النشط' },
  { command: 'new', description: '🔄 محادثة جديدة' },
  { command: 'admin', description: '📬 مراسلة المطور' },
]).catch(() => {});

bot.sendMessage(OWNER_ID, `🚀 *البوت شغال!*\n🧠 ${activeModel.name}\n🔄 #${restartCount}\n📌 PID: \`${process.pid}\``, { parse_mode: 'Markdown' }).catch(() => {});

restartCount++;
saveRestartCount();