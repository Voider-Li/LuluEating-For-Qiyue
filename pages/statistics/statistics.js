const foodService = require('../../services/food');
const nutritionUtil = require('../../utils/nutrition');
const format = require('../../utils/format');

const RANGE_DAYS = { week: 7, month: 30 };
const MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snack'];

function buildStats(records) {
  const allFoods = records.reduce(function (acc, r) {
    return acc.concat(r.foods || r.food_items || []);
  }, []);
  const totals = nutritionUtil.totals(allFoods);

  const mealCounts = {};
  records.forEach(function (r) {
    const key = MEAL_KEYS.indexOf(r.meal_type) >= 0 ? r.meal_type : 'other';
    mealCounts[key] = (mealCounts[key] || 0) + 1;
  });

  const meals = MEAL_KEYS.map(function (key) {
    const count = mealCounts[key] || 0;
    return {
      key: key,
      label: format.mealTypeText(key),
      count: count,
      width: records.length ? Math.round((count / records.length) * 100) : 0
    };
  });

  const dims = format.DIMENSIONS.map(function (d) {
    const good = records.filter(function (r) {
      return r.balance && r.balance[d.key] === 'good';
    }).length;
    return {
      key: d.key,
      label: d.label,
      count: good,
      total: records.length,
      rate: records.length ? Math.round((good / records.length) * 100) : 0
    };
  });

  const overallCounts = {};
  records.forEach(function (r) {
    const key = r.overall || 'other';
    overallCounts[key] = (overallCounts[key] || 0) + 1;
  });
  const overalls = Object.keys(overallCounts).map(function (key) {
    return {
      key: key,
      text: format.overallMeta(key).text,
      color: format.overallMeta(key).color,
      bg: format.overallMeta(key).bg,
      count: overallCounts[key]
    };
  });

  return {
    records: records.length,
    calories: totals.calories,
    protein: totals.protein,
    avgCalories: records.length ? Math.round(totals.calories / records.length) : 0,
    avgProtein: records.length ? Math.round((totals.protein / records.length) * 10) / 10 : 0,
    meals: meals,
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
      const records = await foodService.getAllRecords();
      const days = RANGE_DAYS[this.data.range] || 7;
      const cutoff = Date.now() - days * 86400000;
      const ranged = (records || []).filter(function (r) {
        return r.eaten_at >= cutoff;
      });
      this.setData({
        stats: buildStats(ranged),
        empty: ranged.length === 0,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  }
});
