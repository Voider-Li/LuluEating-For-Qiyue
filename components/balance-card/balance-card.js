const format = require('../../utils/format');

// 营养维度评分：good=3, fair=2, low/high=1, none=0
const SCORE_POINTS = { good: 3, fair: 2, low: 1, high: 1, none: 0 };
const BAR_WIDTH = { good: 100, fair: 62, low: 38, high: 55, none: 6 };

Component({
  properties: {
    balance: {
      type: Object,
      value: {}
    },
    overall: {
      type: String,
      value: ''
    },
    summary: {
      type: String,
      value: ''
    },
    suggestion: {
      type: String,
      value: ''
    },
    nutrition: {
      type: Object,
      value: {}
    },
    analyzeTime: {
      type: String,
      value: ''
    }
  },

  data: {
    dimensions: [],
    overallMeta: { text: '', color: '', bg: '' },
    score: 0,
    nutritionView: { calories: 0, protein: 0, fat: 0 }
  },

  observers: {
    'balance, overall, nutrition': function (balance, overall, nutrition) {
      const dimensions = format.dimensionsWithMeta(balance || {}).map(function (d) {
        return Object.assign({}, d, { width: BAR_WIDTH[d.value] || 6 });
      });
      const score = Math.round(
        (dimensions.reduce(function (sum, d) {
          return sum + (SCORE_POINTS[d.value] || 0);
        }, 0) / (dimensions.length * 3 || 1)) * 100
      );
      const n = nutrition || {};
      this.setData({
        dimensions: dimensions,
        overallMeta: format.overallMeta(overall),
        score: score,
        nutritionView: {
          calories: n.calories || 0,
          protein: n.protein || 0,
          fat: n.fat || 0
        }
      });
    }
  }
});
