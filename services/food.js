const CONFIG = require('../config');
const supabase = require('./supabase');
const cloud = require('./cloud');
const authService = require('./auth');
const dateUtil = require('../utils/date');
const nutrition = require('../utils/nutrition');
const chatEvents = require('./chat-events');

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
  const currentUser = authService.mockUser ? authService.mockUser() : { id: 'mock-qiyue', nickname: '祈栎' };
  const record = Object.assign({ id: 'mock-record-' + Date.now(), owner_id: currentUser.id, owner_name: currentUser.nickname }, payload);
  list.unshift(record);
  wx.setStorageSync('mock_food_records', list);
  chatEvents.publishFoodRecordToChat(record);
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

// ---------- 云开发辅助 ----------

function roleName(role) {
  return role === 'qinghui' ? '清辉' : (role === 'qiyue' ? '祈栎' : '');
}

// 把云数据库的文档，整形成和 mock 完全一样的记录结构（页面因此不用改）
function normalizeRecords(docs) {
  if (!docs || !docs.length) return Promise.resolve([]);
  const fileIds = docs.map(function (d) { return d.image_file_id; }).filter(Boolean);

  return cloud.tempFileURLs(fileIds).then(function (urls) {
    const map = {};
    fileIds.forEach(function (id, i) { map[id] = urls[i] || ''; });

    return docs.map(function (d) {
      return {
        id: d._id,
        owner_id: d._openid,
        owner_name: d.owner_name || roleName(d.owner_role),
        owner_role: d.owner_role || '',
        meal_type: d.meal_type,
        eaten_at: d.eaten_at,
        image_path: d.image_file_id ? (map[d.image_file_id] || d.image_file_id) : '',
        image_file_id: d.image_file_id || '',
        foods: d.foods || [],
        nutrition: d.nutrition || {},
        balance: d.balance || {},
        overall: d.overall || '',
        summary: d.summary || '',
        suggestion: d.suggestion || '',
        note: d.note || d.ga_da_note || ''
      };
    });
  });
}

// 客户端单次最多 100 条，循环取完
// where 传 null 表示不加条件（取全部，比如"两个人的记录"）
function fetchAll(name, where, orderField, orderDir) {
  const out = [];
  function page(skip) {
    let q = cloud.collection(name);
    if (where) q = q.where(where);
    if (orderField) q = q.orderBy(orderField, orderDir || 'asc');
    return q.skip(skip).limit(100).get().then(function (res) {
      const data = res.data || [];
      out.push.apply(out, data);
      if (data.length < 100 || skip > 1000) return out;
      return page(skip + 100);
    });
  }
  return page(0);
}

// ---------- 业务方法 ----------

