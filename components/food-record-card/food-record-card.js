const format = require('../../utils/format');
const dateUtil = require('../../utils/date');
const nutritionUtil = require('../../utils/nutrition');
const interactions = require('../../services/interactions');
const favoritesService = require('../../services/favorites');

Component({
  properties: {
    record: { type: Object, value: {} },
    // 由页面批量算好传进来：{ liked, likeCount, favorite, comments, commentCount }
    // 不传就自己查一次（单条），保证单独用也不会空
    reactions: { type: Object, value: null },
    // 显示"这是谁的记录"（全部记录页做朋友圈式记录流时用）
    showOwner: { type: Boolean, value: false }
  },

  data: {
    timeText: '', mealText: '', foodsText: '', nutritionText: '',
    overallMeta: { text: '', color: '', bg: '' },
    ownerName: '',
    liked: false, likeCount: 0, favorite: false,
    commentCount: 0, commentPreview: '', commentPreviewName: ''
  },

  observers: {
    record: function (record) {
      if (!record || !record.eaten_at) return;
      const foods = nutritionUtil.enrichFoods(record.foods || []);
      const t = nutritionUtil.totals(foods);
      this.setData({
        timeText: dateUtil.formatTime(record.eaten_at),
        mealText: format.mealTypeText(record.meal_type),
        foodsText: format.foodsText(foods),
        nutritionText: t.calories ? t.calories + ' 千卡 · 蛋白质 ' + t.protein + 'g' : '',
        overallMeta: format.overallMeta(record.overall),
        ownerName: record.owner_name || ''
      });
      if (!this.properties.reactions) this.loadOwnReactions();
    },
    reactions: function (r) {
      if (!r) return;
      this.applyReactions(r);
    }
  },

  methods: {
    applyReactions(r) {
      const comments = r.comments || [];
      const last = comments[comments.length - 1];
      this.setData({
        liked: !!r.liked,
        likeCount: r.likeCount || 0,
        favorite: !!r.favorite,
        commentCount: r.commentCount != null ? r.commentCount : comments.length,
        commentPreview: last ? (last.content || '') : '',
        commentPreviewName: last && last.user_name ? last.user_name + '：' : ''
      });
    },

    // 页面没传 reactions 时自己查一条
    loadOwnReactions() {
      const id = this.data.record && this.data.record.id;
      if (!id) return;
      interactions.getReactions([id]).then((map) => {
        if (map && map[id]) this.applyReactions(map[id]);
      }).catch(() => {});
    },

    onTap() { this.triggerEvent('taprecord', { id: this.data.record.id }); },
    onActionArea() {},

    // 点照片放大看
    onPreview() {
      const url = this.data.record && this.data.record.image_path;
      if (!url) return;
      wx.previewImage({ current: url, urls: [url] });
    },

    onLike(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      const id = this.data.record.id;
      interactions.toggleLike(id).then((state) => {
        this.setData({ liked: !!state.liked, likeCount: state.count || 0 });
        this.triggerEvent('changed', { id: id });
      }).catch((err) => {
        wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' });
      });
    },

    onFavorite(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      const id = this.data.record.id;
      const record = this.data.record || {};
      const foods = (record.foods || []).map(function (f) { return f.name; }).filter(Boolean);

      if (this.data.favorite) {
        favoritesService.list().then((rows) => {
          const hit = (rows || []).filter(function (f) { return f.record_id === id; })[0];
          return hit ? favoritesService.remove(hit.id) : null;
        }).then(() => {
          this.setData({ favorite: false });
          this.triggerEvent('changed', { id: id });
          wx.showToast({ title: '已取消收藏', icon: 'none' });
        }).catch((err) => {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' });
        });
        return;
      }

      favoritesService.add({
        record_id: id,
        name: foods.join('、') || '这一餐',
        note: record.note || record.ga_da_note || ''
      }).then(() => {
        this.setData({ favorite: true });
        this.triggerEvent('changed', { id: id });
        wx.showToast({ title: '已收藏', icon: 'none' });
      }).catch((err) => {
        wx.showToast({ title: (err && err.message) || '收藏失败', icon: 'none' });
      });
    },

    onComment(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      const id = this.data.record.id;
      wx.showModal({
        title: '写一句评论',
        editable: true,
        placeholderText: '比如：看起来好香！',
        confirmText: '发布',
        success: (res) => {
          const text = (res.confirm ? (res.content || '').trim() : '');
          if (!text) return;
          interactions.addComment(id, text)
            .then(() => interactions.getComments(id))
            .then((comments) => {
              this.applyReactions({
                liked: this.data.liked,
                likeCount: this.data.likeCount,
                favorite: this.data.favorite,
                comments: comments
              });
              this.triggerEvent('changed', { id: id });
            })
            .catch((err) => {
              wx.showToast({ title: (err && err.message) || '评论失败', icon: 'none' });
            });
        }
      });
    }
  }
});
