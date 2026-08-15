/**
 * chat.js —— 聊天主控制器（全局 Chat 对象）
 *  - init()：首屏从后端拉历史并回填；绑定输入框事件
 *  - send()：把用户消息上屏，调用后端流式接口，逐 token 渲染陈屿的回复
 *  - toggleVoice() / toggleMic()：朗读开关 / 语音输入
 */
const Chat = {
  recording: false,
  rec: null,

  async init() {
    const box = document.getElementById('messages');
    try {
      const data = await API.getHistory();
      (data.messages || []).forEach((m) => this.appendMessage(m.role, m.content));
    } catch (_) { /* 历史拉取失败不阻塞 */ }
    this.scrollBottom();

    const input = document.getElementById('input');
    // 回车发送，Shift+Enter 换行
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
    });
    // 自动增高
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 128) + 'px';
    });
  },

  appendMessage(role, content, streaming = false) {
    const box = document.getElementById('messages');
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + (role === 'user' ? 'user' : 'ai');
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = content;
    wrap.appendChild(bubble);
    box.appendChild(wrap);
    this.scrollBottom();
    return bubble;
  },

  showTyping() {
    const box = document.getElementById('messages');
    const wrap = document.createElement('div');
    wrap.className = 'msg ai';
    wrap.id = 'typingRow';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
    wrap.appendChild(bubble);
    box.appendChild(wrap);
    this.scrollBottom();
  },
  hideTyping() {
    const t = document.getElementById('typingRow');
    if (t) t.remove();
  },

  scrollBottom() {
    const box = document.getElementById('messages');
    box.scrollTop = box.scrollHeight;
  },

  async send() {
    const input = document.getElementById('input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';

    this.appendMessage('user', text); // 用户消息上屏
    this.showTyping();                // 打字指示

    let bubble = null;
    try {
      await API.chatStream(text, (token) => {
        if (!bubble) { this.hideTyping(); bubble = this.appendMessage('ai', ''); }
        bubble.textContent += token;
        this.scrollBottom();
      });
    } catch (e) {
      this.hideTyping();
      this.appendMessage('ai', '（网络好像有点问题，稍后再试试～）');
    }
    if (!bubble) this.hideTyping();
    Voice.speak(bubble ? bubble.textContent : '');
  },

  toggleVoice() { Voice.toggle(); },

  toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('当前浏览器不支持语音输入，可换 Chrome/Edge'); return; }
    if (this.recording) { this.rec.stop(); return; }
    this.rec = new SR();
    this.rec.lang = 'zh-CN';
    this.rec.interimResults = true;
    const input = document.getElementById('input');
    this.rec.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      input.value = t;
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 128) + 'px';
    };
    this.rec.onend = () => {
      this.recording = false;
      document.getElementById('micBtn').classList.remove('active');
    };
    this.rec.start();
    this.recording = true;
    document.getElementById('micBtn').classList.add('active');
  },
};
