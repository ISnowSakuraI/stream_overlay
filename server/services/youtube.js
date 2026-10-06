import { LiveChat } from 'youtube-chat';
import { addMessage, getSettings } from '../storage/store.js';
import { triggerAlert } from './alert.js';
import { broadcast } from './websocket.js';
import { startViewerCountPolling, stopViewerCountPolling } from './viewercount.js';

let liveChatInstance = null;
let currentInput = null;
let isConnected = false;
let manualStop = false;
let reconnectTimer = null;
let reconnectAttempt = 0;
let generation = 0;

export function getYouTubeStatus() { return { isConnected, videoId: currentInput }; }

export async function autoConnectYouTubeOnStartup() {
  const settings = await getSettings();
  if (settings.youtube?.autoConnect && settings.youtube?.videoId) {
    try { await startYouTubePolling(settings.youtube.videoId); }
    catch (error) { console.warn('[YouTube] Startup connection failed:', error.message); }
  }
}

export async function startYouTubePolling(input) {
  const cleanInput = String(input || '').trim();
  if (!cleanInput || cleanInput.length > 300) throw new Error('A valid YouTube stream, channel, or video ID is required');
  clearTimeout(reconnectTimer);
  await stopYouTubePolling(true);
  manualStop = false;
  currentInput = cleanInput;
  const ownGeneration = ++generation;
  const instance = new LiveChat(parseYouTubeInput(cleanInput));
  liveChatInstance = instance;
  const active = () => ownGeneration === generation && liveChatInstance === instance;
  instance.on('start', liveId => {
    if (!active()) return;
    isConnected = true; reconnectAttempt = 0;
    broadcast('connection:status', { platform: 'youtube', connected: true, videoId: cleanInput });
    startViewerCountPolling('youtube', liveId || cleanInput);
  });
  instance.on('chat', item => { if (active()) void processYouTubeItem(item); });
  instance.on('error', error => {
    if (!active()) return;
    console.warn('[YouTube] Live chat error:', error.message || error);
    if (!isConnected) broadcast('connection:status', { platform: 'youtube', connected: false, error: error.message || 'Connection failed' });
  });
  instance.on('end', () => {
    if (!active()) return;
    isConnected = false; stopViewerCountPolling('youtube');
    broadcast('connection:status', { platform: 'youtube', connected: false });
    if (!manualStop && currentInput) scheduleReconnect();
  });
  try {
    const started = await instance.start();
    if (!started) throw new Error('No active live chat was found. Verify that the stream is live.');
    if (active()) {
      isConnected = true;
      broadcast('connection:status', { platform: 'youtube', connected: true, videoId: cleanInput });
    }
    return { success: true };
  } catch (error) {
    if (active()) {
      await stopYouTubePolling(true);
      broadcast('connection:status', { platform: 'youtube', connected: false, error: error.message });
    }
    throw error;
  }
}

export async function stopYouTubePolling(silent = false) {
  ++generation;
  clearTimeout(reconnectTimer);
  if (liveChatInstance) {
    try { liveChatInstance.stop(); } catch (error) { console.warn('[YouTube] Stop failed:', error.message); }
    liveChatInstance = null;
  }
  isConnected = false;
  stopViewerCountPolling('youtube', silent);
  if (!silent) {
    manualStop = true; currentInput = null; reconnectAttempt = 0;
    broadcast('connection:status', { platform: 'youtube', connected: false });
  }
}

function scheduleReconnect() {
  const input = currentInput;
  const base = Math.min(3_000 * (1.7 ** reconnectAttempt), 60_000);
  const delay = Math.round(base * (0.8 + Math.random() * 0.4));
  reconnectAttempt++;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    if (!manualStop && currentInput === input) startYouTubePolling(input).catch(error => console.warn('[YouTube] Reconnect failed:', error.message));
  }, delay);
}

function parseYouTubeInput(input) {
  if (input.includes('youtube.com/live/')) return { liveId: input.split('youtube.com/live/')[1].split(/[?/]/)[0] };
  if (input.includes('v=')) return { liveId: input.split('v=')[1].split('&')[0] };
  if (input.startsWith('@')) return { handle: input };
  if (input.startsWith('UC') && input.length > 15) return { channelId: input };
  return { liveId: input };
}

async function processYouTubeItem(chatItem) {
  if (!chatItem) return;
  const author = String(chatItem.author?.name || 'Anonymous').slice(0, 100);
  const parts = Array.isArray(chatItem.message) ? chatItem.message.slice(0, 100) : [];
  const message = parts.map(part => part.text || part.emojiText || '').join('').slice(0, 500).trim();
  const isSuperchat = Boolean(chatItem.isSuperChat || chatItem.superchat);
  const msg = {
    id: `yt_${chatItem.id || Date.now()}`, platform: 'youtube', author,
    authorAvatar: chatItem.author?.thumbnail?.url || '', authorId: chatItem.author?.channelId || '',
    message, messageParts: parts, isSuperchat, superchatAmount: chatItem.superchat?.amount || '',
    isMember: Boolean(chatItem.isMembership), timestamp: new Date(chatItem.timestamp || Date.now()).toISOString(),
  };
  await addMessage(msg); broadcast('chat:message', msg);
  if (isSuperchat) void triggerAlert('superchat', { name: author, amount: msg.superchatAmount, message });
  else if (msg.isMember) void triggerAlert('subscribe', { name: author, message });
}
