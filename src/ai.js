'use strict';

/**
 * 🧠 AI Engine v3.0 — SS Wakeel Bot
 * Multi-model manager with smart fallback, auto-rotation, and backoff
 */
const fetch = require('node-fetch');

const API_URL = 'https://models.inference.ai.azure.com/chat/completions';

const MODELS = [
  { id: 0,  name: 'GPT-4o',          model: 'gpt-4o',                          tier: 3 },
  { id: 1,  name: 'DeepSeek-R1',     model: 'DeepSeek-R1',                     tier: 3 },
  { id: 2,  name: 'GPT-4o-mini',     model: 'gpt-4o-mini',                     tier: 2 },
  { id: 3,  name: 'Phi-4',           model: 'Phi-4',                           tier: 2 },
  { id: 4,  name: 'Llama-3.1-405B',  model: 'Meta-Llama-3.1-405B-Instruct',   tier: 2 },
  { id: 5,  name: 'Llama-3.1-8B',    model: 'Meta-Llama-3.1-8B-Instruct',     tier: 1 },
  { id: 6,  name: 'Mistral-large',   model: 'Mistral-large-2407',              tier: 2 },
  { id: 7,  name: 'Cohere-command-r+',model: 'Cohere-command-r-plus-08-2024', tier: 2 },
  { id: 8,  name: 'DeepSeek-V3',     model: 'DeepSeek-V3-0324',               tier: 3 },
  { id: 9,  name: 'o3-mini',         model: 'o3-mini',                         tier: 3 },
  { id: 10, name: 'o1',              model: 'o1',                              tier: 3 },
  { id: 11, name: 'o1-mini',         model: 'o1-mini',                         tier: 2 },
  { id: 12, name: 'Mistral-small',   model: 'Mistral-small-2503',              tier: 2 },
  { id: 13, name: 'Ministral-3B',    model: 'Ministral-3B-2410',               tier: 1 },
  { id: 14, name: 'Grok-3',          model: 'grok-3',                          tier: 3 },
];

const RETRY_DELAYS = [1000, 2000, 4000, 8000]; // Exponential backoff

class AIEngine {
  constructor(githubToken) {
    this.token = githubToken;
    this.activeId = 0;
    this.fails = new Map(); // modelId -> consec fails
    this.rateLimited = new Map(); // modelId -> timestamp until
    this.apiStats = new Map(); // modelId -> { calls, fails, totalMs }
    MODELS.forEach(m => {
      this.fails.set(m.id, 0);
      this.apiStats.set(m.id, { calls: 0, fails: 0, totalMs: 0 });
    });
  }

  get active() { return MODELS[this.activeId]; }
  get list() { return MODELS; }

  /** Call AI with auto fallback on failure */
  async call(messages, options = {}) {
    const { maxRetries = 2, fallback = true } = options;
    const startId = this.activeId;

    for (let attempt = 0; attempt < MODELS.length; attempt++) {
      const modelId = (startId + attempt) % MODELS.length;
      const model = MODELS[modelId];

      // Skip if rate-limited
      const until = this.rateLimited.get(modelId);
      if (until && Date.now() < until) continue;

      // Skip if too many consecutive fails
      if (this.fails.get(modelId) >= 3 && modelId !== this.activeId) continue;

      try {
        const result = await this._callSingle(model, messages);
        this.fails.set(modelId, 0);
        // If we switched models, update active
        if (modelId !== this.activeId) {
          this.activeId = modelId;
        }
        return result;
      } catch (err) {
        const f = (this.fails.get(modelId) || 0) + 1;
        this.fails.set(modelId, f);

        const stats = this.apiStats.get(modelId);
        stats.fails++;

        if (err.message.includes('429') || err.message.includes('RateLimit')) {
          // Rate limited — back off for 30s
          this.rateLimited.set(modelId, Date.now() + 30000);
        }

        if (!fallback && attempt === 0) throw err;
        // If all models failed, throw
        if (attempt === MODELS.length - 1) throw err;
      }
    }
    throw new Error('All models exhausted');
  }

  async _callSingle(model, messages) {
    const body = {
      model: model.model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    };

    const t0 = Date.now();
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });

    const stats = this.apiStats.get(model.id);
    stats.calls++;

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
      err.status = res.status;
      stats.totalMs += (Date.now() - t0);
      throw err;
    }

    const data = await res.json();
    stats.totalMs += (Date.now() - t0);
    this.fails.set(model.id, 0);

    if (!data.choices || !data.choices[0]) {
      throw new Error('Empty AI response');
    }

    return data.choices[0].message.content;
  }

  /** Get best model (lowest fails + highest tier) */
  getBestModel() {
    let best = MODELS[0];
    let bestScore = -1;
    for (const m of MODELS) {
      const fails = this.fails.get(m.id) || 0;
      const score = m.tier * 10 - fails;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best;
  }

  /** Switch to a specific model by id */
  switchTo(id) {
    const m = MODELS.find(x => x.id === id);
    if (!m) return false;
    this.activeId = id;
    this.fails.set(id, 0);
    return true;
  }

  /** Test a model, return latency ms or -1 */
  async testModel(id) {
    const m = MODELS.find(x => x.id === id);
    if (!m) return -1;
    const t0 = Date.now();
    try {
      await this._callSingle(m, [
        { role: 'system', content: 'Reply with one word: OK' },
        { role: 'user', content: 'ping' },
      ]);
      return Date.now() - t0;
    } catch (e) {
      return -1;
    }
  }

  /** Find any working model */
  async findWorkingModel() {
    for (const m of MODELS) {
      const lat = await this.testModel(m.id);
      if (lat > 0) {
        this.activeId = m.id;
        return m;
      }
    }
    return null;
  }

  /** Get API stats report */
  getReport() {
    const lines = [];
    for (const m of MODELS) {
      const s = this.apiStats.get(m.id);
      lines.push(`${m.id}. ${m.name} ${'⭐'.repeat(m.tier)} | calls:${s.calls} fails:${s.fails} ${m.id===this.activeId?'← ACTIVE':''}`);
    }
    return lines.join('\n');
  }

  get activeModel() { return MODELS[this.activeId]; }
  get activeId() { return this._activeId; }
  set activeId(v) { this._activeId = v; }
}

module.exports = { AIEngine, MODELS };