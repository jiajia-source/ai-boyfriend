/**
 * routes/memory.js —— 记忆档案接口
 *  GET    /api/memory               获取全部（profile + longterm）
 *  POST   /api/memory/profile       新增基础档案 {category, content}
 *  PUT    /api/memory/profile/:id   修改某条档案 {content}
 *  DELETE /api/memory/profile/:id    删除某条档案
 *  DELETE /api/memory/longterm/:id   删除某条长期记忆
 *  DELETE /api/memory/all            清空两套记忆
 */
const express = require('express');
const router = express.Router();
const Memory = require('../memory');

router.get('/', (req, res) => {
  res.json({
    profile: Memory.getProfileMemory(),
    longterm: Memory.getLongTermMemory(200),
  });
});

router.post('/profile', (req, res) => {
  const { category, content } = req.body || {};
  if (!category || !content) return res.status(400).json({ error: '缺少 category 或 content' });
  Memory.addProfileMemory(category, content);
  res.json({ ok: true });
});

router.put('/profile/:id', (req, res) => {
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: '缺少 content' });
  Memory.updateProfileMemory(Number(req.params.id), content);
  res.json({ ok: true });
});

router.delete('/profile/:id', (req, res) => {
  Memory.deleteProfileMemory(Number(req.params.id));
  res.json({ ok: true });
});

router.delete('/longterm/:id', (req, res) => {
  Memory.deleteLongTermMemory(Number(req.params.id));
  res.json({ ok: true });
});

router.delete('/all', (req, res) => {
  Memory.clearAllMemory();
  res.json({ ok: true });
});

module.exports = router;
