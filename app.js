const CONFIG = require('./config');
const appConfig = require('./services/app-config');

// 主题对应的"下拉露出的窗口底色"，跟 app.wxss 里的 --t-bg 保持一致
const THEME_BG = {
  warm: '#FFF6DE',
  pink: '#FFF1F6'
};

App({
  globalData: {
    user: null,
    isLogin: false,
    cloudReady: false,
    theme: 'warm'
  },

  onLaunch() {
    this.initCloud();
    this.restoreUser();
    this.loadTheme();
  },

  // 主题存在数据库键值对里（app_config.theme），改值不用发版
  loadTheme() {
    appConfig.getTheme()
      .then((theme) => this.setTheme(theme))
      .catch(() => this.setTheme('warm'));
  },

  setTheme(theme) {
    const name = theme || 'warm';
    this.globalData.theme = name;

    // 顺带把窗口底色也换掉，避免下拉时露出跟页面不一致的颜色
    if (wx.setBackgroundColor && THEME_BG[name]) {
      wx.setBackgroundColor({ backgroundColor: THEME_BG[name] });
    }

    // 主题是异步读出来的：读到的时候当前页面早就渲染完了，
    // 这里主动通知它刷一下，否则要等下次 onShow（比如点一下）才变色。
    const pages = getCurrentPages();
    const current = pages[pages.length - 1];
    if (current && typeof current.setData === 'function') {
      try {
        current.setData({ theme: name });
        if (typeof current.getTabBar === 'function' && current.getTabBar()) {
          current.getTabBar().syncTheme();
        }
      } catch (e) {
        // 页面可能正在销毁，忽略
      }
    }
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
