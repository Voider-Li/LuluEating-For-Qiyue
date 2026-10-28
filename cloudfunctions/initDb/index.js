// 云函数：initDb
// 作用：一键建好集合 + 写入三个智能体的人设（种子数据）。
//
// 幂等 + 不覆盖：已存在的智能体默认**跳过**，所以你在数据库里改过人设不会被冲掉。
// 想强制刷回默认人设：测试时传 { "force": true }。
//
// 用法：微信开发者工具里右键 cloudfunctions/initDb -> 上传并部署，
//       再去云开发控制台「云函数 -> initDb -> 测试」传 {} 跑一次。

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COLLECTIONS = [
  // 用户
  'profiles',
  // 饮食核心
  'food_records',
  'dietary_preferences',
  'ingredients',
  // 互动
  'favorites',
  'post_likes',
  'post_comments',
  // 聊天
  'chat_agents',
  'chat_messages',
  // 辅助
  'backstage',
  'meal_recommendations',
  'ai_call_logs',
  // 键值对配置（主题开关、彩蛋开关等都放这里）
  'app_config',
  // 剧情（礼物点进去的视觉小说）
  'stories'
];

// 键值对配置的初始值。平时改这些值就行，不用发版。
//
// ★ 最常用的只有一个：birthday_mode
//     true  = 生日模式（粉色主题 + 首页横幅 + 餐桌礼物，一起开）
//     false = 平时（暖黄主题，横幅和礼物都关）
//   下面 theme / banner_enabled / gift_enabled 留空 = 跟随总开关；
//   填了就以填的为准（想单独调某一项时才用得上）。
const APP_CONFIG = [
  {
    _id: 'birthday_mode',
    key: 'birthday_mode',
    value: 'false',
    remark: '★总开关：true=生日模式（粉色+横幅+礼物全开）；false=平时（暖黄，全关）'
  },
  {
    _id: 'theme',
    key: 'theme',
    value: '',
    remark: '主题覆盖：留空跟随总开关；也可填 warm / pink 强制指定'
  },
  {
    _id: 'banner_enabled',
    key: 'banner_enabled',
    value: '',
    remark: '横幅覆盖：留空跟随总开关；填 true / false 可单独控制'
  },
  {
    _id: 'banner_text',
    key: 'banner_text',
    value: '🎉生日快乐！🎉',
    remark: '首页横幅文案，清空则不显示横幅'
  },
  {
    _id: 'banner_image',
    key: 'banner_image',
    value: '',
    remark: '首页横幅配图（云存储 fileID，可留空）'
  },
  {
    _id: 'gift_enabled',
    key: 'gift_enabled',
    value: '',
    remark: '礼物覆盖：留空跟随总开关；填 true / false 可单独控制'
  },
  {
    _id: 'gift_image',
    key: 'gift_image',
    value: '',
    remark: '礼物图（云存储 fileID，留空则用 🎁）'
  },
  {
    _id: 'story_id',
    key: 'story_id',
    value: '',
    remark: '剧情：留空=取 stories 里第一条 enabled；填了就指定那条 _id'
  }
];

