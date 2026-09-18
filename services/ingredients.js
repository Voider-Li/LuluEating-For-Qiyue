const CONFIG = require('../config');
const supabase = require('./supabase');
const authService = require('./auth');

const MOCK_SEED = [
  { id: 'i1', name: '鸡蛋', quantity: '6 个', note: '' },
  { id: 'i2', name: '西红柿', quantity: '', note: '还剩 2 个' },
  { id: 'i3', name: '青菜', quantity: '', note: '' }
];

function loadLocal() {
  const cached = wx.getStorageSync('mock_ingredients');
  if (cached && cached.length) return cached;
  wx.setStorageSync('mock_ingredients', MOCK_SEED);
  return MOCK_SEED.slice();
}

function list() {
  if (CONFIG.USE_MOCK_DATA) {
    return Promise.resolve(loadLocal());
  }
  return authService.getCurrentUser().then(function (user) {
    return supabase.selectFrom('ingredients', {
      columns: 'id,name,quantity,note,created_at',
      filters: { user_id: user.id },
      order: 'created_at',
      orderDirection: 'asc'
    });
  });
}

function add(name, quantity, note) {
  if (CONFIG.USE_MOCK_DATA) {
    const list = loadLocal();
    const item = {
      id: 'i' + Date.now(),
      name: name,
      quantity: quantity || '',
      note: note || ''
    };
    list.push(item);
    wx.setStorageSync('mock_ingredients', list);
    return Promise.resolve(item);
  }
  return authService.getCurrentUser().then(function (user) {
    return supabase.insertInto('ingredients', {
      user_id: user.id,
      name: name,
      quantity: quantity || '',
      note: note || ''
    });
  });
}

function remove(id) {
  if (CONFIG.USE_MOCK_DATA) {
    const list = loadLocal().filter(function (item) { return item.id !== id; });
    wx.setStorageSync('mock_ingredients', list);
    return Promise.resolve();
  }
  return authService.getCurrentUser().then(function (user) {
    return supabase.deleteFrom('ingredients', { id: id, user_id: user.id });
  });
}

module.exports = {
  list,
  add,
  remove
};
