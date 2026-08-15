/**
 * routes/setting.js —— 设置接口
 *  GET  /api/setting : 读取设置（当前含 proactiveEnabled 主动推送开关）
 *  POST /api/setting : 修改设置 { proactiveEnabled: boolean }
 */
const express = require('express');
const router = express.Router();
const Memory = require('../memory');

router.get('/', (req, res) => {
  res.json({
    proactiveEnabled: Memory.getSetting('proactiveEnabled', 'true') === 'true',
  });
});

router.post('/', (req, res) => {
  const { proactiveEnabled } = req.body || {};
  if (typeof proactiveEnabled === 'boolean') {
    Memory.setSetting('proactiveEnabled', String(proactiveEnabled));
  }
  res.json({ ok: true });
});

module.exports = router;
