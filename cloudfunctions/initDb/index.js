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
  'ai_call_logs'
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

  return {
    ok: true,
    created: created,
    existed: existed,
    seeded: seeded,
    tip: '接下来：① 按《云开发数据库设计.md》§4 配安全规则；② 给 ai 云函数配环境变量 KEY_DEEPSEEK 并把超时时间调到 60 秒。'
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
