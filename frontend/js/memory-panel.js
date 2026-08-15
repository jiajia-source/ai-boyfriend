/**
 * memory-panel.js —— 记忆档案面板（全局 MemoryPanel 对象）
 * 从后端拉取两套记忆，支持查看 / 新增 / 编辑 / 删除 / 清空。
 * 用 DOM 事件绑定（而非内联 onclick + JSON 拼接），避免内容含引号时出错。
 */
const MemoryPanel = {
  categories: ['作息', '备考', '护肤体质', '项目进度', '性格偏好', '在意的事'],

  open() {
    document.getElementById('memoryModal').classList.remove('hidden');
    this.render();
  },
  close() {
    document.getElementById('memoryModal').classList.add('hidden');
  },

  async render() {
    const data = await API.getMemory();
    this.renderProfile(data.profile || []);
    this.renderLongterm(data.longterm || []);
  },

  // 工具：创建带文本的安全节点
  _el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  },

  renderProfile(list) {
    const box = document.getElementById('profileList');
    box.innerHTML = '';
    const grouped = {};
    list.forEach((m) => { (grouped[m.category] = grouped[m.category] || []).push(m); });

    this.categories.forEach((cat) => {
      const wrap = this._el('div', 'mb-2');
      wrap.appendChild(this._el('div', 'mem-cat font-medium', cat));
      const items = grouped[cat] || [];
      if (!items.length) {
        wrap.appendChild(this._el('div', 'text-xs text-gray-300', '（空）'));
      }
      items.forEach((m) => {
        const row = this._el('div', 'mem-item flex items-start justify-between gap-2 mt-1');
        row.appendChild(this._el('span', 'text-sm flex-1', m.content));
        const ops = this._el('span', 'shrink-0 text-xs');
        const edit = this._el('button', 'text-blue-500 mr-2', '改');
        edit.onclick = () => this.editProfile(m.id, m.content);
        const del = this._el('button', 'text-red-400', '删');
        del.onclick = () => this.delProfile(m.id);
        ops.appendChild(edit); ops.appendChild(del);
        row.appendChild(ops);
        wrap.appendChild(row);
      });
      box.appendChild(wrap);
    });
  },

  renderLongterm(list) {
    const box = document.getElementById('longtermList');
    box.innerHTML = '';
    if (!list.length) { box.appendChild(this._el('div', 'text-xs text-gray-300', '（空）')); return; }
    list.forEach((m) => {
      const row = this._el('div', 'mem-item flex items-start justify-between gap-2');
      row.appendChild(this._el('span', 'text-sm flex-1', m.content));
      const del = this._el('button', 'shrink-0 text-xs text-red-400', '删');
      del.onclick = () => this.delLongterm(m.id);
      row.appendChild(del);
      box.appendChild(row);
    });
  },

  showAddForm() {
    const cat = prompt('选择分类：\n' + this.categories.map((c, i) => `${i + 1}.${c}`).join('\n'), '1');
    if (!cat) return;
    const idx = parseInt(cat, 10) - 1;
    if (isNaN(idx) || !this.categories[idx]) return;
    const content = prompt('输入这条档案内容：');
    if (!content) return;
    API.addProfile(this.categories[idx], content).then(() => this.render());
  },

  editProfile(id, current) {
    const content = prompt('修改为：', current);
    if (!content) return;
    API.updateProfile(id, content).then(() => this.render());
  },

  delProfile(id) {
    if (!confirm('删除这条档案？')) return;
    API.deleteProfile(id).then(() => this.render());
  },
  delLongterm(id) {
    if (!confirm('删除这条记忆？')) return;
    API.deleteLongterm(id).then(() => this.render());
  },

  clearAll() {
    if (!confirm('确定清空全部记忆？此操作不可恢复。')) return;
    API.clearAll().then(() => this.render());
  },
};
