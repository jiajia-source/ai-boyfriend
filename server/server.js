/**
 * server.js —— Express 入口
 * 职责：
 *  1. 托管 frontend/ 静态文件（PWA 前端）
 *  2. 挂载 /api/* 路由（聊天、记忆、推送订阅、设置、公开配置）
 *  3. 启动后端定时任务（主动关心 + WebPush）
 *
 * 个人学习作品集，禁止商用。
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDb } = require('./src/db');
const chatRoutes = require('./src/routes/chat');
const memoryRoutes = require('./src/routes/memory');
const pushRoutes = require('./src/routes/push');
const settingRoutes = require('./src/routes/setting');
const ttsRoutes = require('./src/routes/tts');
const { startScheduler } = require('./src/scheduler');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 初始化数据库（建表）
initDb();

// ---------- API 路由 ----------
app.use('/api/chat', chatRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/push-subscribe', pushRoutes);
app.use('/api/setting', settingRoutes);
app.use('/api/tts', ttsRoutes);

// 公开配置：把 VAPID 公钥下发给前端（私钥永远不暴露）
app.get('/api/config', (req, res) => {
  res.json({ vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

// ---------- 托管前端（PWA） ----------
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));
app.get('/', (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));
// SPA 兜底：未知路径回退到首页（PWA 刷新不 404）
app.get('*', (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  陈屿 AI 男友服务已启动：http://localhost:${PORT}`);
  console.log(`  DeepSeek 模型：${process.env.DEEPSEEK_MODEL || 'deepseek-chat'}`);
  console.log(`  VAPID 已配置：${!!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)}\n`);
  startScheduler(); // 启动后台主动消息 + 推送定时任务
});
