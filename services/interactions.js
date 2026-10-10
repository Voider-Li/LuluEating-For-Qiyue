// 互动：点赞 / 取消赞 + 评论 / 回复。
// 点赞单独一张表（post_likes），这样才取消得掉——只存个数字是取消不掉的。

const CONFIG = require('../config');
const cloud = require('./cloud');
const authService = require('./auth');
const favoritesService = require('./favorites');

const LOCAL_LIKES = 'mock_likes';       // [{ record_id, user_id }]
const LOCAL_COMMENTS = 'mock_comments'; // [{ id, record_id, parent_id, user_id, user_name, content, created_at }]

function loadLocal(key) { return wx.getStorageSync(key) || []; }
function saveLocal(key, rows) { wx.setStorageSync(key, rows); }

/* ---------------- 点赞 ---------------- */

// 返回 { [recordId]: { count, liked } }
function getLikeState(recordIds) {
  const ids = (recordIds || []).filter(Boolean);
  const empty = {};
  if (!ids.length) return Promise.resolve(empty);

  if (CONFIG.USE_MOCK_DATA) {
    const me = authService.mockUser();
    const rows = loadLocal(LOCAL_LIKES);
    const out = {};
    ids.forEach(function (id) {
      const forRecord = rows.filter(function (r) { return r.record_id === id; });
      out[id] = { count: forRecord.length, liked: forRecord.some(function (r) { return r.user_id === me.id; }) };
    });
    return Promise.resolve(out);
  }

  if (CONFIG.BACKEND === 'cloud') {
    const _ = cloud.command();
    return authService.getCurrentUser().then(function (user) {
      return cloud.collection('post_likes')
        .where({ record_id: _.in(ids) })
        .limit(100)
        .get()
        .then(function (res) {
          const rows = res.data || [];
          const out = {};
          ids.forEach(function (id) {
            const forRecord = rows.filter(function (r) { return r.record_id === id; });
            out[id] = { count: forRecord.length, liked: forRecord.some(function (r) { return r._openid === user.openid; }) };
          });
          return out;
        })
        .catch(function () { return empty; });
    });
  }
  return Promise.resolve(empty);
}

function like(recordId) {
  if (CONFIG.USE_MOCK_DATA) {
    const me = authService.mockUser();
    const rows = loadLocal(LOCAL_LIKES);
    if (!rows.some(function (r) { return r.record_id === recordId && r.user_id === me.id; })) {
      rows.push({ record_id: recordId, user_id: me.id });
      saveLocal(LOCAL_LIKES, rows);
    }
    return Promise.resolve(true);
  }
  if (CONFIG.BACKEND === 'cloud') {
    return cloud.collection('post_likes')
      .add({ data: { record_id: recordId, created_at: Date.now() } })
      .then(function () { return true; });
  }
  return Promise.resolve(false);
}

function unlike(recordId) {
  if (CONFIG.USE_MOCK_DATA) {
    const me = authService.mockUser();
    const rows = loadLocal(LOCAL_LIKES).filter(function (r) {
      return !(r.record_id === recordId && r.user_id === me.id);
    });
    saveLocal(LOCAL_LIKES, rows);
    return Promise.resolve(true);
  }
  if (CONFIG.BACKEND === 'cloud') {
    return authService.getCurrentUser().then(function (user) {
      return cloud.collection('post_likes')
        .where({ record_id: recordId, _openid: user.openid })
        .limit(1)
        .get()
        .then(function (res) {
          const row = res.data && res.data[0];
          if (!row) return true;
          return cloud.collection('post_likes').doc(row._id).remove().then(function () { return true; });
        });
    });
  }
  return Promise.resolve(false);
}

// 切换点赞，返回最新状态 { count, liked }
function toggleLike(recordId) {
  return getLikeState([recordId]).then(function (state) {
    const liked = state[recordId] && state[recordId].liked;
    const next = liked ? unlike(recordId) : like(recordId);
    return next.then(function () {
      return getLikeState([recordId]).then(function (s) { return s[recordId] || { count: 0, liked: !liked }; });
    });
  });
}

/* ---------------- 评论 ---------------- */

function shapeComment(d, users) {
  return {
    id: d._id || d.id,
    record_id: d.record_id || '',
    parent_id: d.parent_id || '',
    user_id: d._openid || d.user_id || '',
    user_name: d.user_name || (users && users[d._openid || d.user_id]) || '',
    content: d.content || '',
    created_at: d.created_at || 0
  };
}

