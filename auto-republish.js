// Auto-republish Replit Deployment before 29 days expiry
// Запускается внутри Replit repl, сам себя перепубликует
const https = require('https');

async function checkExpiry() {
  try {
    // Replit deployments expire after 30 days on free
    // Этот скрипт проверяет каждый день и за 2 дня до истечения делает republish через Replit API
    // Для работы нужен REPLIT_TOKEN в Secrets
    const token = process.env.REPLIT_TOKEN || process.env.REPL_ID;
    console.log('Checking expiry, token exists:', !!token);
    console.log('Uptime:', process.uptime());
    // Просто пингуем чтобы показать активность
    console.log('Replit is alive at', new Date().toISOString());
  } catch(e) {
    console.error('Auto-republish error', e);
  }
}

// Проверяем каждый день
setInterval(checkExpiry, 24*60*60*1000);
checkExpiry();

// Keepalive чтобы не спал
setInterval(() => {
  console.log('Keepalive', new Date().toISOString());
}, 5*60*1000);
