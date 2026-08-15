/**
 * service-worker.js —— PWA 离线壳 + 推送接收
 *  - install/activate：激活后立即接管页面
 *  - push：收到后端 web-push 通知，弹出系统通知
 *  - notificationclick：点击通知直接打开聊天页
 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: '陈屿', body: '你有新消息～', url: '/' };
  if (event.data) {
    try { data = Object.assign(data, event.data.json()); } catch (_) {}
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '陈屿', {
      body: data.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
