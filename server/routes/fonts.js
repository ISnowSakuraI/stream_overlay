import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { FONTS_DIR, ensureDataDirs } from '../storage/store.js';
import { fetchWithTimeout } from '../lib/http.js';

const router = express.Router();

// Preset / Built-in Google Fonts (Thai & English)
const PRESET_FONTS = [
  'Noto Sans Thai',
  'Prompt',
  'Kanit',
  'Sarabun',
  'Mitr',
  'Chakra Petch',
  'Bai Jamjuree',
  'Charm',
  'Chonburi',
  'Mali',
  'Pattaya',
  'Srisakdi',
  'IBM Plex Sans Thai',
  'Inter',
  'JetBrains Mono'
];

// Multer storage setup for custom font uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureDataDirs();
    cb(null, FONTS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${cleanName}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // Max 15MB font
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.ttf', '.otf', '.woff', '.woff2'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid font file type. Allowed: .ttf, .otf, .woff, .woff2'));
    }
  }
});

// GET /api/fonts — Get list of all available fonts
router.get('/', async (req, res) => {
  try {
    await ensureDataDirs();
    const files = await fs.readdir(FONTS_DIR);
    const customFonts = files
      .filter((f) => /\.(ttf|otf|woff|woff2)$/i.test(f))
      .map((filename) => {
        const ext = path.extname(filename);
        const name = filename.replace(/_\d+\.(ttf|otf|woff|woff2)$/i, '').replace(/_/g, ' ');
        return {
          name,
          filename,
          url: `/uploads/fonts/${filename}`
        };
      });

    res.json({
      presetFonts: PRESET_FONTS,
      customFonts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fonts/upload — Upload a custom font file
router.post('/upload', upload.single('font'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No font file uploaded' });
  }
  // M-12: removed unused `ext` variable
  const name = req.file.filename.replace(/_\d+\.(ttf|otf|woff|woff2)$/i, '').replace(/_/g, ' ');
  res.json({
    success: true,
    font: {
      name,
      filename: req.file.filename,
      url: `/uploads/fonts/${req.file.filename}`
    }
  });
});

// POST /api/fonts/google/import — Download Google Font to local fonts directory
router.post('/google/import', async (req, res) => {
  try {
    const { fontName } = req.body;
    if (!fontName || !fontName.trim()) {
      return res.status(400).json({ error: 'fontName is required' });
    }

    // Validate length to prevent oversized requests
    const cleanFontName = fontName.trim();
    if (cleanFontName.length > 100) {
      return res.status(400).json({ error: 'fontName is too long (max 100 characters)' });
    }

    const googleCssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(cleanFontName)}:wght@400;600;700&display=swap`;

    // Fetch CSS from Google Fonts
    const cssRes = await fetchWithTimeout(googleCssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, 8_000);

    if (!cssRes.ok) {
      return res.status(400).json({ error: `Could not find font "${cleanFontName}" on Google Fonts.` });
    }

    const cssText = await cssRes.text();
    // Extract first font file URL from CSS
    const match = cssText.match(/url\((https:\/\/[^)]+\.(woff2|ttf|otf))\)/);
    if (!match || !match[1]) {
      return res.status(400).json({ error: `Could not parse font binary for "${cleanFontName}".` });
    }

    const fontFileUrl = match[1];

    // SSRF guard: only allow downloads from Google's font CDN
    if (!fontFileUrl.startsWith('https://fonts.gstatic.com/')) {
      return res.status(400).json({ error: 'Font URL is not from a trusted source.' });
    }

    const ext = match[2] ? `.${match[2]}` : '.woff2';
    const fontFileName = `${cleanFontName.replace(/\s+/g, '_')}_gfont_${Date.now()}${ext}`;

    // Download font binary
    const fontRes = await fetchWithTimeout(fontFileUrl, {}, 12_000);
    const arrayBuf = await fontRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    await ensureDataDirs();
    const targetPath = path.join(FONTS_DIR, fontFileName);
    await fs.writeFile(targetPath, buffer);

    res.json({
      success: true,
      font: {
        name: cleanFontName,
        filename: fontFileName,
        url: `/uploads/fonts/${fontFileName}`
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/fonts/:filename — Delete custom font
router.delete('/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;

    // Security: resolve the final path and confirm it stays within FONTS_DIR
    const safeBase = path.resolve(FONTS_DIR);
    const targetPath = path.resolve(FONTS_DIR, filename);
    if (!targetPath.startsWith(safeBase + path.sep)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (await fs.pathExists(targetPath)) {
      await fs.remove(targetPath);
      res.json({ success: true, message: 'Font deleted successfully' });
    } else {
      res.status(404).json({ error: 'Font file not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
