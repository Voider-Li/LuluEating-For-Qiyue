Component({
  data: {
    selected: 0,
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

  methods: {
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
