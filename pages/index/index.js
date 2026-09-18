const app = getApp();
const foodService = require('../../services/food');
const authService = require('../../services/auth');

Page({
  data: {
    user: null,
    needLogin: false,
    email: '',
    password: '',
    loggingIn: false,
    todayRecords: [],
    todayCount: 0,
    hasRecords: false,
    loading: true,
    greeting: '你好呀！'
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.setGreeting();
    this.refresh();
  },

  setGreeting() {
    const hour = new Date().getHours();
    let greeting = '晚上好呀！';
    if (hour >= 5 && hour < 11) {
      greeting = '早上好呀！';
    } else if (hour >= 11 && hour < 14) {
      greeting = '中午好呀！';
    }
    this.setData({ greeting: greeting });
  },

  async refresh() {
    const user = await authService.getCurrentUser();
    if (!user) {
      this.setData({ needLogin: true, loading: false, user: null });
      return;
    }

    this.setData({ user: user, needLogin: false });
    try {
      const records = await foodService.getTodayRecords();
      const todayRecords = (records || []).map(function (r) {
        return Object.assign({}, r, { foods: r.foods || r.food_items || [] });
      });
      this.setData({
        todayRecords: todayRecords,
        todayCount: todayRecords.length,
        hasRecords: todayRecords.length > 0,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  onInputEmail(e) {
    this.setData({ email: e.detail.value });
  },

  onInputPassword(e) {
    this.setData({ password: e.detail.value });
  },

  async onLogin() {
    this.setData({ loggingIn: true });
    try {
      const user = await authService.login(this.data.email, this.data.password);
      app.setUser(user);
      await this.refresh();
      wx.showToast({ title: '登录成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || '登录失败', icon: 'none' });
    }
    this.setData({ loggingIn: false });
  },

  goRecord() {
    wx.switchTab({ url: '/pages/record/record' });
  },

  goRecommendation() {
    wx.navigateTo({ url: '/pages/recommendation/recommendation' });
  },

  goRecords() {
    wx.navigateTo({ url: '/pages/records/records' });
  },

  goStatistics() {
    wx.navigateTo({ url: '/pages/statistics/statistics' });
  },

  goIngredients() {
    wx.switchTab({ url: '/pages/ingredients/ingredients' });
  },

  goPreferences() {
    wx.navigateTo({ url: '/pages/preferences/preferences' });
  }
});
