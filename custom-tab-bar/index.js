Component({
  data: {
    selected: 0,
    theme: 'warm',
    list: [
      {
        pagePath: '/pages/index/index',
        text: '首页',
        iconPath: '/assets/tabbar/home.png',
        selectedIconPath: '/assets/tabbar/home-active.png'
      },
      {
        pagePath: '/pages/record/record',
        text: '记录',
        iconPath: '/assets/tabbar/record.png',
        selectedIconPath: '/assets/tabbar/record-active.png'
      },
      {
        pagePath: '/pages/ingredients/ingredients',
        text: '食材',
        iconPath: '/assets/tabbar/ingredients.png',
        selectedIconPath: '/assets/tabbar/ingredients-active.png'
      }
    ]
  },

  // tabBar 在页面根节点之外，拿不到页面上那个主题类，所以自己读一次
  lifetimes: {
    attached() { this.syncTheme(); }
  },

  pageLifetimes: {
    show() { this.syncTheme(); }
  },

  methods: {
    syncTheme() {
      const app = getApp();
      const theme = (app && app.globalData && app.globalData.theme) || 'warm';
      if (theme !== this.data.theme) this.setData({ theme: theme });
    },

    onTap(e) {
      const { path, index } = e.currentTarget.dataset;
      if (index === this.data.selected) return;
      wx.switchTab({ url: path });
    },

    goChat() {
      wx.navigateTo({ url: '/pages/chat/chat' });
    }
  }
});
