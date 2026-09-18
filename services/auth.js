const CONFIG = require('../config');
const supabase = require('./supabase');

function mockUser() {
  return { id: 'mock-user-id', email: 'qiyue@example.com', nickname: '七七' };
}

function getToken() {
  return wx.getStorageSync('auth_token') || '';
}

function getCurrentUser() {
  return new Promise(function (resolve) {
    if (CONFIG.USE_MOCK_DATA) {
      resolve(mockUser());
      return;
    }
    const cached = wx.getStorageSync('auth_user');
    if (cached && cached.id) {
      resolve(cached);
      return;
    }
    resolve(null);
  });
}

function login(email, password) {
  if (!email || !password) {
    return Promise.reject(new Error('请输入邮箱和密码'));
  }
  if (CONFIG.USE_MOCK_DATA) {
    const user = mockUser();
    wx.setStorageSync('auth_user', user);
    return Promise.resolve(user);
  }
  return supabase.signInWithPassword(email, password).then(function (data) {
    const user = {
      id: data.user.id,
      email: data.user.email,
      nickname: data.user.user_metadata && data.user.user_metadata.nickname
    };
    wx.setStorageSync('auth_token', data.access_token);
    wx.setStorageSync('auth_user', user);
    return user;
  });
}

function register(email, password) {
  if (CONFIG.USE_MOCK_DATA) {
    return login(email, password);
  }
  return supabase.signUp(email, password);
}

function logout() {
  const clearLocal = function () {
    wx.removeStorageSync('auth_token');
    wx.removeStorageSync('auth_user');
  };
  if (!CONFIG.USE_MOCK_DATA) {
    return supabase
      .signOut(getToken())
      .catch(function () {
        // 忽略登出时的网络错误
      })
      .then(clearLocal);
  }
  return Promise.resolve(clearLocal());
}

module.exports = {
  mockUser,
  getToken,
  getCurrentUser,
  login,
  register,
  logout
};
