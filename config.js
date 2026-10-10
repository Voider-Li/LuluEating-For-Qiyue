// 膳食助手小程序配置
//
// 后端三种模式，用 BACKEND 切换：
//   'mock'     —— 本地缓存，不需要任何后端，界面可以完整跑通（默认）
//   'cloud'    —— 微信云开发（云数据库 / 云存储 / 云函数），免备案
//   'supabase' —— 旧的 Supabase 方案，保留但暂不推荐（体验版需要已备案域名）
//
// 注意：绝不要把 service_role key、数据库密码或 AI API Key 放在这里。
//       AI 的 Key 放在「云函数的环境变量」里，见 cloudfunctions/ai/index.js。

const BACKEND = 'cloud'; // 'mock' | 'cloud' | 'supabase'

const CONFIG = {
  BACKEND: BACKEND,

  // 兼容旧代码：BACKEND 为 mock 时即为 true
  USE_MOCK_DATA: BACKEND === 'mock',

  // ---------- 微信云开发 ----------
  // 云环境 ID（云开发控制台左上角，形如 cloud1-xxxxxxxx）。
  // 留空 = 使用默认环境（只有一个环境时没问题；有多个环境时必须填）。
  CLOUD_ENV: '',

  // 云存储目录前缀（云开发一个环境只有一个存储空间，用目录区分）
  CLOUD_DIRS: {
    food: 'food-images/',
    favorites: 'favorites-images/',
    chat: 'chat-images/'
  },

  // ---------- Supabase（旧方案，暂不使用）----------
  // 从 Supabase 项目设置 -> API 中获得。anon / publishable key 可放前端。
  SUPABASE_URL: '',
  SUPABASE_PUBLISHABLE_KEY: '',

  // 目标用户所在时区（东八区）
  TIMEZONE_OFFSET_HOURS: 8
};

module.exports = CONFIG;
