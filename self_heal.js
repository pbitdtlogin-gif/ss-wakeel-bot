// ============================================================
//  🛡️ SELF-HEALING PROTOCOL — SS WAKEEL BOT v2.0
//  Auto-repair, Deep Diagnostics, Periodic Development
// ============================================================

const fs = require('fs');
const os = require('os');

const HEAL_LOG = 'heal.log';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

function log(msg) {
  const line = `[🛡️ ${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(HEAL_LOG, line);
  console.log(line.trim());
}

module.exports = {
  name: 'SelfHealProtocol',
  version: '2.0.0',

  /** Initialize the self-healing engine */
  init(bot, ownerId, ctx) {
    this.bot = bot;
    this.ownerId = ownerId;
    this.ctx = ctx; // { activeModel, MODELS, users, userChats, messageCount, startTime, restartCount, callAI }
    this.consecutiveFails = 0;
    this.lastModelTest = 0;

    log('🛡️ Self-healing protocol INITIALIZED');
    this.startPeriodicCheck();
    this.startDeepDiagnostics();
    return this;
  },

  /** Periodic health check every 5 minutes */
  startPeriodicCheck() {
    setInterval(() => this.runHealthCheck(), CHECK_INTERVAL);
    setTimeout(() => this.runHealthCheck(), 10000);
  },

  async runHealthCheck() {
    const report = [];

    // 1. Memory check
    const mem = process.memoryUsage();
    const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
    const heapTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(1);
    const memPercent = (mem.heapUsed / mem.heapTotal * 100).toFixed(1);
    report.push(`💾 RAM: ${heapUsedMB}/${heapTotalMB} MB (${memPercent}%)`);
    if (parseFloat(memPercent) > 85) {
      report.push('⚠️ MEMORY CRITICAL — scheduling restart');
      log(`MEMORY CRITICAL: ${memPercent}%`);
      this.consecutiveFails += 2;
    }

    // 2. API Health check
    try {
      const t0 = Date.now();
      await this.ctx.callAI([
        { role: 'system', content: 'You are a health checker. Reply with exactly one word: OK' },
        { role: 'user', content: 'ping' }
      ]);
      const latency = Date.now() - t0;
      report.push(`🧠 API: 🟢 OK (${latency}ms)`);
      this.consecutiveFails = Math.max(0, this.consecutiveFails - 1);
      this.lastModelTest = Date.now();
    } catch (e) {
      report.push(`🧠 API: 🔴 FAIL — ${e.message.slice(0, 60)}`);
      this.consecutiveFails++;
      log(`API check failed (${this.consecutiveFails}x): ${e.message}`);
    }

    // 3. Uptime
    const uptime = Math.floor((Date.now() - this.ctx.startTime) / 1000);
    const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = uptime % 60;
    report.push(`⏱ Uptime: ${h}h ${m}m ${s}s`);

    // 4. Users
    report.push(`👥 Users: ${Object.keys(this.ctx.users).length}`);

    // 5. Messages
    report.push(`💬 Messages: ${this.ctx.messageCount}`);

    // 6. Log rotation
    try {
      const logSize = fs.statSync('bot.log').size;
      const logMB = (logSize / 1024 / 1024).toFixed(2);
      if (logMB > 5) {
        report.push(`📋 Log: ${logMB} MB — ROTATING`);
        this.rotateLogs();
      } else {
        report.push(`📋 Log: ${logMB} MB`);
      }
    } catch (e) {}

    log(`Health check:\n  ${report.join('\n  ')}`);

    if (this.consecutiveFails >= 3) {
      log('CONSECUTIVE FAILS >= 3 — executing auto-repair');
      await this.autoRepair();
    }
  },

  /** Auto-repair: try different models, then restart */
  async autoRepair() {
    log('🔄 Executing auto-repair sequence...');

    for (const model of this.ctx.MODELS) {
      if (model.id === this.ctx.activeModel.id) continue;
      try {
        log(`Trying fallback model: ${model.name}`);
        this.ctx.activeModel = model;
        const t0 = Date.now();
        await this.ctx.callAI([
          { role: 'system', content: 'Reply OK' },
          { role: 'user', content: 'test' }
        ]);
        log(`✅ Auto-repair: switched to ${model.name} (${Date.now() - t0}ms)`);
        this.consecutiveFails = 0;
        try {
          await this.bot.sendMessage(this.ownerId,
            `🛡️ *Auto-Repair Activated*\n\n✅ Switched to *${model.name}*\n⏱ Latency: ${Date.now() - t0}ms\n📌 All systems nominal`,
            { parse_mode: 'Markdown' }
          );
        } catch (e) {}
        return { success: true, model: model.name };
      } catch (e) {
        log(`Model ${model.name} failed: ${e.message.slice(0, 50)}`);
      }
    }

    log('❌ All models failed — executing hard restart');
    try {
      await this.bot.sendMessage(this.ownerId,
        `🛡️ *CRITICAL*\n\n❌ All models failed\n🔄 Hard restart in 5s...`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {}
    setTimeout(() => process.exit(1), 5000);
    return { success: false };
  },

  /** Deep diagnostics every 30 min */
  startDeepDiagnostics() {
    setInterval(() => this.runDeepDiagnostics(), 30 * 60 * 1000);
    setTimeout(() => this.runDeepDiagnostics(), 60000);
  },

  async runDeepDiagnostics() {
    const report = [];
    report.push('🔬 DEEP DIAGNOSTICS');
    report.push(`Time: ${new Date().toISOString()}`);
    const cpus = os.cpus();
    const load = os.loadavg();
    report.push(`CPU: ${cpus.length} cores, Load: ${load[0].toFixed(2)}/${load[1].toFixed(2)}/${load[2].toFixed(2)}`);
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
    report.push(`System RAM: ${totalMem}GB total, ${freeMem}GB free`);
    const mem = process.memoryUsage();
    report.push(`Heap: ${(mem.heapUsed/1024/1024).toFixed(1)}/${(mem.heapTotal/1024/1024).toFixed(1)} MB`);
    report.push(`RSS: ${(mem.rss/1024/1024).toFixed(1)} MB`);
    try {
      const files = fs.readdirSync('/workspace/ss-wakeel-bot');
      report.push(`Files: ${files.length} in workspace`);
    } catch (e) {}
    const t0 = Date.now();
    await new Promise(resolve => setImmediate(resolve));
    const lag = Date.now() - t0;
    report.push(`Event loop lag: ${lag}ms`);
    if (lag > 100) report.push('⚠️ High event loop lag detected');
    log(report.join('\n  '));
  },

  /** Rotate logs */
  rotateLogs() {
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      if (fs.existsSync('bot.log')) fs.renameSync('bot.log', `bot_${ts}.log`);
      if (fs.existsSync('heal.log')) fs.renameSync('heal.log', `heal_${ts}.log`);
      log('📋 Logs rotated');
      const logs = fs.readdirSync('.')
        .filter(f => f.startsWith('bot_') || f.startsWith('heal_'))
        .sort()
        .slice(0, -3);
      logs.forEach(f => { try { fs.unlinkSync(f); } catch(e) {} });
    } catch (e) { log(`Log rotation error: ${e.message}`); }
  },

  /** Full diagnostic report */
  async getFullReport() {
    const uptime = Math.floor((Date.now() - this.ctx.startTime) / 1000);
    const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = uptime % 60;
    const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const users = Object.keys(this.ctx.users);
    let report = `🛡️ *SS WAKEEL — FULL DIAGNOSTIC* 🛡️\n\n`;
    report += `📊 *System*\n• PID: \`${process.pid}\`\n• Uptime: ${h}h ${m}m ${s}s\n• Restart #: ${this.ctx.restartCount}\n• Memory: ${mem} MB\n• Messages: ${this.ctx.messageCount}\n\n`;
    report += `🧠 *AI Engine*\n• Active: *${this.ctx.activeModel.name}* ⭐\n• Models: ${this.ctx.MODELS.length} available\n• API: ${this.consecutiveFails === 0 ? '🟢 Healthy' : '🔴 Unstable'}\n\n`;
    report += `👥 *Users*\n• Total: ${users.length}\n`;
    if (users.length > 0) {
      const last5 = users.slice(-5);
      report += `• Last 5: ${last5.map(u => `\`${u}\``).join(', ')}\n`;
    }
    report += `\n🛡️ *Self-Heal Stats*\n• Consecutive fails: ${this.consecutiveFails}\n• Last API test: ${this.lastModelTest ? new Date(this.lastModelTest).toLocaleString() : 'N/A'}\n• Status: ${this.consecutiveFails >= 3 ? '🔴 REPAIRING' : '🟢 Nominal'}\n`;
    return report;
  }
};