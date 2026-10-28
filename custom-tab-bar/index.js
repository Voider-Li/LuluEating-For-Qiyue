Component({
  data: {
    selected: 0,
    // 首次渲染先不播动画：避免"从首页滑到当前页"的假动作
    animate: false,
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
    attached() {
      this.syncTheme();
      this.syncRoute();
      this._animTimer = setTimeout(() => {
        this.setData({ animate: true });
      }, 300);
    },

    detached() {
      if (this._animTimer) clearTimeout(this._animTimer);
    }
  },

  pageLifetimes: {
    show() {
      this.syncTheme();
      this.syncRoute();
    }
  },

  methods: {
    syncTheme() {
      const app = getApp();
      const theme = (app && app.globalData && app.globalData.theme) || 'warm';
      if (theme !== this.data.theme) this.setData({ theme: theme });
    },

    // 以当前页面路由为准同步选中项：
    // 每个 tab 页都有自己的一份 tabBar 实例，只靠页面 onShow 里 setData 容易闪一下
    syncRoute() {
      const pages = getCurrentPages();
      const cur = pages[pages.length - 1];
      if (!cur || !cur.route) return;
      const route = '/' + cur.route;
      const idx = this.data.list.findIndex(function (it) {
        return it.pagePath === route;
      });
      if (idx > -1 && idx !== this.data.selected) {
        this.setData({ selected: idx });
      }
    },

    onTap(e) {
      const { path, index } = e.currentTarget.dataset;
      if (index === this.data.selected) return;
      const prev = this.data.selected;
      // 先在当前页面把底座滑过去，视觉上是一次连贯的滑动；
      // 切过去之后新页面的实例会直接落在正确位置
      this.setData({ selected: index });
      wx.switchTab({
        url: path,
        fail: () => this.setData({ selected: prev })
      });
    },

    goChat() {
      wx.navigateTo({ url: '/pages/chat/chat' });
    }
  }
});
