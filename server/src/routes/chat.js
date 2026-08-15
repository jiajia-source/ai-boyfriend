/**
 * routes/chat.js —— 聊天接口
 *  POST /api/chat  : 接收用户消息，SSE 流式返回 AI 回复；结束后台记忆提炼
 *  GET  /api/chat  : 返回最近对话历史（前端打开页面时回填）
 */
const express = require('express');
const router = express.Router();
const Memory = require('../memory');
const Agent = require('../agent');

// 历史（前端首屏回填）
router.get('/', (req, res) => {
  const list = Memory.getRecentMessages(40).map(m => ({
    role: m.role,
    content: m.content,
  }));
  res.json({ messages: list });
});

// 流式聊天（SSE）
router.post('/', async (req, res) => {
  const message = (req.body && req.body.message) || '';
  if (!message.trim()) return res.status(400).json({ error: '消息为空' });

  // SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 关闭 nginx 缓冲，保证流式
  if (res.flushHeaders) res.flushHeaders();

  // 先落库用户消息 + 记录最后聊天时间 + 更新陈屿脾气状态
  Memory.saveMessage('user', message);
  Memory.setSetting('lastChatTs', String(Date.now()));
  Memory.updateChenyuMood(message);

  let full = '';
  try {
    await Agent.generateReply(message, {
      onToken: (t) => {
        full += t;
        res.write(`data: ${JSON.stringify({ token: t })}\n\n`);
      },
    });
  } catch (e) {
    console.error('[chat] 生成失败', e.message);
    full = Agent.getFallbackReply(); // 断网/故障时按脾气状态走本地兜底
    res.write(`data: ${JSON.stringify({ token: full })}\n\n`);
  }

  // 落库 AI 回复
  Memory.saveMessage('assistant', full);
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();

  // 后台异步提炼记忆（不阻塞响应）
  Agent.summarizeConversation(message, full).catch((err) =>
    console.error('[chat] 记忆提炼失败', err.message)
  );
});

module.exports = router;
