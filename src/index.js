'use strict';

/**
 * 🤖 Ss Wakeel Bot v3.0 — MAIN ENTRY
 * Self-healing, 5 UI scenarios, multi-model AI, production-grade
 */
const TOKEN = process.env.BOT_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID || '8277131084');

if (!TOKEN || !GITHUB_TOKEN) {
  console.error('❌ Missing BOT_TOKEN or GITHUB_TOKEN');
  process.exit(1);
}

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const { AIEngine } = require('./ai');
const ui = require('./ui');
const { HealProtocol } = require('./heal');

// ── Globals ──
const ai = new AIEngine(GITHUB_TOKEN);
const users = {};
const userChats = {};
const userSettings = {};
const MAX_HISTORY = 30;
const startTime = Date.now();
let messageCount = 0;

const LOG_FILE = path.join(__dirname, '..', 'bot.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch(e) {}
  console.log(line.trim());
}

// ── Init Bot ──
const bot = new TelegramBot(TOKEN, {
  polling: {
    params: { timeout: 30 },
    interval: 300,
  },
});

// Error resilience on polling
bot.on('polling_error', (err) => {
  log(`POLLING_ERR: ${err.message}`);
  // If fatal, restart
  if (err.code === 'EFATAL' || err.message.includes('terminated')) {
    log('Fatal polling error, restarting in 2s...');
    setTimeout(() => process.exit(1), 2000);
  }
});

bot.on('webhook_error', (err) => log(`WEBHOOK_ERR: ${err.message}`));

// ── HealProtocol ──
const heal = new HealProtocol();
heal.init(bot, OWNER_ID, { ai, users, userChats, messageCount, userSettings });

