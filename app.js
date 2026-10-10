const CONFIG = require('./config');

App({
  globalData: {
    user: null,
    isLogin: false,
    cloudReady: false
  },

  onLaunch() {
    this.initCloud();
    this.restoreUser();
  },

  // 初始化云开发（只有 BACKEND === 'cloud' 才需要）
  initCloud() {
    if (CONFIG.BACKEND !== 'cloud') return;
    if (!wx.cloud) {
      console.error('[cloud] 当前基础库不支持云开发，请把调试基础库调到 2.2.3 以上');
      return;
    }
    const options = { traceUser: true };
    if (CONFIG.CLOUD_ENV) options.env = CONFIG.CLOUD_ENV;
    wx.cloud.init(options);
    this.globalData.cloudReady = true;
  },

  restoreUser() {
    const cached = wx.getStorageSync('auth_user');
    if (cached && cached.id) {
      this.globalData.user = cached;
      this.globalData.isLogin = true;
      return;
    }
    if (CONFIG.USE_MOCK_DATA) {
      // 演示模式：自动登录一个示例用户，让所有页面可以直接跑通
      this.globalData.user = { id: 'mock-qiyue', nickname: '祈栎', role: 'qiyue' };
      this.globalData.isLogin = true;
      return;
    }
    if (CONFIG.BACKEND === 'cloud') {
      // 云开发：登录态由 openid 决定，启动时静默拉一次
      const authService = require('./services/auth');
      authService.getCurrentUser()
        .then((user) => { if (user) this.setUser(user); })
        .catch((e) => console.warn('[cloud] 启动登录失败：', e && e.message));
    }
  },

  setUser(user) {
    this.globalData.user = user;
    this.globalData.isLogin = !!user;
    if (user) {
      wx.setStorageSync('auth_user', user);
    } else {
      wx.removeStorageSync('auth_user');
    }
  },

  logout() {
    this.setUser(null);
  }
});
