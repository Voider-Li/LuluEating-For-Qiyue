const foodService = require('../../services/food');
const nutritionUtil = require('../../utils/nutrition');

const MEAL_OPTIONS = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '加餐' }
];

function withKeys(foods) {
  return (foods || []).map(function (f, i) {
    return Object.assign({}, f, { _key: i + '-' + (f.name || '') });
  });
}

Page({
  data: {
    theme: 'warm',
    mealOptions: MEAL_OPTIONS,
    mealType: 'lunch',
    imagePath: '',
    analyzing: false,
    stepText: '',
    result: null,
    foods: [],
    nutrition: null,
    balance: {},
    overall: '',
    summary: '',
    suggestion: '',
    note: '',
    steps: ['上传图片', 'AI 识别食物', '营养评估'],
    step: 0,
    progress: 0,
    stepText: '',
    analyzeTime: '',
    newFoodName: '',
    saving: false
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'warm' });
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  onMealTap(e) {
    this.setData({ mealType: e.currentTarget.dataset.key });
  },

  onChooseImage() {
    if (this.data.analyzing) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      // 传云存储前先压缩，省流量、也避免单文件过大
      sizeType: ['compressed'],
      success: (res) => {
        this.setData({
          imagePath: res.tempFiles[0].tempFilePath,
          result: null,
          foods: [],
          balance: {},
          overall: '',
          summary: '',
          suggestion: ''
        });
      }
    });
  },

  onAnalyze() {
    if (!this.data.imagePath) {
      wx.showToast({ title: '先拍一张照片或从相册选择', icon: 'none' });
      return;
    }
    if (this.data.analyzing) return;

    this.setData({
      analyzing: true,
      result: null,
      foods: [],
      balance: {},
      overall: '',
      summary: '',
      suggestion: '',
      note: '',
      step: 0,
      progress: 12,
      stepText: '正在上传图片…'
    });

    const steps = [
      { delay: 80, step: 0, progress: 22, text: '正在上传图片…' },
      { delay: 480, step: 1, progress: 50, text: 'AI 正在识别食物…' },
      { delay: 1080, step: 2, progress: 78, text: '正在评估营养均衡…' }
    ];
    this._analyzeStart = Date.now();
    this._analyzeTimers = steps.map((s) =>
      setTimeout(() => {
        this.setData({ step: s.step, progress: s.progress, stepText: s.text });
      }, s.delay)
    );

    this._runAnalysis();
  },

  async _runAnalysis() {
    try {
      const result = await foodService.analyzeFood(this.data.imagePath);
      const foods = withKeys(nutritionUtil.enrichFoods(result.foods || []));
      const nutrition = result.nutrition || nutritionUtil.totals(foods);
      const remaining = Math.max(0, 1650 - (Date.now() - this._analyzeStart));
      this._analyzeTimers.push(
        setTimeout(() => {
          this.setData({
            result: result,
            foods: foods,
            nutrition: nutrition,
            balance: result.balance || {},
            overall: result.overall || '',
            summary: result.summary || '',
            suggestion: result.suggestion || '',
            step: 2,
            progress: 100,
            stepText: '分析完成，识别出 ' + foods.length + ' 种食物',
            analyzeTime: ((Date.now() - this._analyzeStart) / 1000).toFixed(1),
            analyzing: false
          });
        }, remaining)
      );
    } catch (e) {
      this.setData({ analyzing: false });
      wx.showModal({
        title: '识别失败',
        content: '这次没能识别清楚，再试一次吧。',
        confirmText: '重新识别'
      });
    }
  },

  onUnload() {
    if (this._analyzeTimers) {
      this._analyzeTimers.forEach(function (t) { clearTimeout(t); });
    }
  },

  onRemoveFood(e) {
    const index = e.currentTarget.dataset.index;
    const foods = this.data.foods.slice();
    foods.splice(index, 1);
    this.setData({ foods: withKeys(foods) });
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },
  onFoodInput(e) {
    this.setData({ newFoodName: e.detail.value });
  },

  onAddFood() {
    const name = (this.data.newFoodName || '').trim();
    if (!name) return;
    this.setData({
      foods: withKeys(this.data.foods.concat([{ name: name, category: 'other' }])),
      newFoodName: ''
    });
  },

  async onSave() {
    if (!this.data.foods.length) {
      wx.showToast({ title: '还没有食物，请先识别或手动添加', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await foodService.saveRecord({
        meal_type: this.data.mealType,
        eaten_at: Date.now(),
        image_path: this.data.imagePath,
        foods: this.data.foods,
        balance: this.data.balance,
        overall: this.data.overall,
        summary: this.data.summary,
        suggestion: this.data.suggestion,
        note: this.data.note
      });
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 600);
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
    this.setData({ saving: false });
  }
});