// 剧情（餐桌上的礼物点进去）。台词照《剧本.md》来，改台词不用发版。
// 图片放在 assets/story/ 里，直接写本地路径即可（也能填云存储 fileID）。
//   option: true = 玩家"选项"，对话框会变成暖色高亮
//   name 留空 = 旁白，左上角不显示名字框
const STORIES = [
  {
    _id: 'birthday-2026',
    enabled: true,
    title: '给祈栎',
    scenes: [
      {
        image: '/assets/story/1.jpg',
        lines: [
          { name: '', text: '三个小家伙凑在一起，像在藏什么东西，小声嘀咕着——', option: false },
          { name: '三个小家伙', text: '今天是祈栎姐姐生日，清辉让咱们把他的小礼物藏好，咱们可不能掉链子！', option: false },
          { name: '祈栎', text: '嘿！你们三个悄咪咪地干什么呢？', option: true }
        ]
      },
      {
        image: '/assets/story/2.jpg',
        lines: [
          { name: '', text: '三个小家伙被吓了一跳，转过来，紧张地说——', option: false },
          { name: '三个小家伙', text: '祈栎姐姐！你怎么这会儿……生……生日快乐！！！', option: false },
          { name: '祈栎', text: '谢谢你们！', option: true },
          { name: '祈栎', text: '我都听到啦，把小礼物拿出来吧！', option: true }
        ]
      },
      {
        image: '/assets/story/3.jpg',
        lines: [
          { name: '', text: '噜妹拿出礼盒。', option: false }
        ]
      },
      {
        image: '/assets/story/4.jpg',
        lines: [
          { name: '', text: '噜妹打开礼盒，里面是一封信。', option: false }
        ]
      }
    ],
    // 打开信封之后：8 页信纸，左右滑动翻页
    pages: [
      { image: '/assets/story/letter/1.jpg', text: '' },
      { image: '/assets/story/letter/2.jpg', text: '' },
      { image: '/assets/story/letter/3.jpg', text: '' },
      { image: '/assets/story/letter/4.jpg', text: '' },
      { image: '/assets/story/letter/5.jpg', text: '' },
      { image: '/assets/story/letter/6.jpg', text: '' },
      { image: '/assets/story/letter/7.jpg', text: '' },
      { image: '/assets/story/letter/8.jpg', text: '' }
    ],
    // 可选：最后的一封信（纯文字）。信已经做成图片放进 pages 了，这里留 null 即可。
    letter: null
  }
];

// 三个智能体的人设。system_prompt 是核心 —— 改它不用重新发版小程序。
// model 用 DeepSeek 官方当前的名字：deepseek-flash（推荐）/ deepseek-v4-pro
const AGENTS = [
  {
    _id: 'egg-sheep',
    name: 'DongDong羊',
    emoji: '🐑',
    avatar_file_id: '',
    tone: '活泼可爱',
    color: '#FFE4A7',
    textColor: '#8A5A12',
    description: '负责发现饭菜里的可爱细节，偶尔申请偷吃一口。',
    system_prompt: [
      '你是 DongDong羊，一只活泼的小羊，住在清辉和祈栎的餐桌上。',
      '性格：贪吃、嘴甜、容易兴奋，看到好吃的就走不动路。',
      '说话方式：短、快、带语气词（"哇""诶""嘿嘿"），一次只说一到两句，绝不长篇大论，不用列表。',
      '你会做的事：夸这顿饭哪里可爱、哪里香；如果对方吃得少或者只吃了一样，半开玩笑地提醒一句；偶尔申请"隔着屏幕偷吃一口"。',
      '边界：不评价身材、不催减肥、不说教；不确定的事不要编。'
    ].join('\n'),
    model: 'deepseek-flash',
    temperature: 0.9,
    chattiness: 70,
    seat: { left: 8, top: 50 },
    enabled: true
  },
  {
    _id: 'capybara-lulu',
    name: '噜噜',
    emoji: '🦫',
    avatar_file_id: '',
    tone: '温柔安静',
    color: '#DDEEDC',
    textColor: '#52724E',
    description: '会留意你有没有好好吃饭，也会听你说碎碎念。',
    system_prompt: [
      '你是噜噜，一只温柔安静的水豚，住在清辉和祈栎的餐桌上。',
      '性格：慢、稳、话不多，但很在意对方过得好不好。',
      '说话方式：轻声细语，一到两句，不用列表，不堆感叹号。',
      '你会做的事：看到对方今天记录了，轻轻肯定一句；如果对方在碎碎念里提到累、忙、心情不好，先接住情绪，再说吃饭；偶尔提醒喝水、休息。',
      '边界：不催、不评判、不说教；对方不想说就不追问。'
    ].join('\n'),
    model: 'deepseek-flash',
    temperature: 0.8,
    chattiness: 40,
    seat: { left: 91, top: 40 },
    enabled: true
  },
  {
    _id: 'lumei',
    name: '噜妹',
    emoji: '🐰',
    avatar_file_id: '',
    tone: '机灵俏皮',
    color: '#F6DDE2',
    textColor: '#A25768',
    description: '擅长发现饮食里的小规律，偶尔轻轻吐槽一下。',
    system_prompt: [
      '你是噜妹，一只机灵的小兔，住在清辉和祈栎的餐桌上。',
      '性格：爱观察、爱总结、嘴快但不刻薄。',
      '说话方式：一到两句，带点调侃，可以引用具体菜名；不用列表，不说套话。',
      '你会做的事：从最近几天的记录里看出小规律（总吃同一种、蔬菜偏少、晚饭偏晚等），轻轻点一句；偶尔和 DongDong羊、噜噜拌嘴。',
      '边界：只吐槽吃的事，不攻击人；不编造没看到的数据。'
    ].join('\n'),
    model: 'deepseek-flash',
    temperature: 0.9,
    chattiness: 55,
    seat: { left: 91, top: 63 },
    enabled: true
  }
];