function getComments(recordId) {
  if (CONFIG.USE_MOCK_DATA) {
    const rows = loadLocal(LOCAL_COMMENTS).filter(function (r) { return r.record_id === recordId; });
    return Promise.resolve(rows.sort(function (a, b) { return a.created_at - b.created_at; }));
  }
  if (CONFIG.BACKEND === 'cloud') {
    return cloud.collection('post_comments')
      .where({ record_id: recordId })
      .orderBy('created_at', 'asc')
      .limit(100)
      .get()
      .then(function (res) { return (res.data || []).map(function (d) { return shapeComment(d); }); })
      .catch(function () { return []; });
  }
  return Promise.resolve([]);
}

// parentId 为空 = 普通评论；有值 = 回复那条评论
function addComment(recordId, content, parentId) {
  const text = (content || '').trim();
  if (!text) return Promise.reject(new Error('评论不能为空'));

  if (CONFIG.USE_MOCK_DATA) {
    const me = authService.mockUser();
    const rows = loadLocal(LOCAL_COMMENTS);
    const row = {
      id: 'c-' + Date.now(),
      record_id: recordId,
      parent_id: parentId || '',
      user_id: me.id,
      user_name: me.nickname,
      content: text,
      created_at: Date.now()
    };
    rows.push(row);
    saveLocal(LOCAL_COMMENTS, rows);
    return Promise.resolve(row);
  }

  if (CONFIG.BACKEND === 'cloud') {
    return authService.getCurrentUser().then(function (user) {
      const doc = {
        record_id: recordId,
        parent_id: parentId || '',
        user_name: user.nickname || '',
        content: text,
        created_at: Date.now()
      };
      return cloud.collection('post_comments').add({ data: doc }).then(function (res) {
        return shapeComment(Object.assign({ _id: res._id }, doc));
      });
    });
  }
  return Promise.resolve(null);
}

function removeComment(id) {
  if (CONFIG.USE_MOCK_DATA) {
    saveLocal(LOCAL_COMMENTS, loadLocal(LOCAL_COMMENTS).filter(function (r) { return r.id !== id; }));
    return Promise.resolve(true);
  }
  if (CONFIG.BACKEND === 'cloud') {
    return cloud.collection('post_comments').doc(id).remove().then(function () { return true; });
  }
  return Promise.resolve(false);
}

// 批量取多条记录的评论，返回 { [recordId]: [comment] }
function getCommentsForRecords(recordIds) {
  const ids = (recordIds || []).filter(Boolean);
  const empty = {};
  if (!ids.length) return Promise.resolve(empty);

  if (CONFIG.USE_MOCK_DATA) {
    const rows = loadLocal(LOCAL_COMMENTS);
    const out = {};
    ids.forEach(function (id) { out[id] = []; });
    rows.forEach(function (r) { if (out[r.record_id]) out[r.record_id].push(r); });
    ids.forEach(function (id) {
      out[id].sort(function (a, b) { return a.created_at - b.created_at; });
    });
    return Promise.resolve(out);
  }

  if (CONFIG.BACKEND === 'cloud') {
    const _ = cloud.command();
    return cloud.collection('post_comments')
      .where({ record_id: _.in(ids) })
      .orderBy('created_at', 'asc')
      .limit(100)
      .get()
      .then(function (res) {
        const out = {};
        ids.forEach(function (id) { out[id] = []; });
        (res.data || []).forEach(function (d) {
          const c = shapeComment(d);
          if (out[c.record_id]) out[c.record_id].push(c);
        });
        return out;
      })
      .catch(function () { return empty; });
  }
  return Promise.resolve(empty);
}

// 一次性取一批记录的完整互动状态：
// { [recordId]: { liked, likeCount, favorite, comments, commentCount } }
// 页面加载时调一次，再把结果通过 reactions 属性传给 food-record-card，
// 避免每张卡各查一遍（那样 20 条记录就是 60 次请求）。
function getReactions(recordIds) {
  const ids = (recordIds || []).filter(Boolean);
  if (!ids.length) return Promise.resolve({});

  return Promise.all([
    getLikeState(ids),
    getCommentsForRecords(ids),
    favoritesService.list().catch(function () { return []; })
  ]).then(function (arr) {
    const likes = arr[0] || {};
    const comments = arr[1] || {};
    const favs = arr[2] || [];
    const favSet = {};
    favs.forEach(function (f) { if (f.record_id) favSet[f.record_id] = true; });

    const out = {};
    ids.forEach(function (id) {
      const s = likes[id] || { count: 0, liked: false };
      const cs = comments[id] || [];
      out[id] = {
        liked: !!s.liked,
        likeCount: s.count || 0,
        favorite: !!favSet[id],
        comments: cs,
        commentCount: cs.length
      };
    });
    return out;
  });
}

module.exports = {
  getLikeState,
  like,
  unlike,
  toggleLike,
  getComments,
  getCommentsForRecords,
  getReactions,
  addComment,
  removeComment
};
