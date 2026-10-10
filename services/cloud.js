// 微信云开发轻量封装：数据库 / 云存储 / 云函数
// 其它 service 只通过这里访问云开发，方便以后整体替换。

const CONFIG = require('../config');

function isCloud() {
  return CONFIG.BACKEND === 'cloud';
}

function ensureInit() {
  if (!wx.cloud) {
    throw new Error('当前基础库不支持云开发，请把调试基础库调到 2.2.3 以上');
  }
}

function db() {
  ensureInit();
  return wx.cloud.database();
}

function collection(name) {
  return db().collection(name);
}

// 查询指令（_.gt / _.in / _.and ...）
function command() {
  return db().command;
}

// 调用云函数，直接返回 result
function call(name, data) {
  ensureInit();
  return wx.cloud
    .callFunction({ name: name, data: data || {} })
    .then(function (res) {
      const result = res && res.result;
      if (result && result.ok === false) {
        throw new Error(result.error || (name + ' 执行失败'));
      }
      return result;
    })
    .catch(function (err) {
      const msg = (err && (err.errMsg || err.message)) || '云函数调用失败';
      throw new Error(name + '：' + msg);
    });
}

// 上传本地文件到云存储，返回 fileID
// dirKey: 'food' | 'favorites' | 'chat'（对应 config.CLOUD_DIRS）
function upload(dirKey, filePath, ext) {
  ensureInit();
  const dir = (CONFIG.CLOUD_DIRS && CONFIG.CLOUD_DIRS[dirKey]) || (dirKey + '/');
  const cloudPath = dir + Date.now() + '-' + Math.floor(Math.random() * 10000) + (ext || '.jpg');
  return wx.cloud
    .uploadFile({ cloudPath: cloudPath, filePath: filePath })
    .then(function (res) { return res.fileID; });
}

// 用 fileID 换临时链接（约 2 小时有效）—— 私有文件就这样访问
// 云开发单次最多 50 个，这里自动分批
function tempFileURLs(fileIDs) {
  ensureInit();
  const list = (fileIDs || []).filter(Boolean);
  if (!list.length) return Promise.resolve([]);

  const CHUNK = 50;
  const chunks = [];
  for (let i = 0; i < list.length; i += CHUNK) chunks.push(list.slice(i, i + CHUNK));

  return chunks
    .reduce(function (chain, chunk) {
      return chain.then(function (acc) {
        return wx.cloud.getTempFileURL({ fileList: chunk }).then(function (res) {
          const urls = (res.fileList || []).map(function (item) { return item.tempFileURL || ''; });
          return acc.concat(urls);
        });
      });
    }, Promise.resolve([]));
}

function tempFileURL(fileID) {
  if (!fileID) return Promise.resolve('');
  return tempFileURLs([fileID]).then(function (urls) { return urls[0] || ''; });
}

module.exports = {
  isCloud: isCloud,
  db: db,
  collection: collection,
  command: command,
  call: call,
  upload: upload,
  tempFileURL: tempFileURL,
  tempFileURLs: tempFileURLs
};
