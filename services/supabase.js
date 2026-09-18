// 轻量 Supabase 客户端封装（基于 wx.request 的 REST 调用）
// 说明：不引入第三方 npm 依赖，直接对接 Supabase 的
//   - PostgREST（/rest/v1）
//   - Auth（/auth/v1）
//   - Storage（/storage/v1）
//   - Edge Functions（/functions/v1）

const CONFIG = require('../config');

function baseUrl() {
  return (CONFIG.SUPABASE_URL || '').replace(/\/+$/, '');
}

function checkConfig() {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('缺少 Supabase 配置：请在 miniprogram/config.js 中填写 SUPABASE_URL 与 SUPABASE_PUBLISHABLE_KEY');
  }
}

function request(options) {
  return new Promise(function (resolve, reject) {
    try {
      checkConfig();
    } catch (e) {
      reject(e);
      return;
    }
    const token = options.token || '';
    wx.request({
      url: baseUrl() + options.path,
      method: options.method || 'GET',
      data: options.data,
      header: Object.assign(
        {
          apikey: CONFIG.SUPABASE_PUBLISHABLE_KEY,
          Authorization: token ? 'Bearer ' + token : 'Bearer ' + CONFIG.SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json'
        },
        options.header || {}
      ),
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error('请求失败(' + res.statusCode + ')：' + JSON.stringify(res.data || res.errMsg)));
        }
      },
      fail: function (err) {
        reject(err);
      }
    });
  });
}

// 把 { column: value } 转成 PostgREST 查询，支持 { 'column.gte': value } 这种操作符写法
function encodeQuery(filters) {
  const keys = Object.keys(filters || {});
  return keys
    .map(function (k) {
      const parts = k.split('.');
      const op = parts.length > 1 ? parts.pop() : 'eq';
      return parts.join('.') + '=' + op + '.' + encodeURIComponent(filters[k]);
    })
    .join('&');
}

// ---- Database ----

function selectFrom(table, options) {
  options = options || {};
  const q = [];
  if (options.columns) q.push('select=' + encodeURIComponent(options.columns));
  const eqs = encodeQuery(options.filters);
  if (eqs) q.push(eqs);
  if (options.order) {
    q.push('order=' + encodeURIComponent(options.order + (options.orderDirection ? '.' + options.orderDirection : '')));
  }
  if (options.limit) q.push('limit=' + options.limit);
  const path = '/rest/v1/' + table + (q.length ? '?' + q.join('&') : '');
  return request({ path: path, method: 'GET', token: options.token });
}

function insertInto(table, rows, token) {
  return request({
    path: '/rest/v1/' + table,
    method: 'POST',
    data: Array.isArray(rows) ? rows : [rows],
    token: token,
    header: { Prefer: 'return=representation' }
  });
}

function updateTable(table, data, filters, token) {
  const eqs = encodeQuery(filters);
  return request({
    path: '/rest/v1/' + table + (eqs ? '?' + eqs : ''),
    method: 'PATCH',
    data: data,
    token: token,
    header: { Prefer: 'return=representation' }
  });
}

function deleteFrom(table, filters, token) {
  const eqs = encodeQuery(filters);
  return request({
    path: '/rest/v1/' + table + (eqs ? '?' + eqs : ''),
    method: 'DELETE',
    token: token,
    header: { Prefer: 'return=representation' }
  });
}

// ---- Auth ----

function signInWithPassword(email, password) {
  return request({
    path: '/auth/v1/token?grant_type=password',
    method: 'POST',
    data: { email: email, password: password }
  });
}

function signUp(email, password) {
  return request({
    path: '/auth/v1/signup',
    method: 'POST',
    data: { email: email, password: password }
  });
}

function signOut(token) {
  return request({ path: '/auth/v1/logout', method: 'POST', token: token });
}

function getUser(token) {
  return request({ path: '/auth/v1/user', method: 'GET', token: token });
}

// ---- Storage ----

function uploadFile(bucket, objectPath, filePath, token) {
  return new Promise(function (resolve, reject) {
    wx.getFileSystemManager().readFile({
      filePath: filePath,
      success: function (res) {
        request({
          path: '/storage/v1/object/' + bucket + '/' + objectPath,
          method: 'POST',
          data: res.data,
          token: token,
          header: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }
        })
          .then(resolve)
          .catch(reject);
      },
      fail: reject
    });
  });
}

function publicUrl(bucket, objectPath) {
  return baseUrl() + '/storage/v1/object/public/' + bucket + '/' + objectPath;
}

// ---- Edge Functions ----

function invokeFunction(name, data, token) {
  return request({ path: '/functions/v1/' + name, method: 'POST', data: data || {}, token: token });
}

module.exports = {
  request,
  selectFrom,
  insertInto,
  updateTable,
  deleteFrom,
  signInWithPassword,
  signUp,
  signOut,
  getUser,
  uploadFile,
  publicUrl,
  invokeFunction
};
