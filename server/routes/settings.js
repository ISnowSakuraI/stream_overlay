import express from 'express';
import { getSettings, saveSettings } from '../storage/store.js';
import { broadcast } from '../services/websocket.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const updated = await saveSettings(req.body);
    broadcast('settings:update', updated);
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
