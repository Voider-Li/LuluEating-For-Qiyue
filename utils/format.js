const MEAL_TYPES = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
  other: '其他'
};

const OVERALL_MAP = {
  balanced: { text: '比较均衡', color: '#5B8C5A', bg: '#E7F0E7' },
  fair: { text: '基本均衡', color: '#B07D2B', bg: '#F7EED6' },
  needs_improvement: { text: '可以调整', color: '#C25B3F', bg: '#F9E3DE' }
};

const BALANCE_MAP = {
  good: { text: '充足', color: '#5B8C5A', bg: '#E7F0E7' },
  fair: { text: '一般', color: '#B07D2B', bg: '#F7EED6' },
  low: { text: '偏少', color: '#D9822B', bg: '#FBE9DC' },
  high: { text: '偏高', color: '#C25B3F', bg: '#F9E3DE' },
  none: { text: '没有', color: '#8E897D', bg: '#EFEDE7' }
};

const DIMENSIONS = [
  { key: 'carbohydrate', label: '主食' },
  { key: 'protein', label: '蛋白质' },
  { key: 'vegetable', label: '蔬菜' },
  { key: 'fruit', label: '水果' },
  { key: 'fat', label: '油脂' }
];

function mealTypeText(key) {
  return MEAL_TYPES[key] || key || '其他';
}

function overallMeta(key) {
  return OVERALL_MAP[key] || { text: '未评价', color: '#9B968A', bg: '#EFEDE7' };
}

function balanceMeta(key) {
  return BALANCE_MAP[key] || { text: '未知', color: '#9B968A', bg: '#EFEDE7' };
}

function dimensionsWithMeta(balance) {
  return DIMENSIONS.map(function (d) {
    const value = balance && balance[d.key] ? balance[d.key] : 'none';
    return {
      key: d.key,
      label: d.label,
      value: value,
      meta: balanceMeta(value)
    };
  });
}

function foodsText(foods) {
  const list = foods || [];
  return list.map(function (f) { return f.name; }).join(' / ') || '暂无食物';
}

module.exports = {
  MEAL_TYPES,
  OVERALL_MAP,
  BALANCE_MAP,
  DIMENSIONS,
  mealTypeText,
  overallMeta,
  balanceMeta,
  dimensionsWithMeta,
  foodsText
};
