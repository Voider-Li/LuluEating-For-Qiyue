// 云函数：login
// 作用：拿到调用者的 openid，做身份校验，返回 / 创建他的 profile（祈栎 / 清辉）。
// 只有云函数能安全拿到 openid，所以登录必须走这里。
//
// 身份校验三道：
//   ① openid 由微信给，前端伪造不了；
//   ② 这张餐桌只坐两个人 —— profiles 最多 2 条，第三个人进不来；
//   ③ 一个身份一旦被某台设备认领，别人顶不掉（换设备要在控制台删掉那条）。
//
// 环境变量（可选，用来临时放开）：
//   ALLOW_EXTRA_USERS=true   允许超过 2 人
//   ALLOW_ROLE_SWITCH=true   允许同一台设备切换身份（调试用）
//
// 入参：
//   {}                                  -> { ok, openid, profile }
//   { action: 'claim', role, nickname } -> 认领身份

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COLLECTION = 'profiles';
const ROLES = { qiyue: '祈栎', qinghui: '清辉' };
const MAX_USERS = 2; // 这张餐桌只坐两个人

function flag(name) {
  return String(process.env[name] || '').toLowerCase() === 'true';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, error: '拿不到 openid' };

  try {
    await ensureCollection(COLLECTION);
    if (event && event.action === 'claim') {
      return await claim(OPENID, event);
    }
    return await whoami(OPENID);
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
};

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (e) {
    // 已存在会报错，忽略
  }
}

async function getProfile(openid) {
  try {
    const res = await db.collection(COLLECTION).where({ _openid: openid }).limit(1).get();
    return (res.data && res.data[0]) || null;
  } catch (e) {
    return null;
  }
}

async function getProfileByRole(role) {
  try {
    const res = await db.collection(COLLECTION).where({ role: role }).limit(1).get();
    return (res.data && res.data[0]) || null;
  } catch (e) {
    return null;
  }
}

async function countProfiles() {
  try {
    const res = await db.collection(COLLECTION).count();
    return res.total || 0;
  } catch (e) {
    return 0;
  }
}

async function whoami(openid) {
  const profile = await getProfile(openid);
  if (profile) return { ok: true, openid: openid, profile: profile };

  // 还没有身份：看还有没有空位
  const total = await countProfiles();
  if (total >= MAX_USERS && !flag('ALLOW_EXTRA_USERS')) {
    return { ok: false, full: true, openid: openid, error: '这张餐桌只属于两个人，已经没有空位了。' };
  }
  return { ok: true, openid: openid, profile: null };
}

async function claim(openid, event) {
  const role = event.role;
  if (!ROLES[role]) return { ok: false, error: 'role 只能是 qiyue 或 qinghui' };
  const nickname = event.nickname || ROLES[role];
  const now = Date.now();

  const mine = await getProfile(openid);
  const holder = await getProfileByRole(role);

  // ① 这个身份已经被别人认领了 → 不许顶
  if (holder && holder._openid !== openid) {
    return {
      ok: false,
      taken: true,
      error: ROLES[role] + ' 已经在另一台设备上认领过了。要换设备，去云开发控制台把 profiles 里那条删掉再来。'
    };
  }

  // ② 新用户，但已经坐满 → 不许进
  if (!mine) {
    const total = await countProfiles();
    if (total >= MAX_USERS && !flag('ALLOW_EXTRA_USERS')) {
      return { ok: false, full: true, error: '这张餐桌只属于两个人，已经没有空位了。' };
    }
  }

  // ③ 自己已经有身份，现在想改 → 默认锁死（要放开把 ALLOW_ROLE_SWITCH 设为 true）
  if (mine && mine.role && mine.role !== role && !flag('ALLOW_ROLE_SWITCH')) {
    return {
      ok: false,
      locked: true,
      error: '这台设备已经认领了「' + ROLES[mine.role] + '」，不能再改。'
    };
  }

  if (mine) {
    await db.collection(COLLECTION).doc(mine._id).update({
      data: { role: role, nickname: nickname, updated_at: now }
    });
  } else {
    await db.collection(COLLECTION).add({
      data: {
        _openid: openid,
        role: role,
        nickname: nickname,
        avatar: '',
        created_at: now,
        updated_at: now
      }
    });
  }

  const profile = await getProfile(openid);
  return { ok: true, openid: openid, profile: profile };
}
