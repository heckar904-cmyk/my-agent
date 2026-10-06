# Linux Agent Server - для связи APK с Codespace

Это сервер который делает Linux реальным, а не фейком.

## Что делать в my-agent репо:

1. Открой https://github.com/heckar904-cmyk/my-agent
2. Нажми `Code` -> `Codespaces` -> `Create codespace` или открой существующий
3. В терминале Codespace выполни:

```bash
# Клонируй или создай файлы
# Если репо пустое, скопируй эти файлы:
# server.js и package.json

npm install
node server.js
```

4. Внизу в VS Code вкладка PORTS, найди порт 3000, правой кнопкой -> Port Visibility -> Public
5. Скопируй URL типа `https://silver-engine-g4jq7xx56vj72vvrw-18789.app.github.dev` или с `-3000`
   Важно: URL для 3000 будет `https://xxx-3000.app.github.dev` - именно его вставь в APK

6. В APK в Linux карте вставь:
   - Codespace URL: твой URL с 3000
   - PAT: создай на https://github.com/settings/tokens -> Generate new token (classic) -> выбери repo, codespace

## Что умеет сервер:

- GET /status - реальные CPU, RAM, Disk, uptime
- POST /exec {cmd} - выполнить любую команду (ls, ffmpeg -version, python3 --version, etc)
- POST /chat {prompt} - чат через Linux (если есть GEMINI_KEY в .env)
- GET / - проверка что онлайн

## Установка доп софта в Codespace:

```bash
sudo apt update
sudo apt install -y ffmpeg python3-pip
pip install openai-whisper
pip install git+https://github.com/openai/CLIP.git
```

После этого APK сможет отправлять видео на Linux и получать готовый монтаж 1080x1920.

## Почему Codespace спит:

GitHub автоматически останавливает Codespace через 30 минут бездействия. Это их правило, не мое. Поэтому в APK кнопка "Проверить" показывает реально спит или нет, а "Открыть GitHub" будит его в 1 клик.

Когда сервер запущен, он не дает уснуть пока работает.

## Безопасность:

- Сервер слушает 0.0.0.0 но доступен только через твой приватный Codespace URL
- Команды типа rm -rf / заблокированы
- PAT нужен только если хочешь приватный доступ
