const CONFIG = require('../config');
const supabase = require('./supabase');
const cloud = require('./cloud');
const authService = require('./auth');

const DEFAULT_PREFS = {
  taste: '清淡',
  cuisines: ['中餐'],
  liked: ['鸡蛋', '鸡胸肉'],
  disliked: ['香菜', '苦瓜'],
  allergens: []
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

  if (CONFIG.BACKEND === 'cloud') {
    return authService.getCurrentUser().then(function (user) {
      return cloud.collection('dietary_preferences')
        .where({ _openid: user.openid })
        .limit(1)
        .get()
        .then(function (res) {
          const row = res.data && res.data[0];
          return {
            taste: (row && row.taste) || DEFAULT_PREFS.taste,
            cuisines: (row && row.cuisines) || [],
            liked: (row && row.liked) || [],
            disliked: (row && row.disliked) || [],
            allergens: (row && row.allergens) || []
          };
        })
        .catch(function () {
          // 集合还没建 / 没权限时，先给默认值，不把页面卡死
          return Object.assign({}, DEFAULT_PREFS);
        });
    });
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

  if (CONFIG.BACKEND === 'cloud') {
    return authService.getCurrentUser().then(function (user) {
      const data = {
        taste: prefs.taste,
        cuisines: prefs.cuisines || [],
        liked: prefs.liked || [],
        disliked: prefs.disliked || [],
        allergens: prefs.allergens || [],
        updated_at: Date.now()
      };
      return cloud.collection('dietary_preferences')
        .where({ _openid: user.openid })
        .limit(1)
        .get()
        .then(function (res) {
          const row = res.data && res.data[0];
          if (row) {
            return cloud.collection('dietary_preferences').doc(row._id).update({ data: data });
          }
          return cloud.collection('dietary_preferences').add({ data: data });
        })
        .then(function () { return prefs; });
    });
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
