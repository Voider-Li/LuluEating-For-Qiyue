// 桌上的三个小伙伴
// avatar  : 圆形头像图
// seat    : 在餐桌图上的落座位置（百分比）
//           贴在桌子的左右两侧，尽量远离上下两端的祈栎 / 清辉
//           DongDong羊在左侧，噜噜 + 噜妹在右侧
// greeting: 用户进入页面时随机挑一句打招呼
// replies : 点它时冒出的观察（可带 {{foods}} / {{note}} 占位）
const DEFAULT_AGENTS = [
  {
    id: 'egg-sheep',
    name: 'DongDong羊',
    emoji: '🐑',
    avatar: '/assets/images/ddyavatar.jpg',
    tone: '活泼可爱',
    color: '#FFE4A7',
    textColor: '#8A5A12',
    description: '负责发现饭菜里的可爱细节，偶尔申请偷吃一口。',
    seat: { left: 8, top: 50 },
    greeting: ['来啦！今天想吃点什么？', '你终于来了，我一直在看桌子呢！', '快坐快坐，我等你半天啦～'],
    replies: [
      '这顿看起来也太香了吧，我可以申请隔着屏幕偷吃一口吗？',
      '嘿嘿，被我发现你今天吃得挺认真的！',
      '{{foods}} 诶，光看名字我就馋了。'
    ]
  },
  {
    id: 'capybara-lulu',
    name: '噜噜',
    emoji: '🦫',
    avatar: '/assets/images/luluavatar.jpg',
    tone: '温柔安静',
    color: '#DDEEDC',
    textColor: '#52724E',
    description: '会留意你有没有好好吃饭，也会听你说碎碎念。',
    seat: { left: 91, top: 40 },
    greeting: ['你回来啦，先坐一会儿吧。', '今天过得还好吗？我在这儿呢。', '慢慢来，不着急，先看看桌子。'],
    replies: [
      '看到你有好好记录这一餐，我就放心一点啦。',
      '如果今天有点累，也记得给自己留一点休息时间。',
      '{{note}} 嗯，我听见了，慢慢说。'
    ]
  },
  {
    id: 'lumei',
    name: '噜妹',
    emoji: '🐰',
    avatar: '/assets/images/lumeiavatar.jpg',
    tone: '机灵俏皮',
    color: '#F6DDE2',
    textColor: '#A25768',
    description: '擅长发现饮食里的小规律，偶尔轻轻吐槽一下。',
    seat: { left: 91, top: 63 },
    greeting: ['咦，终于来了。我看看你今天吃了什么。', '来的正好，桌上还差一道菜哦。', '我可都记着呢，你今天吃得怎么样？'],
    replies: [
      '根据我的观察，这顿饭的关键词是：{{foods}}。',
      '不过下次要不要再加一点蔬菜？我会继续观察的。',
      '有意思，这条我记在今天的观察里了。'
    ]
  }
];

function getAgents() {
  const custom = wx.getStorageSync('custom_agents') || [];
  return DEFAULT_AGENTS.concat(custom);
}

function pickAgent(agents) {
  const list = agents && agents.length ? agents : getAgents();
  return list[Math.floor(Math.random() * list.length)];
}

module.exports = { DEFAULT_AGENTS, getAgents, pickAgent };
