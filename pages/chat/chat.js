const foodService = require('../../services/food');
const agentsService = require('../../services/agents');
const chatService = require('../../services/chat');
const backstageService = require('../../services/backstage');
const app = getApp();

// 桌面上的六个盘子位（百分比，相对 table.png 820×912）
// 上半三个是祈栎那侧，下半三个是清辉那侧
// 每排三个呈弧形：两侧的早饭 / 晚饭朝自己人那边靠，中间那格稍远
const PLATE_SLOTS = [
  { key: 'qiyue-breakfast', side: 'qiyue', meal: 'breakfast', label: '早饭', left: 30, top: 22 },
  { key: 'qiyue-lunch', side: 'qiyue', meal: 'lunch', label: '午饭', left: 50, top: 27 },
  { key: 'qiyue-dinner', side: 'qiyue', meal: 'dinner', label: '晚饭', left: 70, top: 22 },
  { key: 'qinghui-breakfast', side: 'qinghui', meal: 'breakfast', label: '早饭', left: 30, top: 78 },
  { key: 'qinghui-lunch', side: 'qinghui', meal: 'lunch', label: '午饭', left: 50, top: 73 },
  { key: 'qinghui-dinner', side: 'qinghui', meal: 'dinner', label: '晚饭', left: 70, top: 78 }
];

const PEOPLE = {
  qiyue: { id: 'mock-qiyue', name: '祈栎', color: '#E6F1FB', textColor: '#0C447C', initial: '祈' },
  qinghui: { id: 'mock-qinghui', name: '清辉', color: '#FAEEDA', textColor: '#633806', initial: '清' }
};

function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function fillTemplate(text, record) {
  const foods = (record.foods || []).map(function (f) { return f.name; }).filter(Boolean);
  return String(text)
    .replace(/\{\{foods\}\}/g, foods.length ? foods.join('、') : '这一餐')
    .replace(/\{\{note\}\}/g, record.note || record.ga_da_note || '');
}

// 记录属于谁那侧：cloud 模式有 owner_role，mock 模式靠 id 判断
function sideOf(record) {
  if (record.owner_role) return record.owner_role === 'qinghui' ? 'qinghui' : 'qiyue';
  return record.owner_id === PEOPLE.qinghui.id ? 'qinghui' : 'qiyue';
}

// 把"现在 / 今晚 8 点 / 明早 8 点"换算成时间戳
function backstageVisibleAt(when) {
  const now = new Date();
  if (when === 'tonight') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  if (when === 'tomorrow') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0, 0).getTime();
  }
  return Date.now();
}

function backstageWhenText(ts) {
  const d = new Date(ts);
  const today = new Date();
  const hh = ('0' + d.getHours()).slice(-2);
  const mm = ('0' + d.getMinutes()).slice(-2);
  const isToday = d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  if (isToday) return '今天 ' + hh + ':' + mm;
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hh + ':' + mm;
}

// 点了智能体、AI 还没回话之前的"思考中"文字 —— 每只语气不一样
const THINKING_LINES = {
  'egg-sheep': [
    '唔……让我闻闻',
    '诶，我想想哦……',
    '等等，我数数有几样',
    '让我再馋一会儿……',
    '嗯……我看看盘子'
  ],
  'capybara-lulu': [
    '嗯……我想想',
    '慢一点，我理一理……',
    '让我看看今天的桌子……',
    '稍等一下下……',
    '唔……我在听'
  ],
  'lumei': [
    '让我掐指一算……',
    '唔……数据加载中',
    '等下，我看看规律……',
    '我看看哦……',
    '嗯……让我算算'
  ]
};
const THINKING_FALLBACK = ['唔……让我想想', '嗯……稍等一下', '让我理一理……', '我在想呢……'];

function thinkingText(agentId) {
  const list = THINKING_LINES[agentId] || THINKING_FALLBACK;
  return list[Math.floor(Math.random() * list.length)];
}

