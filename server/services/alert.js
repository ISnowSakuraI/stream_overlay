import { getAlertConfigs, getSettings, addAlertHistory } from '../storage/store.js';
import { synthesizeThaiSpeech } from './tts.js';
import { broadcast } from './websocket.js';
import { sanitizeAlertPayload, validateAlertType } from '../lib/validation.js';

const MAX_QUEUE_SIZE = 100;
const queue = [];
let processing = false;

// Serialising alert construction preserves event order and prevents a burst of TTS calls.
export function triggerAlert(type, payload = {}) {
  if (!validateAlertType(type)) return Promise.reject(new Error('Invalid alert type'));
  if (queue.length >= MAX_QUEUE_SIZE) return Promise.reject(new Error('Alert queue is full'));
  return new Promise((resolve, reject) => {
    queue.push({ type, payload: sanitizeAlertPayload(payload), resolve, reject });
    void processQueue();
  });
}

async function processQueue() {
  if (processing) return;
  processing = true;
  while (queue.length) {
    const job = queue.shift();
    try { job.resolve(await buildAndBroadcastAlert(job.type, job.payload)); }
    catch (error) { console.error('[Alert] Processing failed:', error.message); job.reject(error); }
  }
  processing = false;
}

async function buildAndBroadcastAlert(alertType, payload) {
  const [configs, settings] = await Promise.all([getAlertConfigs(), getSettings()]);
  const config = configs.find(item => item.type === alertType);
  if (!config || config.enabled === false) return null;

  const name = payload.name || 'Anonymous';
  const amount = payload.amount || '';
  const userMessage = payload.message || '';
  const template = payload.ttsTemplate || config.ttsTemplate || '{name} followed the channel!';
  const subTemplate = payload.subMessage || config.subMessage || '';
  const substitute = value => value.replace(/{name}/g, name.replace(/\([^)]*\)/g, '').trim() || name)
    .replace(/{amount}/g, amount).replace(/{message}/g, userMessage).trim();
  const ttsText = substitute(template).slice(0, settings.tts?.maxLength || 200);
  const subMessage = substitute(subTemplate);
  let audioUrl = null;
  if (settings.tts?.enabled !== false && payload.ttsEnabled !== false && config.ttsEnabled !== false && ttsText) {
    try { audioUrl = await synthesizeThaiSpeech(ttsText, settings.tts?.maxLength || 200); }
    catch (error) { console.warn('[Alert] TTS unavailable; delivering silent alert:', error.message); }
  }

  const alertData = {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: alertType, title: config.name || 'New Alert', name, amount,
    message: userMessage || subMessage, subMessage, ttsText, audioUrl,
    imagePath: payload.imagePath || config.imagePath || '', soundPath: payload.soundPath || config.soundPath || '',
    duration: payload.duration || config.duration || 5_000, fontFamily: payload.fontFamily || config.fontFamily || 'Noto Sans Thai',
    fontSize: payload.fontSize || config.fontSize || 28, fontColor: payload.fontColor || config.fontColor || '#ECECEF',
    bgColor: payload.bgColor || config.bgColor || '#19191B', animationIn: config.animationIn || 'bounceIn',
  };
  await addAlertHistory({ type: alertType, userName: name, amount, message: alertData.message });
  broadcast('alert:trigger', alertData);
  return alertData;
}

export function getAlertQueueStatus() {
  return { queued: queue.length, processing };
}
