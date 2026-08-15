/**
 * api.js —— 前端与后端通信的封装（全局 API 对象）
 * 所有对话/记忆/设置/推送都走这里，前端不直接碰大模型密钥。
 */
const API = {
  // 流式聊天：POST /api/chat，逐 token 回调 onToken，结束 resolve
  chatStream(message, onToken) {
    return fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }).then((resp) => {
      if (!resp.ok) throw new Error('网络错误 ' + resp.status);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      return new Promise((resolve, reject) => {
        const pump = () => {
          reader.read().then(({ done, value }) => {
            if (done) return resolve();
            buf += decoder.decode(value, { stream: true });
            let nl;
            while ((nl = buf.indexOf('\n')) >= 0) {
              const line = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (!line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              try {
                const j = JSON.parse(data);
                if (j.token) onToken(j.token);
              } catch (_) {}
            }
            pump();
          }).catch(reject);
        };
        pump();
      });
    });
  },

  // 历史（首屏回填）
  getHistory() {
    return fetch('/api/chat').then((r) => r.json());
  },

  // 记忆
  getMemory() { return fetch('/api/memory').then((r) => r.json()); },
  addProfile(category, content) {
    return fetch('/api/memory/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, content }),
    });
  },
  updateProfile(id, content) {
    return fetch('/api/memory/profile/' + id, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  },
  deleteProfile(id) { return fetch('/api/memory/profile/' + id, { method: 'DELETE' }); },
  deleteLongterm(id) { return fetch('/api/memory/longterm/' + id, { method: 'DELETE' }); },
  clearAll() { return fetch('/api/memory/all', { method: 'DELETE' }); },

  // 设置
  getSetting() { return fetch('/api/setting').then((r) => r.json()); },
  setSetting(proactiveEnabled) {
    return fetch('/api/setting', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proactiveEnabled }),
    });
  },

  // 推送订阅
  pushSubscribe(subscription) {
    return fetch('/api/push-subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    });
  },

  // 公开配置（拿 VAPID 公钥）
  getConfig() { return fetch('/api/config').then((r) => r.json()); },
};
