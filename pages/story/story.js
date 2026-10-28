// 剧情页：视觉小说式。
// 界面一 = 一幕幕对话（底部半透明对话框 + 左上角名字框）→ 白屏过渡 → 界面二（整屏图片）→ 可选的信。
// 内容全部来自云数据库 stories 集合，改台词不用发版。

const appConfig = require('../../services/app-config');
const storyService = require('../../services/story');

const TYPE_SPEED = 45; // 打字机：每个字 45ms
const FADE_MS = 1100;  // 界面一 → 界面二 的白屏过渡时长

Page({
  data: {
    loading: true,
    story: null,

    stage: 'dialogue', // dialogue（对话）| fade（白屏过渡）| pages（信纸翻页）| letter（纯文字信）| end
    scene: null,       // 当前这一幕（图 + 台词）
    line: null,        // 当前这一句
    sceneIndex: 0,
    lineIndex: 0,

    typed: '',         // 打字机已显示的正文
    typing: false,

    pageIndex: 0,      // 信纸翻到第几页
    currentImage: '',  // 当前这页信纸的图片地址（用字符串，页面直接绑定，最稳）
    fading: false,     // 信纸正在淡出（翻页过渡用）
    imgFailed: false,  // 当前这页图加载失败

    dots: [],          // 界面一的幕数指示
    topPadding: 44
  },

  onLoad() {
    if (wx.setKeepScreenOn) wx.setKeepScreenOn({ keepScreenOn: true });

    try {
      const sys = wx.getSystemInfoSync();
      this.setData({ topPadding: ((sys && sys.statusBarHeight) || 20) + 12 });
    } catch (e) {
      // 拿不到就用默认值
    }

    this.load();
  },

  onUnload() {
    this.stopTyping();
    if (this._fadeTimer) clearTimeout(this._fadeTimer);
    if (this._pageTimer) clearTimeout(this._pageTimer);
    if (wx.setKeepScreenOn) wx.setKeepScreenOn({ keepScreenOn: false });
  },

  /* ---------------- 加载 ---------------- */

  load() {
    Promise.resolve()
      .then(() => appConfig.load())
      .then((cfg) => storyService.getStory((cfg && cfg.story_id) || ''))
      .catch(() => null)
      .then((story) => {
        if (!story) {
          this.setData({ loading: false, story: null });
          return;
        }
        this.setData({
          loading: false,
          story: story,
          dots: story.scenes.map(function (s, i) { return i; }),
          sceneIndex: 0,
          lineIndex: 0,
          stage: 'dialogue'
        });

        // 排查用：在调试器 Console 里能看到数据库实际读到了什么
        console.log('[story] 幕数:', story.scenes.length,
          '| 信纸页数:', story.pages.length,
          '| 第一页 image:', story.pages[0] ? JSON.stringify(story.pages[0].image) : '(无)');

        this.showLine();
      });
  },

  /* ---------------- 界面一：对话 ---------------- */

  showLine() {
    const story = this.data.story;
    if (!story) return;

    const scene = story.scenes[this.data.sceneIndex];
    if (!scene) {
      this.gotoPages();
      return;
    }
    const line = scene.lines[this.data.lineIndex];
    if (!line) {
      this.nextLine(); // 这一幕没有台词，直接跳下一幕
      return;
    }

    this.setData({ scene: scene, line: line });
    this.startTyping(line.text || '');
  },

  nextLine() {
    const story = this.data.story;
    if (!story) return;

    const scene = story.scenes[this.data.sceneIndex];
    const lines = (scene && scene.lines) || [];

    // 这一幕还有下一句
    if (this.data.lineIndex + 1 < lines.length) {
      this.setData({ lineIndex: this.data.lineIndex + 1 });
      this.showLine();
      return;
    }

    // 这一幕说完了 → 下一幕
    if (this.data.sceneIndex + 1 < story.scenes.length) {
      this.setData({ sceneIndex: this.data.sceneIndex + 1, lineIndex: 0 });
      this.showLine();
      return;
    }

    // 全部说完 → 白屏过渡
    this.gotoPages();
  },

  /* ---------------- 界面二：整屏图片 ---------------- */

  gotoPages() {
    this.stopTyping();
    this.setData({ stage: 'fade', scene: null, line: null, typed: '' });

    this._fadeTimer = setTimeout(() => {
      const story = this.data.story;
      if (!story) {
        this.setData({ stage: 'end' });
        return;
      }
      if (story.pages.length) {
        const first = story.pages[0];
        this.setData(
          { stage: 'pages', pageIndex: 0, currentImage: (first && first.image) || '', imgFailed: false },
          () => {
            console.log('[story] 进入信纸，currentImage =', JSON.stringify(this.data.currentImage));
          }
        );
        return;
      }
      if (story.letter) {
        this.setData({ stage: 'letter' });
        return;
      }
      this.setData({ stage: 'end' });
    }, FADE_MS);
  },

  /* ---------------- 打字机 ---------------- */

  startTyping(full) {
    this.stopTyping();
    if (!full) {
      this.setData({ typed: '', typing: false });
      return;
    }

    this.setData({ typed: '', typing: true });
    let i = 0;
    this._typer = setInterval(() => {
      i += 1;
      this.setData({ typed: full.slice(0, i) });
      if (i >= full.length) this.stopTyping();
    }, TYPE_SPEED);
  },

  stopTyping() {
    if (this._typer) {
      clearInterval(this._typer);
      this._typer = null;
    }
    if (this.data.typing) this.setData({ typing: false });
  },

  completeTyping() {
    this.stopTyping();
    const line = this.data.line;
    this.setData({ typed: (line && line.text) || '' });
  },

  /* ---------------- 交互 ---------------- */

  // 点屏幕（只处理对话那一幕；信纸那一屏用左下/右下按钮翻页）
  onTap() {
    if (this.data.stage !== 'dialogue') return;

    if (this.data.typing) {
      this.completeTyping(); // 字还没打完 → 先补全
    } else {
      this.nextLine();
    }
  },

  // 信纸左右翻页
  onPrevPage() {
    this.goPage(this.data.pageIndex - 1);
  },

  onNextPage() {
    const story = this.data.story;
    if (!story) return;
    if (this.data.pageIndex >= story.pages.length - 1) {
      this.onFinishPages();
      return;
    }
    this.goPage(this.data.pageIndex + 1);
  },

  goPage(next) {
    const story = this.data.story;
    if (!story || next < 0 || next >= story.pages.length) return;
    if (this.data.fading) return;

    this.setData({ fading: true });
    if (this._pageTimer) clearTimeout(this._pageTimer);
    this._pageTimer = setTimeout(() => {
      const target = story.pages[next];
      this.setData({
        pageIndex: next,
        currentImage: (target && target.image) || '',
        fading: false,
        imgFailed: false
      });
    }, 190);
  },

  // 图加载失败时给个提示，别让用户对着白屏猜
  onImgError(e) {
    console.warn('[story] 信纸图片加载失败：', JSON.stringify(this.data.currentImage), e && e.detail);
    this.setData({ imgFailed: true });
  },

  // 最后一页的"看完了"
  onFinishPages() {
    const story = this.data.story;
    if (story && story.letter) {
      this.setData({ stage: 'letter' });
      return;
    }
    this.setData({ stage: 'end' });
  },

  onSkip() {
    this.gotoPages();
  },

  onReplay() {
    const story = this.data.story;
    if (!story) return;
    this.setData({
      stage: 'dialogue',
      sceneIndex: 0,
      lineIndex: 0,
      pageIndex: 0,
      currentImage: ''
    });
    this.showLine();
  },

  onDone() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  onBackHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
