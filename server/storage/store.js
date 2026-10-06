import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { sanitizeAlertConfigs, sanitizeSettingsPatch } from '../lib/validation.js';

// Per-file write queue: serializes concurrent writes to the same file
// to prevent the read-modify-write race condition.
const writeQueues = new Map();
function enqueueWrite(filePath, writeFn) {
  const prev = writeQueues.get(filePath) || Promise.resolve();
  const next = prev.then(writeFn);
  // Keep the queue operational after an error, while returning the real error to its caller.
  writeQueues.set(filePath, next.catch(() => {}));
  return next;
}

async function writeJsonAtomic(filePath, value) {
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeJson(temporary, value, { spaces: 2 });
  await fs.move(temporary, filePath, { overwrite: true });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getStorageRootDir() {
  // 1. If explicit PORTABLE_EXECUTABLE_DIR is specified
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return process.env.PORTABLE_EXECUTABLE_DIR;
  }
  // 2. Default to Windows AppData (%APPDATA%/StreamOverlayPro)
  // This guarantees settings, fonts, and uploads are preserved across all app updates!
  const appDataPath = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library/Application Support') : path.join(process.env.HOME, '.config'));
  return path.join(appDataPath, 'StreamOverlayPro');
}

const ROOT_DIR = getStorageRootDir();
const DATA_DIR = path.join(ROOT_DIR, 'data');
const MESSAGES_DIR = path.join(DATA_DIR, 'messages');
const ALERTS_DIR = path.join(DATA_DIR, 'alerts');

const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const IMAGES_DIR = path.join(UPLOADS_DIR, 'images');
const SOUNDS_DIR = path.join(UPLOADS_DIR, 'sounds');
const TTS_CACHE_DIR = path.join(UPLOADS_DIR, 'tts-cache');
const FONTS_DIR = path.join(UPLOADS_DIR, 'fonts');

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const ALERTS_CONFIG_FILE = path.join(DATA_DIR, 'alert-configs.json');

const DEFAULT_SETTINGS = {
  closeBehavior: 'ask', // 'ask' | 'minimize' | 'exit'
  youtube: {
    videoId: '',
    autoConnect: false
  },
  twitch: {
    channel: '',
    autoConnect: true
  },
  chatOverlay: {
    shape: 'bubble',
    fontFamily: 'Noto Sans Thai',
    fontSize: 15,
    fontColor: '#ECECEF',
    bgColor: 'rgba(25, 25, 27, 0.85)',
    maxMessages: 20,
    fadeTimeout: 0,
    position: 'bottom-left'
  },
  alertOverlay: {
    position: 'center',
    defaultDuration: 5000
  },
  tts: {
    enabled: true,
    maxLength: 200
  },
  dashboardSound: {
    enabled: true,
    volume: 0.6
  }
};

const DEFAULT_ALERTS = [
  {
    id: 'follow-default',
    type: 'follow',
    name: 'ผู้ติดตามใหม่ (YouTube & Twitch)',
    imagePath: '',
    soundPath: '',
    duration: 5000,
    ttsEnabled: true,
    ttsTemplate: '{name} ได้ติดตามช่องแล้ว!',
    subMessage: 'ขอบคุณที่ติดตามนะครับ!',
    fontFamily: 'Noto Sans Thai',
    fontSize: 28,
    fontColor: '#3CC68A',
    bgColor: '#19191B',
    enabled: true
  },
  {
    id: 'sub-default',
    type: 'subscribe',
    name: 'สมัครสมาชิก (Member / Twitch Sub)',
    imagePath: '',
    soundPath: '',
    duration: 5000,
    ttsEnabled: true,
    ttsTemplate: '{name} ได้สมัครสมาชิกแล้ว!',
    subMessage: 'ขอบคุณสำหรับการสมัครสมาชิกครับ!',
    fontFamily: 'Noto Sans Thai',
    fontSize: 28,
    fontColor: '#ECECEF',
    bgColor: '#19191B',
    enabled: true
  },
  {
    id: 'superchat-default',
    type: 'superchat',
    name: 'Super Chat / Bits (โดเนท)',
    imagePath: '',
    soundPath: '',
    duration: 7000,
    ttsEnabled: true,
    ttsTemplate: '{name} ส่ง {amount}: {message}',
    subMessage: 'ขอบคุณสำหรับการสนับสนุนนะครับ!',
    fontFamily: 'Noto Sans Thai',
    fontSize: 28,
    fontColor: '#E8A33C',
    bgColor: '#19191B',
    enabled: true
  },
  {
    id: 'raid-default',
    type: 'raid',
    name: 'Raid / Host (Twitch)',
    imagePath: '',
    soundPath: '',
    duration: 6000,
    ttsEnabled: true,
    ttsTemplate: '{name} นำคนดู {amount} คนมา Raid!',
    subMessage: 'ยินดีต้อนรับทุกคนที่ Raid เข้ามาครับ!',
    fontFamily: 'Noto Sans Thai',
    fontSize: 28,
    fontColor: '#9146FF',
    bgColor: '#19191B',
    enabled: true
  }
];

