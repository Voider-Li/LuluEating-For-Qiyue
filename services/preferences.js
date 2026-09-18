const CONFIG = require('../config');
const supabase = require('./supabase');
const authService = require('./auth');

const DEFAULT_PREFS = {
  taste: '清淡',
  cuisines: ['中餐'],
  liked: ['鸡蛋', '鸡胸肉'],
  disliked: ['香菜', '苦瓜']
};

function loadLocal() {
  const cached = wx.getStorageSync('mock_preferences');
  if (cached && cached.taste) return cached;
  wx.setStorageSync('mock_preferences', DEFAULT_PREFS);
  return Object.assign({}, DEFAULT_PREFS);
}

function get() {
  if (CONFIG.USE_MOCK_DATA) {
    return Promise.resolve(loadLocal());
  }
  return authService.getCurrentUser().then(function (user) {
    return supabase
      .selectFrom('dietary_preferences', {
        columns: 'taste,cuisines,liked_foods,disliked_foods',
        filters: { user_id: user.id }
      })
      .then(function (rows) {
        const row = rows && rows[0];
        return {
          taste: (row && row.taste) || '清淡',
          cuisines: (row && row.cuisines) || [],
          liked: (row && row.liked_foods) || [],
          disliked: (row && row.disliked_foods) || []
        };
      });
  });
}

function save(prefs) {
  if (CONFIG.USE_MOCK_DATA) {
    wx.setStorageSync('mock_preferences', prefs);
    return Promise.resolve(prefs);
  }
  return authService.getCurrentUser().then(function (user) {
    const data = {
      user_id: user.id,
      taste: prefs.taste,
      cuisines: prefs.cuisines || [],
      liked_foods: prefs.liked || [],
      disliked_foods: prefs.disliked || []
    };
    return supabase
      .selectFrom('dietary_preferences', { columns: 'id', filters: { user_id: user.id } })
      .then(function (rows) {
        if (rows && rows.length) {
          return supabase.updateTable('dietary_preferences', data, { id: rows[0].id });
        }
        return supabase.insertInto('dietary_preferences', data);
      });
  });
}

module.exports = {
  get,
  save
};
