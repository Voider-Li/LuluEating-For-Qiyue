const ingredientService = require('../../services/ingredients');

Page({
  data: {
    theme: 'warm',
    list: [],
    name: '',
    quantity: '',
    note: '',
    adding: false,
    loading: true
  },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'warm' });
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.load();
  },

  async load() {
    try {
      const list = await ingredientService.list();
      this.setData({ list: list || [], loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onQuantityInput(e) {
    this.setData({ quantity: e.detail.value });
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  async onAdd() {
    const name = (this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入食材名称', icon: 'none' });
      return;
    }
    this.setData({ adding: true });
    try {
      await ingredientService.add(name, this.data.quantity, this.data.note);
      this.setData({ name: '', quantity: '', note: '', adding: false });
      await this.load();
      wx.showToast({ title: '已添加', icon: 'success' });
    } catch (e) {
      this.setData({ adding: false });
      wx.showToast({ title: e.message || '添加失败', icon: 'none' });
    }
  },

  onDelete(e) {
    const id = e.detail.id;
    wx.showModal({
      title: '删除食材',
      content: '确定删除这条食材吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await ingredientService.remove(id);
            await this.load();
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  }
});
