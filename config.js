// 膳食助手小程序配置
//
// 从 Supabase 项目设置 -> API 中获得：
//   - Project URL
//   - anon / publishable key（可以安全地放在小程序前端）
//
// 注意：绝不要把 service_role key、数据库密码或 AI API Key 放在这里。

const CONFIG = {
  // Supabase 项目地址，例如 https://xxxx.supabase.co
  SUPABASE_URL: '',

  // Supabase 发布用 key（anon / publishable key）
  SUPABASE_PUBLISHABLE_KEY: '',

  // 演示模式：true 时不请求后端，使用内置示例数据，
  // 方便先在微信开发者工具里跑通界面。
  // 接入真实 Supabase 后改为 false。
  USE_MOCK_DATA: true,

  // 目标用户所在时区（东八区）
  TIMEZONE_OFFSET_HOURS: 8
};

module.exports = CONFIG;
