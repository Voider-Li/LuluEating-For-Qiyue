const CONFIG = require('../config');
const supabase = require('./supabase');
const authService = require('./auth');

function mockRecommendation() {
  return {
    title: '清淡晚餐',
    reason: '今天午餐油脂相对较高，蔬菜也偏少。',
    suggestions: ['番茄炒蛋', '清炒青菜', '适量米饭'],
    summary: '今晚可以适当清淡一些，让今天的饮食结构更均衡。家里有番茄、鸡蛋和青菜，可以直接用上。'
  };
}

function getRecommendation() {
  if (CONFIG.USE_MOCK_DATA) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(mockRecommendation());
      }, 1200);
    });
  }
  const token = authService.getToken();
  return supabase.invokeFunction('recommend-meal', {}, token);
}

module.exports = {
  getRecommendation
};
