/**
 * Electron Main Process — ApexConnect Desktop
 * setContentProtection(true) = GPU secure surface (screenshots → black)
 */

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const http = require('http');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const EXPO_URL = 'http://localhost:8081';
const RETRY_INTERVAL_MS = 1500;
const MAX_RETRIES = 30; // wait up to ~45 seconds for Expo to start

// ── Security: block external navigation ──────────────────────────────────────
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    const allowed = [EXPO_URL, 'http://localhost:3002', 'file://'];
    if (!allowed.some((a) => url.startsWith(a))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

// ── Check if Expo dev server is ready ────────────────────────────────────────
function isExpoReady() {
  return new Promise((resolve) => {
    const req = http.get(EXPO_URL, (res) => {
      resolve(res.statusCode < 500);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

// ── Wait for Expo server, then load ──────────────────────────────────────────
async function waitForExpoAndLoad(win) {
  let retries = 0;
  while (retries < MAX_RETRIES) {
    const ready = await isExpoReady();
    if (ready) {
      win.loadURL(EXPO_URL);
      return;
    }
    retries++;
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
    // Update loading page message
    try {
      win.webContents.executeJavaScript(
        `document.getElementById('status') && (document.getElementById('status').textContent = 'Connecting... (${retries}/${MAX_RETRIES})')`
      );
    } catch (_) {}
  }
  // If expo never started, show error
  win.loadURL(`data:text/html,<body style="background:#111;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px"><h2>⚠️ Could not connect to Expo server</h2><p style="opacity:.5">Make sure <code>npm run dev</code> is running in the project root</p></body>`);
}

// ── Loading splash shown while waiting for Expo ───────────────────────────────
const LOADING_HTML = `data:text/html;charset=utf-8,<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0f1a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: white;
      gap: 20px;
    }
    .logo {
      width: 64px; height: 64px;
      background: linear-gradient(135deg, #25D366, #128C7E);
      border-radius: 18px;
      display: flex; align-items: center; justify-content: center;
      font-size: 32px;
    }
    h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #25D366;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #status { font-size: 13px; opacity: 0.4; }
  </style>
</head>
<body>
  <div class="logo">💬</div>
  <h1>ApexConnect</h1>
  <div class="spinner"></div>
  <p id="status">Starting server...</p>
</body>
</html>`;

// ── Create window ─────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'ApexConnect',
    icon: path.join(__dirname, '../assets/images/icon.png'),
    backgroundColor: '#0a0f1a',
    // show immediately with splash — don't use ready-to-show (it won't fire
    // if the page fails to load, leaving window stuck invisible)
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: isDev,
    },
  });

  // ── OS-level screenshot/recording prevention ───────────────────────────────
  // Windows: WDA_EXCLUDEFROMCAPTURE — GPU compositor secure buffer
  // macOS:   NSWindowSharingNone — Quartz compositor secure layer
  // Effect: Snipping Tool, PrtSc, OBS, Xbox Game Bar all capture BLACK
  win.setContentProtection(true);

  // Disable default menu in production (removes Ctrl+Shift+I shortcut)
  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  // Keep title fixed
  win.on('page-title-updated', (e) => e.preventDefault());

  if (isDev) {
    // Show splash while Expo server warms up, then load the real app
    win.loadURL(LOADING_HTML);
    waitForExpoAndLoad(win);
  } else {
    // Production: load static web export
    win.loadFile(path.join(__dirname, '../dist-web/index.html'));
  }

  // Reload if page fails after initial load (e.g., hot reload disconnect)
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, url) => {
    if (url === EXPO_URL || url?.startsWith(EXPO_URL)) {
      console.log(`[Electron] Page failed to load (${errorCode}), retrying in 2s...`);
      setTimeout(() => win.loadURL(EXPO_URL), 2000);
    }
  });

  return win;
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
