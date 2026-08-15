/**
 * push.js —— WebPush 离线推送
 *
 * 关键点（你强调的）：
 *  - VAPID 私钥只从环境变量读取，绝不写死在代码里。
 *  - 发送时遍历数据库里所有订阅，逐台推送。
 *  - 失效订阅（404/410）自动清理。
 *  - iOS 必须把网页"添加到主屏幕"成为 PWA 才能收离线推送；安卓浏览器即可。
 */
const webpush = require('web-push');
const { db } = require('./db');

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const email = process.env.VAPID_EMAIL || 'mailto:you@example.com';

if (publicKey && privateKey) {
  webpush.setVapidDetails(email, publicKey, privateKey);
}

function getSubscriptions() {
  return db.prepare('SELECT id, endpoint, p256dh, auth FROM subscriptions').all();
}

/**
 * 向所有订阅设备发送系统通知。
 * @returns {boolean} 是否成功发起（未配置 VAPID 则返回 false）
 */
async function sendPush(title, body) {
  if (!publicKey || !privateKey) {
    console.warn('[push] 未配置 VAPID，跳过推送');
    return false;
  }
  const subs = getSubscriptions();
  const payload = JSON.stringify({ title, body, url: '/' });
  for (const s of subs) {
    const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
    try {
      await webpush.sendNotification(sub, payload);
    } catch (e) {
      // 订阅失效：删除，避免下次继续报错
      if (e.statusCode === 404 || e.statusCode === 410) {
        db.prepare('DELETE FROM subscriptions WHERE id=?').run(s.id);
      } else {
        console.error('[push] 发送失败', e.message);
      }
    }
  }
  return true;
}

module.exports = { sendPush, getSubscriptions };
