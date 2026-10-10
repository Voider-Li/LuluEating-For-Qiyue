const CONFIG = require('../config');
const supabase = require('./supabase');

const MOCK_USERS = [
  { id: 'mock-qiyue', email: 'qiyue@example.com', nickname: '祈栎', role: 'qiyue' },
  { id: 'mock-qinghui', email: 'qinghui@example.com', nickname: '清辉', role: 'qinghui' }
];

function mockUser() {
  const activeId = wx.getStorageSync('mock_active_account') || 'mock-qiyue';
  return MOCK_USERS.find((item) => item.id === activeId) || MOCK_USERS[0];
}

function setMockUser(id) {
  const user = MOCK_USERS.find((item) => item.id === id) || MOCK_USERS[0];
  wx.setStorageSync('mock_active_account', user.id);
  wx.setStorageSync('auth_user', user);
  return user;
}

function getToken() { return wx.getStorageSync('auth_token') || ''; }

// ---------- 云开发 ----------

// 内存缓存，避免每次 getCurrentUser 都打一次云函数
let _cloudUser = null;

// 直接调 callFunction（而不是走 cloud.call），因为要把"坐满了/被占了"这类
// 业务失败当成状态返回，而不是当异常抛出。
function callLogin(data) {
  if (!wx.cloud) return Promise.reject(new Error('当前基础库不支持云开发'));
  return wx.cloud.callFunction({ name: 'login', data: data || {} }).then(
    function (r) { return (r && r.result) || {}; },
    function (err) {
      const msg = (err && (err.errMsg || err.message)) || '云函数调用失败';
      throw new Error('login：' + msg);
    }
  );
}

function shapeUser(res) {
  const profile = res && res.profile;
  return {
    id: (res && res.openid) || '',
    openid: (res && res.openid) || '',
    nickname: (profile && profile.nickname) || '',
    avatar: (profile && profile.avatar) || '',
    role: (profile && profile.role) || '',
    // 还没认领身份（第一次打开）时为 false，页面据此弹"你是谁"
    claimed: !!(profile && profile.role)
  };
}

function cloudLogin(force) {
  if (_cloudUser && !force) return Promise.resolve(_cloudUser);
  return callLogin({}).then(function (res) {
    if (res.ok === false) {
      if (res.full || res.taken || res.locked) {
        // 身份校验没过：当成"被挡住"的状态，让页面显示原因
        _cloudUser = { id: '', openid: res.openid || '', blocked: true, message: res.error || '进不来' };
        return _cloudUser;
      }
      throw new Error(res.error || '登录失败');
    }
    const user = shapeUser(res);
    _cloudUser = user;
    wx.setStorageSync('auth_user', user);
    return user;
  });
}

// 认领身份：'qiyue' | 'qinghui'
function claimRole(role, nickname) {
  return callLogin({ action: 'claim', role: role, nickname: nickname }).then(function (res) {
    if (res.ok === false) throw new Error(res.error || '设置失败');
    _cloudUser = null;
    return cloudLogin(true);
  });
}

// ---------- 对外 ----------

function getCurrentUser() {
  if (CONFIG.USE_MOCK_DATA) return Promise.resolve(mockUser());
  if (CONFIG.BACKEND === 'cloud') return cloudLogin(false);
  const cached = wx.getStorageSync('auth_user');
  return Promise.resolve(cached && cached.id ? cached : null);
}

function login(email, password) {
  if (CONFIG.USE_MOCK_DATA) {
    const user = MOCK_USERS.find((item) => item.id === email || item.email === email) || mockUser();
    return Promise.resolve(setMockUser(user.id));
  }
  if (CONFIG.BACKEND === 'cloud') return cloudLogin(true);
  if (!email || !password) return Promise.reject(new Error('请输入邮箱和密码'));
  return supabase.signInWithPassword(email, password).then(function (data) {
    const user = { id: data.user.id, email: data.user.email, nickname: data.user.user_metadata && data.user.user_metadata.nickname };
    wx.setStorageSync('auth_token', data.access_token);
    wx.setStorageSync('auth_user', user);
    return user;
  });
}

function register(email, password) {
  if (CONFIG.USE_MOCK_DATA) return login(email, password);
  if (CONFIG.BACKEND === 'cloud') return cloudLogin(true);
  return supabase.signUp(email, password);
}

function logout() {
  const clearLocal = function () {
    _cloudUser = null;
    wx.removeStorageSync('auth_token');
    wx.removeStorageSync('auth_user');
  };
  if (CONFIG.BACKEND === 'cloud') return Promise.resolve(clearLocal());
  if (!CONFIG.USE_MOCK_DATA) return supabase.signOut(getToken()).catch(function () {}).then(clearLocal);
  return Promise.resolve(clearLocal());
}

module.exports = {
  MOCK_USERS,
  mockUser,
  setMockUser,
  getToken,
  getCurrentUser,
  claimRole,
  login,
  register,
  logout
};
