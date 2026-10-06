import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config.js';
import { ensureDataDirs } from './storage/store.js';
import { createApp } from './app.js';
import { initWebSocketServer } from './services/websocket.js';
import { autoConnectTwitchOnStartup } from './services/twitch.js';
import { autoConnectYouTubeOnStartup } from './services/youtube.js';
// H-2: TTS cache cleanup on startup (remove files older than 7 days)
import { cleanTtsCache } from './services/tts.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '../');

const app = createApp({ rootDir: ROOT_DIR });
const server = http.createServer(app);

// Initialize WebSocket server
initWebSocketServer(server);

// Start Server
async function start() {
  await ensureDataDirs();
  // H-2: clean TTS cache files older than 7 days on each startup
  cleanTtsCache(7).catch(() => {}); // non-blocking, don't delay startup
  await autoConnectTwitchOnStartup();
  await autoConnectYouTubeOnStartup();

  server.listen(config.port, '127.0.0.1', () => {
    console.log(`\n==================================================`);
    console.log(`🚀 StreamOverlay Pro Server running on http://localhost:${config.port}`);
    console.log(`💬 Chat Overlay URL:  http://localhost:${config.port}/overlay/chat`);
    console.log(`🔔 Alert Overlay URL: http://localhost:${config.port}/overlay/alert`);
    console.log(`==================================================\n`);
  });
}

start().catch(error => {
  console.error('[Server] Failed to start:', error);
  process.exitCode = 1;
});
