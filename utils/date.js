const CONFIG = require('../config');

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

// 把时间戳换算到目标时区（东八区）的“本地”时间
function toLocal(ts) {
  const offset = (CONFIG.TIMEZONE_OFFSET_HOURS || 8) * 3600 * 1000;
  return new Date(ts + offset);
}

// 返回东八区当天 00:00 到次日 00:00 的时间戳范围
function getTodayRange() {
  const offset = (CONFIG.TIMEZONE_OFFSET_HOURS || 8) * 3600 * 1000;
  const localNow = toLocal(Date.now());
  const start = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()) - offset;
  return { start: start, end: start + 24 * 3600 * 1000 };
}

function isToday(ts) {
  const range = getTodayRange();
  return ts >= range.start && ts < range.end;
}

function formatTime(ts) {
  const d = new Date(ts);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function dayLabel(ts) {
  if (isToday(ts)) return '今天';
  const range = getTodayRange();
  if (ts >= range.start - 86400000 && ts < range.start) return '昨天';
  return formatDate(ts);
}

module.exports = {
  getTodayRange,
  isToday,
  formatTime,
  formatDate,
  dayLabel
};
