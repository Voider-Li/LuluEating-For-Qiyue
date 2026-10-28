const favoritesService = require('../../services/favorites');

Page({
  data: {
    theme: 'warm', favorites: [], total: 0, loading: true },

  onShow() {
    this.setData({ theme: getApp().globalData.theme || 'warm' }); this.load(); },

  async load() {
    this.setData({ loading: true });
    try {
      const list = await favoritesService.list();
      this.setData({ favorites: list || [], total: (list || []).length, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  onAddFavorite() {
    wx.showActionSheet({
      itemList: ['拍照收藏', '从相册选', '只写菜名'],
      success: (res) => {
        if (res.tapIndex === 2) {
          this.askNameAndSave('');
          return;
        }
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: [res.tapIndex === 0 ? 'camera' : 'album'],
          sizeType: ['compressed'],
          success: (media) => {
            const file = media.tempFiles && media.tempFiles[0];
            this.askNameAndSave((file && file.tempFilePath) || '');
          }
        });
      },
      fail: () => {}
    });
  },

  askNameAndSave(imagePath) {
    wx.showModal({
      title: '收藏一道菜',
      editable: true,
      placeholderText: '比如：奶油蘑菇汤',
      confirmText: '收藏',
      success: (res) => {
        const name = (res.confirm ? (res.content || '').trim() : '');
        if (!name) return;
        wx.showLoading({ title: '收藏中', mask: true });
        favoritesService.add({ name: name, image_path: imagePath })
          .then(() => {
            wx.hideLoading();
            wx.showToast({ title: '已收藏', icon: 'success' });
            this.load();
          })
          .catch((err) => {
            wx.hideLoading();
            wx.showToast({ title: (err && err.message) || '收藏失败', icon: 'none' });
          });
      }
    });
  },

  onLongPress(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '这条收藏';
    wx.showModal({
      title: '取消收藏',
      content: '把「' + name + '」从收藏里移除？',
      confirmText: '移除',
      confirmColor: '#D36E62',
      success: (res) => {
        if (!res.confirm) return;
        favoritesService.remove(id)
          .then(() => {
            wx.showToast({ title: '已移除', icon: 'none' });
            this.load();
          })
          .catch((err) => {
            wx.showToast({ title: (err && err.message) || '移除失败', icon: 'none' });
          });
      }
    });
  }
});
