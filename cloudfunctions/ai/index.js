// 云函数：ai
// 接 DeepSeek 官方 API（OpenAI 兼容格式，https://api.deepseek.com/chat/completions）
// 三个动作：
//   chat      智能体说话（会带上"记忆"：最近对话 + 今天的餐桌 + 最近一周 + 口味偏好）
//   recommend 下一餐推荐
//   analyze   看图识餐（走视觉模型）
//
// 环境变量（云函数「配置 -> 环境变量」）：
//   KEY_DEEPSEEK      必填，DeepSeek 的 API Key（sk-...）
//   AI_BASE_URL       可选，默认 https://api.deepseek.com
//   AI_TEXT_MODEL     可选，默认 deepseek-flash
//   AI_VISION_MODEL   可选，默认 deepseek-flash（看图用的；要更稳可试 deepseek-v4-flash-vision-exp）
//
// ⚠️ 记得把这个云函数的「超时时间」调到 60 秒 —— 默认很短，AI 调用会超时。

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const https = require('https');

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_TEXT_MODEL = 'deepseek-flash';
const DEFAULT_VISION_MODEL = 'deepseek-flash';

const CONVERSATION_ID = 'our-table';
const ROLE_NAMES = { qiyue: '祈栎', qinghui: '清辉' };
const WEEK_MS = 7 * 86400000;

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID;
  const action = (event && event.action) || 'chat';
  try {
    if (action === 'chat') return await handleChat(openid, event);
    if (action === 'recommend') return await handleRecommend(openid, event);
    if (action === 'analyze') return await handleAnalyze(openid, event);
    return { ok: false, error: '未知 action：' + action };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
};

/* ---------------- 配置 ---------------- */

