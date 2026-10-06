import { config } from '../config.js';
import { broadcast } from './websocket.js';
import { fetchWithTimeout } from '../lib/http.js';

const jobs = { twitch: null, youtube: null };
const counts = { twitch: null, youtube: null };
let twitchToken = null;
let twitchTokenExpiry = 0;

async function getTwitchToken() {
  if (twitchToken && Date.now() < twitchTokenExpiry) return twitchToken;
  const { clientId, clientSecret } = config.twitch;
  if (!clientId || !clientSecret) return null;
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' });
  const response = await fetchWithTimeout('https://id.twitch.tv/oauth2/token', { method: 'POST', body }, 8_000);
  const data = await response.json();
  if (!data.access_token) return null;
  twitchToken = data.access_token;
  twitchTokenExpiry = Date.now() + Math.max((data.expires_in || 300) - 300, 60) * 1_000;
  return twitchToken;
}

async function twitchCount(channel) {
  if (!config.twitch.clientId || !config.twitch.clientSecret) return null;
  const token = await getTwitchToken();
  if (!token) return null;
  const response = await fetchWithTimeout(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`, {
    headers: { 'Client-ID': config.twitch.clientId, Authorization: `Bearer ${token}` }
  }, 8_000);
  return (await response.json()).data?.[0]?.viewer_count ?? null;
}

async function youtubeCount(videoId) {
  if (!config.youtube.apiKey) return null;
  const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${encodeURIComponent(videoId)}&key=${config.youtube.apiKey}`;
  const data = await (await fetchWithTimeout(url, {}, 8_000)).json();
  const value = data.items?.[0]?.liveStreamingDetails?.concurrentViewers;
  return value == null ? null : Number.parseInt(value, 10);
}

export function startViewerCountPolling(platform, id) {
  if (!['twitch', 'youtube'].includes(platform) || !id) return;
  stopViewerCountPolling(platform, true);
  const job = { stopped: false, timer: null, id };
  jobs[platform] = job;
  const run = async () => {
    try {
      const count = await (platform === 'twitch' ? twitchCount(id) : youtubeCount(id));
      counts[platform] = Number.isFinite(count) ? count : null;
      broadcast('viewer:count', { platform, count: counts[platform] });
    } catch (error) {
      console.warn(`[ViewerCount] ${platform} polling failed:`, error.message);
    } finally {
      if (!job.stopped) job.timer = setTimeout(run, 60_000);
    }
  };
  void run();
}

export function stopViewerCountPolling(platform, silent = false) {
  const job = jobs[platform];
  if (job) { job.stopped = true; clearTimeout(job.timer); jobs[platform] = null; }
  counts[platform] = null;
  if (!silent) broadcast('viewer:count', { platform, count: null });
}

export function getViewerCounts() { return { ...counts }; }
