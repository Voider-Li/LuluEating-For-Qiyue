const dateUtil = require('../../utils/date');

const REPLIES = [
  '好呀～今天吃了什么好吃的？🍚',
  '嘿嘿，我觉得可以来点番茄炒蛋！🍅',
  '刚在想晚餐吃什么，你有主意吗？',
  '记得多喝水哦～ 💧',
  '睡前别吃太冰的，对胃好 🧊',
  '哈哈，被你抓到啦，我正饿着肚子呢 😋'
];

Page({
  data: {
    messages: [],
    inputValue: '',
    typing: false,
    scrollIntoView: ''
  },

  onLoad() {
    this.loadMessages();
  },

  loadMessages() {
    const messages = wx.getStorageSync('chat_messages') || [];
    this.setData({ messages: messages });
    this.scrollToBottom(messages.length ? messages[messages.length - 1].id : '');
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  onSend() {
    const text = (this.data.inputValue || '').trim();
    if (!text || this.data.typing) return;

    const now = Date.now();
    const userMsg = {
      id: 'u' + now,
      from: 'me',
      text: text,
      time: now
    };
    const messages = this.data.messages.concat([userMsg]);
    this.saveMessages(messages);
    this.setData({
      messages: messages,
      inputValue: ''
    });
    this.scrollToBottom(userMsg.id);
    this.simulateReply();
  },

  simulateReply() {
    this.setData({ typing: true });
    const reply = this.pickReply();
    setTimeout(() => {
      const msg = {
        id: 'r' + Date.now(),
        from: 'partner',
        text: reply,
        time: Date.now()
      };
      const messages = this.data.messages.concat([msg]);
      this.saveMessages(messages);
      this.setData({ messages: messages, typing: false });
      this.scrollToBottom(msg.id);
    }, 800 + Math.random() * 900);
  },

  pickReply() {
    // 简单轮换，避免连续重复
    const idx = this._replyIdx == null ? -1 : this._replyIdx;
    const next = (idx + 1) % REPLIES.length;
    this._replyIdx = next;
    return REPLIES[next];
  },

  saveMessages(messages) {
    wx.setStorageSync('chat_messages', messages.slice(-200));
  },

  onClear() {
    if (!this.data.messages.length) return;
    wx.showModal({
      title: '清空聊天',
      content: '确定要清空和嘎哒的聊天记录吗？',
      confirmColor: '#B57D0A',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('chat_messages');
          this.setData({ messages: [], scrollIntoView: '' });
        }
      }
    });
  },

  scrollToBottom(id) {
    if (!id) return;
    this.setData({ scrollIntoView: 'msg-' + id });
  },

  formatTime(ts) {
    return dateUtil.formatTime(ts);
  }
});
