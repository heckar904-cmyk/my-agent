// Linux Agent Server для my-agent Codespace + Replit - v1.0.8 persist keys
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

function log(msg){ console.log(`[${new Date().toISOString()}] ${msg}`); }

const KEYS_FILE = path.join(__dirname, 'user-keys.json');
let cachedKeys = {};
try{
  if(fs.existsSync(KEYS_FILE)){
    cachedKeys = JSON.parse(fs.readFileSync(KEYS_FILE,'utf8'));
    log('Loaded keys from '+KEYS_FILE);
  }
}catch(e){ log('keys load error '+e.message); cachedKeys={}; }

function saveKeysToFile(keys){
  cachedKeys = {...cachedKeys, ...keys, updated: new Date().toISOString()};
  try{
    fs.writeFileSync(KEYS_FILE, JSON.stringify(cachedKeys, null, 2));
    log('Keys saved: gemini='+(cachedKeys.gemini?'yes':'no')+' groq='+(cachedKeys.groq?'yes':'no'));
  }catch(e){ log('save error '+e.message); }
  return cachedKeys;
}

app.post('/save-keys', (req,res)=>{
  const {gemini, groq, githubPat, codespaceUrl, extraPats} = req.body;
  const toSave = {};
  if(gemini!==undefined) toSave.gemini = gemini;
  if(groq!==undefined) toSave.groq = groq;
  if(githubPat!==undefined) toSave.githubPat = githubPat;
  if(codespaceUrl!==undefined) toSave.codespaceUrl = codespaceUrl;
  if(extraPats!==undefined) toSave.extraPats = extraPats;
  const saved = saveKeysToFile(toSave);
  res.json({ok:true, saved: {gemini: !!saved.gemini, groq: !!saved.groq, githubPat: !!saved.githubPat, codespaceUrl: saved.codespaceUrl}, updated: saved.updated});
});

app.get('/get-keys', (req,res)=>{
  res.json({
    gemini: cachedKeys.gemini||'',
    groq: cachedKeys.groq||'',
    githubPat: cachedKeys.githubPat||'',
    codespaceUrl: cachedKeys.codespaceUrl||'',
    extraPats: cachedKeys.extraPats||'',
    updated: cachedKeys.updated||''
  });
});

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
      message: 'Linux работает, ключи: gemini='+(cachedKeys.gemini?'yes':'no'),
      keysSaved: {gemini: !!cachedKeys.gemini, groq: !!cachedKeys.groq, pat: !!cachedKeys.githubPat}
    });
  });
});

app.post('/exec', (req, res) => {
  const { cmd } = req.body;
  if (!cmd) return res.status(400).json({ error: 'No cmd' });
  const blocked = ['rm -rf /', ':(){:|:&};:', 'mkfs', 'dd if='];
  if (blocked.some(b => cmd.includes(b))) return res.status(403).json({ error: 'Blocked' });
  log(`Exec: ${cmd}`);
  exec(cmd, { timeout: 30000, maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
    res.json({ cmd, stdout: stdout?.slice(0, 10000) || '', stderr: stderr?.slice(0, 5000) || '', error: err?.message || null, code: err?.code || 0 });
  });
});

app.post('/chat', async (req, res) => {
  const { prompt, model } = req.body;
  const geminiKey = cachedKeys.gemini || process.env.GEMINI_KEY || (fs.existsSync('.env') ? fs.readFileSync('.env','utf8').match(/GEMINI_KEY=(.*)/)?.[1] : null);
  if (!prompt) return res.status(400).json({ error: 'No prompt' });
  if (geminiKey) {
    try {
      const fetch = (await import('node-fetch')).default;
      const modelName = model || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || 'Gemini error');
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
      return res.json({ response: text, via: 'linux-gemini', model: modelName });
    } catch (e) {
      log(`Gemini error: ${e.message}`);
      return res.json({ response: `Linux: "${prompt.slice(0,100)}"\nОшибка: ${e.message}`, via: 'linux-fallback' });
    }
  }
  res.json({ response: `Привет с Linux! ${os.hostname()}, ${os.cpus().length} vCPU. Запрос: ${prompt}\nДобавь ключ через сайт и он сохранится на сервере.`, via: 'linux-echo' });
});

app.post('/montage', async (req, res) => {
  log('Montage request');
  res.json({ status: 'ready', message: 'Монтаж готов', ffmpeg: await new Promise(resolve => { exec('ffmpeg -version | head -1', (err, stdout) => { resolve(stdout?.trim() || 'ffmpeg not found'); }); }) });
});

let lastPing = Date.now();
app.get('/keepalive', (req, res) => {
  lastPing = Date.now();
  try { fs.writeFileSync('/tmp/keepalive', new Date().toISOString()); } catch(e){}
  res.json({ status: 'alive', lastPing: new Date(lastPing).toISOString(), uptime: os.uptime() });
});

app.get('/sleep-config', (req, res) => {
  res.json({ message: 'Keepalive', lastPing: new Date(lastPing).toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Linux Agent Server',
    version: '1.0.8-persist-keys',
    status: 'online',
    keys: {gemini: !!cachedKeys.gemini, groq: !!cachedKeys.groq, pat: !!cachedKeys.githubPat},
    endpoints: {
      '/status': 'GET',
      '/save-keys': 'POST {gemini,groq,githubPat,codespaceUrl}',
      '/get-keys': 'GET',
      '/exec': 'POST {cmd}',
      '/chat': 'POST {prompt}',
      '/keepalive': 'GET'
    },
    timestamp: new Date().toISOString()
  });
});

setInterval(() => {
  try { fs.writeFileSync('/tmp/keepalive', new Date().toISOString()); } catch(e){}
}, 60*1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  log(`Server running on 0.0.0.0:${PORT} v1.0.8-persist`);
});
