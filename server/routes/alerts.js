import express from 'express';
import multer from 'multer';
import path from 'path';
import { getAlertConfigs, saveAlertConfigs, getRecentAlertHistory } from '../storage/store.js';
import { triggerAlert } from '../services/alert.js';
import { broadcast } from '../services/websocket.js';
import { IMAGES_DIR, SOUNDS_DIR } from '../storage/store.js';
import fs from 'fs-extra';

const router = express.Router();

// Allowed file types
const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_SOUND_EXTS = ['.mp3', '.ogg', '.wav', '.aac', '.m4a'];
const ALLOWED_SOUND_MIMES = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/mp4', 'audio/x-m4a'];

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `img_${Date.now()}${ext}`);
  }
});

const soundStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, SOUNDS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `snd_${Date.now()}${ext}`);
  }
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_IMAGE_EXTS.includes(ext) && ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid image type. Allowed: ${ALLOWED_IMAGE_EXTS.join(', ')}`));
    }
  }
});

const uploadSound = multer({
  storage: soundStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_SOUND_EXTS.includes(ext) && ALLOWED_SOUND_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid audio type. Allowed: ${ALLOWED_SOUND_EXTS.join(', ')}`));
    }
  }
});

router.get('/', async (req, res) => {
  try {
    const configs = await getAlertConfigs();
    res.json(configs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const configs = await saveAlertConfigs(req.body);
    broadcast('alertConfigs:update', configs);
    res.json({ success: true, configs });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/trigger-test', async (req, res) => {
  try {
    const { type, payload } = req.body;
    const alertData = await triggerAlert(type || 'subscribe', payload || { name: 'ผู้ทดสอบ (Test User)' });
    res.json({ success: true, alertData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const history = await getRecentAlertHistory(50);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload/image', (req, res) => {
  uploadImage.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });
    if (!(await hasValidSignature(req.file.path, 'image'))) {
      await fs.remove(req.file.path);
      return res.status(400).json({ error: 'The uploaded file is not a valid image' });
    }
    const fileUrl = `/uploads/images/${req.file.filename}`;
    res.json({ success: true, url: fileUrl });
  });
});

router.post('/upload/sound', (req, res) => {
  uploadSound.single('sound')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No sound file uploaded' });
    if (!(await hasValidSignature(req.file.path, 'audio'))) {
      await fs.remove(req.file.path);
      return res.status(400).json({ error: 'The uploaded file is not recognised as audio' });
    }
    const fileUrl = `/uploads/sounds/${req.file.filename}`;
    res.json({ success: true, url: fileUrl });
  });
});

async function hasValidSignature(filePath, type) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(16);
    await handle.read(buffer, 0, buffer.length, 0);
    if (type === 'image') {
      return buffer.subarray(0, 3).toString('hex') === 'ffd8ff' || buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) ||
        buffer.subarray(0, 4).toString() === 'GIF8' || buffer.subarray(0, 4).toString() === 'RIFF';
    }
    return buffer.subarray(0, 3).toString() === 'ID3' || buffer.subarray(0, 4).toString() === 'RIFF' ||
      buffer.subarray(0, 4).toString() === 'OggS' || buffer.subarray(4, 8).toString() === 'ftyp' || buffer[0] === 0xff;
  } finally { await handle.close(); }
}

export default router;
