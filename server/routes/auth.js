import express from 'express';
import { startYouTubePolling, stopYouTubePolling, getYouTubeStatus } from '../services/youtube.js';
import { startTwitchChat, stopTwitchChat, getTwitchStatus } from '../services/twitch.js';
import { saveSettings, getSettings } from '../storage/store.js';

const router = express.Router();

router.get('/status', (req, res) => {
  res.json({
    youtube: getYouTubeStatus(),
    twitch: getTwitchStatus()
  });
});

router.post('/youtube/connect', async (req, res) => {
  try {
    const { videoId } = req.body;
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }
    const result = await startYouTubePolling(videoId);
    const settings = await getSettings();
    settings.youtube.videoId = videoId;
    await saveSettings(settings);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/youtube/disconnect', (req, res) => {
  stopYouTubePolling();
  res.json({ success: true });
});

router.post('/twitch/connect', async (req, res) => {
  try {
    const { channel } = req.body;
    if (!channel) {
      return res.status(400).json({ error: 'Twitch channel name is required' });
    }
    const result = startTwitchChat(channel);
    const settings = await getSettings();
    settings.twitch.channel = channel;
    await saveSettings(settings);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/twitch/disconnect', (req, res) => {
  stopTwitchChat();
  res.json({ success: true });
});

export default router;
