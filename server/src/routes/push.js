/**
 * routes/push.js —— 推送订阅接口
 *  POST /api/push-subscribe : 前端 PWA 订阅后，把 subscription 存入数据库（upsert）
 */
const express = require('express');
const router = express.Router();
const { db } = require('../db');

router.post('/', (req, res) => {
  const sub = req.body && req.body.subscription;
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    return res.status(400).json({ error: '订阅信息不完整' });
  }
  const exists = db.prepare('SELECT id FROM subscriptions WHERE endpoint=?').get(sub.endpoint);
  if (exists) {
    db.prepare('UPDATE subscriptions SET p256dh=?, auth=?, ts=? WHERE endpoint=?')
      .run(sub.keys.p256dh, sub.keys.auth, Date.now(), sub.endpoint);
  } else {
    db.prepare('INSERT INTO subscriptions (endpoint, p256dh, auth, ts) VALUES (?, ?, ?, ?)')
      .run(sub.endpoint, sub.keys.p256dh, sub.keys.auth, Date.now());
  }
  res.json({ ok: true });
});

module.exports = router;
