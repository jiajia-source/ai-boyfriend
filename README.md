# 陈屿 · 全栈 AI 男友（高级人机恋 · 个人学习作品集）

> ⚠️ **仅限个人学习使用，禁止任何商用。**

一个手写轻量化 Agent 的 AI 男友陪伴应用：后端跑 Agent（记忆 + 大模型 + 主动关心），
前端 PWA 实现离线推送。前后端分离，记忆永久保存在后端 SQLite，**清除浏览器缓存 / 换手机也不会丢**。

---

## 一、技术栈

| 层 | 技术 |
|----|------|
| 前端 | HTML + TailwindCSS(CDN) + 原生 JS + PWA(manifest + service-worker) |
| 后端 | Node.js + Express + SQLite(better-sqlite3) + web-push |
| 大模型 | DeepSeek（`deepseek-chat`，OpenAI 兼容，密钥仅存后端 `.env`） |
| 推送 | WebPush（VAPID，私钥仅存后端环境变量） |
| 语音 | Azure TTS（密钥后端代理 `/api/tts`）/ 浏览器原生语音兜底 |

**不引入 LangChain 等重型框架**，Agent 逻辑全部手写。

### 核心特性
- **手写轻量 Agent**：请求前把两套记忆拼在 Prompt 最开头；每轮对话后让模型输出 JSON 自动提炼要点写回记忆。
- **陈屿「真实脾气」状态机**（后端持久化在 SQLite `settings` 表）：
  - `normal` 平时：温和自然、有主见但不霸道、不卑微；
  - `petty` 闹点小脾气：你对他冷淡/敷衍时偶尔别扭、不百分百顺从，但心里在意、绝不过分（25 分钟自动恢复平和）；
  - `coaxing` 低头哄：你一生气/委屈，他立刻放下所有脾气软下来哄你，哪怕刚还在闹别扭。
  - 脾气状态注入每轮系统提示，断网时也有本地兜底话术；定时主动推送在 `petty` 时跳过、`coaxing` 时改发"低头哄"式关心。
- **PWA 离线推送**：iOS 需"添加到主屏幕"成为 PWA 才能收锁屏推送。

---

## 二、目录结构

```
aiboyfriend/
├── README.md                 # 本文档
├── server/                   # 后端（Node.js + Express）
│   ├── package.json
│   ├── .env.example          # 环境变量模板（复制为 .env 后填真实值）
│   ├── .gitignore            # 屏蔽 .env 与 data/
│   ├── server.js             # Express 入口：托管前端 + 挂载 API + 启动定时任务
│   └── src/
│       ├── db.js             # SQLite 初始化（单文件，落在 server/data/）
│       ├── memory.js         # 两层记忆 CRUD + 长度上限自动丢旧 + 上下文 + 设置
│       ├── persona.js        # 固定男生人设（陈屿）
│       ├── llm.js            # 大模型客户端：chatStream(流式) / chatJSON(记忆提炼)
│       ├── agent.js          # Agent 核心：拼 prompt + 生成回复 + 对话后提炼记忆 + 主动消息
│       ├── push.js           # WebPush 发送（VAPID 从环境变量读取）
│       ├── scheduler.js      # 定时任务：主动关心 + 推送（手写 setInterval）
│       └── routes/
│           ├── chat.js       # POST /api/chat(SSE 流式) · GET /api/chat(历史)
│           ├── memory.js     # 记忆档案 增删改查
│           ├── push.js       # POST /api/push-subscribe 保存订阅
│           ├── setting.js    # GET/POST /api/setting 主动推送开关
│           └── tts.js        # POST /api/tts Azure 语音代理（可选）
└── frontend/                 # 前端（PWA）
    ├── index.html            # 聊天 UI（Tailwind）
    ├── manifest.json
    ├── service-worker.js     # 离线壳 + 接收推送 + 点击打开聊天
    ├── icon.svg
    ├── css/style.css
    └── js/
        ├── api.js            # 与后端通信封装
        ├── push.js           # 前端订阅 WebPush
        ├── voice.js          # 语音朗读
        ├── memory-panel.js   # 记忆档案面板
        ├── settings.js       # 设置面板
        └── chat.js           # 聊天主控制器（流式消费）
```

---

## 三、本地运行

```bash
cd server
cp .env.example .env        # 填入 DEEPSEEK_API_KEY、VAPID_* 等
npm install
npm start                   # 默认 http://localhost:3000
```

打开 http://localhost:3000 即可聊天。

---

## 四、VAPID 密钥生成

```bash
npx web-push generate-vapid-keys
```

把输出的 **公钥** 填 `VAPID_PUBLIC_KEY`、`**私钥**` 填 `VAPID_PRIVATE_KEY`、`VAPID_EMAIL` 填你的邮箱。
**私钥只在 `.env`，绝不上传仓库**（`.gitignore` 已屏蔽）。

---

## 五、Render 部署（后端 + 前端一次部署）

1. 注册 https://render.com ，New → Web Service → 连接你的 GitHub 仓库。
2. 配置：
   - **Root Directory**：`server`（让 Render 以该目录为项目根）
   - **Build Command**：`npm install`
   - **Start Command**：`node server.js`
   - **Environment**：选 `Node`
3. 在 Render 的 **Environment Variables** 里添加：
   - `DEEPSEEK_API_KEY`
   - `DEEPSEEK_MODEL` = `deepseek-chat`
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL`
   - `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION`（可选，不填则用浏览器原生语音）
   - `PORT` 由 Render 自动注入，无需手动设
4. 部署完成后，Render 会给一个 `https://xxx.onrender.com` 地址，打开即是网页版。
5. **手机收推送**：
   - **安卓**：用 Chrome 打开地址 → 允许通知 → 即可在锁屏收到系统推送。
   - **iOS（关键）**：必须用 Safari 打开 → 点「分享」→ **添加到主屏幕** → 从桌面图标进入 → 允许通知。只有作为 PWA 安装后，iOS 才能收离线推送。

> Render 免费版会休眠，定时推送在休眠期间不会触发，访问一次即唤醒。如需常驻可升级付费实例。

---

## 六、API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | 聊天，SSE 流式返回 `data: {"token":"..."}` |
| GET  | `/api/chat` | 返回最近对话历史 |
| GET  | `/api/memory` | 获取全部记忆（profile + longterm） |
| POST | `/api/memory/profile` | 新增基础档案 `{category, content}` |
| PUT  | `/api/memory/profile/:id` | 修改档案 `{content}` |
| DELETE | `/api/memory/profile/:id` | 删除档案 |
| DELETE | `/api/memory/longterm/:id` | 删除长期记忆 |
| DELETE | `/api/memory/all` | 清空两套记忆 |
| POST | `/api/push-subscribe` | 保存前端推送订阅 |
| GET  | `/api/setting` | 读取设置（主动推送开关） |
| POST | `/api/setting` | 修改设置 `{proactiveEnabled}` |
| POST | `/api/tts` | Azure 语音代理（可选） |
| GET  | `/api/config` | 下发 VAPID 公钥给前端 |

---

## 七、约束核对

- ✅ 不引入 LangChain，Agent 全手写
- ✅ 密钥 / API Key 全部在后端 `.env`，`.gitignore` 屏蔽，严禁提交
- ✅ 数据库 SQLite 单文件（server/data/aiboyfriend.db），方便部署
- ✅ 记忆做长度上限（档案 60 / 长期 120 / 对话 200），超出自动丢旧，防 token 超限
- ✅ 记忆永久在后端，换手机/清缓存不丢
- ✅ PWA：manifest + service-worker，点击通知打开聊天页
- ✅ 仅个人学习，禁止商用
