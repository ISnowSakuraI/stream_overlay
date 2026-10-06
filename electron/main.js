import { app, BrowserWindow, Tray, Menu, shell, clipboard, nativeImage, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

import { config } from '../server/config.js';
import { ensureDataDirs, getSettings } from '../server/storage/store.js';
import { createApp } from '../server/app.js';
import { initWebSocketServer } from '../server/services/websocket.js';
import { autoConnectTwitchOnStartup } from '../server/services/twitch.js';
import { autoConnectYouTubeOnStartup } from '../server/services/youtube.js';
// H-2: TTS cache cleanup on startup
import { cleanTtsCache } from '../server/services/tts.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// #11: Use a proper module-level variable instead of monkey-patching app.isQuitting
let isQuitting = false;

// Ensure single instance of app
const gotTheLock = app.requestSingleInstanceLock();

let mainWindow = null;
let tray = null;
let server = null;
// M-10: default must match DEFAULT_SETTINGS.closeBehavior = 'ask'
let closeBehaviorCache = 'ask';

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    await startServer();
    createTray();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

// Create Express + WS Server inside Electron
async function startServer() {
  await ensureDataDirs();
  // H-2: clean TTS cache files older than 7 days (non-blocking)
  cleanTtsCache(7).catch(() => {});
  await autoConnectTwitchOnStartup();
  await autoConnectYouTubeOnStartup();

  try {
    const s = await getSettings();
    if (s?.closeBehavior) closeBehaviorCache = s.closeBehavior;
    // Keep listening for settings updates via the save mechanism
  } catch (e) {}

  const appPath = app.isPackaged ? app.getAppPath() : path.join(__dirname, '../');
  const expressApp = createApp({ rootDir: appPath });
  server = http.createServer(expressApp);

  initWebSocketServer(server);

  return new Promise((resolve) => {
    server.listen(config.port, '127.0.0.1', () => {
      console.log(`[Electron Backend] Server running on http://localhost:${config.port}`);
      resolve();
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'StreamOverlay Pro — Control Panel',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL(`http://localhost:${config.port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Read latest close behavior from disk on every close event (fixes stale cache bug)
  mainWindow.on('close', async (event) => {
    if (isQuitting) return;

    // Always prevent default first so we can read settings asynchronously
    event.preventDefault();

    if (!mainWindow || mainWindow.isDestroyed()) return;

    // Read freshly from settings file each time
    let behavior = closeBehaviorCache;
    try {
      const s = await getSettings();
      if (s?.closeBehavior) {
        behavior = s.closeBehavior;
        closeBehaviorCache = behavior;
      }
    } catch (e) {}

    if (behavior === 'minimize') {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
      return;
    }

    if (behavior === 'exit') {
      forceQuitApp();
      return;
    }

    // 'ask' — show dialog
    dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['ย่อลง System Tray', 'ปิดโปรแกรม', 'ยกเลิก'],
      defaultId: 0,
      cancelId: 2,
      title: 'StreamOverlay Pro',
      message: 'ต้องการทำอะไรกับหน้าต่างนี้?',
      detail: 'ย่อลง Tray — OBS Overlay ยังทำงาน  |  ปิดโปรแกรม — หยุดทุกอย่าง',
    }).then(({ response }) => {
      if (response === 0) {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
      } else if (response === 1) {
        forceQuitApp();
      }
    }).catch(() => {});
  });
}

function forceQuitApp() {
  isQuitting = true;
  if (tray) {
    try {
      tray.destroy();
    } catch (e) {}
    tray = null;
  }
  app.exit(0);
}

function createTray() {
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    buffer[i * 4 + 0] = 124; // R
    buffer[i * 4 + 1] = 106; // G
    buffer[i * 4 + 2] = 232; // B
    buffer[i * 4 + 3] = 255; // A
  }

  const trayIcon = nativeImage.createFromBitmap(buffer, { width: size, height: size });

  tray = new Tray(trayIcon);
  tray.setToolTip('StreamOverlay Pro — OBS Chat & Alert Overlay System');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'StreamOverlay Pro',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'เปิดหน้าควบคุม (Open Dashboard)',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: 'คัดลอก URL Chat Overlay',
      click: () => {
        clipboard.writeText(`http://localhost:${config.port}/overlay/chat`);
      }
    },
    {
      label: 'คัดลอก URL Alert Overlay',
      click: () => {
        clipboard.writeText(`http://localhost:${config.port}/overlay/alert`);
      }
    },
    { type: 'separator' },
    {
      label: 'เปิดใน Web Browser',
      click: () => {
        shell.openExternal(`http://localhost:${config.port}`);
      }
    },
    { type: 'separator' },
    {
      label: 'ปิดโปรแกรม (Exit)',
      click: () => {
        forceQuitApp();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

// #31: window-all-closed does not support e.preventDefault() — empty listener keeps tray app alive
app.on('window-all-closed', () => {});
