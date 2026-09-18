const CONFIG = require('./config');

App({
  globalData: {
    user: null,
    isLogin: false
  },

  onLaunch() {
    const cached = wx.getStorageSync('auth_user');
    if (cached && cached.id) {
      this.globalData.user = cached;
      this.globalData.isLogin = true;
    } else if (CONFIG.USE_MOCK_DATA) {
      // 演示模式：自动登录一个示例用户，让所有页面可以直接跑通
      this.globalData.user = { id: 'mock-user', nickname: '七七' };
      this.globalData.isLogin = true;
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
