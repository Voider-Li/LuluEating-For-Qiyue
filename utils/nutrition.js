// 常见食物营养估算（按“份/次”计，单位：kcal / g）
// 数值为演示用毛估，真实数据应来自 AI 识别后端。
const FOOD_NUTRITION = {
  '米饭': { calories: 174, protein: 3.6, fat: 0.5 },
  '红烧肉': { calories: 362, protein: 12.4, fat: 30.5 },
  '炒青菜': { calories: 76, protein: 4.2, fat: 4.5 },
  '鸡蛋': { calories: 78, protein: 6.7, fat: 5.3 },
  '牛奶': { calories: 135, protein: 6.6, fat: 7.2 },
  '全麦面包': { calories: 195, protein: 7.5, fat: 3.2 },
  '番茄炒蛋': { calories: 210, protein: 10.5, fat: 13.0 },
  '清炒青菜': { calories: 72, protein: 3.8, fat: 4.2 },
  '面条': { calories: 220, protein: 8.0, fat: 1.5 },
  '鸡胸肉': { calories: 165, protein: 31.0, fat: 3.6 },
  '牛肉': { calories: 250, protein: 26.0, fat: 15.0 },
  '鱼': { calories: 130, protein: 22.0, fat: 4.0 },
  '豆腐': { calories: 120, protein: 10.0, fat: 7.0 },
  '水果': { calories: 80, protein: 1.0, fat: 0.3 },
  '酸奶': { calories: 110, protein: 5.5, fat: 3.0 }
};

const CATEGORY_FALLBACK = {
  carbohydrate: { calories: 116, protein: 2.6, fat: 0.4 },
  protein: { calories: 220, protein: 15.0, fat: 14.0 },
  vegetable: { calories: 60, protein: 3.0, fat: 3.0 },
  fruit: { calories: 80, protein: 1.0, fat: 0.3 },
  fat: { calories: 90, protein: 0.5, fat: 8.0 },
  other: { calories: 85, protein: 3.0, fat: 4.0 }
};

// 给单个食物补上 calories / protein / fat（已有则不覆盖）
function enrichFood(food) {
  if (!food) return food;
  const name = (food.name || '').trim();
  const target = FOOD_NUTRITION[name] || CATEGORY_FALLBACK[food.category] || CATEGORY_FALLBACK.other;
  return Object.assign({}, food, {
    calories: Math.round(food.calories != null ? food.calories : target.calories),
    protein: Math.round((food.protein != null ? food.protein : target.protein) * 10) / 10,
    fat: Math.round((food.fat != null ? food.fat : target.fat) * 10) / 10
  });
}

function enrichFoods(foods) {
  return (foods || []).map(enrichFood);
}

// 汇总一组食物的总热量 / 蛋白质 / 脂肪
function totals(foods) {
  const list = enrichFoods(foods);
  const sum = list.reduce(
    function (acc, f) {
      acc.calories += f.calories || 0;
      acc.protein += f.protein || 0;
      acc.fat += f.fat || 0;
      return acc;
    },
    { calories: 0, protein: 0, fat: 0 }
  );
  return {
    calories: Math.round(sum.calories),
    protein: Math.round(sum.protein * 10) / 10,
    fat: Math.round(sum.fat * 10) / 10
  };
}

module.exports = {
  enrichFood,
  enrichFoods,
  totals
};
