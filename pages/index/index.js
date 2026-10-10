const app = getApp();
const foodService = require('../../services/food');
const authService = require('../../services/auth');

Page({
  data: {
    user: null,
    needLogin: false,
    needClaim: false,
    blocked: false,
    blockMessage: '',
    email: '',
    password: '',
    loggingIn: false,
    todayRecords: [],
    todayCount: 0,
    hasRecords: false,
    loading: true,
    greeting: '你好呀！',
    menuOpen: false,
    menuItems: [
      { key: 'chat', icon: '💬', label: '进入聊天室', hint: '看看小伙伴说了什么' },
      { key: 'record', icon: '📷', label: '记录这一餐', hint: '拍照或手动补记' },
      { key: 'records', icon: '🫶', label: '看看她的记录', hint: '给清辉点个赞' },
      { key: 'favorites', icon: '⭐', label: '我的收藏', hint: '把好吃的留下来' }
    ],
    todayStatus: [
      { key: 'breakfast', label: '早餐', done: false },
      { key: 'lunch', label: '午餐', done: false },
      { key: 'dinner', label: '晚餐', done: false }
    ],
    nutritionHint: '今天还可以再多一点蔬菜',
    companionText: '三个小家伙在等着你呢!',
    accountSwitching: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.setGreeting();
    this.refresh();
  },

  setGreeting() {
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    let greeting = '晚上好呀！';
    if (totalMinutes >= 180 && totalMinutes < 570) greeting = '早上好呀！';
    else if (totalMinutes >= 570 && totalMinutes < 690) greeting = '上午好呀！';
    else if (totalMinutes >= 690 && totalMinutes <= 810) greeting = '中午好呀！';
    else if (totalMinutes > 810 && totalMinutes <= 1080) greeting = '下午好呀！';
    this.setData({ greeting: greeting });
  },

  async refresh() {
    let user = null;
    try {
      user = await authService.getCurrentUser();
    } catch (e) {
      user = null;
    }
    // 身份校验没过（这张餐桌只坐两个人）
    if (user && user.blocked) {
      this.setData({
        user: null, needLogin: false, needClaim: false,
        blocked: true, blockMessage: user.message || '', loading: false
      });
      return;
    }
    if (!user) {
      this.setData({ needLogin: true, needClaim: false, blocked: false, loading: false, user: null });
      return;
    }
    // 云开发模式：第一次打开还没选"我是谁"
    if (!user.role) {
      this.setData({ user: user, needLogin: false, needClaim: true, blocked: false, loading: false });
      return;
    }
    this.setData({ user: user, needLogin: false, needClaim: false, blocked: false });
    try {
      const records = await foodService.getTodayRecords();
      const todayRecords = (records || []).map(function (r) {
        return Object.assign({}, r, { foods: r.foods || r.food_items || [] });
      });
      const typeMap = {};
      todayRecords.forEach(function (record) { typeMap[record.meal_type] = true; });
      const todayStatus = this.data.todayStatus.map(function (item) {
        return Object.assign({}, item, { done: !!typeMap[item.key] });
      });
      this.setData({
        todayRecords: todayRecords,
        todayCount: todayRecords.length,
        hasRecords: todayRecords.length > 0,
        todayStatus: todayStatus,
        nutritionHint: todayRecords.length >= 2 ? '今天的饮食节奏不错，记得补一点水果' : '今天还可以再多一点蔬菜',
        companionText: todayRecords.length ? '噜噜看到你今天已经认真吃饭了。' : '三个小家伙在等着你呢！',
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  onInputEmail(e) { this.setData({ email: e.detail.value }); },
  onInputPassword(e) { this.setData({ password: e.detail.value }); },

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

  // 云开发：认领身份（我是祈栎 / 我是清辉）
  async onClaim(e) {
    const role = e.currentTarget.dataset.role;
    try {
      wx.showLoading({ title: '设置中', mask: true });
      const user = await authService.claimRole(role);
      app.setUser(user);
      wx.hideLoading();
      await this.refresh();
      wx.showToast({ title: '好啦', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: (err && err.message) || '设置失败', icon: 'none' });
    }
  },

  onSwitchAccount() {
    const names = ['祈栎', '清辉'];
    wx.showActionSheet({ itemList: names, success: async (res) => {
      const isCloud = !!(this.data.user && this.data.user.openid);
      let user;
      if (isCloud) {
        // 云开发：切换"我是谁"（一台手机也能来回测试两边）
        user = await authService.claimRole(res.tapIndex === 0 ? 'qiyue' : 'qinghui');
      } else {
        const accountId = res.tapIndex === 0 ? 'mock-qiyue' : 'mock-qinghui';
        user = authService.setMockUser(accountId);
      }
      this.setData({ user });
      await this.refresh();
      wx.showToast({ title: '已切换为' + user.nickname, icon: 'none' });
    }});
  },
  toggleLuluMenu() { this.setData({ menuOpen: !this.data.menuOpen }); },
  closeLuluMenu() { if (this.data.menuOpen) this.setData({ menuOpen: false }); },
  // 认领弹窗的遮罩：吃掉点击，别透到下面去
  noop() {},

  onMenuTap(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ menuOpen: false });
    if (key === 'chat') this.goChat();
    if (key === 'record') this.goRecord();
    if (key === 'records') this.goRecords();
    if (key === 'favorites') this.goFavorites();
  },

  goChat() { wx.navigateTo({ url: '/pages/chat/chat' }); },
  goRecord() { wx.switchTab({ url: '/pages/record/record' }); },
  goRecommendation() { wx.navigateTo({ url: '/pages/recommendation/recommendation' }); },
  goRecords() { wx.navigateTo({ url: '/pages/records/records' }); },
  goStatistics() { wx.navigateTo({ url: '/pages/statistics/statistics' }); },
  goIngredients() { wx.switchTab({ url: '/pages/ingredients/ingredients' }); },
  goPreferences() { wx.navigateTo({ url: '/pages/preferences/preferences' }); },
  goFavorites() { wx.navigateTo({ url: '/pages/favorites/favorites' }); }
});

