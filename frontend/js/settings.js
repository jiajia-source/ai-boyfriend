/**
 * settings.js —— 设置面板（全局 Settings 对象）
 * 当前含：主动推送通知开关（写回后端 /api/setting）。
 */
const Settings = {
  open() {
    document.getElementById('settingsModal').classList.remove('hidden');
    API.getSetting().then((s) => {
      document.getElementById('pushToggle').checked = !!s.proactiveEnabled;
    });
  },
  close() {
    document.getElementById('settingsModal').classList.add('hidden');
  },
  save() {
    const v = document.getElementById('pushToggle').checked;
    API.setSetting(v).then(() => this.close());
  },
};
