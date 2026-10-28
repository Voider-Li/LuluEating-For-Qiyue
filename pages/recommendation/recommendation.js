const recommendationService = require('../../services/recommendation');
const foodService = require('../../services/food');

Page({
  data: {
    theme: 'warm',
    loading: false,
    result: null,
    todayCount: 0
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'warm' });
    this.refreshCount();
  },

  async refreshCount() {
    try {
      const records = await foodService.getTodayRecords();
      this.setData({ todayCount: (records || []).length });
    } catch (e) {
      // 忽略：展示层不需要阻塞
    }
  },

  async onRecommend() {
    this.setData({ loading: true, result: null });
    try {
      const result = await recommendationService.getRecommendation();
      this.setData({ result: result, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '没能生成建议，再试一次吧', icon: 'none' });
    }
  }
});
