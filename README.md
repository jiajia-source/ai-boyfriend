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

## 五、云端常驻部署（电脑关机也能用）

目标：把陈屿部署到 Render 云端，**24/7 在线**——你电脑关了、睡觉了，手机照样能打开聊天、收推送。

> 代价：记忆数据存在 Render 的持久盘（云端），不再是纯本地；免费档节点在海外，国内访问偶尔偏慢属正常。代码建议放 **GitHub 私有仓库**（只有你能看，符合"自己用"）。

### 步骤 0：把代码推到 GitHub 私有仓库
（需你本人在自己电脑上操作，涉及 GitHub 账号授权）

```bash
# 1) 登录 GitHub（浏览器授权一次）
gh auth login

# 2) 在项目目录创建私有仓库并一键推送
cd aiboyfriend
gh repo create aiboyfriend-chenyu --private --source=. --remote=origin --push
```

> 若不想用 gh，也可在 GitHub 网页手动 New 一个 **Private** 仓库，然后：
> `git remote add origin https://github.com/你的名/aiboyfriend-chenyu.git`
> `git branch -M main` → `git push -u origin main`

推送时注意：**`.env` 已被 `.gitignore` 屏蔽，不会进仓库**（密钥安全）。进仓库的只有 `.env.example` 模板。

### 步骤 1：Render 连仓库（Blueprint 一键建服务）
1. 打开 https://dashboard.render.com → **New** → **Blueprint**。
2. 连接你的 GitHub 账号，选中 `aiboyfriend-chenyu` 私有仓库。
3. Render 会自动读取仓库里的 `render.yaml`：建好 Web 服务、挂 1GB 持久盘（`/var/data`，记忆不丢）、列出环境变量。
4. 点 **Apply** / **Create** 开始部署（首次构建约 1–2 分钟）。

### 步骤 2：填写 4 个密钥环境变量
`render.yaml` 里标了 `sync:false` 的 4 项**不会自动填**，需在 Render 控制台手动填（值都在你本机 `aiboyfriend/server/.env` 里）：
- `DEEPSEEK_API_KEY` = `sk-...`
- `VAPID_PUBLIC_KEY` = `...`
- `VAPID_PRIVATE_KEY` = `...`
- `AZURE_SPEECH_KEY`（可选，留空则用浏览器原生语音）

另外建议把 `VAPID_EMAIL` 从占位 `mailto:you@example.com` 改成你的真实邮箱（WebPush 规范建议）。
填完 **Save Changes** 触发重新部署。

### 步骤 3：拿到地址
部署完成后，Render 给一个 `https://aiboyfriend-chenyu.onrender.com`（具体名看你填的服务名）。这就是云端地址，**电脑关机也不影响**。

### 步骤 4：保活（关键！否则免费档会休眠）
Render 免费 Web Service **15 分钟无请求就休眠**，手机打开会卡十几秒冷启动，定时推送也会停。用免费监控 ping 它即可常驻：

1. 注册 https://uptimerobot.com （免费版够用）。
2. 新增 **Monitor** → 类型 HTTP(s) → URL 填 `https://你的地址.onrender.com/api/config` → 间隔 **5 分钟**。
3. 保存。此后云端服务一直被 ping 着，不会睡。

> 保活由 UptimeRobot 云端完成，**不依赖你电脑**——这正是"电脑关机也能用"的关键。

### 步骤 5：手机使用
- **安卓**：Chrome 打开云端地址 → 允许通知 → 锁屏收推送。
- **iOS**：Safari 打开 → 分享 → **添加到主屏幕** → 从桌面图标进 → 允许通知（必须装成 PWA 才能锁屏收推送）。

### 数据说明
记忆存在 Render 持久盘 `/var/data/*.db`，部署、重启都不丢。要备份/迁移，可在 Render Shell 里导出，或定期下载 disk 快照。

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

---

## 八、纯本地自用（不部署到公网 / 不推 GitHub）

适合「自己用、不对外开放」的场景：服务跑在你自己的电脑上，手机连过来。

### 前置
- 电脑装好 **Node.js 18+**（含 npm）。
- 本项目 `.env` 已配好 DeepSeek Key 与 VAPID 密钥，无需再改。

### 步骤
1. 解压本项目到任意目录。
2. 双击 **`start.bat`** → 首次会自动 `npm install` 然后启动服务。
3. 看到 `listening on 3000` 后，电脑浏览器打开 `http://localhost:3000` 即可聊天。
4. **手机访问二选一**：
   - **A. 同一 WiFi（最简单，但 iOS 锁屏推送受限）**：手机浏览器开 `http://你电脑局域网IP:3000`（电脑上 `ipconfig` 查 IPv4，如 `192.168.1.20`）。
   - **B. Cloudflare Tunnel（推荐，手机任意网络 + 真·锁屏推送）**：另开窗口双击 **`tunnel.bat` → 终端给一个 `https://xxxx.trycloudflare.com` 公网 HTTPS 地址，手机打开它即可；建议「添加到主屏幕」变 App**。
     > 首次用 Tunnel 前需装 `cloudflared` 并加入 PATH：
     > https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
5. 首次打开页面会请求通知权限，允许后陈屿可主动推送（方案 B 的 HTTPS 下 iOS/安卓均能锁屏收推送）。

### 说明
- 记忆存在你电脑的 SQLite（`server/data/*.db`），只要你不动这个文件就一直保留。
- 想彻底停服务：关闭 `start.bat` 窗口、关掉 `tunnel.bat` 窗口即可。
- `render.yaml` / 本地 git 仓库留着无害，以后想上 Render 公网部署也方便。