export async function ensureDataDirs() {
  // Auto-migrate from previous local folder if present
  const oldLocalRoot = path.join(__dirname, '../../');
  if (ROOT_DIR !== oldLocalRoot) {
    const oldDataDir = path.join(oldLocalRoot, 'data');
    const oldUploadsDir = path.join(oldLocalRoot, 'uploads');

    if (await fs.pathExists(oldDataDir)) {
      try {
        await fs.copy(oldDataDir, DATA_DIR, { overwrite: false });
      } catch (e) {
        // H-5: log migration failure so the user knows data may not have migrated
        console.error('[Store] Migration from old data dir failed:', e.message);
      }
    }
    if (await fs.pathExists(oldUploadsDir)) {
      try {
        await fs.copy(oldUploadsDir, UPLOADS_DIR, { overwrite: false });
      } catch (e) {
        console.error('[Store] Migration from old uploads dir failed:', e.message);
      }
    }
  }

  await fs.ensureDir(DATA_DIR);
  await fs.ensureDir(MESSAGES_DIR);
  await fs.ensureDir(ALERTS_DIR);
  await fs.ensureDir(UPLOADS_DIR);
  await fs.ensureDir(IMAGES_DIR);
  await fs.ensureDir(SOUNDS_DIR);
  await fs.ensureDir(TTS_CACHE_DIR);
  await fs.ensureDir(FONTS_DIR);

  if (!(await fs.pathExists(SETTINGS_FILE))) {
    await fs.writeJson(SETTINGS_FILE, DEFAULT_SETTINGS, { spaces: 2 });
  }

  // Create alert configs if missing
  if (!(await fs.pathExists(ALERTS_CONFIG_FILE))) {
    await fs.writeJson(ALERTS_CONFIG_FILE, DEFAULT_ALERTS, { spaces: 2 });
  }
}

export async function getSettings() {
  await ensureDataDirs();
  try {
    const settings = await fs.readJson(SETTINGS_FILE);
    return { ...DEFAULT_SETTINGS, ...settings };
  } catch (err) {
    return DEFAULT_SETTINGS;
  }
}

// #19: Deep merge helper — prevents nested settings from being wiped on partial updates
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export async function saveSettings(newSettings) {
  await ensureDataDirs();
  const patch = sanitizeSettingsPatch(newSettings);
  return enqueueWrite(SETTINGS_FILE, async () => {
    const current = await getSettings();
    // Deep merge so nested keys (e.g. chatOverlay.fontFamily) are preserved.
    const updated = deepMerge(current, patch);
    await writeJsonAtomic(SETTINGS_FILE, updated);
    return updated;
  });
}

export async function getAlertConfigs() {
  await ensureDataDirs();
  try {
    const configs = await fs.readJson(ALERTS_CONFIG_FILE);
    return configs.map((c) => {
      if (c.subMessage === undefined) {
        if (c.type === 'follow') c.subMessage = 'ขอบคุณที่ติดตามนะครับ!';
        else if (c.type === 'subscribe') c.subMessage = 'ขอบคุณสำหรับการสมัครสมาชิกครับ!';
        else if (c.type === 'superchat') c.subMessage = 'ขอบคุณสำหรับการสนับสนุนนะครับ!';
        else if (c.type === 'raid') c.subMessage = 'ยินดีต้อนรับทุกคนที่ Raid เข้ามาครับ!';
      }
      if (!c.name) {
        if (c.type === 'follow') c.name = 'ผู้ติดตามใหม่ (YouTube & Twitch)';
        else if (c.type === 'subscribe') c.name = 'สมัครสมาชิกช่อง (Member / Twitch Sub)';
        else if (c.type === 'superchat') c.name = 'Super Chat / Bits (โดเนท)';
        else if (c.type === 'raid') c.name = 'Raid / Host (Twitch)';
      }
      return c;
    });
  } catch (err) {
    return DEFAULT_ALERTS;
  }
}

export async function saveAlertConfigs(configs) {
  await ensureDataDirs();
  const validated = sanitizeAlertConfigs(configs);
  return enqueueWrite(ALERTS_CONFIG_FILE, async () => {
    await writeJsonAtomic(ALERTS_CONFIG_FILE, validated);
    return validated;
  });
}

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

export function addMessage(msg) {
  const today = getTodayString();
  const file = path.join(MESSAGES_DIR, `${today}.json`);
  return enqueueWrite(file, async () => {
    let messages = [];
    if (await fs.pathExists(file)) {
      try {
        messages = await fs.readJson(file);
      } catch (e) {
        messages = [];
      }
    }
    messages.push(msg);
    if (messages.length > 1000) {
      messages = messages.slice(messages.length - 1000);
    }
    await writeJsonAtomic(file, messages);
    return msg;
  });
}

export async function getRecentMessages(limit = 100) {
  await ensureDataDirs();
  const today = getTodayString();
  const file = path.join(MESSAGES_DIR, `${today}.json`);
  if (!(await fs.pathExists(file))) {
    return [];
  }
  try {
    const messages = await fs.readJson(file);
    return messages.slice(-limit);
  } catch (e) {
    return [];
  }
}

export function addAlertHistory(alertData) {
  const today = getTodayString();
  const file = path.join(ALERTS_DIR, `${today}.json`);
  return enqueueWrite(file, async () => {
    let alerts = [];
    if (await fs.pathExists(file)) {
      try {
        alerts = await fs.readJson(file);
      } catch (e) {
        alerts = [];
      }
    }
    const entry = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...alertData,
      timestamp: new Date().toISOString()
    };
    alerts.push(entry);
    // Alert history must remain bounded during long-running streams.
    if (alerts.length > 2_000) alerts = alerts.slice(-2_000);
    await writeJsonAtomic(file, alerts);
    return entry;
  });
}

export async function getRecentAlertHistory(limit = 50) {
  await ensureDataDirs();
  const today = getTodayString();
  const file = path.join(ALERTS_DIR, `${today}.json`);
  if (!(await fs.pathExists(file))) {
    return [];
  }
  try {
    const alerts = await fs.readJson(file);
    return alerts.slice(-limit);
  } catch (e) {
    return [];
  }
}

export { DATA_DIR, UPLOADS_DIR, IMAGES_DIR, SOUNDS_DIR, TTS_CACHE_DIR, FONTS_DIR };
