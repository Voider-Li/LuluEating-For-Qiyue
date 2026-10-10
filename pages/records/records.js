const foodService = require('../../services/food');
const dateUtil = require('../../utils/date');
const interactions = require('../../services/interactions');

Page({
  data: {
    scope: 'both',   // 'both' 两个人的记录流 | 'mine' 只看我的
    groups: [],
    reactions: {},   // { [recordId]: { liked, likeCount, favorite, comments, commentCount } }
    loading: true
  },

  onShow() {
    this.load();
  },

  onScope(e) {
    const scope = e.currentTarget.dataset.scope;
    if (scope === this.data.scope) return;
    this.setData({ scope: scope, groups: [], reactions: {}, loading: true });
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const records = await foodService.getAllRecords({ both: this.data.scope === 'both' });
      const sorted = (records || []).slice().sort(function (a, b) {
        return b.eaten_at - a.eaten_at;
      });

      const groups = [];
      const map = {};
      const ids = [];
      sorted.forEach(function (r) {
        const label = dateUtil.dayLabel(r.eaten_at);
        const record = Object.assign({}, r, { foods: r.foods || r.food_items || [] });
        if (record.id) ids.push(record.id);
        if (!map[label]) {
          map[label] = [];
          groups.push({ label: label, items: map[label] });
        }
        map[label].push(record);
      });

      this.setData({ groups: groups, loading: false });
      this.loadReactions(ids);
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  // 一次把这一页所有记录的点赞 / 评论 / 收藏状态取回来（3 次请求搞定一屏）
  loadReactions(ids) {
    if (!ids || !ids.length) {
      this.setData({ reactions: {} });
      return;
    }
    interactions.getReactions(ids)
      .then((map) => this.setData({ reactions: map || {} }))
      .catch(() => {});
  },

  // 某张卡片点赞/评论/收藏之后，只刷新那一条
  onCardChanged(e) {
    const id = e && e.detail && e.detail.id;
    if (!id) return;
    interactions.getReactions([id]).then((map) => {
      if (!map || !map[id]) return;
      const reactions = Object.assign({}, this.data.reactions);
      reactions[id] = map[id];
      this.setData({ reactions: reactions });
    }).catch(() => {});
  }
});
