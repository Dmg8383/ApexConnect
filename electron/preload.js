/**
 * Electron Preload Script — ApexConnect Desktop
 *
 * Runs in renderer context with Node.js access BEFORE the page loads.
 * contextIsolation: true means the renderer cannot access Node/Electron APIs
 * directly — only what we explicitly expose here via contextBridge.
 *
 * We intentionally expose NOTHING — the web app is self-contained.
 * This is the most secure configuration.
 */

const { contextBridge } = require('electron');

// Expose a minimal, read-only API so the web app knows it's running in Electron
contextBridge.exposeInMainWorld('__apexElectron', {
  isElectron: true,
  platform: process.platform, // 'win32' | 'darwin' | 'linux'
  version: process.env.npm_package_version || '1.0.0',
});
