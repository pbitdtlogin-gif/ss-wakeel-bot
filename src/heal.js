'use strict';

/**
 * 🛡️ HealProtocol v3.0 — SS Wakeel Bot
 * Self-healing, deep diagnostics, auto-repair, memory management
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'bot.log');
const HEAL_LOG = path.join(__dirname, '..', 'heal.log');
const CHECK_INTERVAL = 5 * 60 * 1000;   // 5 min
const DEEP_INTERVAL = 30 * 60 * 1000;   // 30 min
const MAX_LOG_MB = 5;
const MAX_HEAL_LOG_MB = 2;
const MAX_RESTART_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

class HealProtocol {
  constructor() {
    this.consecutiveFails = 0;
    this.lastHealthOk = Date.now();
    this.warnings = [];
    this.restartCount = this._loadRestartCount();
    this.startTime = Date.now();
    this._initialized = false;
  }

  /** Initialize with bot instance and context */
  init(bot, ownerId, ctx) {
    this.bot = bot;
    this.ownerId = ownerId;
    this.ctx = ctx; // { ai, users, userChats, messageCount, userSettings }
    this._initialized = true;

    this.log('🛡️ HealProtocol v3.0 INITIALIZED');

    // Start periodic checks
    setTimeout(() => this._healthCheck(), 5000);
    setInterval(() => this._healthCheck(), CHECK_INTERVAL);

    // Deep diagnostics
    setTimeout(() => this._deepDiag(), 30000);
    setInterval(() => this._deepDiag(), DEEP_INTERVAL);

    // Watchdog: if no health in 30 min, force restart
    setInterval(() => {
      if (Date.now() - this.lastHealthOk > 30 * 60 * 1000) {
        this.log('⚠️ Watchdog: no health check OK in 30 min. Forcing repair.');
        this.autoRepair();
      }
    }, 60 * 1000);

    // Periodic restart (every 4h to prevent memory leaks)
    setInterval(() => {
      this.log('🔄 Scheduled restart (4h cycle)');
      this._notifyOwner('🔄 *Scheduled restart* — 4h cycle for stability');
      setTimeout(() => process.exit(0), 3000);
    }, MAX_RESTART_INTERVAL);

    return this;
  }

  log(msg) {
    const line = `[🛡️ ${new Date().toISOString()}] ${msg}`;
    try {
      fs.appendFileSync(HEAL_LOG, line + '\n');
    } catch (e) {}
    console.log(line);
  }

  _loadRestartCount() {
    try {
      const rc = fs.readFileSync(path.join(__dirname, '..', 'restart_count.txt'), 'utf8').trim();
      return parseInt(rc) || 0;
    } catch (e) { return 0; }
  }

  _saveRestartCount() {
    try {
      fs.writeFileSync(path.join(__dirname, '..', 'restart_count.txt'), String(this.restartCount));
    } catch (e) {}
  }

  async _healthCheck() {
    const report = [];
    const errors = [];

    // 1. Memory
    const mem = process.memoryUsage();
    const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
    const heapTotal = (mem.heapTotal / 1024 / 1024).toFixed(1);
    const memPct = (mem.heapUsed / mem.heapTotal * 100).toFixed(1);
    report.push(`💾 Heap: ${heapMB}/${heapTotal} MB (${memPct}%)`);

    if (parseFloat(memPct) > 85) {
      errors.push('MEMORY CRITICAL');
      report.push('⚠️ CRITICAL: scheduling GC/restart');
      if (global.gc) { try { global.gc(); } catch(e) {} }
    }

    // 2. API check
    try {
      const t0 = Date.now();
      await this.ctx.ai.call([
        { role: 'system', content: 'Reply one word: OK' },
        { role: 'user', content: 'ping' }
      ], { maxRetries: 0, fallback: false });
      const lat = Date.now() - t0;
      report.push(`🧠 AI: 🟢 ${lat}ms`);
      this.lastHealthOk = Date.now();
      this.consecutiveFails = Math.max(0, this.consecutiveFails - 1);
    } catch (e) {
      report.push(`🧠 AI: 🔴 ${e.message.slice(0, 60)}`);
      errors.push(`AI_FAIL: ${e.message.slice(0, 40)}`);
      this.consecutiveFails++;
    }

    // 3. Uptime
    const up = Math.floor((Date.now() - this.startTime) / 1000);
    const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = up % 60;
    report.push(`⏱ ${h}h ${m}m ${s}s`);

    // 4. Stats
    report.push(`👥 Users: ${Object.keys(this.ctx.users).length}`);
    report.push(`💬 Msgs: ${this.ctx.messageCount}`);
    report.push(`🔄 Restart #${this.restartCount}`);

    // 5. Log rotation
    this._rotateLogs();

    this.log(`Check:\n  ${report.join('\n  ')}`);

    if (this.consecutiveFails >= 3) {
      this.log('⚠️ 3+ consecutive fails — auto repair');
      await this.autoRepair();
    }
  }

  async autoRepair() {
    this.log('🔄 AUTO-REPAIR START');

    // Try to find a working model
    const working = await this.ctx.ai.findWorkingModel();
    if (working) {
      this.log(`✅ Switched to ${working.name}`);
      this.consecutiveFails = 0;
      this._notifyOwner(`🛡️ *Auto-Repair* ✅\n→ Switched to *${working.name}*\n→ System nominal`);
      return { success: true, model: working.name };
    }

    // Hard restart
    this.log('❌ All models failed — hard restart');
    this._notifyOwner('🛡️ *CRITICAL* — All models failed\n🔄 Hard restart in 5s...');
    setTimeout(() => process.exit(1), 5000);
    return { success: false };
  }

  async _deepDiag() {
    const r = [];
    r.push('🔬 DEEP DIAGNOSTICS');
    r.push(`Time: ${new Date().toISOString()}`);

    try {
      const cpus = os.cpus();
      const load = os.loadavg();
      r.push(`CPU: ${cpus.length} cores, Load: ${load[0].toFixed(2)}`);

      const total = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
      const free = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
      r.push(`System RAM: ${total}G total, ${free}G free`);

      const mem = process.memoryUsage();
      r.push(`RSS: ${(mem.rss/1024/1024).toFixed(1)} MB`);
      r.push(`Heap: ${(mem.heapUsed/1024/1024).toFixed(1)}/${(mem.heapTotal/1024/1024).toFixed(1)} MB`);
      r.push(`Ext: ${(mem.external/1024/1024).toFixed(1)} MB`);
    } catch (e) { r.push(`Mem error: ${e.message}`); }

    // Event loop lag
    const t0 = Date.now();
    await new Promise(r => setImmediate(r));
    const lag = Date.now() - t0;
    r.push(`Event loop: ${lag}ms`);
    if (lag > 200) r.push('⚠️ HIGH LAG');

    // File count
    try {
      const files = fs.readdirSync(path.join(__dirname, '..'));
      r.push(`Files: ${files.length}`);
    } catch (e) {}

    // API model stats
    if (this.ctx.ai) {
      r.push(`\n🧠 Model: ${this.ctx.ai.active.name}`);
      r.push(`Overall API health: ${this.consecutiveFails === 0 ? '🟢' : '🔴'}`);
    }

    this.log(r.join('\n  '));
    return r.join('\n');
  }

  _rotateLogs() {
    try {
      for (const f of ['bot.log', 'heal.log']) {
        const fp = path.join(__dirname, '..', f);
        if (!fs.existsSync(fp)) continue;
        const size = fs.statSync(fp).size;
        const maxSize = f === 'heal.log' ? MAX_HEAL_LOG_MB : MAX_LOG_MB;
        if (size > maxSize * 1024 * 1024) {
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          fs.renameSync(fp, fp.replace('.log', `_${ts}.log`));
          this.log(`📋 Rotated ${f}`);
        }
      }
      // Clean old logs (keep last 5)
      const dir = path.join(__dirname, '..');
      const logs = fs.readdirSync(dir)
        .filter(f => /^(bot|heal)_\d{4}-\d{2}/.test(f))
        .sort()
        .slice(0, -5);
      logs.forEach(f => { try { fs.unlinkSync(path.join(dir, f)); } catch(e) {} });
    } catch (e) { this.log(`Log rotation error: ${e.message}`); }
  }

  async getFullReport() {
    const up = Math.floor((Date.now() - this.startTime) / 1000);
    const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = up % 60;
    const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const users = Object.keys(this.ctx.users);

    let report = '🛡️ *SS WAKEEL — FULL DIAGNOSTIC v3.0* 🛡️\n\n';
    report += `📊 *System*\n• PID: \`${process.pid}\`\n• Uptime: ${h}h ${m}m ${s}s\n• Restart #: ${this.restartCount}\n• Memory: ${mem} MB\n• Messages: ${this.ctx.messageCount}\n\n`;
    report += `🧠 *AI Engine*\n• Active: *${this.ctx.ai.active.name}* ⭐\n• Models: ${this.ctx.ai.list.length} available\n• Status: ${this.consecutiveFails === 0 ? '🟢 Healthy' : '🔴 Unstable'}\n• Fails: ${this.consecutiveFails}\n\n`;
    report += `👥 *Users*\n• Total: ${users.length}\n`;
    if (users.length > 5) {
      report += `• Last 5: ${users.slice(-5).map(u => `\`${u}\``).join(', ')}\n`;
    }
    report += `\n🛡️ *HealProtocol*\n• Status: ${this.consecutiveFails >= 3 ? '🔴 REPAIRING' : '🟢 Nominal'}\n• Last OK: ${new Date(this.lastHealthOk).toLocaleString()}\n`;

    // Message counts for top users
    const topUsers = Object.values(this.ctx.users)
      .sort((a, b) => (b.messagesCount || 0) - (a.messagesCount || 0))
      .slice(0, 5);
    if (topUsers.length) {
      report += `\n🏆 *Top Users*\n${topUsers.map((u, i) => `${i+1}. ${u.firstName}: ${u.messagesCount || 0} msgs`).join('\n')}\n`;
    }

    return report;
  }

  _notifyOwner(text) {
    if (!this.bot || !this.ownerId) return;
    try {
      this.bot.sendMessage(this.ownerId, text, { parse_mode: 'Markdown' }).catch(() => {});
    } catch (e) {}
  }
}

module.exports = { HealProtocol };