function config() {
  const key = process.env.KEY_DEEPSEEK;
  if (!key) {
    throw new Error('缺少环境变量 KEY_DEEPSEEK。请在「云函数 -> ai -> 配置 -> 环境变量」里填上 DeepSeek 的 API Key。');
  }
  return {
    key: key,
    baseUrl: (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    textModel: process.env.AI_TEXT_MODEL || DEFAULT_TEXT_MODEL,
    visionModel: process.env.AI_VISION_MODEL || DEFAULT_VISION_MODEL
  };
}

/* ---------------- 记忆：把"该知道的"拼成一段上下文 ---------------- */

function startOfToday() {
  const offset = 8 * 3600000; // 东八区
  const now = Date.now();
  return Math.floor((now + offset) / 86400000) * 86400000 - offset;
}

async function loadMemory(openid) {
  const now = Date.now();
  const safe = function (p) { return p.catch(function () { return { data: [] }; }); };

  const results = await Promise.all([
    safe(db.collection('profiles').where({ _openid: openid }).limit(1).get()),
    safe(db.collection('food_records')
      .where({ eaten_at: _.gte(startOfToday()).and(_.lte(now)) })
      .orderBy('eaten_at', 'asc').limit(100).get()),
    safe(db.collection('food_records')
      .where({ eaten_at: _.gte(now - WEEK_MS) })
      .orderBy('eaten_at', 'desc').limit(100).get()),
    safe(db.collection('dietary_preferences').where({ _openid: openid }).limit(1).get()),
    safe(db.collection('chat_messages')
      .where({ conversation_id: CONVERSATION_ID })
      .orderBy('created_at', 'desc').limit(12).get())
  ]);

  const profile = (results[0].data && results[0].data[0]) || null;
  return {
    profile: profile,
    meName: (profile && profile.nickname) || ROLE_NAMES[profile && profile.role] || '这位',
    today: results[1].data || [],
    week: results[2].data || [],
    prefs: (results[3].data && results[3].data[0]) || null,
    messages: (results[4].data || []).slice().reverse() // 变回时间正序
  };
}

const MEAL_LABEL = { breakfast: '早饭', lunch: '午饭', dinner: '晚饭', snack: '加餐' };

function recordsLine(records) {
  return records.map(function (r) {
    const foods = (r.foods || []).map(function (f) { return f.name; }).filter(Boolean).join('、') || '（没记菜名）';
    const note = r.note || '';
    const who = r.owner_name || ROLE_NAMES[r.owner_role] || '';
    return '- ' + who + ' ' + (MEAL_LABEL[r.meal_type] || '一餐') + '：' + foods + (note ? '｜碎碎念：「' + note + '」' : '');
  }).join('\n');
}

// 把记忆拼成一段给模型看的文本
function buildMemoryText(mem) {
  const parts = [];

  parts.push('【今天的餐桌】');
  parts.push(mem.today.length ? recordsLine(mem.today) : '（今天两个人都还没记录）');

  const weekNotes = mem.week.filter(function (r) { return r.note; }).length;
  parts.push('【最近一周】两个人一共记录了 ' + mem.week.length + ' 餐' +
    (weekNotes ? '，其中 ' + weekNotes + ' 餐写了碎碎念。' : '。'));

  const p = mem.prefs;
  if (p) {
    parts.push('【' + mem.meName + '的口味】' +
      '口味：' + (p.taste || '未设置') +
      '；喜欢：' + ((p.liked || []).join('、') || '无') +
      '；不喜欢：' + ((p.disliked || []).join('、') || '无') +
      '；过敏原：' + ((p.allergens || []).join('、') || '无') + '。');
  }

  return parts.join('\n');
}

/* ---------------- chat ---------------- */

async function handleChat(openid, event) {
  const agent = await getAgent(event.agent_id);
  const mem = await loadMemory(openid);

  const persona = (agent && agent.system_prompt) ||
    '你是住在清辉和祈栎餐桌上的小伙伴。说话简短、温暖，每次只说一到两句，不要用列表。';

  const system = persona +
    '\n\n下面是你知道的真实情况，请自然地带进对话，不要生硬罗列：\n' + buildMemoryText(mem) +
    '\n\n注意：你是在一个"只能聊吃"的餐桌上说话，别说"有什么可以帮你"这种客服腔。';

  const messages = [{ role: 'system', content: system }];

  // 短期记忆：最近的对话
  mem.messages.forEach(function (m) {
    if (!m.content) return;
    if (m.agent_id) {
      messages.push({ role: 'assistant', content: m.content });
    } else {
      const who = m.sender_role === 'qinghui' ? '清辉' : m.sender_role === 'qiyue' ? '祈栎' : '';
      messages.push({ role: 'user', content: (who ? who + '：' : '') + m.content });
    }
  });

  const hint = event.hint || '接着聊一句';
  messages.push({ role: 'user', content: '（现在）' + hint });

  const started = Date.now();
  const result = await callModel({
    messages: messages,
    model: (agent && agent.model) || undefined,
    temperature: agent && agent.temperature != null ? agent.temperature : 0.8
  });

  await logCall(openid, {
    scene: 'chat', agent_id: event.agent_id || '', model: result.model,
    latency_ms: Date.now() - started, usage: result.usage, ok: true, error: ''
  });

  return { ok: true, text: result.text, model: result.model };
}

/* ---------------- recommend ---------------- */

async function handleRecommend(openid) {
  const mem = await loadMemory(openid);

  const system = '你是一个温柔的家庭饮食助手。根据"今天已经吃过什么"和"口味偏好"，推荐下一餐。' +
    '只输出一个 JSON 对象，不要任何多余文字，格式：' +
    '{"title":"","reason":"","suggestions":["",""],"summary":""}。' +
    'title 是短标题，reason 是推荐理由，suggestions 是 2-4 道菜名，summary 是一两句说明。';

  const started = Date.now();
  const result = await callModel({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: buildMemoryText(mem) + '\n\n请推荐下一餐。' }
    ],
    temperature: 0.7
  });

  await logCall(openid, {
    scene: 'recommend', agent_id: '', model: result.model,
    latency_ms: Date.now() - started, usage: result.usage, ok: true, error: ''
  });

  const parsed = parseJson(result.text) || {};
  return {
    ok: true,
    title: parsed.title || '下一餐推荐',
    reason: parsed.reason || '',
    suggestions: parsed.suggestions || [],
    summary: parsed.summary || result.text
  };
}

/* ---------------- analyze（看图识餐）---------------- */