// ── Helpers ──
function registerUser(msg) {
  const uid = msg.from.id;
  if (!users[uid]) {
    users[uid] = {
      id: uid,
      username: msg.from.username || '',
      firstName: msg.from.first_name || '',
      lastName: msg.from.last_name || '',
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      lastMessage: '',
      messagesCount: 0,
    };
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
  if (userChats[uid].length > MAX_HISTORY) {
    userChats[uid] = userChats[uid].slice(-MAX_HISTORY);
  }
}

function getSystemPrompt(name) {
  return `You are Karkroot, a smart and loyal AI assistant for Telegram. You speak Arabic and English. You are always helpful, concise, and fast. Answer user questions directly without fluff. The user's name is ${name || 'Unknown'}. Current time: ${new Date().toISOString()}`;
}

// ── Safe send ──
async function safeReply(chatId, text, opts = {}) {
  try {
    const maxLen = 4000;
    if (text.length > maxLen) {
      for (let i = 0; i < text.length; i += maxLen) {
        await bot.sendMessage(chatId, text.substring(i, i + maxLen), {
          ...opts,
          parse_mode: 'Markdown',
        });
        await new Promise(r => setTimeout(r, 300));
      }
    } else {
      await bot.sendMessage(chatId, text, { ...opts, parse_mode: 'Markdown' });
    }
  } catch (e) {
    try {
      await bot.sendMessage(chatId, text.replace(/[*_`\[\]]/g, ''), opts);
    } catch (e2) {
      log(`Failed to send: ${e2.message}`);
    }
  }
}

async function sendUIGreeting(chatId, msg) {
  const us = userSettings[msg.from.id] || { uiMode: 'auto' };
  const response = [
    `🤖 *مرحباً! أنا Karkroot* 🚀`,
    ``,
    `🧠 النشط: *${ai.active.name}*`,
    `🎨 الواجهة: *${us.uiMode === 'auto' ? 'ذكية (تلقائية)' : us.uiMode}*`,
    ``,
    `📋 5 سيناريوهات UI ذكية:`,
    `1️⃣ Terminal AI — واجهة الطرفية`,
    `2️⃣ Dashboard — لوحة المعلومات`,
    `3️⃣ Hologram — الهولوجرام`,
    `4️⃣ Command Center — مركز القيادة`,
    `5️⃣ Inline Mode — الأزرار الذكية`,
    ``,
    `🔄 البوت يختار الأنسب تلقائياً!`,
    `🛡️ بروتوكول الإصلاح الذاتي v3.0 🟢`,
    ``,
    `📌 /help للمساعدة`,
  ].join('\n');

  try {
    await bot.sendMessage(chatId, response, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💬 اسألني', callback_data: 'chat' },
            { text: '🎨 Terminal', callback_data: 'ui_terminal' },
          ],
          [
            { text: '📊 Dashboard', callback_data: 'ui_dashboard' },
            { text: '🌀 Hologram', callback_data: 'ui_hologram' },
          ],
          [
            { text: '⚡ Command Center', callback_data: 'ui_center' },
            { text: '🔄 تلقائي', callback_data: 'ui_auto' },
          ],
        ],
      },
    });
  } catch (e) {
    await safeReply(chatId, response);
  }
}

async function sendUIResponse(chatId, response, modelName, userName, stats, forceMode) {
  const mode = forceMode || 'auto';
  try {
    await bot.sendChatAction(chatId, 'upload_photo');

    let buffer;
    const caption = response.length > 900 ? response.slice(0, 900) + '…' : response;

    if (mode === 'terminal') buffer = ui.terminal(response, modelName, userName);
    else if (mode === 'dashboard') buffer = ui.dashboard(response, modelName, userName, stats);
    else if (mode === 'hologram') buffer = ui.hologram(response, modelName, userName);
    else if (mode === 'center') buffer = ui.commandCenter(response, modelName, userName, stats);
    else buffer = ui.selectScenario(response, modelName, userName, stats).buffer;

    const imgPath = `/tmp/ui_${chatId}_${Date.now()}.png`;
    fs.writeFileSync(imgPath, buffer);

    await bot.sendPhoto(chatId, imgPath, {
      caption: `<b>🧠 ${modelName}</b>\n\n${caption.replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 900)}`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💬 رد نصي', callback_data: 'text_reply' },
            { text: '🎨 غير الواجهة', callback_data: 'change_ui' },
          ],
        ],
      },
    });

    try { fs.unlinkSync(imgPath); } catch (e) {}
  } catch (e) {
    log(`UI render error: ${e.message}`);
    await safeReply(chatId, response);
  }
}

// ── Callback Handler ──
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const uid = query.from.id;
  const data = query.data;

  try {
    await bot.answerCallbackQuery(query.id);

    if (data.startsWith('ui_')) {
      userSettings[uid] = userSettings[uid] || {};
      userSettings[uid].uiMode = data.replace('ui_', '');
      const label = userSettings[uid].uiMode === 'auto' ? 'تلقائية' : userSettings[uid].uiMode;
      await safeReply(chatId, `✅ الواجهة: *${label}*`);
    }

    if (data === 'change_ui') {
      await bot.sendMessage(chatId, '🎨 *اختر واجهة:*', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 تلقائي', callback_data: 'ui_auto' },
              { text: '💻 Terminal', callback_data: 'ui_terminal' },
            ],
            [
              { text: '📊 Dashboard', callback_data: 'ui_dashboard' },
              { text: '🌀 Hologram', callback_data: 'ui_hologram' },
            ],
            [
              { text: '⚡ Command Center', callback_data: 'ui_center' },
            ],
          ],
        },
      });
    }

    if (data === 'chat') {
      await safeReply(chatId, '💬 أرسل لي سؤالك!');
    }

    if (data === 'text_reply') {
      await safeReply(chatId, '✏️ اكتب ردك مباشرة');
    }

    try {
      await bot.deleteMessage(chatId, query.message.message_id);
    } catch (e) {}
  } catch (e) {
    log(`Callback error: ${e.message}`);
  }
});

// ── Owner Command Text ──
const OWNER_CMDS = [
  `🔐 *لوحة تحكم المطور — SS WAKEEL v3.0* 🚀`,
  ``,
  `📊 *الإدارة*`,
  `• /status — حالة البوت الكاملة`,
  `• /restart — إعادة تشغيل`,
  `• /uptime — مدة التشغيل`,
  `• /pid — رقم العملية`,
  ``,
  `🧠 *النماذج*`,
  `• /models — عرض النماذج`,
  `• /active — النموذج النشط`,
  `• /setmodel <رقم> — تغيير النموذج`,
  `• /testmodel <رقم> — اختبار`,
  `• /swap — تدوير تلقائي`,
  ``,
  `👥 *المستخدمين*`,
  `• /users — قائمة المستخدمين`,
  `• /uid <اسم> — البحث`,
  `• /reply <id> <رسالة> — الرد`,
  `• /send <id> <رسالة> — إرسال`,
  `• /broadcast <رسالة> — بث`,
  `• /export — تصدير CSV`,
  ``,
  `🎨 *واجهات UI*`,
  `• /ui — اختيار واجهة`,
  `• /ui_terminal | /ui_dashboard | /ui_hologram | /ui_center | /ui_inline | /ui_auto`,
  ``,
  `🛡️ *الإصلاح الذاتي*`,
  `• /heal — فحص وإصلاح فوري`,
  `• /diag — تقرير تشخيص كامل`,
  `• /cleanup — تنظيف مؤقت`,
  `• /logs — آخر السجلات`,
  `• /clearlogs — مسح`,
  ``,
  `⚙️ /say <رسالة> | /reset | /stats`,
  ``,
  `🔒 *مخصص للمالك فقط*`,
].join('\n');

// ── Main Message Handler ──
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const uid = msg.from.id;
    const text = (msg.text || '').trim();
    const isOwner = uid === OWNER_ID;

    registerUser(msg);
    messageCount++;

    // ── OWNER COMMANDS ──
    if (isOwner && msg.chat.type === 'private') {
      // Owner menu
      if (text === '/owner' || text === '/dev') {
        return await safeReply(chatId, OWNER_CMDS);
      }

      // Self-heal
      if (text === '/heal') {
        await safeReply(chatId, '🛡️ *بدء الإصلاح الذاتي...*');
        const result = await heal.autoRepair();
        const status = result.success
          ? `✅ *تم الإصلاح* → ${result.model} 🚀`
          : '❌ فشل الإصلاح';
        return await safeReply(chatId, status);
      }

      if (text === '/diag') {
        return await safeReply(chatId, await heal.getFullReport());
      }

      if (text === '/cleanup') {
        let cleaned = 0;
        try {
          const tmpFiles = fs.readdirSync('/tmp').filter(f => f.startsWith('ui_'));
          tmpFiles.forEach(f => {
            try { fs.unlinkSync(`/tmp/${f}`); cleaned++; } catch (e) {}
          });

          const oldLogs = fs.readdirSync(path.join(__dirname, '..'))
            .filter(f => /^(bot|heal)_\d{4}-\d{2}/.test(f))
            .sort()
            .slice(0, -5);
          oldLogs.forEach(f => {
            try { fs.unlinkSync(path.join(__dirname, '..', f)); cleaned++; } catch (e) {}
          });
        } catch (e) {}
        return await safeReply(chatId, `🧹 *تنظيف:* حذف ${cleaned} ملف`);
      }

      // UI
      if (text === '/ui') {
        return await bot.sendMessage(chatId, '🎨 *اختر واجهة البوت:*', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔄 تلقائي (ذكي)', callback_data: 'ui_auto' },
                { text: '💻 Terminal AI', callback_data: 'ui_terminal' },
              ],
              [
                { text: '📊 Dashboard', callback_data: 'ui_dashboard' },
                { text: '🌀 Hologram', callback_data: 'ui_hologram' },
              ],
              [
                { text: '⚡ Command Center', callback_data: 'ui_center' },
                { text: '🔘 Inline', callback_data: 'ui_inline' },
              ],
            ],
          },
        });
      }

      for (const m of ['terminal', 'dashboard', 'hologram', 'center', 'inline', 'auto']) {
        if (text === `/ui_${m}`) {
          userSettings[uid] = userSettings[uid] || {};
          userSettings[uid].uiMode = m;
          return await safeReply(chatId, `✅ واجهة *${m}* مفعلة!`);
        }
      }

      // Status
      if (text === '/status') {
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        const h = Math.floor(uptime / 3600);
        const m = Math.floor((uptime % 3600) / 60);
        const s = uptime % 60;
        const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        const us = userSettings[uid]?.uiMode || 'auto';
        return await safeReply(chatId, [
          `📊 *حالة البوت*`,
          ``,
          `🤖 *@Ss_Wakeel_bot*`,
          `• 🟢 شغال`,
          `• PID: \`${process.pid}\``,
          `• وقت: ${h}h ${m}m ${s}s`,
          `• إعادة: #${heal.restartCount}`,
          `• رسائل: ${messageCount}`,
          `• مستخدمين: ${Object.keys(users).length}`,
          ``,
          `🧠 *${ai.active.name}* ⭐`,
          `🎨 واجهة: *${us}*`,
          `💾 ذاكرة: ${mem} MB`,
          `🛡️ Heal: ${heal.consecutiveFails === 0 ? '🟢' : '🔴'}`,
        ].join('\n'));
      }

      if (text === '/uptime') {
        const t = Math.floor((Date.now() - startTime) / 1000);
        return await safeReply(chatId, [
          `🕐 *مدة التشغيل:* ${Math.floor(t / 3600)}h ${Math.floor((t % 3600) / 60)}m ${t % 60}s`,
          `🔄 إعادة: #${heal.restartCount}`,
          `📊 رسائل: ${messageCount}`,
        ].join('\n'));
      }

      if (text === '/pid') {
        return await safeReply(chatId, `📌 *PID:* \`${process.pid}\``);
      }

      if (text === '/stats') {
        const t = Math.floor((Date.now() - startTime) / 1000);
        const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        const topUsers = Object.values(users)
          .sort((a, b) => (b.messagesCount || 0) - (a.messagesCount || 0))
          .slice(0, 5);
        return await safeReply(chatId, [
          `📊 *إحصائيات*`,
          ``,
          `⏱ ${Math.floor(t / 3600)}h ${Math.floor((t % 3600) / 60)}m ${t % 60}s`,
          `🔄 إعادة: #${heal.restartCount}`,
          `💬 رسائل: ${messageCount}`,
          `👥 مستخدمين: ${Object.keys(users).length}`,
          `🧠 ${ai.active.name}`,
          `💾 ${mem} MB`,
          ``,
          `🏆 *الأكثر نشاطاً:*`,
          topUsers.length
            ? topUsers.map(u => `• ${u.firstName}: ${u.messagesCount || 0}`).join('\n')
            : '(لا يوجد)',
        ].join('\n'));
      }

      if (text === '/export') {
        const list = Object.values(users);
        if (!list.length) return await safeReply(chatId, '📭 ولا مستخدم');
        let csv = 'ID,Username,FirstName,LastName,FirstSeen,LastSeen,Messages,LastMessage\n';
        list.forEach(u => {
          csv += `${u.id},${u.username || ''},${u.firstName || ''},${u.lastName || ''},${new Date(u.firstSeen).toISOString()},${new Date(u.lastSeen).toISOString()},${u.messagesCount || 0},"${(u.lastMessage || '').replace(/"/g, '""')}"\n`;
        });
        const csvPath = '/tmp/users_export.csv';
        fs.writeFileSync(csvPath, csv);
        try {
          await bot.sendDocument(chatId, csvPath, { caption: '📋 بيانات المستخدمين' });
        } catch (e) {
          await safeReply(chatId, `📋 ${list.length} مستخدم`);
        }
        return;
      }

      // Models
      if (text === '/models') {
        const lines = ai.list.map(m =>
          `${m.id}. ${m.name} ${'🔥'.repeat(m.tier)}${m.id === ai.active.id ? ' ⭐' : ''}`
        );
        return await safeReply(chatId, `🧠 *النماذج*\n\n${lines.join('\n')}`);
      }

      if (text === '/active') {
        return await safeReply(chatId, `⭐ *النشط:* ${ai.active.name}\n📌 \`${ai.active.model}\``);
      }

      if (text.startsWith('/setmodel ')) {
        const id = parseInt(text.split(' ')[1]);
        if (!ai.switchTo(id)) return await safeReply(chatId, '❌ رقم خطأ');
        log(`Model changed to ${ai.active.name}`);
        return await safeReply(chatId, `✅ *${ai.active.name}* ⭐`);
      }

      if (text.startsWith('/testmodel ')) {
        const id = parseInt(text.split(' ')[1]);
        const m = ai.list.find(x => x.id === id);
        if (!m) return await safeReply(chatId, '❌ رقم خطأ');
        await safeReply(chatId, `⏳ جاري اختبار *${m.name}*...`);

        const prev = ai.activeId;
        const lat = await ai.testModel(id);
        if (lat > 0) {
          await safeReply(chatId, `✅ *${m.name}* — ${lat}ms`);
        } else {
          await safeReply(chatId, `❌ *${m.name}* — فشل`);
        }
        ai.activeId = prev;
        return;
      }

      if (text === '/swap') {
        await safeReply(chatId, '🔄 جاري البحث عن بديل...');
        const working = await ai.findWorkingModel();
        if (working) {
          return await safeReply(chatId, `✅ *${working.name}* 🚀 (${ai.apiStats.get(working.id).calls} calls)`);
        }
        return await safeReply(chatId, '❌ ما لقيت نموذج شغال');
      }

      // Users
      if (text === '/users') {
        const list = Object.values(users);
        if (!list.length) return await safeReply(chatId, '👥 ولا مستخدم');
        return await safeReply(chatId, [
          `👥 *${list.length} مستخدم*`,
          '',
          ...list.map((u, i) =>
            `${i + 1}. ${u.firstName}${u.lastName ? ' ' + u.lastName : ''} ${u.username ? '@' + u.username : ''}\n   \`${u.id}\` | ${u.messagesCount || 0} رسالة`
          ),
        ].join('\n'));
      }

      if (text.startsWith('/uid ')) {
        const q = text.slice(5).toLowerCase();
        const found = Object.values(users).filter(
          u =>
            u.firstName.toLowerCase().includes(q) ||
            (u.username || '').toLowerCase().includes(q) ||
            String(u.id).includes(q)
        );
        if (!found.length) return await safeReply(chatId, '❌ ما لقيت');
        return await safeReply(chatId,
          '🔍 ' +
          found
            .map(
              u =>
                `• ${u.firstName} (@${u.username || '—'}) — \`${u.id}\` — ${u.messagesCount || 0} رسالة`
            )
            .join('\n')
        );
      }

      if (text.startsWith('/reply ')) {
        const parts = text.split(' ');
        const targetId = parseInt(parts[1]);
        const replyText = parts.slice(2).join(' ');
        if (!targetId || !replyText) return await safeReply(chatId, '❌ /reply <id> <رسالة>');
        try {
          await bot.sendMessage(targetId, `📨 *من المطور:*\n\n${replyText}`, { parse_mode: 'Markdown' });
          log(`Replied to ${targetId}`);
          await safeReply(chatId, `✅ \`${targetId}\``);
        } catch (e) {
          await safeReply(chatId, `❌ ${e.message.slice(0, 100)}`);
        }
        return;
      }

      if (text.startsWith('/send ')) {
        const parts = text.split(' ');
        const targetId = parseInt(parts[1]);
        const sendText = parts.slice(2).join(' ');
        if (!targetId || !sendText) return await safeReply(chatId, '❌ /send <id> <رسالة>');
        try {
          await bot.sendMessage(targetId, sendText);
          await safeReply(chatId, `✅ \`${targetId}\``);
        } catch (e) {
          await safeReply(chatId, `❌ ${e.message.slice(0, 100)}`);
        }
        return;
      }

      if (text.startsWith('/broadcast ')) {
        const bcText = text.slice(11);
        const ids = Object.keys(users);
        let ok = 0;
        let fail = 0;
        await safeReply(chatId, `📢 بث لـ ${ids.length}...`);
        for (const id of ids) {
          try {
            await bot.sendMessage(parseInt(id), `📢 *إعلان:*\n\n${bcText}`, { parse_mode: 'Markdown' });
            ok++;
          } catch (e) {
            fail++;
          }
          await new Promise(r => setTimeout(r, 100));
        }
        return await safeReply(chatId, `✅ تم: ${ok} | فشل: ${fail}`);
      }

      // Logs
      if (text === '/logs') {
        try {
          const logData = fs.readFileSync(LOG_FILE, 'utf8').split('\n').slice(-20).join('\n');
          await safeReply(chatId, `📋 *آخر السجلات:*\n\`\`\`\n${logData || '(فارغ)'}\n\`\`\``);
        } catch (e) {
          await safeReply(chatId, '📋 السجل فارغ');
        }
        return;
      }

      if (text === '/clearlogs') {
        try {
          fs.writeFileSync(LOG_FILE, '');
          fs.writeFileSync(path.join(__dirname, '..', 'heal.log'), '');
        } catch (e) {}
        return await safeReply(chatId, '✅ مسح');
      }

      if (text === '/restart') {
        await safeReply(chatId, '🔄 جاري إعادة التشغيل...');
        setTimeout(() => process.exit(0), 1000);
        return;
      }

      if (text === '/reset') {
        Object.keys(users).forEach(k => delete users[k]);
        Object.keys(userChats).forEach(k => delete userChats[k]);
        Object.keys(userSettings).forEach(k => delete userSettings[k]);
        messageCount = 0;
        return await safeReply(chatId, '✅ *إعادة ضبط كاملة*');
      }

      if (text.startsWith('/say ')) {
        return await safeReply(chatId, `💬 ${text.slice(5)}`);
      }
    }

    // ── USER COMMANDS ──
    if (text === '/start') {
      return await sendUIGreeting(chatId, msg);
    }

    if (text === '/help') {
      return await safeReply(chatId, [
        `❓ *مساعدة*`,
        ``,
        `🧠 النموذج: *${ai.active.name}*`,
        `📬 /admin <رسالة> — تواصل مع المطور`,
        `🔄 /new — بدء محادثة جديدة`,
        `🎨 البوت يرسل ردود مصورة بـ 5 واجهات ذكية!`,
        `🛡️ نظام الإصلاح الذاتي نشط 🟢`,
        `💡 فقط اسألني!`,
      ].join('\n'));
    }

    if (text === '/new') {
      userChats[uid] = [];
      return await safeReply(chatId, '🔄 *محادثة جديدة* ✅');
    }

    if (text.startsWith('/admin ')) {
      const adminMsg = text.slice(7);
      try {
        await bot.sendMessage(
          OWNER_ID,
          `📬 *من مستخدم:* ${msg.from.first_name || ''} ${msg.from.username ? '@' + msg.from.username : ''}\n🆔 \`${uid}\`\n💬 ${adminMsg}\n\n📌 /reply ${uid} ...`,
          { parse_mode: 'Markdown' }
        );
        await safeReply(chatId, '✅ *أرسلت للمطور!*');
      } catch (e) {
        await safeReply(chatId, '❌ فشل الإرسال');
      }
      return;
    }

    // ── AI Response ──
    if (text && !text.startsWith('/')) {
      await bot.sendChatAction(chatId, 'typing');
      addChat(uid, 'user', text);

      const name = msg.from.first_name || 'مستخدم';
      const ctx = [
        { role: 'system', content: getSystemPrompt(name) },
        ...(userChats[uid] || []),
      ];

      try {
        const reply = await ai.call(ctx, { maxRetries: 1 });
        addChat(uid, 'assistant', reply);

        const us = userSettings[uid] || { uiMode: 'auto' };

        // Decide: inline (text) or UI image
        const useText =
          us.uiMode === 'inline' ||
          (us.uiMode === 'auto' && (reply.length < 80 && !reply.includes('```') && !reply.includes('\n\n')));

        if (useText) {
          await safeReply(chatId, reply);
        } else {
          const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
          const stats = {
            users: Object.keys(users).length,
            messages: messageCount,
            memory: memMB,
          };
          const forceMode = us.uiMode === 'auto' ? null : us.uiMode;
          await sendUIResponse(chatId, reply, ai.active.name, name, stats, forceMode);
        }
      } catch (e) {
        log(`AI error: ${e.message}`);

        // Try fallback models via AI engine (it auto-falls back)
        try {
          const reply = await ai.call(ctx, { maxRetries: 0 });
          addChat(uid, 'assistant', reply);
          heal.consecutiveFails = 0;
          await safeReply(chatId, `⚠️ حولت لـ *${ai.active.name}*\n\n${reply}`);
        } catch (e2) {
          heal.consecutiveFails++;
          await safeReply(chatId, `❌ خطأ: ${e.message.slice(0, 80)}\nجرب /new`);

          if (heal.consecutiveFails >= 3 && isOwner) {
            log('Auto-triggering heal from user message');
            heal.autoRepair().catch(() => {});
          }
        }
      }
    }
  } catch (err) {
    log(`MAIN ERROR: ${err.message}\n${err.stack}`);
  }
});

