// 收藏：谁收藏了哪道菜 / 哪条记录。
// 图片存云存储（favorites-images/），这里负责把 fileID 换成能显示的临时链接。

const CONFIG = require('../config');
const cloud = require('./cloud');
const authService = require('./auth');

const LOCAL_KEY = 'mock_favorites';

function loadLocal() {
  return wx.getStorageSync(LOCAL_KEY) || [];
}

function shape(d) {
  return {
    id: d._id,
    record_id: d.record_id || '',
    name: d.name || '',
    image_file_id: d.image_file_id || '',
    image_path: '', // 由 withUrls 填
    note: d.note || '',
    created_at: d.created_at || 0
  };
}

// 批量把 fileID 换成临时链接
function withUrls(rows) {
  const ids = rows.map(function (r) { return r.image_file_id; }).filter(Boolean);
  if (!ids.length) return Promise.resolve(rows);
  return cloud.tempFileURLs(ids).then(function (urls) {
    const map = {};
    ids.forEach(function (id, i) { map[id] = urls[i] || ''; });
    return rows.map(function (r) {
      return Object.assign({}, r, { image_path: r.image_file_id ? (map[r.image_file_id] || r.image_file_id) : '' });
    });
  });
}

function list() {
  if (CONFIG.USE_MOCK_DATA) {
    return Promise.resolve(loadLocal());
  }
  if (CONFIG.BACKEND === 'cloud') {
    return authService.getCurrentUser().then(function (user) {
      return cloud.collection('favorites')
        .where({ _openid: user.openid })
        .orderBy('created_at', 'desc')
        .limit(100)
        .get()
        .then(function (res) {
          return withUrls((res.data || []).map(shape));
        })
        .catch(function () { return []; });
    });
  }
  return Promise.resolve([]);
}

// item: { record_id?, name, image_path?（本地临时路径或 fileID）, note? }
function add(item) {
  if (CONFIG.USE_MOCK_DATA) {
    const rows = loadLocal();
    const row = {
      id: 'fav-' + Date.now(),
      record_id: item.record_id || '',
      name: item.name || '',
      image_path: item.image_path || '',
      note: item.note || '',
      created_at: Date.now()
    };
    rows.unshift(row);
    wx.setStorageSync(LOCAL_KEY, rows);
    return Promise.resolve(row);
  }

  if (CONFIG.BACKEND === 'cloud') {
    return authService.getCurrentUser().then(function () {
      // 本地临时路径要先传到云存储
      const path = item.image_path || '';
      const pre = item.image_file_id
        ? Promise.resolve(item.image_file_id)
        : (path && path.indexOf('cloud://') !== 0 && path
          ? cloud.upload('favorites', path, '.jpg')
          : Promise.resolve(path || ''));

      return pre.then(function (fileId) {
        const now = Date.now();
        const doc = {
          record_id: item.record_id || '',
          name: item.name || '',
          image_file_id: fileId,
          note: item.note || '',
          created_at: now
        };
        return cloud.collection('favorites').add({ data: doc }).then(function (res) {
          return Object.assign({ id: res._id, image_path: '' }, doc);
        });
      });
    });
  }
  return Promise.resolve(null);
}

function remove(id) {
  if (CONFIG.USE_MOCK_DATA) {
    wx.setStorageSync(LOCAL_KEY, loadLocal().filter(function (r) { return r.id !== id; }));
    return Promise.resolve(true);
  }
  if (CONFIG.BACKEND === 'cloud') {
    return cloud.collection('favorites').doc(id).remove().then(function () { return true; });
  }
  return Promise.resolve(false);
}

module.exports = { list, add, remove };
