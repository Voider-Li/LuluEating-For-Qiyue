// 云函数：stats
// 作用：算最近 7 / 30 天的饮食统计。
// 为什么必须放云函数：客户端不能 aggregate，单次最多也只能取 100 条。
// 入参：{ days: 7 | 30 }

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const PAGE = 100;
const MAX_PAGES = 50;
const DIMS = ['carbohydrate', 'protein', 'vegetable', 'fruit', 'fat'];

exports.main = async (event) => {
  try {
    const days = event && event.days === 30 ? 30 : 7;
    const end = Date.now();
    const start = end - days * 86400000;

    const records = await fetchAll('food_records', {
      eaten_at: _.gte(start).and(_.lt(end))
    });

    return Object.assign({ ok: true, range: { days: days, start: start, end: end } }, summarize(records));
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
};

async function fetchAll(name, where) {
  const out = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await db.collection(name).where(where).skip(page * PAGE).limit(PAGE).get();
    const data = res.data || [];
    out.push.apply(out, data);
    if (data.length < PAGE) break;
  }
  return out;
}

function summarize(records) {
  const totals = { meals: records.length, kcal: 0, protein: 0, fat: 0, carb: 0 };
  const mealDistribution = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  const overallDistribution = { balanced: 0, fair: 0, poor: 0 };
  const balanceRates = {};
  DIMS.forEach(function (d) {
    balanceRates[d] = { good: 0, fair: 0, low: 0, high: 0, none: 0, total: 0 };
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
    DIMS.forEach(function (d) {
      const v = b[d];
      if (v && balanceRates[d][v] !== undefined) {
        balanceRates[d][v] += 1;
        balanceRates[d].total += 1;
      }
    });
  });

  return {
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
