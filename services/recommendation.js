const CONFIG = require('../config');
const supabase = require('./supabase');
const cloud = require('./cloud');
const authService = require('./auth');

function mockRecommendation() {
  return {
    title: '清淡晚餐',
    reason: '今天午餐油脂相对较高，蔬菜也偏少。',
    suggestions: ['番茄炒蛋', '清炒青菜', '适量米饭'],
    summary: '今晚可以适当清淡一些，让今天的饮食结构更均衡。家里有番茄、鸡蛋和青菜，可以直接用上。'
  };
}

// 上下文（今天吃了啥 + 口味偏好）由 ai 云函数自己组装，前端不用拼
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

// 每次推荐存一份，方便过几天回看"当时推荐了番茄炒蛋，我最后吃的是泡面"
function saveRecommendation(result) {
  try {
    cloud.collection('meal_recommendations').add({
      data: {
        title: result.title,
        reason: result.reason,
        suggestions: result.suggestions,
        summary: result.summary,
        for_date: todayStr(),
        created_at: Date.now()
      }
    }).catch(function () { /* 存不上不影响展示 */ });
  } catch (e) { /* 忽略 */ }
}

function getRecommendation() {
  if (CONFIG.USE_MOCK_DATA) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(mockRecommendation());
      }, 1200);
    });
  }

  if (CONFIG.BACKEND === 'cloud') {
    return cloud.call('ai', { action: 'recommend' }).then(function (res) {
      const result = {
        title: res.title || '下一餐推荐',
        reason: res.reason || '',
        suggestions: res.suggestions || [],
        summary: res.summary || ''
      };
      saveRecommendation(result);
      return result;
    });
  }

  const token = authService.getToken();
  return supabase.invokeFunction('recommend-meal', {}, token);
}

module.exports = {
  getRecommendation
};
