import express from 'express';
import { synthesizeThaiSpeech } from '../services/tts.js';

const router = express.Router();

router.post('/synthesize', async (req, res) => {
  try {
    const { text } = req.body;
    if (typeof text !== 'string' || !text.trim() || text.length > 2_000) {
      return res.status(400).json({ error: 'text is required' });
    }
    const audioUrl = await synthesizeThaiSpeech(text);
    res.json({ success: true, audioUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
