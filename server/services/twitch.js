import WebSocket from 'ws';
import { addMessage, getSettings } from '../storage/store.js';
import { triggerAlert } from './alert.js';
import { broadcast } from './websocket.js';
import { startViewerCountPolling, stopViewerCountPolling } from './viewercount.js';

let ws = null;
let currentChannel = null;
let isConnected = false;
let reconnectTimer = null;
let manualStop = false;
let reconnectAttempt = 0;

export function getTwitchStatus() {
  return {
    isConnected,
    channel: currentChannel
  };
}

export async function autoConnectTwitchOnStartup() {
  try {
    const settings = await getSettings();
    if (settings?.twitch?.autoConnect && settings?.twitch?.channel) {
      console.log(`[Twitch Auto-Connect] Starting Twitch chat for #${settings.twitch.channel}...`);
      startTwitchChat(settings.twitch.channel);
    }
  } catch (err) {
    console.error('[Twitch Auto-Connect] Error:', err.message);
  }
}

export function startTwitchChat(channel) {
  if (!channel) {
    throw new Error('Twitch channel name is required');
  }

  clearTimeout(reconnectTimer);
  stopTwitchChatSilently();

  manualStop = false;
  currentChannel = channel.toLowerCase().replace('#', '').trim();
  if (!/^[a-z0-9_]{1,25}$/.test(currentChannel)) throw new Error('Invalid Twitch channel name');

  const wsUrl = 'wss://irc-ws.chat.twitch.tv:443';
  ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log(`[Twitch] Connected to IRC server for channel #${currentChannel}`);
    ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
    ws.send('PASS oauth:anonymous');
    ws.send(`NICK justinfan${Math.floor(10000 + Math.random() * 90000)}`);
    ws.send(`JOIN #${currentChannel}`);
    isConnected = true;
    reconnectAttempt = 0;
    broadcast('connection:status', { platform: 'twitch', connected: true, channel: currentChannel });
    // Start polling viewer count every 60 seconds
    startViewerCountPolling('twitch', currentChannel);
  });

  ws.on('message', async (data) => {
    const rawMessage = data.toString();

    // Respond to PING keep-alive
    if (rawMessage.startsWith('PING')) {
      ws.send('PONG :tmi.twitch.tv');
      return;
    }

    // Process PRIVMSG and USERNOTICE
    if (rawMessage.includes('PRIVMSG')) {
      await parseTwitchMessage(rawMessage);
    } else if (rawMessage.includes('USERNOTICE')) {
      await parseTwitchUsernotice(rawMessage);
    }
  });

  ws.on('error', (err) => {
    console.error('[Twitch] WebSocket error:', err.message);
    isConnected = false;
    broadcast('connection:status', { platform: 'twitch', connected: false, error: err.message });
  });

  ws.on('close', () => {
    console.log('[Twitch] Disconnected from IRC server');
    isConnected = false;
    broadcast('connection:status', { platform: 'twitch', connected: false });

    if (!manualStop && currentChannel) scheduleReconnect();
  });

  return { success: true, channel: currentChannel };
}

