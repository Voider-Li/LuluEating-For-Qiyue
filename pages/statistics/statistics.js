const statisticsService = require('../../services/statistics');
const format = require('../../utils/format');

const RANGE_DAYS = { week: 7, month: 30 };
const MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snack'];

// 把 statistics 服务返回的口径，整形成页面要的形状
function buildStats(raw) {
  const totals = raw.totals || {};
  const averages = raw.averages || {};
  const mealDistribution = raw.mealDistribution || {};
  const overallDistribution = raw.overallDistribution || {};
  const balanceRates = raw.balanceRates || {};
  const meals = totals.meals || 0;

  const mealRows = MEAL_KEYS.map(function (key) {
    const count = mealDistribution[key] || 0;
    return {
      key: key,
      label: format.mealTypeText(key),
      count: count,
      width: meals ? Math.round((count / meals) * 100) : 0
    };
  });

  const dims = format.DIMENSIONS.map(function (d) {
    const rate = balanceRates[d.key] || {};
    const good = rate.good || 0;
    return {
      key: d.key,
      label: d.label,
      count: good,
      total: meals,
      rate: meals ? Math.round((good / meals) * 100) : 0
    };
  });

  const overalls = Object.keys(overallDistribution)
    .filter(function (key) { return overallDistribution[key] > 0; })
    .map(function (key) {
      const meta = format.overallMeta(key);
      return { key: key, text: meta.text, color: meta.color, bg: meta.bg, count: overallDistribution[key] };
    });

  return {
    records: meals,
    calories: Math.round(totals.kcal || 0),
    protein: Math.round(totals.protein || 0),
    avgCalories: averages.kcalPerMeal || 0,
    avgProtein: averages.proteinPerMeal || 0,
    meals: mealRows,
    dims: dims,
    overalls: overalls
  };
}

Page({
  data: {
    range: 'week',
    loading: true,
    stats: null,
    empty: false
  },

  onShow() {
    this.load();
  },

  onRange(e) {
    const range = e.currentTarget.dataset.range;
    if (range === this.data.range) return;
    this.setData({ range: range, stats: null, empty: false, loading: true });
    this.load();
  },

  async load() {
    try {
      const days = RANGE_DAYS[this.data.range] || 7;
      // cloud 模式走 stats 云函数（客户端取不了 >100 条、也不能 aggregate）
      const raw = await statisticsService.getStats(days);
      const stats = buildStats(raw);
      this.setData({
        stats: stats,
        empty: stats.records === 0,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  }
});