Page({
  data: {
    todayText: '',
    unread: false,
    seats: {
      qiyue: {
        name: PEOPLE.qiyue.name, avatar: '', color: PEOPLE.qiyue.color,
        textColor: PEOPLE.qiyue.textColor, initial: PEOPLE.qiyue.initial, left: 50, top: 0
      },
      qinghui: {
        name: PEOPLE.qinghui.name, avatar: '', color: PEOPLE.qinghui.color,
        textColor: PEOPLE.qinghui.textColor, initial: PEOPLE.qinghui.initial, left: 50, top: 99
      }
    },
    plates: [],
    mates: [],
    bubble: null,

    // 到点的惊喜（后厨布置的）
    surprises: [],

    // 后厨面板（清辉专属）
    backstageOpen: false,
    bsContent: '',
    bsFor: 'qiyue',
    bsWhen: 'now',
    bsList: []
  },

  onLoad() {
    const d = new Date();
    this.setData({ todayText: (d.getMonth() + 1) + '月' + d.getDate() + '日' });
  },

  onShow() {
    // 人设从数据库读（读不到会退回前端默认），读到之后再打招呼
    this.loadAgents().then(() => { this.greet(); });
    this.refresh();
    this.loadSurprises();
  },

  onHide() {
    this.clearBubbleTimer();
    wx.setStorageSync('chat_last_seen', Date.now());
    this.setData({ unread: false });
  },

  onUnload() {
    this.clearBubbleTimer();
  },

  /* ---------------- 三个小伙伴 ---------------- */

  loadAgents() {
    return agentsService.getAgents().then((agents) => {
      this._agents = agents || [];
      this.setData({ mates: this.buildMates(this._agents) });
    }).catch(() => {
      this._agents = [];
      this.setData({ mates: [] });
    });
  },

  buildMates(agents) {
    return (agents || []).map(function (agent) {
      const seat = agent.seat || { left: 50, top: 92 };
      return {
        id: agent.id,
        name: agent.name,
        avatar: agent.avatar || '',
        emoji: agent.emoji || '✦',
        color: agent.color || '#F4E7C5',
        textColor: agent.textColor || '#8A5A12',
        description: agent.description || '',
        left: seat.left,
        top: seat.top,
        speaking: false,
        _greeting: agent.greeting || [],
        _replies: agent.replies || []
      };
    });
  },

  // 进页面时随机挑一只打招呼
  greet() {
    const mates = this.data.mates;
    if (!mates.length) return;
    const mate = pickOne(mates);
    const text = mate._greeting.length ? pickOne(mate._greeting) : '我在这儿呢。';
    this.speak(mate, text);
  },

  // 点某一只：先冒个"正在想"，再去问 AI；问不到就用本地模板兜底
  onAgentTap(e) {
    const id = e.currentTarget.dataset.id;
    const mate = this.data.mates.find(function (m) { return m.id === id; });
    if (!mate) return;

    const record = this.pickRecord();
    const fallback = mate._replies.length
      ? fillTemplate(pickOne(mate._replies), record || {})
      : '我记下啦。';

    // 先冒一句随机的"思考中"，再等 AI 回话
    this.speak(mate, thinkingText(mate.id), true);

    const agent = (this._agents || []).find(function (a) { return a.id === id; }) || mate;
    const foods = record
      ? (record.foods || []).map(function (f) { return f.name; }).filter(Boolean).join('、')
      : '';
    const hint = foods
      ? '对方刚点了一下你，想听你说说桌上这顿（' + foods + '）。用你自己的口吻说一到两句。'
      : '对方刚点了一下你。用你自己的口吻说一到两句。';

    chatService.askAgent(agent, hint)
      .then((msg) => {
        this.speak(mate, (msg && msg.content) ? msg.content : fallback);
      })
      .catch(() => {
        this.speak(mate, fallback);
      });
  },

  pickRecord() {
    const filled = this.data.plates.filter(function (p) { return !p.empty && p.record; });
    if (!filled.length) return null;
    return pickOne(filled).record;
  },

  speak(mate, text, thinking) {
    this.clearBubbleTimer();
    const mates = this.data.mates.map(function (m) {
      return Object.assign({}, m, { speaking: m.id === mate.id });
    });
    this.setData({
      mates: mates,
      bubble: { id: mate.id, name: mate.name, avatar: mate.avatar, color: mate.color, text: text, thinking: !!thinking }
    });
    this._bubbleTimer = setTimeout(() => {
      this.setData({
        bubble: null,
        mates: this.data.mates.map(function (m) { return Object.assign({}, m, { speaking: false }); })
      });
    }, 7000);
  },

  clearBubbleTimer() {
    if (this._bubbleTimer) {
      clearTimeout(this._bubbleTimer);
      this._bubbleTimer = null;
    }
  },

  onBubbleTap() {
    this.clearBubbleTimer();
    this.setData({ bubble: null });
  },

  /* ---------------- 桌上的六道菜 ---------------- */

  async refresh() {
    let records = [];
    try {
      records = (await foodService.getTodayTable()) || [];
    } catch (err) {
      records = [];
    }
    const list = records.map(function (r) {
      return Object.assign({}, r, { foods: r.foods || r.food_items || [] });
    });

    // 消息流（记录上桌 + 智能体发言）：用来算"桌上有新东西"的红点
    let messages = [];
    try {
      messages = (await chatService.getMessages(20)) || [];
    } catch (err) {
      messages = [];
    }

    const lastSeen = wx.getStorageSync('chat_last_seen') || 0;
    const latestRecord = list.reduce(function (max, r) { return Math.max(max, r.eaten_at || 0); }, 0);
    const latestMsg = messages.reduce(function (max, m) { return Math.max(max, m.created_at || 0); }, 0);

    this.setData({
      plates: this.buildPlates(list),
      unread: Math.max(latestRecord, latestMsg) > lastSeen
    });
  },

  // 六个格子固定对应「某人 × 某餐」；同一餐有多条时取最新一条
  buildPlates(records) {
    const latest = {};
    records.forEach(function (record) {
      const side = sideOf(record);
      const slotKey = side + '|' + record.meal_type;
      if (!latest[slotKey] || (record.eaten_at || 0) > (latest[slotKey].eaten_at || 0)) {
        latest[slotKey] = record;
      }
    });

    return PLATE_SLOTS.map(function (slot) {
      const record = latest[slot.side + '|' + slot.meal] || null;
      const foods = record
        ? (record.foods || []).map(function (f) { return f.name; }).filter(Boolean)
        : [];
      return {
        key: slot.key,
        side: slot.side,
        label: slot.label,
        left: slot.left,
        top: slot.top,
        empty: !record,
        image: (record && record.image_path) || '',
        foodsText: foods.join('、'),
        record: record
      };
    });
  },

  onPlateTap(e) {
    const key = e.currentTarget.dataset.key;
    const plate = this.data.plates.find(function (p) { return p.key === key; });
    if (!plate) return;

    if (plate.empty) {
      wx.switchTab({ url: '/pages/record/record' });
      return;
    }
    const note = plate.record.note || plate.record.ga_da_note || '';
    wx.showModal({
      title: plate.label,
      content: (plate.foodsText || '还没写吃了什么') + (note ? '\n\n“' + note + '”' : ''),
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#B57D0A'
    });
  },

  onSeatTap(e) {
    const side = e.currentTarget.dataset.side;
    wx.showToast({ title: (this.data.seats[side] || {}).name + '的位置', icon: 'none' });
  },

  /* ---------------- 底部 ---------------- */

  onRecord() {
    wx.switchTab({ url: '/pages/record/record' });
  },

  /* ---------------- 后厨（清辉专属） ---------------- */

  myRole() {
    const user = (app && app.globalData && app.globalData.user) || {};
    if (user.role) return user.role;
    return user.id === PEOPLE.qinghui.id ? 'qinghui' : 'qiyue';
  },

  isQinghui() {
    return this.myRole() === 'qinghui';
  },

  // 到点该出现的惊喜
  loadSurprises() {
    backstageService.listDue(this.myRole()).then((list) => {
      this.setData({ surprises: list || [] });
    }).catch(() => {});
  },

  onSurpriseDone(e) {
    const id = e.currentTarget.dataset.id;
    backstageService.markShown(id).then(() => this.loadSurprises()).catch(() => {});
  },

  // 长按「＋ 记一餐」→ 打开后厨（祈栎长按没有反应）
  onBackstage() {
    if (!this.isQinghui()) return;
    this.setData({ backstageOpen: true, bsContent: '', bsFor: 'qiyue', bsWhen: 'now' });
    this.loadBackstageList();
  },

  closeBackstage() {
    this.setData({ backstageOpen: false });
  },

  loadBackstageList() {
    backstageService.listMine().then((list) => {
      const now = Date.now();
      const rows = (list || []).map(function (item) {
        return Object.assign({}, item, {
          forText: item.for_role === 'qinghui' ? '给清辉' : '给祈栎',
          whenText: item.visible_at <= now ? '已经出现' : backstageWhenText(item.visible_at)
        });
      });
      this.setData({ bsList: rows });
    }).catch(() => {});
  },

  onBsInput(e) { this.setData({ bsContent: e.detail.value }); },
  onBsFor(e) { this.setData({ bsFor: e.currentTarget.dataset.v }); },
  onBsWhen(e) { this.setData({ bsWhen: e.currentTarget.dataset.v }); },

  onBsSave() {
    const content = (this.data.bsContent || '').trim();
    if (!content) {
      wx.showToast({ title: '先写点什么吧', icon: 'none' });
      return;
    }
    backstageService.add({
      type: 'message',
      content: content,
      for_role: this.data.bsFor,
      visible_at: backstageVisibleAt(this.data.bsWhen)
    }).then(() => {
      wx.showToast({ title: '放进后厨了', icon: 'success' });
      this.setData({ bsContent: '' });
      this.loadBackstageList();
    }).catch((err) => {
      wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' });
    });
  },

  onBsRemove(e) {
    const id = e.currentTarget.dataset.id;
    backstageService.remove(id).then(() => this.loadBackstageList()).catch(() => {});
  }
});
