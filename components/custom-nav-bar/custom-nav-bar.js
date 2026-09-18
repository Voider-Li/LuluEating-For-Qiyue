Component({
  data: {
    statusBarHeight: 20,
    navHeight: 44,
    totalHeight: 64,
    navDate: ''
  },

  lifetimes: {
    attached() {
      try {
        const sys = wx.getSystemInfoSync();
        const menu = wx.getMenuButtonBoundingClientRect();
        const statusBarHeight = (sys && sys.statusBarHeight) || 20;
        let navHeight = 44;
        if (menu && menu.height && menu.top > statusBarHeight) {
          navHeight = menu.height + (menu.top - statusBarHeight) * 2;
        }
        this.setData({
          statusBarHeight: statusBarHeight,
          navHeight: navHeight,
          totalHeight: statusBarHeight + navHeight,
          navDate: this.formatNavDate()
        });
      } catch (e) {
        // 使用默认值兜底
      }
    }
  },

  methods: {
    formatNavDate() {
      const d = new Date();
      const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
      return (d.getMonth() + 1) + '月' + d.getDate() + '日 · 周' + week;
    }
  }
});
