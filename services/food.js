const CONFIG = require('../config');
const supabase = require('./supabase');
const authService = require('./auth');
const dateUtil = require('../utils/date');
const nutrition = require('../utils/nutrition');

// ---------- mock 数据 ----------

function seedRecords() {
  const now = Date.now();
  const day = 86400000;
  const today = new Date(now);
  const todayNoon = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 30).getTime();
  const yesterdayMorning = todayNoon - day - 4.5 * 3600000; // 昨天 08:00

  const lunchFoods = nutrition.enrichFoods([
    { name: '米饭', category: 'carbohydrate' },
    { name: '红烧肉', category: 'protein' },
    { name: '炒青菜', category: 'vegetable' }
  ]);
  const breakfastFoods = nutrition.enrichFoods([
    { name: '鸡蛋', category: 'protein' },
    { name: '牛奶', category: 'protein' },
    { name: '全麦面包', category: 'carbohydrate' }
  ]);
  const lunchNutrition = nutrition.totals(lunchFoods);
  const breakfastNutrition = nutrition.totals(breakfastFoods);

  return [
    {
      id: 'mock-record-1',
      meal_type: 'lunch',
      eaten_at: todayNoon,
      image_path: '',
      foods: lunchFoods,
      nutrition: lunchNutrition,
      balance: { carbohydrate: 'good', protein: 'good', vegetable: 'low', fruit: 'none', fat: 'high' },
      overall: 'fair',
      summary: '这顿饭主食和蛋白质比较充足，但蔬菜偏少，油脂相对较高。',
      suggestion: '下一餐可以适当增加蔬菜，并减少油炸或高油脂食物。'
    },
    {
      id: 'mock-record-2',
      meal_type: 'breakfast',
      eaten_at: yesterdayMorning,
      image_path: '',
      foods: breakfastFoods,
      nutrition: breakfastNutrition,
      balance: { carbohydrate: 'good', protein: 'good', vegetable: 'none', fruit: 'none', fat: 'fair' },
      overall: 'balanced',
      summary: '早餐蛋白质充足，搭配也比较简单清爽。',
      suggestion: '如果方便的话，可以再加一份水果。'
    }
  ];
}

function loadLocalRecords() {
  const cached = wx.getStorageSync('mock_food_records');
  if (cached && cached.length) return cached;
  const seeds = seedRecords();
  wx.setStorageSync('mock_food_records', seeds);
  return seeds;
}

function saveLocalRecord(payload) {
  const list = loadLocalRecords();
  const record = Object.assign({ id: 'mock-record-' + Date.now() }, payload);
  list.unshift(record);
  wx.setStorageSync('mock_food_records', list);
  return record;
}

function mockAnalysis() {
  const foods = nutrition.enrichFoods([
    { name: '米饭', category: 'carbohydrate' },
    { name: '红烧肉', category: 'protein' },
    { name: '炒青菜', category: 'vegetable' }
  ]);
  return {
    foods: foods,
    nutrition: nutrition.totals(foods),
    balance: { carbohydrate: 'good', protein: 'good', vegetable: 'low', fruit: 'none', fat: 'high' },
    overall: 'fair',
    summary: '这顿饭主食和蛋白质比较充足，但蔬菜偏少，油脂相对较高。',
    suggestion: '下一餐可以适当增加蔬菜，并减少油炸或高油脂食物。'
  };
}

function delay(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// ---------- 业务方法 ----------

function getTodayRecords() {
  if (CONFIG.USE_MOCK_DATA) {
    const list = loadLocalRecords()
      .filter(function (r) { return dateUtil.isToday(r.eaten_at); })
      .sort(function (a, b) { return a.eaten_at - b.eaten_at; });
    return Promise.resolve(list);
  }

  return authService.getCurrentUser().then(function (user) {
    const range = dateUtil.getTodayRange();
    return supabase.selectFrom('food_records', {
      columns: 'id,meal_type,eaten_at,image_path,balance,overall,summary,suggestion,food_items(*)',
      filters: {
        user_id: user.id,
        'eaten_at.gte': new Date(range.start).toISOString(),
        'eaten_at.lt': new Date(range.end).toISOString()
      },
      order: 'eaten_at',
      orderDirection: 'asc'
    });
  });
}

function getAllRecords() {
  if (CONFIG.USE_MOCK_DATA) {
    const list = loadLocalRecords().sort(function (a, b) { return b.eaten_at - a.eaten_at; });
    return Promise.resolve(list);
  }

  return authService.getCurrentUser().then(function (user) {
    return supabase.selectFrom('food_records', {
      columns: 'id,meal_type,eaten_at,image_path,balance,overall,summary,suggestion,food_items(*)',
      filters: { user_id: user.id },
      order: 'eaten_at',
      orderDirection: 'desc'
    });
  });
}

function analyzeFood(imagePath) {
  if (CONFIG.USE_MOCK_DATA) {
    return delay(1600).then(mockAnalysis);
  }

  return authService.getCurrentUser().then(function (user) {
    const token = authService.getToken();
    const objectPath = user.id + '/' + Date.now() + '.jpg';
    return supabase
      .uploadFile('food-images', objectPath, imagePath, token)
      .then(function () {
        return supabase.invokeFunction('analyze-food', { image_path: objectPath }, token);
      });
  });
}

function saveRecord(payload) {
  if (CONFIG.USE_MOCK_DATA) {
    return Promise.resolve(saveLocalRecord(payload));
  }

  return authService.getCurrentUser().then(function (user) {
    const token = authService.getToken();
    const foods = payload.foods || [];
    const rowData = {
      user_id: user.id,
      meal_type: payload.meal_type,
      eaten_at: payload.eaten_at || Date.now(),
      image_path: payload.image_path || '',
      overall: payload.overall || '',
      summary: payload.summary || '',
      suggestion: payload.suggestion || '',
      balance: payload.balance || {}
    };
    return supabase.insertInto('food_records', rowData, token).then(function (rows) {
      const record = rows[0];
      const items = foods.map(function (f) {
        return {
          food_record_id: record.id,
          name: f.name,
          category: f.category || 'other'
        };
      });
      return supabase.insertInto('food_items', items, token).then(function () {
        return record;
      });
    });
  });
}

module.exports = {
  getTodayRecords,
  getAllRecords,
  analyzeFood,
  saveRecord
};
