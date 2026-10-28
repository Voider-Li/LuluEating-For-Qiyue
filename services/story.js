// 剧情：从餐桌上的礼物点进来的一段"视觉小说"。
// 内容全部放在云数据库 stories 集合里，改台词不用发版。
//
// 表结构（stories）：
// {
//   "_id": "birthday-2026",
//   "enabled": true,
//   "title": "给祈栎",
//
//   "scenes": [                       // 界面一：一幕一幕的对话
//     {
//       "image": "/assets/story/1.jpg",   // 这一幕的图（本地路径或云存储 fileID 都行）
//       "lines": [
//         { "name": "三个小家伙", "text": "……", "option": false },  // 角色说的
//         { "name": "祈栎",       "text": "……", "option": true  }   // 玩家"选项"（样式不同）
//       ]
//     }
//   ],
//
//   "pages": [                        // 界面二：整屏图片
//     { "image": "/assets/story/5.jpg", "text": "" }
//   ],
//
//   "letter": {                       // 可选：最后的一封信（纯文字）
//     "title": "写给你的一封信",
//     "text": "第一段\n\n第二段",
//     "sign": "—— 清辉"
//   }
// }

const CONFIG = require('../config');
const cloud = require('./cloud');

const LOCAL_KEY = 'mock_story';

// 图片地址容错：写成 assets/story/letter/1.jpg（少了前导斜杠）时自动补上。
// 小程序里绝对路径必须从 / 开头，否则加载不出来。
function fixSrc(src) {
  const s = String(src || '').trim();
  if (!s) return '';
  if (s.charAt(0) === '/') return s;
  if (s.indexOf('cloud://') === 0) return s;
  if (s.indexOf('http://') === 0 || s.indexOf('https://') === 0) return s;
  if (s.indexOf('wxfile://') === 0 || s.indexOf('data:') === 0) return s;
  return '/' + s;
}

function cleanLines(lines) {
  return (lines || [])
    .filter(function (l) { return l && (l.text || l.name); })
    .map(function (l, i) {
      return {
        key: 'l' + i,
        name: l.name || '',
        text: l.text || '',
        option: !!l.option
      };
    });
}

// 把数据库里的一条记录整理成页面好用的形状
function normalize(doc) {
  if (!doc) return null;

  const scenes = (doc.scenes || [])
    .map(function (s, i) {
      return { key: 's' + i, image: fixSrc(s && s.image), lines: cleanLines(s && s.lines) };
    })
    .filter(function (s) { return s.image || s.lines.length; });

  const pages = (doc.pages || [])
    .filter(function (p) { return p && (p.image || p.text); })
    .map(function (p, i) {
      return { key: 'p' + i, image: fixSrc(p.image), text: p.text || '' };
    });

  const letter = doc.letter && (doc.letter.text || doc.letter.title)
    ? {
        title: doc.letter.title || '',
        text: doc.letter.text || '',
        sign: doc.letter.sign || ''
      }
    : null;

  if (!scenes.length && !pages.length && !letter) return null;

  return {
    id: doc._id || doc.id || '',
    title: doc.title || '',
    scenes: scenes,
    pages: pages,
    letter: letter
  };
}

// id 为空 = 取第一条 enabled 的剧情
function getStory(id) {
  if (CONFIG.USE_MOCK_DATA) {
    return Promise.resolve(normalize(wx.getStorageSync(LOCAL_KEY)));
  }

  if (CONFIG.BACKEND === 'cloud') {
    // cloud.collection() 可能同步抛错，这里兜住，别让剧情页崩掉
    let query;
    try {
      const col = cloud.collection('stories');
      query = id
        ? col.where({ _id: id }).limit(1).get()
        : col.where({ enabled: true }).limit(1).get();
    } catch (e) {
      console.warn('[story] 云开发未就绪：', e && e.message);
      return Promise.resolve(null);
    }

    return query
      .then(function (res) {
        return normalize(res.data && res.data[0]);
      })
      .catch(function (e) {
        console.warn('[story] 读取失败：', e && e.message);
        return null;
      });
  }

  return Promise.resolve(null);
}

module.exports = { getStory, normalize };
