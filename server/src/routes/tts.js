/**
 * routes/tts.js —— Azure TTS 后端代理（可选）
 *
 * 为什么放后端：Azure 密钥绝不能出现在前端代码里。前端把要读的文案 POST 过来，
 * 后端用密钥请求 Azure，把音频流返回给前端播放。
 * 未配置 AZURE_SPEECH_KEY 时返回 501，前端自动降级为浏览器原生语音。
 */
const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION || 'eastasia';
  const text = (req.body && req.body.text) || '';
  if (!key) return res.status(501).json({ error: '未配置 Azure TTS' });
  if (!text.trim()) return res.status(400).json({ error: '文本为空' });

  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `<speak version='1.0' xml:lang='zh-CN'><voice xml:lang='zh-CN' xml:gender='Male' name='zh-CN-YunxiNeural'>${text.replace(/[<>&]/g, '')}</voice></speak>`;

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      },
      body: ssml,
    });
    if (!resp.ok) return res.status(resp.status).json({ error: 'TTS 失败' });
    const buf = Buffer.from(await resp.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
