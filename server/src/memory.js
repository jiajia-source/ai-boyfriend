/**
 * memory.js —— 记忆层（全部落在后端 SQLite）
 *
 * 两套记忆：
 *  ① profile_memory  基础档案：作息 / 备考 / 护肤体质 / 项目进度 / 性格偏好 / 在意的事
 *  ② long_term_memory 对话长期记忆：每轮提炼的要点（不存大段原文）
 * 另含 conversations（近期对话上下文）与 settings（开关等）。
 *
 * 防 token 爆：两个记忆库都有数量上限，超出按时间丢弃最旧的；
 * 插入前做去重（同内容不重复写）。
 */
const { db } = require('./db');

const PROFILE_LIMIT = 60;   // 基础档案上限
const LONGTERM_LIMIT = 120; // 长期记忆上限
const CONV_LIMIT = 200;     // 对话上下文上限

// ---------------- ① 基础档案 ----------------
function getProfileMemory() {
  return db.prepare('SELECT id, category, content, ts FROM profile_memory ORDER BY ts DESC').all();
}
function addProfileMemory(category, content) {
  if (!category || !content) return;
  const exists = db.prepare('SELECT id FROM profile_memory WHERE category=? AND content=?').get(category, content);
  if (exists) return; // 去重
  db.prepare('INSERT INTO profile_memory (category, content, ts) VALUES (?, ?, ?)').run(category, content, Date.now());
  trimTable('profile_memory', PROFILE_LIMIT);
}
function updateProfileMemory(id, content) {
  db.prepare('UPDATE profile_memory SET content=?, ts=? WHERE id=?').run(content, Date.now(), id);
}
function deleteProfileMemory(id) {
  db.prepare('DELETE FROM profile_memory WHERE id=?').run(id);
}

// ---------------- ② 长期记忆 ----------------
function getLongTermMemory(limit = 40) {
  // 取最近 limit 条，按时间正序返回，便于拼进 prompt
  return db.prepare('SELECT id, content, ts FROM long_term_memory ORDER BY ts DESC LIMIT ?').all(limit).reverse();
}
function addLongTermMemory(content) {
  if (!content) return;
  const exists = db.prepare('SELECT id FROM long_term_memory WHERE content=?').get(content);
  if (exists) return;
  db.prepare('INSERT INTO long_term_memory (content, ts) VALUES (?, ?)').run(content, Date.now());
  trimTable('long_term_memory', LONGTERM_LIMIT);
}
function deleteLongTermMemory(id) {
  db.prepare('DELETE FROM long_term_memory WHERE id=?').run(id);
}

// ---------------- 对话上下文 ----------------
function saveMessage(role, content) {
  db.prepare('INSERT INTO conversations (role, content, ts) VALUES (?, ?, ?)').run(role, content, Date.now());
  trimTable('conversations', CONV_LIMIT);
}
function getRecentMessages(limit = 12) {
  return db.prepare('SELECT role, content FROM conversations ORDER BY ts DESC LIMIT ?').all(limit).reverse();
}

// ---------------- 一键清空 ----------------
function clearAllMemory() {
  db.prepare('DELETE FROM profile_memory').run();
  db.prepare('DELETE FROM long_term_memory').run();
}

// ---------------- 陈屿脾气状态机（让他有真实脾气，但她在气头上会低头哄） ----------------
// 状态：normal 平时 / petty 闹点小脾气、不百分百顺从 / coaxing 她生气委屈了，他低头哄
// 单用户模型下，脾气状态持久化在 settings 表（chenyuMood / chenyuMoodReason / chenyuMoodTs）
const MOOD_EXPIRE = 25 * 60 * 1000; // petty 超时（25 分钟）自动恢复平和，避免一直别扭
const ANGER_RE = /(生气|气死|气死我|讨厌你|恼火|烦死了|烦人|凭什么|滚|你走开|别理我|不想理你|懒得理你|你烦不烦|闭嘴|少管我|关你什么事|我受够|你管得着吗|你真烦|去你的|被你气|气死我了|委屈|想哭|难过|伤心|你气我)/;
const COLD_RE = /(随便你|关我什么事|你管得着吗|不想理你|懒得理你|你走开|别烦我|少管我|我不想跟你说话|别跟我说话|敷衍|没空理你|哼|懒得理)/;

function getChenyuMood() {
  const s = getSetting('chenyuMood', 'normal');
  const ts = parseInt(getSetting('chenyuMoodTs', '0'), 10) || 0;
  if (s === 'petty' && (Date.now() - ts) > MOOD_EXPIRE) return 'normal'; // 久了自动恢复
  return s;
}
function setChenyuMood(state, reason) {
  setSetting('chenyuMood', state);
  setSetting('chenyuMoodTs', String(Date.now()));
  if (reason) setSetting('chenyuMoodReason', reason);
}
function detectUserAnger(text) {
  return ANGER_RE.test(text || '');
}
function detectUserColdToHim(text) {
  return COLD_RE.test(text || '');
}
// 每次她说完话，更新陈屿此刻的脾气状态（本地判定，比纯靠 AI 听话稳）
function updateChenyuMood(text) {
  const angry = detectUserAnger(text);
  const cold = detectUserColdToHim(text);
  const cur = getChenyuMood();

  // ① 她生气/委屈 → 立刻低头哄，哪怕刚还在闹脾气
  if (angry) {
    if (cur !== 'coaxing') setChenyuMood('coaxing', '她生气/委屈了，低头哄');
    return;
  }
  // ② 她不气了（正常回复）→ 哄完这一轮恢复平和
  if (cur === 'coaxing') {
    setChenyuMood('normal', '哄完了，恢复平和');
    return;
  }
  // ③ 她对他冷淡/敷衍 → 偶尔闹点小脾气（概率控制，避免太玻璃心）
  if (cold && cur !== 'petty') {
    if (Math.random() < 0.6) setChenyuMood('petty', '她有点冷淡/敷衍');
    return;
  }
  // ④ 平时极低概率自发小情绪（让他像有生活的人）
  if (cur === 'normal' && !cold && Math.random() < 0.03) {
    setChenyuMood('petty', '今天有点自己的小情绪');
  }
}

// ---------------- 设置 ----------------
function getSetting(key, def = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return row ? row.value : def;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
}

// ---------------- 内部工具：超出上限丢旧 ----------------
function trimTable(table, limit) {
  const count = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
  if (count > limit) {
    const olds = db.prepare(`SELECT id FROM ${table} ORDER BY ts ASC LIMIT ?`).all(count - limit);
    const del = db.prepare(`DELETE FROM ${table} WHERE id=?`);
    const tx = db.transaction((ids) => ids.forEach(r => del.run(r.id)));
    tx(olds);
  }
}

module.exports = {
  getProfileMemory, addProfileMemory, updateProfileMemory, deleteProfileMemory,
  getLongTermMemory, addLongTermMemory, deleteLongTermMemory,
  saveMessage, getRecentMessages,
  clearAllMemory,
  getSetting, setSetting,
  getChenyuMood, setChenyuMood, detectUserAnger, detectUserColdToHim, updateChenyuMood,
};