function stopTwitchChatSilently() {
  if (ws) {
    // #28: Remove handlers before closing to prevent the onclose reconnect from firing
    // on the old socket after ws has been set to null
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  isConnected = false;
}

export function stopTwitchChat() {
  manualStop = true;
  reconnectAttempt = 0;
  clearTimeout(reconnectTimer);
  stopViewerCountPolling('twitch');
  if (ws) {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  isConnected = false;
  currentChannel = null;
  broadcast('connection:status', { platform: 'twitch', connected: false });
  console.log('[Twitch] Stopped Twitch chat connection');
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  const baseDelay = Math.min(3_000 * (1.7 ** reconnectAttempt), 60_000);
  const delay = Math.round(baseDelay * (0.8 + Math.random() * 0.4));
  reconnectAttempt++;
  console.log(`[Twitch] Reconnecting to #${currentChannel} in ${(delay / 1000).toFixed(1)}s`);
  reconnectTimer = setTimeout(() => {
    if (!manualStop && currentChannel) startTwitchChat(currentChannel);
  }, delay);
}

function parseTwitchEmotes(text, emotesTag) {
  if (!emotesTag || !emotesTag.trim()) {
    return [{ text }];
  }

  const replacements = [];
  const parts = emotesTag.split('/');

  for (const part of parts) {
    const [emoteId, positions] = part.split(':');
    if (!emoteId || !positions) continue;

    const ranges = positions.split(',');
    for (const range of ranges) {
      const [startStr, endStr] = range.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        replacements.push({
          start,
          end,
          emoteId,
          url: `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/2.0`
        });
      }
    }
  }

  replacements.sort((a, b) => a.start - b.start);

  const messageParts = [];
  let lastIdx = 0;

  for (const rep of replacements) {
    if (rep.start > lastIdx) {
      messageParts.push({ text: text.substring(lastIdx, rep.start) });
    }
    const emoteCode = text.substring(rep.start, rep.end + 1);
    messageParts.push({
      url: rep.url,
      alt: emoteCode,
      isCustomEmoji: true
    });
    lastIdx = rep.end + 1;
  }

  if (lastIdx < text.length) {
    messageParts.push({ text: text.substring(lastIdx) });
  }

  return messageParts;
}

async function parseTwitchMessage(raw) {
  try {
    const tagMatch = raw.match(/^@([^\s]+)/);
    const tags = {};
    if (tagMatch) {
      tagMatch[1].split(';').forEach((tag) => {
        const [key, value] = tag.split('=');
        tags[key] = value || '';
      });
    }

    const messageMatch = raw.match(/PRIVMSG #[^\s]+ :(.+)/);
    const text = messageMatch ? messageMatch[1].trim() : '';

    const author = tags['display-name'] || tags['user-id'] || 'TwitchUser';
    const isSub = tags['subscriber'] === '1';
    const isMod = tags['mod'] === '1';
    const isBroadcaster = tags['badges'] && tags['badges'].includes('broadcaster');
    const bits = tags['bits'] ? parseInt(tags['bits'], 10) : 0;
    const emotesTag = tags['emotes'] || '';

    const messageParts = parseTwitchEmotes(text, emotesTag);

    const msgObj = {
      id: `tw_${tags['id'] || Date.now()}`,
      platform: 'twitch',
      author,
      authorId: tags['user-id'] || '',
      authorColor: tags['color'] || '#9146FF',
      message: text,
      messageParts,
      isSuperchat: bits > 0,
      superchatAmount: bits > 0 ? `${bits} Bits` : '',
      isMember: isSub,
      isModerator: isMod,
      badges: isBroadcaster ? ['broadcaster'] : isMod ? ['moderator'] : isSub ? ['subscriber'] : [],
      timestamp: new Date().toISOString()
    };

    await addMessage(msgObj);
    broadcast('chat:message', msgObj);

    if (bits > 0) {
      await triggerAlert('superchat', {
        name: author,
        amount: `${bits} Bits`,
        message: text
      });
    }
  } catch (err) {
    console.error('[Twitch] Message parse error:', err);
  }
}

async function parseTwitchUsernotice(raw) {
  try {
    const tagMatch = raw.match(/^@([^\s]+)/);
    const tags = {};
    if (tagMatch) {
      tagMatch[1].split(';').forEach((tag) => {
        const [key, value] = tag.split('=');
        tags[key] = value || '';
      });
    }

    const msgType = tags['msg-id'] || '';
    const name = tags['display-name'] || tags['login'] || 'User';

    if (msgType === 'sub' || msgType === 'resub') {
      await triggerAlert('subscribe', {
        name,
        message: `${name} สมัครสมาชิก Twitch!`
      });
    } else if (msgType === 'raid') {
      const raiders = tags['msg-param-viewerCount'] || '0';
      await triggerAlert('raid', {
        name,
        amount: raiders,
        message: `${name} นำคนดู ${raiders} คนมา Raid!`
      });
    }
  } catch (err) {
    console.error('[Twitch] Usernotice parse error:', err);
  }
}
