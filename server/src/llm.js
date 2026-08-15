/**
 * llm.js —— 大模型客户端（DeepSeek，OpenAI 兼容）
 * 手写轻量调用，不引入 LangChain 等重型库。
 * 提供两个能力：
 *   chatStream(messages, onToken)  —— 流式输出，逐 token 回调（用于聊天）
 *   chatJSON(messages)             —— 一次性返回 JSON（用于对话后记忆提炼）
 */
const API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
  };
}

/**
 * 流式对话：把大模型返回的 token 通过 onToken 逐步回调给调用方。
 */
async function chatStream(messages, onToken) {
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ model: MODEL, messages, stream: true, temperature: 0.8 }),
  });
  if (!resp.ok) throw new Error(`LLM HTTP ${resp.status}`);
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const j = JSON.parse(data);
        const t = j.choices?.[0]?.delta?.content;
        if (t) onToken(t);
      } catch (_) { /* 忽略不完整片段 */ }
    }
  }
}

/**
 * JSON 对话：要求模型只返回 JSON 对象（用于记忆提炼）。
 */
async function chatJSON(messages) {
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      model: MODEL, messages, stream: false, temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });
  if (!resp.ok) throw new Error(`LLM HTTP ${resp.status}`);
  const j = await resp.json();
  const content = j.choices?.[0]?.message?.content || '{}';
  try { return JSON.parse(content); } catch (_) { return {}; }
}

module.exports = { chatStream, chatJSON };