// ── Process Graceful Shutdown ──
process.on('uncaughtException', (err) => {
  log(`💥 UNCAUGHT: ${err.message}\n${err.stack}`);
  heal.restartCount++;
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (err) => {
  log(`⚠️ UNHANDLED REJECTION: ${err.message}`);
});

process.on('SIGTERM', () => {
  log('SIGTERM received. Shutting down gracefully...');
  bot.stopPolling();
  setTimeout(() => process.exit(0), 500);
});

process.on('SIGINT', () => {
  log('SIGINT received. Shutting down...');
  bot.stopPolling();
  setTimeout(() => process.exit(0), 500);
});

// ── Startup ──
log(`✅ Bot PID: ${process.pid} | Model: ${ai.active.name} | Owner: ${OWNER_ID}`);
log(`🎨 5 UI scenarios loaded | 🛡️ HealProtocol v3.0 active`);

// Set bot commands
bot.setMyCommands([
  { command: 'start', description: '🤖 بدء المحادثة' },
  { command: 'help', description: '❓ المساعدة' },
  { command: 'new', description: '🔄 محادثة جديدة' },
  { command: 'admin', description: '📬 مراسلة المطور' },
]).catch(() => {});

// Notify owner
bot.sendMessage(
  OWNER_ID,
  [
    `🚀 *Ss Wakeel Bot v3.0 — ONLINE!* 🔥`,
    ``,
    `🧠 *${ai.active.name}* ⭐`,
    `🔄 #${heal.restartCount}`,
    `🎨 5 واجهات UI ذكية`,
    `🛡️ بروتوكول الإصلاح الذاتي v3.0 🟢`,
    `📌 PID: \`${process.pid}\``,
    `💪 النظام مستقر ومنيع`,
  ].join('\n'),
  { parse_mode: 'Markdown' }
).catch(() => {});

heal.restartCount++;
heal._saveRestartCount();