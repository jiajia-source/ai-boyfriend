/**
 * voice.js —— 语音朗读（全局 Voice 对象）
 * 优先用后端 /api/tts（Azure，密钥在后端）；未配置时自动降级为浏览器原生语音。
 * 保留原有 Azure TTS 能力，同时密钥不暴露在前端。
 */
const Voice = {
  enabled: false,

  toggle() {
    this.enabled = !this.enabled;
    const btn = document.getElementById('voiceToggle');
    btn.textContent = this.enabled ? '🔊' : '🔇';
    btn.classList.toggle('active', this.enabled);
    return this.enabled;
  },

  // 朗读文本
  async speak(text) {
    if (!this.enabled) return;
    text = (text || '').slice(0, 200);
    if (!text) return;
    // 先试后端 Azure TTS
    try {
      const r = await fetch('/api/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (r.ok) {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
        return;
      }
    } catch (_) { /* 忽略，走兜底 */ }
    // 浏览器原生语音兜底
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith('zh'));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    }
  },
};
