/**
 * scheduler.js —— 后端定时任务（手写 setInterval，不引 node-cron）
 *
 * 每 5 分钟检查一次：当用户有一阵子没说话、且开启了主动消息时，
 * 由 Agent 依据记忆生成一条关心，存入对话历史并通过 WebPush 推送到手机。
 *
 * 节流逻辑（你的约束：控 token / 不骚扰）：
 *  - 距上次聊天 < 3 小时：不主动（她可能正忙）
 *  - 距上次主动推送 < 4 小时：不重复推
 *  - 开关关闭：完全不发
 */
const Memory = require('./memory');
const Agent = require('./agent');
const Push = require('./push');

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 分钟
const SILENT_AFTER_CHAT = 3 * 60 * 60 * 1000; // 聊天后 3h 内不主动
const MIN_PUSH_GAP = 4 * 60 * 60 * 1000;      // 两次主动推送至少隔 4h

function startScheduler() {
  setInterval(async () => {
    try {
      const enabled = Memory.getSetting('proactiveEnabled', 'true') === 'true';
      if (!enabled) return;

      const lastChat = parseInt(Memory.getSetting('lastChatTs', '0'), 10);
      const lastPush = parseInt(Memory.getSetting('lastProactiveTs', '0'), 10);
      const now = Date.now();

      if (now - lastChat < SILENT_AFTER_CHAT) return; // 她最近聊过，不抢话
      if (now - lastPush < MIN_PUSH_GAP) return;       // 推送太频繁，歇会儿

      const mood = Memory.getChenyuMood();
      if (mood === 'petty') {
        // 他正闹脾气，不会主动推送（符合"闹别扭时不硬发"）
        console.log('[scheduler] 陈屿正闹脾气，跳过本轮主动推送');
        return;
      }
      // coaxing：她刚生气委屈，发一条低头哄的关心；normal：正常自然关心
      const msg = await Agent.generateProactive(mood);
      if (!msg) return;

      Memory.saveMessage('assistant', msg); // 记入对话历史，打开 APP 能看到
      Memory.setSetting('lastProactiveTs', String(now));
      await Push.sendPush('陈屿', msg);
      console.log('[scheduler] 已发送主动消息推送');
    } catch (e) {
      console.error('[scheduler] 错误', e.message);
    }
  }, CHECK_INTERVAL);

  console.log('[scheduler] 主动消息定时任务已启动');
}

module.exports = { startScheduler };
