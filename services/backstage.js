// 后厨：清辉提前布置的惊喜（预设菜 / 话，到点自动出现）。
// 只有清辉能布置；祈栎看不到"还没到点"的内容。

const CONFIG = require('../config');
const cloud = require('./cloud');
const authService = require('./auth');

const LOCAL_KEY = 'mock_backstage';

function loadLocal() { return wx.getStorageSync(LOCAL_KEY) || []; }
function saveLocal(rows) { wx.setStorageSync(LOCAL_KEY, rows); }

function shape(d) {
  return {
    id: d._id,
    type: d.type || 'message',
    content: d.content || '',
    for_role: d.for_role || 'qiyue',
    visible_at: d.visible_at || 0,
    status: d.status || 'pending',
    created_at: d.created_at || 0
  };
}

// 清辉视角：自己布置的全部
function listMine() {
  if (CONFIG.USE_MOCK_DATA) {
    return Promise.resolve(loadLocal().slice().sort(function (a, b) { return (a.visible_at || 0) - (b.visible_at || 0); }));
  }
  if (CONFIG.BACKEND === 'cloud') {
    return authService.getCurrentUser().then(function (user) {
      return cloud.collection('backstage')
        .where({ _openid: user.openid })
        .orderBy('visible_at', 'asc')
        .limit(100)
        .get()
        .then(function (res) { return (res.data || []).map(shape); })
        .catch(function () { return []; });
    });
  }
  return Promise.resolve([]);
}

// 到点、且给某人的惊喜（供餐桌/首页读取）
function listDue(forRole, now) {
  const at = now || Date.now();
  const _ = CONFIG.BACKEND === 'cloud' ? cloud.command() : null;

  if (CONFIG.USE_MOCK_DATA) {
    const rows = loadLocal().filter(function (r) {
      return r.status === 'pending' && r.for_role === forRole && (r.visible_at || 0) <= at;
    });
    return Promise.resolve(rows);
  }
  if (CONFIG.BACKEND === 'cloud') {
    return cloud.collection('backstage')
      .where({ for_role: forRole, status: 'pending', visible_at: _.lte(at) })
      .orderBy('visible_at', 'asc')
      .limit(20)
      .get()
      .then(function (res) { return (res.data || []).map(shape); })
      .catch(function () { return []; });
  }
  return Promise.resolve([]);
}

// item: { type: 'dish'|'message', content, for_role, visible_at }
function add(item) {
  const doc = {
    type: item.type || 'message',
    content: item.content || '',
    for_role: item.for_role || 'qiyue',
    visible_at: item.visible_at || Date.now(),
    status: 'pending',
    created_at: Date.now()
  };

  if (CONFIG.USE_MOCK_DATA) {
    const rows = loadLocal();
    const row = Object.assign({ id: 'bs-' + Date.now() }, doc);
    rows.push(row);
    saveLocal(rows);
    return Promise.resolve(row);
  }
  if (CONFIG.BACKEND === 'cloud') {
    return cloud.collection('backstage').add({ data: doc }).then(function (res) {
      return shape(Object.assign({ _id: res._id }, doc));
    });
  }
  return Promise.resolve(null);
}

function markShown(id) {
  if (CONFIG.USE_MOCK_DATA) {
    saveLocal(loadLocal().map(function (r) {
      return r.id === id ? Object.assign({}, r, { status: 'shown' }) : r;
    }));
    return Promise.resolve(true);
  }
  if (CONFIG.BACKEND === 'cloud') {
    return cloud.collection('backstage').doc(id).update({ data: { status: 'shown' } })
      .then(function () { return true; });
  }
  return Promise.resolve(false);
}

function remove(id) {
  if (CONFIG.USE_MOCK_DATA) {
    saveLocal(loadLocal().filter(function (r) { return r.id !== id; }));
    return Promise.resolve(true);
  }
  if (CONFIG.BACKEND === 'cloud') {
    return cloud.collection('backstage').doc(id).remove().then(function () { return true; });
  }
  return Promise.resolve(false);
}

module.exports = { listMine, listDue, add, markShown, remove };
