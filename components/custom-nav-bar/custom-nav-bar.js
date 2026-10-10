// 二级页面左上角返回按钮上显示的文字 = 「这个页面叫什么」
// 新增页面记得在这里补一行；没补的会退回「返回」。
const PAGE_NAMES = {
  'pages/records/records': '饮食记录',
  'pages/statistics/statistics': '营养统计',
  'pages/preferences/preferences': '饮食偏好',
  'pages/recommendation/recommendation': '下一餐推荐',
  'pages/favorites/favorites': '我的收藏',
  'pages/chat/chat': '嘎哒'
};

Component({
  properties: {
    // 兜底：页面没在上面那张表里时用它
    backText: {
      type: String,
      value: '返回'
    }
  },

  data: {
    statusBarHeight: 20,
    navHeight: 44,
    totalHeight: 64,
    navDate: '',
    showBack: false,
    backLabel: '返回'
  },

  lifetimes: {
    attached() {
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const route = (currentPage && currentPage.route) || '';

      const tabPages = [
        'pages/index/index',
        'pages/record/record',
        'pages/ingredients/ingredients'
      ];
      const showBack = !!route && tabPages.indexOf(route) === -1;
      const backLabel = PAGE_NAMES[route] || this.properties.backText || '返回';

      this.setData({ showBack: showBack, backLabel: backLabel });

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
    },

    onBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack({ delta: 1 });
      } else {
        wx.switchTab({ url: '/pages/index/index' });
      }
    }
  }
});
