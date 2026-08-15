/**
 * agent.js —— 轻量 Agent 核心（手写，不依赖框架）
 *
 * 每轮对话流程：
 *  1. buildSystemPrompt()：把【基础档案】+【长期记忆】+【最近对话】拼在 prompt 最开头
 *  2. generateReply()：调用大模型流式生成回复（记忆前置，保证"记得住、不重复问"）
 *  3. summarizeConversation()：对话结束后，让模型把本轮要点提炼成 JSON，写入两套记忆
 *
 * 主动消息：generateProactive() 依据记忆生成一条自然关心，由 scheduler 定时触发并推送。
 */
const Memory = require('./memory');
const { chatStream, chatJSON } = require('./llm');
const { PERSONA } = require('./persona');

// 把两套记忆 + 最近对话拼成系统提示前缀
function buildMemoryContext() {
  const profile = Memory.getProfileMemory()
    .map(m => `${m.category}：${m.content}`).join('；');
  const facts = Memory.getLongTermMemory(40)
    .map(m => `· ${m.content}`).join('\n');
  const conv = Memory.getRecentMessages(12)
    .map(m => `${m.role === 'user' ? '用户' : '陈屿'}：${m.content}`).join('\n');
  return { profile, facts, conv };
}

function buildSystemPrompt() {
  const { profile, facts, conv } = buildMemoryContext();
  const mood = Memory.getChenyuMood();
  const moodText = {
    normal: '平和（平时，温和自然、有主见但不霸道、不卑微）',
    petty: '正闹点小脾气（不完全顺着她、语气稍冷稍短、带点小情绪，但心里在意她、绝不过分绝不强硬、不伤人）',
    coaxing: '正在低头哄她（她刚生气/委屈，你立刻软下来、顺着她、先把她的情绪接住；绝不和她对呛、绝不这时候讲道理、绝不冷处理，主动服软认错哄人）',
  }[mood] || '平和';
  return [
    PERSONA,
    '',
    '【记忆档案 · 基础信息（她固定的个人情况，你始终记得）】',
    profile || '（暂无）',
    '',
    '【记忆档案 · 长期记忆（你们聊过的要点）】',
    facts || '（暂无）',
    '',
    '【最近对话】',
    conv || '（暂无）',
    '',
    '【陈屿此刻的脾气状态】',
    moodText,
    '',
    '规矩：读取记忆后严格维持人设；用户最新话题优先；不油腻；简短自然像真人。',
    '脾气规矩：她明显生气/委屈时，你立刻放下所有小脾气转为低头哄，绝不和她对呛、绝不讲道理、绝不冷处理；哪怕你刚还在闹别扭，此刻也必须低头。她冷淡敷衍时，你偶尔闹点小脾气但不伤人。',
  ].join('\n');
}

/**
 * 生成回复（流式）。onToken 回调每个 token。
 */
async function generateReply(userText, { onToken } = {}) {
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: userText },
  ];
  let full = '';
  await chatStream(messages, (t) => { full += t; onToken && onToken(t); });
  return full;
}

/**
 * 对话后自动提炼记忆：让模型输出 JSON，提取本轮关键信息写入两套记忆。
 * 失败静默，绝不阻塞聊天。
 */
async function summarizeConversation(userText, assistantText) {
  const sys = `你是记忆整理助手。根据一轮对话，提取有价值的新信息。
只输出 JSON：{"profile":[{"category":"作息|备考|护肤体质|项目进度|性格偏好|在意的事","content":"一句话要点"}],"facts":["对话要点（不写废话、不写大段原文）"]}。
规则：无关闲聊、情绪性感叹不要写；已存在的事实不要重复；category 只能取给定枚举。`;
  const user = `用户：${userText}\n陈屿：${assistantText}`;
  const r = await chatJSON([
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ]);
  (r.profile || []).forEach(p => {
    if (p && p.category && p.content) Memory.addProfileMemory(p.category, p.content);
  });
  (r.facts || []).forEach(f => { if (f) Memory.addLongTermMemory(f); });
}

// ---------------- 断网 / 模型故障时的本地兜底（按脾气状态给不同话术） ----------------
const FALLBACK = {
  coaxing: [
    '好好好我的错，你别气了。看你气的我心都揪起来了，想怎么罚我都行。',
    '是我不好，我不该那样。你打我骂我都行，就是别憋着气伤自己。',
    '真把你气着了？我错了还不行吗，你跟我说说哪不痛快，我听着，全听你的。',
    '我知道你这会儿正火大，我不跟你犟了，你先出出气，气消了再收拾我，啊？',
  ],
  petty: [
    '（他轻哼一声，别过脸）你今天怎么老跟我拧着来。行吧，你说什么就是什么。',
    '哼，你倒是会气人。我先不理你了，自己去忙我的了。',
    '你这人……算了，我跟你说不通。随你吧。',
  ],
  normal: [
    '（陈屿暂时走神了，稍后再来找我～）',
    '刚才信号抖了一下，你刚说啥？我再听一遍。',
  ],
};
function getFallbackReply() {
  const m = Memory.getChenyuMood();
  const arr = FALLBACK[m] || FALLBACK.normal;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 主动关心消息：依据记忆生成一条自然短消息（由 scheduler 定时调用）。
 * @param {string} mood 当前陈屿脾气状态，coaxing 时生成"低头哄"风格，normal 时生成自然关心。
 */
async function generateProactive(mood = 'normal') {
  const { profile, facts } = buildMemoryContext();
  let sys, user;
  if (mood === 'coaxing') {
    // 她还在气头上 → 发一条低头哄的关心，而不是硬关心
    sys = [
      PERSONA,
      '',
      '她刚刚还在生气/委屈，你正低头哄她。写一条软乎乎的、主动服软的关心短消息（一两句），像哄人时发的。',
      '要求：认错服软、顺着她、接住她的情绪；不要解释、不要讲道理、不要引号；只输出消息正文。',
    ].join('\n');
    user = `她的档案：${profile}\n最近记忆：\n${facts}`;
  } else {
    sys = [
      PERSONA,
      '',
      '根据你对她的记忆，写一条自然、不刻意的主动关心短消息（一两句），像真人忙里偷闲发的。',
      '要求：接住她最近提过的事；不要每次都问"刷题"等旧话题；只输出消息正文，不要解释、不要引号。',
    ].join('\n');
    user = `她的档案：${profile}\n最近记忆：\n${facts}`;
  }
  let msg = '';
  try {
    await chatStream([{ role: 'system', content: sys }, { role: 'user', content: user }], (t) => { msg += t; });
  } catch (e) {
    msg = mood === 'coaxing'
      ? '还气着呢？我错了嘛，你理理我好不好。'
      : '刚才想起你，惦记你今天累不累。有空找我聊两句呀。';
  }
  return msg.trim();
}

module.exports = { buildSystemPrompt, generateReply, summarizeConversation, generateProactive, getFallbackReply };
