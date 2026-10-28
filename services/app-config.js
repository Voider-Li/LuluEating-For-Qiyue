// 键值对配置：云数据库里一张 app_config 表，一条记录一个配置项。
// 用途：把"需要经常调整、又不该改代码发版"的开关放这里，例如主题、生日彩蛋的生效时间。
//
// 表结构（app_config）：
//   { "key": "theme", "value": "pink", "remark": "主题：warm | pink" }
//
// 改法：云开发控制台 → 数据库 → app_config → 直接改 value，小程序下次进页面就生效。

const CONFIG = require('../config');
const cloud = require('./cloud');

const LOCAL_KEY = 'mock_app_config';
const CACHE_MS = 30 * 1000; // 30 秒内不重复请求，避免每个页面都打一次数据库

// 兜底默认值：数据库里读不到时用这套，保证横幅 / 礼物至少能显示出来
const DEFAULTS = {
  // 总开关：true = 生日模式（粉色主题 + 横幅 + 礼物 一起开）
  birthday_mode: 'false',
  // 下面几项【留空 = 跟随总开关】；填了就以填的为准（可以只覆盖其中一项）
  theme: '',
  banner_enabled: '',
  banner_text: '🎉生日快乐！🎉',
  banner_image: '',
  gift_enabled: '',
  gift_image: ''
};

let _cache = null;
let _cacheAt = 0;

// 读出全部配置（带缓存）
function load(force) {
  const now = Date.now();
  if (!force && _cache && now - _cacheAt < CACHE_MS) {
    return Promise.resolve(_cache);
  }

  if (CONFIG.USE_MOCK_DATA) {
    const local = wx.getStorageSync(LOCAL_KEY) || {};
    _cache = Object.assign({}, DEFAULTS, local);
    _cacheAt = now;
    return Promise.resolve(_cache);
  }

  if (CONFIG.BACKEND === 'cloud') {
    // 注意：cloud.collection() 可能【同步抛错】（云开发没就绪 / 基础库不支持），
    // 所以必须在这里 try 住，否则异常会冒出去把调用方的 .catch 绕过，
    // 导致横幅、礼物这些全部静默不显示。
    let query;
    try {
      query = cloud.collection('app_config').limit(100).get();
    } catch (e) {
      console.warn('[app-config] 云开发未就绪，先用默认配置：', e && e.message);
      _cache = Object.assign({}, DEFAULTS);
      _cacheAt = now;
      return Promise.resolve(_cache);
    }

    return query
      .then(function (res) {
        const out = Object.assign({}, DEFAULTS);
        (res.data || []).forEach(function (row) {
          if (row && row.key) out[row.key] = row.value;
        });
        _cache = out;
        _cacheAt = now;
        return out;
      })
      .catch(function (e) {
        // 表还没建 / 没权限 → 退回默认，别让配置把页面搞崩
        console.warn('[app-config] 读取失败，先用默认配置：', e && e.message);
        _cache = Object.assign({}, DEFAULTS);
        _cacheAt = now;
        return _cache;
      });
  }

  _cache = Object.assign({}, DEFAULTS);
  return Promise.resolve(_cache);
}

function get(key, fallback) {
  return load().then(function (all) {
    const v = all[key];
    return v === undefined || v === null || v === '' ? fallback : v;
  });
}

// 把原始配置解析成"实际生效"的一组值。
// 规则：总开关 birthday_mode 优先级最高；
//       theme / banner_enabled / gift_enabled 留空就跟随总开关，填了就以填的为准。
//   birthday_mode = true  → 主题 pink、横幅开、礼物开
//   birthday_mode = false → 主题 warm、横幅关、礼物关
function resolve(cfg) {
  const c = cfg || {};
  const birthday = isOn(c.birthday_mode, false);
  return {
    birthday: birthday,
    theme: birthday ? 'pink' : (c.theme || 'warm'),
    bannerOn: isOn(c.banner_enabled, birthday),
    bannerText: c.banner_text || '',
    bannerImage: c.banner_image || '',
    giftOn: isOn(c.gift_enabled, birthday),
    giftImage: c.gift_image || ''
  };
}

// 当前主题名：'warm'（默认暖黄）| 'pink'（粉色）
function getTheme() {
  return load().then(function (cfg) { return resolve(cfg).theme; });
}

// 写一项配置（目前只有控制台会用到；留个口子方便以后加"隐藏开关"）
function set(key, value) {
  if (CONFIG.USE_MOCK_DATA) {
    const local = wx.getStorageSync(LOCAL_KEY) || {};
    local[key] = value;
    wx.setStorageSync(LOCAL_KEY, local);
    clearCache();
    return Promise.resolve(true);
  }

  if (CONFIG.BACKEND === 'cloud') {
    return cloud.collection('app_config')
      .where({ key: key })
      .limit(1)
      .get()
      .then(function (res) {
        const row = res.data && res.data[0];
        if (row) {
          return cloud.collection('app_config').doc(row._id).update({
            data: { value: value, updated_at: Date.now() }
          });
        }
        return cloud.collection('app_config').add({
          data: { key: key, value: value, created_at: Date.now(), updated_at: Date.now() }
        });
      })
      .then(function () {
        clearCache();
        return true;
      });
  }

  return Promise.resolve(false);
}

function clearCache() {
  _cache = null;
  _cacheAt = 0;
}

// 把配置值当布尔用：'true' / '1' / true 都算真；空值取 fallback
function isOn(value, fallback) {
  if (value === undefined || value === null || value === '') return !!fallback;
  return value === true || value === 1 || value === 'true' || value === '1';
}

module.exports = { load, get, getTheme, resolve, set, clearCache, isOn, DEFAULTS };
