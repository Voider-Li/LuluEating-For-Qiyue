// 记录上桌：一条新记录 → 往餐桌的消息流里发一条 + 随机挑一只智能体回一句。
// cloud 模式走 chat_messages（chat.js）；mock 模式沿用原来的本地缓存写法。

const CONFIG = require('../config');
const agentsUtil = require('../utils/agents');
const agentsService = require('./agents');
const chatService = require('./chat');

function recordText(record) {
  const foods = (record.foods || record.food_items || []).map(function (food) { return food.name; }).filter(Boolean);
  return foods.length ? foods.join('、') : '这一餐';
}

// mock 模式用的模板回复
function makeAgentReply(agent, record) {
  const foods = recordText(record);
  const note = record.note || record.ga_da_note || '';
  const openers = {
    'egg-sheep': '这顿看起来也太香了吧！',
    'capybara-lulu': '看到你有好好记录这一餐，我就放心一点啦。',
    'lumei': '根据我的观察，这顿饭的关键词是：' + foods + '。'
  };
  const endings = {
    'egg-sheep': '我可以申请隔着屏幕偷吃一口吗？',
    'capybara-lulu': '如果今天有点累，也记得给自己留一点休息时间。',
    'lumei': '不过下次要不要再加一点蔬菜？我会继续观察的。'
  };
  return (openers[agent.id] || '我看到你刚刚记录了一顿饭。') +
    (note ? '你还写了“' + note + '”，听起来今天也发生了不少事情。' : '') + ' ' +
    (endings[agent.id] || '今天也要好好吃饭呀。');
}

function publishFoodRecordToChat(record) {
  if (CONFIG.BACKEND === 'cloud') {
    // 云端：先发"记录上桌"的消息，再挑一只智能体回一句（失败不影响记录本身）
    return chatService.postFoodRecordMessage(record)
      .then(function () { return chatService.getMessages(10); })
      .then(function (history) {
        return agentsService.getAgents().then(function (agents) {
          const agent = agentsService.pickAgent(agents);
          if (!agent) return null;
          return chatService.askAgent(agent, history);
        });
      })
      .catch(function (e) {
        console.warn('[chat] 记录上桌失败：', e && e.message);
      });
  }

  // mock：写本地缓存
  const messages = wx.getStorageSync('chat_messages') || [];
  const agent = agentsUtil.pickAgent();
  const now = Date.now();
  const event = {
    id: 'food-event-' + now,
    type: 'food_record',
    from: 'system',
    actorName: record.owner_name || '祈栎',
    text: (record.owner_name || '祈栎') + '刚刚记录了' + recordText(record),
    record: record,
    time: now
  };
  const reply = {
    id: 'agent-reply-' + (now + 1),
    type: 'agent',
    from: 'agent',
    agentId: agent.id,
    agentName: agent.name,
    agentEmoji: agent.emoji,
    agentColor: agent.color,
    agentTextColor: agent.textColor,
    text: makeAgentReply(agent, record),
    time: now + 1
  };
  wx.setStorageSync('chat_messages', messages.concat([event, reply]).slice(-200));
  return Promise.resolve();
}

module.exports = { publishFoodRecordToChat };
