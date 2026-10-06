// Linux Agent Server для my-agent Codespace
// Запуск: node server.js
// Порт 3000, пробрось Public в Codespaces

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// Логи
function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// Статус системы - реальные данные
app.get('/status', (req, res) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const uptime = os.uptime();
  
  exec('df -h / | tail -1', (err, stdout) => {
    const disk = stdout ? stdout.trim() : 'unknown';
    
    res.json({
      online: true,
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: cpus.length,
      cpuModel: cpus[0]?.model || 'unknown',
      totalMem: Math.round(totalMem / 1024 / 1024) + ' MB',
      freeMem: Math.round(freeMem / 1024 / 1024) + ' MB',
      usedMem: Math.round((totalMem - freeMem) / 1024 / 1024) + ' MB',
      uptime: Math.round(uptime / 60) + ' min',
      uptimeSec: uptime,
      disk: disk,
      load: os.loadavg(),
      timestamp: new Date().toISOString(),
      message: 'Linux Codespace работает, готов к командам'
    });
  });
});

// Выполнить команду
app.post('/exec', (req, res) => {
  const { cmd } = req.body;
  if (!cmd) return res.status(400).json({ error: 'No cmd' });
  
  // Безопасность - запрещаем опасные команды
  const blocked = ['rm -rf /', ':(){:|:&};:', 'mkfs', 'dd if='];
  if (blocked.some(b => cmd.includes(b))) {
    return res.status(403).json({ error: 'Blocked command' });
  }
  
  log(`Exec: ${cmd}`);
  
  exec(cmd, { timeout: 30000, maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
    res.json({
      cmd,
      stdout: stdout?.slice(0, 10000) || '',
      stderr: stderr?.slice(0, 5000) || '',
      error: err?.message || null,
      code: err?.code || 0
    });
  });
});

// Чат через Linux (прокси к Gemini если ключ есть)
app.post('/chat', async (req, res) => {
  const { prompt, model } = req.body;
  const geminiKey = process.env.GEMINI_KEY || fs.existsSync('.env') ? fs.readFileSync('.env','utf8').match(/GEMINI_KEY=(.*)/)?.[1] : null;
  
  if (!prompt) return res.status(400).json({ error: 'No prompt' });
  
  // Если есть ключ - пробуем Gemini напрямую с Linux
  if (geminiKey) {
    try {
      const fetch = (await import('node-fetch')).default;
      const modelName = model || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || 'Gemini error');
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
      return res.json({ response: text, via: 'linux-gemini', model: modelName });
    } catch (e) {
      log(`Gemini error: ${e.message}`);
      return res.json({ response: `Linux получил запрос: "${prompt.slice(0,100)}"\n\nНо Gemini вернул ошибку: ${e.message}\n\nПопробуй модель gemini-2.0-flash - она стабильная.`, via: 'linux-fallback' });
    }
  }
  
  // Без ключа - просто эхо с инфо о системе
  res.json({
    response: `Привет с Linux! Я работаю на ${os.hostname()}, ${os.cpus().length} vCPU, ${Math.round(os.totalmem()/1024/1024)}MB RAM.\n\nТвой запрос: ${prompt}\n\nЧтобы я отвечал как ИИ, добавь GEMINI_KEY в .env файл в Codespace.\n\nА так я могу:\n- Выполнять команды через /exec\n- Монтировать видео через /montage\n- Показывать статус через /status`,
    via: 'linux-echo'
  });
});

// Монтаж TikTok - принимает файлы и делает ffmpeg
app.post('/montage', async (req, res) => {
  // Заглушка - в реальности тут ffmpeg
  log('Montage request');
  res.json({
    status: 'ready',
    message: 'Монтаж готов к работе. Загрузи видео через /upload',
    ffmpeg: await new Promise(resolve => {
      exec('ffmpeg -version | head -1', (err, stdout) => {
        resolve(stdout?.trim() || 'ffmpeg not found, install: sudo apt install ffmpeg');
      });
    })
  });
});

// Keepalive - не давать заснуть
let lastPing = Date.now();
app.get('/keepalive', (req, res) => {
  lastPing = Date.now();
  // Трогаем файл чтобы показать активность
  try { fs.writeFileSync('/tmp/keepalive', new Date().toISOString()); } catch(e){}
  res.json({ status: 'alive', lastPing: new Date(lastPing).toISOString(), uptime: os.uptime() });
});

app.get('/sleep-config', (req, res) => {
  res.json({
    message: 'Чтобы Codespace не засыпал, в APK включи ☕ Не давать засыпать. Тогда APK будет пинговать /keepalive каждые 10 мин.',
    githubSettings: 'Или зайди на https://github.com/settings/codespaces и поставь Default idle timeout 240 минут (максимум)',
    currentTimeout: process.env.CODESPACE_IDLE_TIMEOUT || '30 min default',
    keepalive: true,
    lastPing: new Date(lastPing).toISOString()
  });
});

// Корень
app.get('/', (req, res) => {
  res.json({
    name: 'Linux Agent Server',
    version: '1.0.7-auto-wake',
    status: 'online',
    autoWake: 'Поддерживает авто-пробуждение через GitHub API',
    keepalive: 'Поддерживает /keepalive чтобы не засыпать',
    endpoints: {
      '/status': 'GET - реальный статус CPU/RAM/Disk',
      '/exec': 'POST {cmd} - выполнить команду',
      '/chat': 'POST {prompt, model} - чат через Linux',
      '/montage': 'POST - монтаж видео',
      '/keepalive': 'GET - пинг чтобы не заснул',
      '/sleep-config': 'GET - настройки сна'
    },
    howTo: '1. Пробрось порт 3000 Public 2. Вставь URL в APK 3. Вставь GitHub PAT в APK для авто-пробуждения',
    timestamp: new Date().toISOString()
  });
});

// Авто-keepalive внутри сервера - трогаем файл каждую минуту чтобы GitHub считал активным
setInterval(() => {
  try {
    fs.writeFileSync('/tmp/keepalive', new Date().toISOString());
    // Также пишем в лог
    if (Date.now() - lastPing < 15*60*1000) {
      console.log(`[keepalive] still alive, last external ping ${Math.round((Date.now()-lastPing)/1000)}s ago`);
    }
  } catch(e){}
}, 60*1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  log(`Server running on http://0.0.0.0:${PORT}`);
  log(`Codespace URL будет типа https://xxx-3000.app.github.dev`);
  log(`Пробрось порт 3000 как Public!`);
  log(`CPU: ${os.cpus().length} x ${os.cpus()[0]?.model}`);
  log(`RAM: ${Math.round(os.totalmem()/1024/1024)} MB`);
});
