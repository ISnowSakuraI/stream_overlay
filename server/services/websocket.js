import { WebSocketServer, WebSocket } from 'ws';
import { getSettings, getAlertConfigs } from '../storage/store.js';
import { triggerAlert } from './alert.js';
import { isTrustedLocalOrigin } from '../app.js';
import { sanitizeAlertPayload, validateAlertType, text } from '../lib/validation.js';

let wss = null;
const MAX_MESSAGE_BYTES = 16 * 1024;

export function initWebSocketServer(server) {
  wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: MAX_MESSAGE_BYTES,
    verifyClient: ({ origin }, done) => done(isTrustedLocalOrigin(origin), 403, 'Local origin required'),
  });
  wss.on('connection', async ws => {
    try {
      send(ws, 'init', { settings: await getSettings(), alertConfigs: await getAlertConfigs(), messages: [] });
    } catch (error) {
      console.error('[WebSocket] Initial state failed:', error.message);
      ws.close(1011, 'Initialisation failed');
      return;
    }
    ws.on('error', error => console.warn('[WebSocket] Client error:', error.message));
    ws.on('message', async raw => {
      try {
        if (raw.length > MAX_MESSAGE_BYTES) return ws.close(1009, 'Message too large');
        const message = JSON.parse(raw.toString());
        await handleClientMessage(ws, message);
      } catch (error) {
        console.warn('[WebSocket] Invalid client message:', error.message);
        send(ws, 'error', { error: 'Invalid WebSocket message' });
      }
    });
  });
  console.log('[WebSocket] Server initialised on /ws');
  return wss;
}

function send(ws, event, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
}

export function broadcast(event, data) {
  if (!wss) return;
  const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  for (const client of wss.clients) if (client.readyState === WebSocket.OPEN) client.send(payload);
}

async function handleClientMessage(ws, message) {
  if (!message || typeof message !== 'object' || typeof message.event !== 'string') throw new Error('Invalid event');
  switch (message.event) {
    case 'ping': return send(ws, 'pong', { time: Date.now() });
    case 'test_alert': {
      const type = validateAlertType(message.data?.type || 'follow');
      if (!type) throw new Error('Invalid alert type');
      await triggerAlert(type, sanitizeAlertPayload(message.data));
      return;
    }
    case 'test_chat': {
      const data = message.data || {};
      const chat = {
        id: `test_${Date.now()}`, platform: data.platform === 'twitch' ? 'twitch' : 'youtube',
        author: text(data.author, { max: 100, fallback: 'Test User' }) || 'Test User',
        message: text(data.message, { max: 500 }), timestamp: new Date().toISOString(),
      };
      if (!chat.message) throw new Error('Message is required');
      broadcast('chat:message', chat);
      return;
    }
    case 'clear_chat': return broadcast('chat:clear', {});
    default: throw new Error('Unknown event');
  }
}

export function closeWebSocketServer() {
  return new Promise(resolve => wss ? wss.close(resolve) : resolve());
}
