// 统计：最近 7 / 30 天。
// cloud 模式调 stats 云函数（客户端不能 aggregate，也取不了超过 100 条）；
// mock 模式在本地按同样的口径算一份，保证界面一致。

const CONFIG = require('../config');
const cloud = require('./cloud');

const DIMS = ['carbohydrate', 'protein', 'vegetable', 'fruit', 'fat'];

function getStats(days) {
  const d = days === 30 ? 30 : 7;

  if (CONFIG.BACKEND === 'cloud') {
    return cloud.call('stats', { days: d }).then(function (res) {
      return {
        days: (res.range && res.range.days) || d,
        totals: res.totals || {},
        averages: res.averages || {},
        mealDistribution: res.mealDistribution || {},
        overallDistribution: res.overallDistribution || {},
        balanceRates: res.balanceRates || {}
      };
    });
  }

  // mock：拉本地记录自己算
  const foodService = require('./food');
  return foodService.getAllRecords().then(function (records) {
    const end = Date.now();
    const start = end - d * 86400000;
    const inRange = (records || []).filter(function (r) {
      return (r.eaten_at || 0) >= start && (r.eaten_at || 0) < end;
    });
    return summarize(inRange, d, start, end);
  });
}

// 与 cloudfunctions/stats 的口径保持一致
function summarize(records, days, start, end) {
  const totals = { meals: records.length, kcal: 0, protein: 0, fat: 0, carb: 0 };
  const mealDistribution = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  const overallDistribution = { balanced: 0, fair: 0, poor: 0 };
  const balanceRates = {};
  DIMS.forEach(function (dim) {
    balanceRates[dim] = { good: 0, fair: 0, low: 0, high: 0, none: 0, total: 0 };
  });

  records.forEach(function (r) {
    const n = r.nutrition || {};
    totals.kcal += n.kcal || 0;
    totals.protein += n.protein || 0;
    totals.fat += n.fat || 0;
    totals.carb += n.carb || 0;

    if (mealDistribution[r.meal_type] !== undefined) mealDistribution[r.meal_type] += 1;
    if (overallDistribution[r.overall] !== undefined) overallDistribution[r.overall] += 1;

    const b = r.balance || {};
    DIMS.forEach(function (dim) {
      const v = b[dim];
      if (v && balanceRates[dim][v] !== undefined) {
        balanceRates[dim][v] += 1;
        balanceRates[dim].total += 1;
      }
    });
  });

  return {
    days: days,
    totals: totals,
    averages: {
      kcalPerMeal: totals.meals ? Math.round(totals.kcal / totals.meals) : 0,
      proteinPerMeal: totals.meals ? Math.round((totals.protein / totals.meals) * 10) / 10 : 0
    },
    mealDistribution: mealDistribution,
    overallDistribution: overallDistribution,
    balanceRates: balanceRates
  };
}

module.exports = { getStats, DIMS };