function getTodayRecords() {
  if (CONFIG.USE_MOCK_DATA) {
    const list = loadLocalRecords()
      .filter(function (r) { return dateUtil.isToday(r.eaten_at); })
      .sort(function (a, b) { return a.eaten_at - b.eaten_at; });
    return Promise.resolve(list);
  }

  if (CONFIG.BACKEND === 'cloud') {
    const _ = cloud.command();
    const range = dateUtil.getTodayRange();
    return authService.getCurrentUser().then(function (user) {
      return cloud.collection('food_records')
        .where({ _openid: user.openid, eaten_at: _.gte(range.start).and(_.lt(range.end)) })
        .orderBy('eaten_at', 'asc')
        .limit(100)
        .get()
        .then(function (res) { return normalizeRecords(res.data); });
    });
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

// 今天的餐桌：两个人的记录都要（用来铺在桌面上），按时间正序
function getTodayTable() {
  if (CONFIG.USE_MOCK_DATA) {
    const list = loadLocalRecords()
      .filter(function (r) { return dateUtil.isToday(r.eaten_at); })
      .sort(function (a, b) { return a.eaten_at - b.eaten_at; });
    return Promise.resolve(list);
  }

  if (CONFIG.BACKEND === 'cloud') {
    const _ = cloud.command();
    const range = dateUtil.getTodayRange();
    return cloud.collection('food_records')
      .where({ eaten_at: _.gte(range.start).and(_.lt(range.end)) })
      .orderBy('eaten_at', 'asc')
      .limit(100)
      .get()
      .then(function (res) { return normalizeRecords(res.data); });
  }

  const range = dateUtil.getTodayRange();
  return supabase.selectFrom('food_records', {
    columns: 'id,user_id,meal_type,eaten_at,image_path,note,balance,overall,summary,suggestion,food_items(*)',
    filters: {
      'eaten_at.gte': new Date(range.start).toISOString(),
      'eaten_at.lt': new Date(range.end).toISOString()
    },
    order: 'eaten_at',
    orderDirection: 'asc'
  });
}

// options.both = true 时取两个人的记录（"全部记录"页用来做朋友圈式的记录流）
function getAllRecords(options) {
  const both = !!(options && options.both);

  if (CONFIG.USE_MOCK_DATA) {
    const list = loadLocalRecords().sort(function (a, b) { return b.eaten_at - a.eaten_at; });
    return Promise.resolve(list);
  }

  if (CONFIG.BACKEND === 'cloud') {
    return authService.getCurrentUser().then(function (user) {
      const where = both ? null : { _openid: user.openid };
      return fetchAll('food_records', where, 'eaten_at', 'desc')
        .then(function (docs) { return normalizeRecords(docs); });
    });
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

  if (CONFIG.BACKEND === 'cloud') {
    return cloud.upload('food', imagePath, '.jpg').then(function (fileID) {
      return cloud.call('ai', { action: 'analyze', image_file_id: fileID }).then(function (res) {
        return {
          foods: res.foods || [],
          nutrition: res.nutrition || {},
          balance: res.balance || {},
          overall: res.overall || '',
          summary: res.summary || '',
          suggestion: res.suggestion || '',
          image_file_id: fileID,
          image_path: fileID
        };
      });
    });
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

// 记录里的图片：优先用已上传的 fileID；如果给的是本地临时路径（手动记、没跑识别），先传到云存储
function resolveImageFileId(payload) {
  const given = payload.image_file_id || '';
  if (given) return Promise.resolve(given);
  const path = payload.image_path || '';
  if (!path) return Promise.resolve('');
  if (path.indexOf('cloud://') === 0) return Promise.resolve(path);
  return cloud.upload('food', path, '.jpg');
}

function saveRecord(payload) {
  if (CONFIG.USE_MOCK_DATA) {
    return Promise.resolve(saveLocalRecord(payload));
  }

  if (CONFIG.BACKEND === 'cloud') {
    return authService.getCurrentUser().then(function (user) {
      // 图片可能已经是 fileID（跑过识别），也可能是本地临时路径（手动记的），后者要先传云存储
      return resolveImageFileId(payload).then(function (imageFileId) {
        const now = Date.now();
        const foods = payload.foods || [];
        const doc = {
          // 注意：客户端 add 不能写 _openid，云开发会自动带上创建者
          owner_role: user.role,
          owner_name: user.nickname || roleName(user.role),
          meal_type: payload.meal_type,
          eaten_at: payload.eaten_at || now,
          image_file_id: imageFileId,
          note: payload.note || '',
          overall: payload.overall || '',
          summary: payload.summary || '',
          suggestion: payload.suggestion || '',
          balance: payload.balance || {},
          nutrition: payload.nutrition || {},
          // 冗余一份在记录里，列表/餐桌直接就能显示，不用再查子表
          foods: foods,
          created_at: now,
          updated_at: now
        };

        return cloud.collection('food_records').add({ data: doc }).then(function (res) {
          // 逐道菜已经嵌在 doc.foods 里（含 kcal / 蛋白 / 脂肪），
          // 不再单独写 food_record_items —— 统计在云函数里算，够用，且少一次写、少一处不一致。
          const saved = {
            id: res._id,
            owner_id: user.openid,
            owner_role: user.role,
            owner_name: doc.owner_name,
            meal_type: doc.meal_type,
            eaten_at: doc.eaten_at,
            image_path: imageFileId,
            image_file_id: imageFileId,
            foods: foods,
            nutrition: doc.nutrition,
            balance: doc.balance,
            overall: doc.overall,
            summary: doc.summary,
            suggestion: doc.suggestion,
            note: doc.note
          };
          // 记录上桌：往消息流发一条 + 让一只智能体回一句（后台进行，失败不影响保存）
          chatEvents.publishFoodRecordToChat(saved);
          return saved;
        });
      });
    });
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
  getTodayTable,
  getAllRecords,
  analyzeFood,
  saveRecord
};
