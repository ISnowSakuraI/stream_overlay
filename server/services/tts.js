import path from 'path';
import crypto from 'crypto';
import fs from 'fs-extra';
import { TTS_CACHE_DIR } from '../storage/store.js';
import { fetchWithTimeout, retry } from '../lib/http.js';

const pendingSyntheses = new Map();

export async function cleanTtsCache(maxAgeDays = 7) {
  try {
    const cutoff = Date.now() - maxAgeDays * 86_400_000;
    const files = await fs.readdir(TTS_CACHE_DIR);
    await Promise.all(files.filter(file => file.endsWith('.mp3')).map(async file => {
      const target = path.join(TTS_CACHE_DIR, file);
      if ((await fs.stat(target)).mtimeMs < cutoff) await fs.remove(target);
    }));
  } catch (error) { console.warn('[TTS] Cache cleanup failed:', error.message); }
}

// The current product intentionally uses Google Translate TTS without credentials.
// Keep it isolated here so it can later be replaced by a supported provider without API changes.
export async function synthesizeThaiSpeech(text, maxLength = 200) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Text is required');
  const cleanText = text.replace(/(https?:\/\/[^\s]+)/g, '').replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ').slice(0, Math.min(Math.max(maxLength, 20), 500)).trim();
  if (!cleanText) throw new Error('No readable text after cleaning');
  const hash = crypto.createHash('sha256').update(cleanText).digest('hex');
  const cacheFile = path.join(TTS_CACHE_DIR, `${hash}.mp3`);
  if (await fs.pathExists(cacheFile)) return `/uploads/tts-cache/${hash}.mp3`;
  if (!pendingSyntheses.has(hash)) {
    pendingSyntheses.set(hash, (async () => {
      const audio = await requestSpeech(cleanText);
      await fs.writeFile(cacheFile, audio);
      return `/uploads/tts-cache/${hash}.mp3`;
    })().finally(() => pendingSyntheses.delete(hash)));
  }
  return pendingSyntheses.get(hash);
}

async function requestSpeech(text) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=th&client=tw-ob&q=${encodeURIComponent(text)}`;
  const response = await retry(() => fetchWithTimeout(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  }, 5_000), { attempts: 2, delayMs: 250 });
  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.byteLength < 100) throw new Error('TTS provider returned empty audio');
  return audio;
}
