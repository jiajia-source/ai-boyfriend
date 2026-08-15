/**
 * push.js —— 前端 WebPush 订阅（全局 Push 对象）
 *  1. 等 Service Worker 就绪
 *  2. 请求通知权限
 *  3. 用后端下发的 VAPID 公钥订阅
 *  4. 把订阅信息 POST 给后端保存（后端据此推送）
 *
 * 注意：iOS 必须把网页"添加到主屏幕"成为 PWA 才能收离线推送。
 */
const Push = {
  async init() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('当前环境不支持 WebPush');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        console.log('用户未授予通知权限，主动推送将不可用');
        return;
      }
      const cfg = await API.getConfig();
      if (!cfg.vapidPublicKey) {
        console.warn('后端未配置 VAPID，无法订阅');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8(cfg.vapidPublicKey),
      });
      await API.pushSubscribe(sub);
      console.log('✅ 推送订阅成功');
    } catch (e) {
      console.warn('推送订阅失败', e.message);
    }
  },

  // base64url -> Uint8Array（VAPID 公钥需要）
  urlBase64ToUint8(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  },
};
