// 餐桌消息流：chat_messages 的读写，以及"让某只智能体说一句"（调 ai 云函数）。
// 只有一个会话，用常量 'our-table'，所以不需要 chat_conversations 表。

const CONFIG = require('../config');
const cloud = require('./cloud');

const CONVERSATION_ID = 'our-table';
const LOCAL_KEY = 'chat_messages'; // 和旧的本地缓存共用一个 key，mock 模式无缝衔接
const LOCAL_MAX = 200;

function loadLocal() {
  return wx.getStorageSync(LOCAL_KEY) || [];
}

function saveLocal(list) {
  wx.setStorageSync(LOCAL_KEY, list.slice(-LOCAL_MAX));
}

function shape(doc) {
  return {
    id: doc._id,
    conversation_id: doc.conversation_id || CONVERSATION_ID,
    sender_role: doc.sender_role || 'system',
    agent_id: doc.agent_id || '',
    content_type: doc.content_type || 'text',
    content: doc.content || '',
    ref_record_id: doc.ref_record_id || '',
    status: doc.status || 'sent',
    created_at: doc.created_at || 0
  };
}

// 取最近的消息（按时间正序返回）
function getMessages(limit) {
  const n = limit || 50;
  if (CONFIG.USE_MOCK_DATA) {
    return Promise.resolve(loadLocal().slice(-n));
  }
  if (CONFIG.BACKEND === 'cloud') {
    return cloud
      .collection('chat_messages')
      .where({ conversation_id: CONVERSATION_ID })
      .orderBy('created_at', 'desc')
      .limit(n)
      .get()
      .then(function (res) {
        return (res.data || []).map(shape).reverse();
      })
      .catch(function () {
        // 集合还没建 / 没权限时别把页面卡死
        return [];
      });
  }
  return Promise.resolve([]);
}

function addMessage(msg) {
  const now = Date.now();
  const doc = {
    conversation_id: CONVERSATION_ID,
    sender_role: msg.sender_role || 'system',
    agent_id: msg.agent_id || '',
    content_type: msg.content_type || 'text',
    content: msg.content || '',
    ref_record_id: msg.ref_record_id || '',
    status: msg.status || 'sent',
    created_at: msg.created_at || now
  };

  if (CONFIG.USE_MOCK_DATA) {
    const list = loadLocal();
    const local = Object.assign({ id: 'msg-' + now }, doc);
    list.push(local);
    saveLocal(list);
    return Promise.resolve(local);
  }

  if (CONFIG.BACKEND === 'cloud') {
    return cloud.collection('chat_messages').add({ data: doc }).then(function (res) {
      return shape(Object.assign({ _id: res._id }, doc));
    });
  }
  return Promise.resolve(shape(doc));
}

// 改状态：'sending' -> 'sent' / 'failed'（配合"发送失败，点重试"）
function updateStatus(id, status) {
  if (CONFIG.USE_MOCK_DATA) {
    const list = loadLocal().map(function (m) {
      return m.id === id ? Object.assign({}, m, { status: status }) : m;
    });
    saveLocal(list);
    return Promise.resolve(true);
  }
  if (CONFIG.BACKEND === 'cloud') {
    return cloud.collection('chat_messages').doc(id).update({ data: { status: status } })
      .then(function () { return true; });
  }
  return Promise.resolve(false);
}

function removeMessage(id) {
  if (CONFIG.USE_MOCK_DATA) {
    saveLocal(loadLocal().filter(function (m) { return m.id !== id; }));
    return Promise.resolve(true);
  }
  if (CONFIG.BACKEND === 'cloud') {
    return cloud.collection('chat_messages').doc(id).remove().then(function () { return true; });
  }
  return Promise.resolve(false);
}

// 记录上桌：发一条"引用型"消息（只存 ref_record_id，不存快照；记录删了消息也不崩）
function postFoodRecordMessage(record) {
  const names = (record.foods || []).map(function (f) { return f.name; }).filter(Boolean).join('、');
  const who = record.owner_name || '';
  return addMessage({
    sender_role: record.owner_role || 'system',
    content_type: 'food_record',
    content: who + '记录了' + (names || '一餐'),
    ref_record_id: record.id
  });
}

// 让某只智能体说一句。
// 上下文（"记忆"：最近对话 + 今天的餐桌 + 最近一周 + 口味）由 ai 云函数自己组装，
// 这里只给一句"为什么现在说话"的提示。
function askAgent(agent, hint) {
  return cloud.call('ai', {
    action: 'chat',
    agent_id: agent.id,
    hint: hint || '接着说一句'
  }).then(function (res) {
    return addMessage({
      sender_role: 'system',
      agent_id: agent.id,
      content_type: 'text',
      content: res.text || ''
    });
  });
}

module.exports = {
  CONVERSATION_ID,
  getMessages,
  addMessage,
  updateStatus,
  removeMessage,
  postFoodRecordMessage,
  askAgent,
  shape
};
