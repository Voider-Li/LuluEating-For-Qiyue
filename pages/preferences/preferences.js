const preferenceService = require('../../services/preferences');

Page({
  data: {
    tasteOptions: ['清淡', '正常', '偏辣'],
    cuisineOptions: ['中餐', '日式', '韩式', '西餐', '其他'],
    taste: '清淡',
    cuisines: [],
    liked: [],
    disliked: [],
    likedInput: '',
    dislikedInput: '',
    saving: false
  },

  async onLoad() {
    try {
      const prefs = await preferenceService.get();
      this.setData({
        taste: prefs.taste || '清淡',
        cuisines: prefs.cuisines || [],
        liked: prefs.liked || [],
        disliked: prefs.disliked || []
      });
    } catch (e) {
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  onTasteTap(e) {
    this.setData({ taste: e.currentTarget.dataset.value });
  },

  onCuisineTap(e) {
    const value = e.currentTarget.dataset.value;
    const cuisines = this.data.cuisines.slice();
    const idx = cuisines.indexOf(value);
    if (idx >= 0) {
      cuisines.splice(idx, 1);
    } else {
      cuisines.push(value);
    }
    this.setData({ cuisines: cuisines });
  },

  onLikedInput(e) {
    this.setData({ likedInput: e.detail.value });
  },

  onDislikedInput(e) {
    this.setData({ dislikedInput: e.detail.value });
  },

  onAddLiked() {
    this.addTag('liked', 'likedInput');
  },

  onAddDisliked() {
    this.addTag('disliked', 'dislikedInput');
  },

  addTag(field, inputField) {
    const value = (this.data[inputField] || '').trim();
    if (!value) return;
    const list = this.data[field].slice();
    if (list.indexOf(value) < 0) {
      list.push(value);
    }
    this.setData({ [field]: list, [inputField]: '' });
  },

  onRemoveTag(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.currentTarget.dataset.value;
    const list = this.data[field].slice();
    const idx = list.indexOf(value);
    if (idx >= 0) {
      list.splice(idx, 1);
    }
    this.setData({ [field]: list });
  },

  async onSave() {
    this.setData({ saving: true });
    try {
      await preferenceService.save({
        taste: this.data.taste,
        cuisines: this.data.cuisines,
        liked: this.data.liked,
        disliked: this.data.disliked
      });
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
    this.setData({ saving: false });
  }
});
