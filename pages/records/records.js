const foodService = require('../../services/food');
const dateUtil = require('../../utils/date');

Page({
  data: {
    groups: [],
    loading: true
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const records = await foodService.getAllRecords();
      const sorted = (records || []).slice().sort(function (a, b) {
        return b.eaten_at - a.eaten_at;
      });
      const groups = [];
      const map = {};
      sorted.forEach(function (r) {
        const label = dateUtil.dayLabel(r.eaten_at);
        const record = Object.assign({}, r, { foods: r.foods || r.food_items || [] });
        if (!map[label]) {
          map[label] = [];
          groups.push({ label: label, items: map[label] });
        }
        map[label].push(record);
      });
      this.setData({ groups: groups, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  }
});