const ANALYZE_INSTRUCTION = '看这张饭菜照片，识别里面有哪些食物，并估算营养。' +
  '只输出一个 JSON 对象，不要任何多余文字，格式：' +
  '{"foods":[{"name":"","category":"carbohydrate|protein|vegetable|fruit|fat|other","kcal":0,"protein":0,"fat":0,"carb":0}],' +
  '"nutrition":{"kcal":0,"protein":0,"fat":0,"carb":0},' +
  '"balance":{"carbohydrate":"good|fair|low|high|none","protein":"","vegetable":"","fruit":"","fat":""},' +
  '"overall":"balanced|fair|poor","summary":"","suggestion":""}';

async function handleAnalyze(openid, event) {
  if (!event.image_file_id) return { ok: false, error: '缺少 image_file_id' };

  const cfg = config();

  // 把云存储里的图读出来转 base64（比临时链接稳，不受外网可达性影响）
  let dataUrl = '';
  try {
    const dl = await cloud.downloadFile({ fileID: event.image_file_id });
    dataUrl = 'data:image/jpeg;base64,' + dl.fileContent.toString('base64');
  } catch (e) {
    return { ok: false, error: '读取图片失败：' + (e.message || e) };
  }

  const started = Date.now();
  const result = await callModel({
    model: cfg.visionModel,
    temperature: 0.3,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: ANALYZE_INSTRUCTION },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }]
  });

  await logCall(openid, {
    scene: 'analyze', agent_id: '', model: result.model,
    latency_ms: Date.now() - started, usage: result.usage, ok: true, error: ''
  });

  const parsed = parseJson(result.text);
  if (!parsed) return { ok: false, error: '模型没有返回可解析的 JSON', raw: result.text };
  parsed.foods = parsed.foods || [];
  return Object.assign({ ok: true }, parsed);
}

/* ---------------- 底层 ---------------- */

function callModel(opts) {
  const cfg = config();
  const model = opts.model || cfg.textModel;
  const body = {
    model: model,
    messages: opts.messages,
    temperature: opts.temperature == null ? 0.8 : opts.temperature,
    stream: false
  };

  return postJson(cfg.baseUrl + '/chat/completions', {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + cfg.key
  }, body).then(function (res) {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      const detail = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      throw new Error('DeepSeek 返回 ' + res.statusCode + '：' + String(detail).slice(0, 300));
    }
    const data = res.data || {};
    const choice = data.choices && data.choices[0];
    const text = (choice && choice.message && choice.message.content) || '';
    return { text: text, model: data.model || model, usage: data.usage || {} };
  });
}

function postJson(url, headers, body) {
  return new Promise(function (resolve, reject) {
    const u = new (require('url').URL)(url);
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: Object.assign({ 'Content-Length': Buffer.byteLength(payload) }, headers),
      timeout: 50000
    }, function (res) {
      let raw = '';
      res.on('data', function (chunk) { raw += chunk; });
      res.on('end', function () {
        let data;
        try { data = JSON.parse(raw); } catch (e) { data = raw; }
        resolve({ statusCode: res.statusCode, data: data });
      });
    });
    req.on('timeout', function () { req.destroy(new Error('请求 DeepSeek 超时')); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function getAgent(agentId) {
  if (!agentId) return null;
  try {
    const res = await db.collection('chat_agents').doc(agentId).get();
    return res.data || null;
  } catch (e) {
    return null;
  }
}

async function logCall(openid, info) {
  try {
    await db.collection('ai_call_logs').add({
      data: {
        _openid: openid || '',
        scene: info.scene,
        agent_id: info.agent_id || '',
        model: info.model || '',
        latency_ms: info.latency_ms || 0,
        prompt_tokens: (info.usage && info.usage.prompt_tokens) || 0,
        completion_tokens: (info.usage && info.usage.completion_tokens) || 0,
        total_tokens: (info.usage && info.usage.total_tokens) || 0,
        ok: !!info.ok,
        error: info.error || '',
        created_at: Date.now()
      }
    });
  } catch (e) {
    // 日志失败不影响主流程
  }
}

function parseJson(text) {
  if (!text) return null;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}
