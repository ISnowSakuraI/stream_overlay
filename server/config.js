import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from multiple candidate paths so it works in both dev and packaged modes.
// Priority order:
//  1. Next to the .exe  (packaged: user puts .env beside StreamOverlayPro.exe)
//  2. resources/app/   (packaged fallback)
//  3. Project root     (development: the normal location)
const execDir = path.dirname(process.execPath);
const envCandidates = [
  path.join(execDir, '.env'),
  path.join(execDir, 'resources', 'app', '.env'),
  path.join(__dirname, '../.env'),
];
for (const envPath of envCandidates) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    console.log(`[Config] Loaded .env from: ${envPath}`);
    break;
  }
}

export const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
    clientId: process.env.YOUTUBE_CLIENT_ID || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
    redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/auth/youtube/callback'
  },
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID || '',
    clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
    redirectUri: process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/twitch/callback'
  },
  googleTts: {
    apiKey: process.env.GOOGLE_TTS_API_KEY || ''
  }
};
