// 三只智能体：优先从云数据库 chat_agents 读（改人设不用发版），
// 读不到（没跑 initDb / 没权限 / mock 模式）就退回前端 utils/agents.js 的默认值。

const CONFIG = require('../config');
const cloud = require('./cloud');
const defaults = require('../utils/agents');

function shape(doc) {
  return {
    id: doc._id,
    name: doc.name || '',
    emoji: doc.emoji || '✦',
    avatar: doc.avatar_file_id || doc.avatar || '',
    tone: doc.tone || '',
    color: doc.color || '#F4E7C5',
    textColor: doc.textColor || '#8A5A12',
    description: doc.description || '',
    system_prompt: doc.system_prompt || '',
    model: doc.model || '',
    temperature: doc.temperature,
    chattiness: doc.chattiness == null ? 50 : doc.chattiness,
    seat: doc.seat || { left: 50, top: 92 },
    enabled: doc.enabled !== false,
    greeting: doc.greeting || [],
    replies: doc.replies || []
  };
}

function getAgents() {
  if (CONFIG.BACKEND !== 'cloud') {
    return Promise.resolve(defaults.getAgents());
  }
  return cloud
    .collection('chat_agents')
    .limit(100)
    .get()
    .then(function (res) {
      const list = (res.data || []).map(shape).filter(function (a) { return a.enabled; });
      return list.length ? mergeDefaults(list) : defaults.getAgents();
    })
    .catch(function () {
      return defaults.getAgents();
    });
}

// 数据库里的人设是"覆盖"，前端默认值当兜底：
// 问候语 / 回复模板这类内容如果没在数据库里改，就用前端那份，页面不至于空。
function mergeDefaults(list) {
  const defs = defaults.DEFAULT_AGENTS || [];
  return list.map(function (agent) {
    const d = defs.filter(function (x) { return x.id === agent.id; })[0] || {};
    return Object.assign({}, agent, {
      greeting: (agent.greeting && agent.greeting.length) ? agent.greeting : (d.greeting || []),
      replies: (agent.replies && agent.replies.length) ? agent.replies : (d.replies || []),
      seat: agent.seat || d.seat,
      color: agent.color || d.color,
      textColor: agent.textColor || d.textColor,
      description: agent.description || d.description || ''
    });
  });
}

// 按话痨度随机挑一只（chattiness 越高越容易被挑中）
function pickAgent(agents) {
  const list = agents && agents.length ? agents : [];
  if (!list.length) return null;
  const total = list.reduce(function (sum, a) {
    return sum + Math.max(1, a.chattiness == null ? 50 : a.chattiness);
  }, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    roll -= Math.max(1, list[i].chattiness == null ? 50 : list[i].chattiness);
    if (roll <= 0) return list[i];
  }
  return list[list.length - 1];
}

module.exports = { getAgents, pickAgent, shape };