exports.main = async (event) => {
  const force = !!(event && event.force);
  // 只刷新键值对配置（会把 birthday_mode 等刷回种子值！不动智能体人设）：{"forceConfig": true}
  const forceConfig = !!(event && event.forceConfig) || force;
  // 只刷新剧情（不动配置、不动人设）：{"forceStory": true}  ← 平时刷新剧情用这个
  const forceStory = !!(event && event.forceStory) || force;

  const created = [];
  const existed = [];
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name);
      created.push(name);
    } catch (e) {
      existed.push(name);
    }
  }

  const seeded = [];
  for (const agent of AGENTS) {
    const id = agent._id;
    const already = await docExists('chat_agents', id);
    if (already && !force) {
      seeded.push('chat_agents/' + id + '（已存在，跳过；要刷回默认请传 {"force":true}）');
      continue;
    }
    // 注意：doc(id).set() 的 data 里不能带 _id，
    // 否则报 "document.set fail -501007 invalid parameters. 不能更新 _id 值"
    const data = Object.assign({}, agent);
    delete data._id;
    await db.collection('chat_agents').doc(id).set({ data: data });
    seeded.push('chat_agents/' + id + (already ? '（已刷新）' : ''));
  }

  // 键值对配置：同样"已存在就跳过"，避免把你改过的开关刷回默认
  for (const item of APP_CONFIG) {
    const id = item._id;
    const already = await docExists('app_config', id);
    if (already && !forceConfig) {
      seeded.push('app_config/' + id + '（已存在，跳过；要刷回默认请传 {"forceConfig":true}）');
      continue;
    }
    const data = Object.assign({}, item, { updated_at: Date.now() });
    delete data._id;
    await db.collection('app_config').doc(id).set({ data: data });
    seeded.push('app_config/' + id + (already ? '（已刷新）' : ''));
  }

  // 剧情：跟配置一样，已存在就跳过（你改过台词不会被冲掉）
  for (const story of STORIES) {
    const id = story._id;
    const already = await docExists('stories', id);
    if (already && !forceStory) {
      seeded.push('stories/' + id + '（已存在，跳过；要刷回默认请传 {"forceStory":true}）');
      continue;
    }
    const data = Object.assign({}, story, { updated_at: Date.now() });
    delete data._id;
    await db.collection('stories').doc(id).set({ data: data });
    seeded.push('stories/' + id + (already ? '（已刷新）' : ''));
  }

  return {
    ok: true,
    created: created,
    existed: existed,
    seeded: seeded,
    tip: '日常改主题/横幅/剧情台词：直接改数据库，重进页面即生效。要刷回默认才需要传参：{"forceStory":true} 只刷剧情（推荐）；{"forceConfig":true} 只刷配置（注意会把 birthday_mode 重置为 false）；{"force":true} 全部刷（含智能体人设，慎用）。另外记得给 app_config、stories 配安全规则。'
  };
};

async function docExists(collection, id) {
  try {
    const res = await db.collection(collection).doc(id).get();
    return !!(res && res.data);
  } catch (e) {
    return false;
  }
}
