const format = require('../../utils/format');
const dateUtil = require('../../utils/date');
const nutritionUtil = require('../../utils/nutrition');

Component({
  properties: {
    record: {
      type: Object,
      value: {}
    }
  },

  data: {
    timeText: '',
    mealText: '',
    foodsText: '',
    nutritionText: '',
    overallMeta: { text: '', color: '', bg: '' }
  },

  observers: {
    record: function (record) {
      if (!record || !record.eaten_at) return;
      const foods = nutritionUtil.enrichFoods(record.foods || []);
      const t = nutritionUtil.totals(foods);
      this.setData({
        timeText: dateUtil.formatTime(record.eaten_at),
        mealText: format.mealTypeText(record.meal_type),
        foodsText: format.foodsText(foods),
        nutritionText: t.calories ? t.calories + ' 千卡 · 蛋白质 ' + t.protein + 'g' : '',
        overallMeta: format.overallMeta(record.overall)
      });
    }
  },

  methods: {
    onTap() {
      this.triggerEvent('taprecord', { id: this.data.record.id });
    }
  }
});
