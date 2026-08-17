'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  powerMonitor,
  session,
  shell,
  Tray,
} = require('electron');
const { NativeStore } = require('./storage');
const { ReminderScheduler } = require('./scheduler');
const { LinuxAudioLoopback } = require('./linux-audio');

const APP_ID = 'com.spritenote.app';
const startInBackground = process.argv.includes('--background');
let mainWindow = null;
let tray = null;
let store = null;
let scheduler = null;
let linuxAudio = null;
let isQuitting = false;
let closeHintShown = false;

if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

function backgroundEnabled() {
  return Boolean(store?.load()?.notificationSettings?.backgroundEnabled);
}

function systemInfo() {
  const cpus = os.cpus();
  return {
    user: os.userInfo().username,
    hostname: os.hostname(),
    os: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    cpu: cpus[0]?.model || `${cpus.length} cores`,
    ram: `${(os.totalmem() / 1073741824).toFixed(1)} GB`,
    uptimeAtLaunch: os.uptime(),
    capturedAt: Date.now(),
  };
}

function iconPath(extension = process.platform === 'win32' ? 'ico' : 'png') {
  return path.join(__dirname, '..', 'build', `icon.${extension}`);
}

const BUILTIN_NOTIFICATION_CHARACTERS = Object.freeze({
  clawd: {
    key: 'clawd', label: "Claw'd",
    avatar: 'assets/clawd-avatar.png', idle: 'assets/clawd-laptop.gif',
  },
  femme: {
    key: 'femme', label: 'Femme Soule',
    avatar: 'assets/femme-soule/avatar.png', idle: 'assets/femme-soule/idle_transparent.gif',
  },
});

function loadRenderer(window) {
  const hash = `sysinfo=${encodeURIComponent(JSON.stringify(systemInfo()))}`;
  return window.loadFile(path.join(__dirname, '..', 'src', 'index.html'), { hash });
}

function createWindow({ show = true } = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 820,
    minHeight: 620,
    show: false,
    backgroundColor: '#090d0b',
    icon: iconPath(),
    title: 'SpriteNote',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // SpriteNote uses its own in-app UI, so the native Electron menu bar
  // (File / Edit / View / Window) is intentionally hidden.
  mainWindow.removeMenu();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:')) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => { if (show) mainWindow.show(); });
  mainWindow.on('close', event => {
    if (!isQuitting && backgroundEnabled()) {
      event.preventDefault();
      mainWindow.hide();
      if (!closeHintShown) {
        closeHintShown = true;
        notify({ title: 'SpriteNote sigue activo', body: 'Los recordatorios continúan en la bandeja del sistema.' });
      }
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  loadRenderer(mainWindow);
  return mainWindow;
}

function showWindow(reminderId = null) {
  const window = createWindow({ show: true });
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  if (reminderId) {
    const send = () => window.webContents.send('navigate:reminder', reminderId);
    if (window.webContents.isLoading()) window.webContents.once('did-finish-load', send);
    else send();
  }
  const sync = () => window.webContents.send('store:runtime-update', store.load());
  if (window.webContents.isLoading()) window.webContents.once('did-finish-load', sync);
  else sync();
}

function updateTray() {
  if (!backgroundEnabled()) {
    tray?.destroy();
    tray = null;
    return;
  }
  if (!tray) {
    tray = new Tray(nativeImage.createFromPath(iconPath()));
    tray.setToolTip('SpriteNote');
    tray.on('click', () => showWindow());
  }
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir SpriteNote', click: () => showWindow() },
    {
      label: 'Avisos activos',
      type: 'checkbox',
      checked: Boolean(store.load()?.notificationSettings?.desktopEnabled),
      click: item => {
        const next = store.mutate(state => {
          if (!state.notificationSettings) state.notificationSettings = {};
          state.notificationSettings.desktopEnabled = item.checked;
        });
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('store:runtime-update', next);
        updateTray();
      },
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));
}

function quoteDesktopEntry(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function configureAutostart(enabled) {
  if (!app.isPackaged) return { supported: true, registered: false, development: true };
  if (process.platform === 'win32' || process.platform === 'darwin') {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: enabled,
      name: 'SpriteNote',
      args: enabled ? ['--background'] : [],
    });
    return { supported: true, registered: enabled };
  }
  if (process.platform === 'linux') {
    const directory = path.join(app.getPath('home'), '.config', 'autostart');
    const file = path.join(directory, 'spritenote.desktop');
    if (enabled) {
      fs.mkdirSync(directory, { recursive: true });
      const executable = process.env.APPIMAGE || process.execPath;
      fs.writeFileSync(file, [
        '[Desktop Entry]',
        'Type=Application',
        'Name=SpriteNote',
        `Exec=${quoteDesktopEntry(executable)} --background`,
        'Terminal=false',
        'X-GNOME-Autostart-enabled=true',
        '',
      ].join('\n'));
    } else if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    return { supported: true, registered: enabled };
  }
  return { supported: false, registered: false };
}

function readableAssetPath(url) {
  if (!url || typeof url !== 'string' || url.startsWith('data:')) return null;
  let filePath = null;
  const clean = url.split('?')[0];
  const characterRoot = path.join(app.getPath('userData'), 'spritenote', 'characters');
  const sourceRoot = path.join(__dirname, '..', 'src');
  const buildRoot = path.join(__dirname, '..', 'build');
  try {
    if (clean.startsWith('file:')) {
      filePath = fileURLToPath(clean);
      if (!isPathInside(filePath, characterRoot)) return null;
    } else {
      filePath = path.join(sourceRoot, clean.replace(/^\/+/, ''));
      if (!isPathInside(filePath, sourceRoot)) return null;
    }
    if (!fs.existsSync(filePath)) return null;
    const ext = path.extname(filePath).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico'].includes(ext)) return null;
    return filePath;
  } catch (_) {
    return null;
  }
}

function currentNotificationCharacter(overrides = {}) {
  const state = store?.load?.() || {};
  const key = safeCharacterSegment(overrides.characterKey || state.activeCharacter || 'clawd', 'clawd');
  const stored = state.customCharacters?.[key] || null;
  const builtin = BUILTIN_NOTIFICATION_CHARACTERS[key] || null;
  const profile = { ...(builtin || {}), ...(stored || {}) };
  const label = String(overrides.characterLabel || profile.label || profile.display || key || 'SpriteNote').trim().slice(0, 40);
  const avatar = overrides.characterAvatar || profile.avatar || profile.idle || profile.assets?.idle || builtin?.avatar || builtin?.idle || null;
  return { key, label, avatar };
}

function characterNotificationTitle(character, kind) {
  const suffix = kind ? ` · ${String(kind).trim().slice(0, 28)}` : '';
  return `${character.label || 'SpriteNote'} - SpriteNote${suffix}`;
}

function notify({ title, body, reminderId, kind = '', characterKey = '', characterLabel = '', characterAvatar = '', urgent = false } = {}) {
  if (!Notification.isSupported()) return false;
  const character = kind ? currentNotificationCharacter({ characterKey, characterLabel, characterAvatar }) : null;
  const notificationTitle = character ? characterNotificationTitle(character, kind) : String(title || 'SpriteNote').slice(0, 100);
  const icon = character ? (readableAssetPath(character.avatar) || iconPath()) : iconPath();
  const options = { title: notificationTitle, body, icon };
  if (urgent && process.platform === 'linux') options.urgency = 'critical';
  const notification = new Notification(options);
  notification.on('click', () => showWindow(reminderId));
  notification.show();
  return true;
}

const CHARACTER_STATES = new Set(['idle', 'idle2', 'idle3', 'coffee', 'heart', 'shy', 'sleep', 'celebrate', 'idea', 'confused', 'workout', 'dizzy', 'jump', 'phone']);
const MAX_CHARACTER_ASSET = 20 * 1024 * 1024;
const MAX_CHARACTER_AVATAR = 5 * 1024 * 1024;

function safeCharacterSegment(value, fallback = '') {
  const clean = String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return (clean || fallback).slice(0, 40);
}

function characterDirectory(key) {
  return path.join(app.getPath('userData'), 'spritenote', 'characters', safeCharacterSegment(key, 'character'));
}

function isPathInside(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isGif(buffer) {
  return buffer?.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
}

function saveCharacterGif(key, state, buffer) {
  if (!CHARACTER_STATES.has(state)) throw new Error('Reacción desconocida');
  if (!isGif(buffer)) throw new Error('El archivo no es un GIF válido');
  if (buffer.length > MAX_CHARACTER_ASSET) throw new Error('El GIF supera el límite de 20 MB');
  const directory = characterDirectory(key);
  fs.mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, `${state}.gif`);
  fs.writeFileSync(destination, buffer);
  return `${pathToFileURL(destination).href}?v=${Date.now()}`;
}

function detectAvatarExtension(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

function avatarMimeFromExtension(ext) {
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  return 'image/png';
}

function saveCharacterAvatar(key, buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Foto inválida');
  if (buffer.length > MAX_CHARACTER_AVATAR) throw new Error('La foto supera el límite de 5 MB');
  const ext = detectAvatarExtension(buffer);
  if (!ext) throw new Error('Usa una foto PNG, JPG o WebP válida');
  const directory = characterDirectory(key);
  fs.mkdirSync(directory, { recursive: true });
  for (const old of ['avatar.png', 'avatar.jpg', 'avatar.jpeg', 'avatar.webp']) {
    fs.rmSync(path.join(directory, old), { force: true });
  }
  const destination = path.join(directory, `avatar.${ext}`);
  fs.writeFileSync(destination, buffer);
  return `${pathToFileURL(destination).href}?v=${Date.now()}`;
}

function exportAvatarPayload(url) {
  const filePath = readableAssetPath(url);
  if (!filePath || !fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  const ext = detectAvatarExtension(buffer);
  if (!ext || buffer.length > MAX_CHARACTER_AVATAR) return null;
  return { mime: avatarMimeFromExtension(ext), ext, data: buffer.toString('base64') };
}

function registerCharacterIpc() {
  ipcMain.handle('characters:select-gif', async (_event, request = {}) => {
    const state = String(request.state || '');
    if (!CHARACTER_STATES.has(state)) return { ok: false, error: 'Reacción desconocida' };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: `Seleccionar GIF · ${state}`,
      properties: ['openFile'],
      filters: [{ name: 'GIF animado', extensions: ['gif'] }],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    try {
      const source = result.filePaths[0];
      const buffer = fs.readFileSync(source);
      return { ok: true, url: saveCharacterGif(request.key, state, buffer), name: path.basename(source), size: buffer.length };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('characters:select-avatar', async (_event, request = {}) => {
    const key = safeCharacterSegment(request.key);
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(key)) return { ok: false, error: 'ID de personaje inválido' };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleccionar foto de perfil',
      properties: ['openFile'],
      filters: [{ name: 'Imagen de perfil', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    try {
      const source = result.filePaths[0];
      const buffer = fs.readFileSync(source);
      return { ok: true, url: saveCharacterAvatar(key, buffer), name: path.basename(source), size: buffer.length };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('characters:remove-assets', async (_event, key) => {
    const directory = characterDirectory(key);
    fs.rmSync(directory, { recursive: true, force: true });
    return { ok: true };
  });

  ipcMain.handle('characters:import-package', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar personaje SpriteNote', properties: ['openFile'],
      filters: [{ name: 'Personaje SpriteNote', extensions: ['spritepet', 'json'] }],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    try {
      const source = result.filePaths[0];
      if (fs.statSync(source).size > 80 * 1024 * 1024) throw new Error('El paquete supera el límite de 80 MB');
      const pack = JSON.parse(fs.readFileSync(source, 'utf8'));
      if (pack.format !== 'spritenote-character' || !pack.profile || !pack.files) throw new Error('Paquete de personaje inválido');
      const key = safeCharacterSegment(pack.profile.key);
      if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(key)) throw new Error('El ID del personaje no es válido');
      const assets = {};
      for (const [state, encoded] of Object.entries(pack.files)) {
        if (!CHARACTER_STATES.has(state) || typeof encoded !== 'string') continue;
        assets[state] = saveCharacterGif(key, state, Buffer.from(encoded, 'base64'));
      }
      if (!assets.idle) throw new Error('El paquete no incluye la reacción idle obligatoria');
      let avatar = '';
      if (pack.avatar?.data && typeof pack.avatar.data === 'string') {
        avatar = saveCharacterAvatar(key, Buffer.from(pack.avatar.data, 'base64'));
      }
      return { ok: true, profile: { ...pack.profile, key, assets, avatar: avatar || pack.profile.avatar || '', custom: !BUILTIN_CHARACTER_KEYS.has(key) } };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('characters:export-package', async (_event, profile = {}) => {
    try {
      const key = safeCharacterSegment(profile.key);
      if (!key) throw new Error('Perfil inválido');
      const files = {};
      for (const [state, url] of Object.entries(profile.assets || {})) {
        if (!CHARACTER_STATES.has(state) || typeof url !== 'string') continue;
        let filePath;
        const characterRoot = path.join(app.getPath('userData'), 'spritenote', 'characters');
        const sourceRoot = path.join(__dirname, '..', 'src');
        if (url.startsWith('file:')) {
          filePath = fileURLToPath(url.split('?')[0]);
          if (!isPathInside(filePath, characterRoot)) continue;
        } else {
          filePath = path.join(sourceRoot, url.replace(/^\/+/, ''));
          if (!isPathInside(filePath, sourceRoot)) continue;
        }
        if (fs.existsSync(filePath)) {
          const buffer = fs.readFileSync(filePath);
          if (isGif(buffer)) files[state] = buffer.toString('base64');
        }
      }
      if (!files.idle) throw new Error('El personaje no tiene un GIF idle exportable');
      const avatar = exportAvatarPayload(profile.avatar);
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Exportar personaje', defaultPath: `${key}.spritepet`,
        filters: [{ name: 'Personaje SpriteNote', extensions: ['spritepet'] }],
      });
      if (result.canceled || !result.filePath) return { ok: false, canceled: true };
      const cleanProfile = { ...profile, assets: undefined, avatar: undefined, custom: true };
      fs.writeFileSync(result.filePath, JSON.stringify({ format: 'spritenote-character', version: 2, profile: cleanProfile, files, avatar }, null, 2));
      return { ok: true, path: result.filePath };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
}

const BUILTIN_CHARACTER_KEYS = new Set(['clawd', 'femme']);

function registerIpc() {
  ipcMain.on('store:load', event => { event.returnValue = store.load(); });
  ipcMain.on('store:save', (_event, data) => {
    try {
      store.save(data);
      updateTray();
    } catch (error) {
      console.error('[storage] No se pudo guardar:', error);
    }
  });
  ipcMain.on('background:get-state', event => {
    event.returnValue = {
      enabled: backgroundEnabled(),
      packaged: app.isPackaged,
      platform: process.platform,
    };
  });
  ipcMain.handle('background:set-enabled', (_event, enabled) => {
    store.mutate(state => {
      if (!state.notificationSettings) state.notificationSettings = {};
      state.notificationSettings.backgroundEnabled = enabled;
    });
    const registration = configureAutostart(enabled);
    updateTray();
    return { enabled, ...registration };
  });
  ipcMain.handle('notification:test', () => {
    const sent = notify({ kind: 'prueba', body: 'Las notificaciones nativas están listas.' });
    return { sent };
  });
  ipcMain.handle('notification:show', (event, payload = {}) => {
    const trustedFrame = mainWindow && event.sender === mainWindow.webContents;
    if (!trustedFrame) return { sent: false };
    const title = String(payload.title || 'SpriteNote · recordatorio').slice(0, 100);
    const body = String(payload.body || '').trim().slice(0, 500);
    const reminderId = String(payload.reminderId || '').slice(0, 80) || null;
    const kind = String(payload.kind || '').trim().slice(0, 28);
    const characterKey = String(payload.characterKey || '').trim().slice(0, 40);
    const characterLabel = String(payload.characterLabel || '').trim().slice(0, 40);
    const characterAvatar = String(payload.characterAvatar || '').trim().slice(0, 1000);
    const urgent = Boolean(payload.urgent);
    if (!body) return { sent: false };
    return { sent: notify({ title, body, reminderId, kind, characterKey, characterLabel, characterAvatar, urgent }) };
  });
}

function registerDisplayMediaHandler() {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    const trustedFrame = mainWindow && request.frame === mainWindow.webContents.mainFrame;
    if (process.platform !== 'win32' || !trustedFrame || !request.userGesture || !request.audioRequested) {
      callback({});
      return;
    }
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 },
      });
      if (!sources.length) callback({});
      else callback({ video: sources[0], audio: 'loopback' });
    } catch (error) {
      console.error('[audio] No se pudo iniciar loopback:', error);
      callback({});
    }
  });
}

function registerLinuxAudioIpc() {
  linuxAudio = new LinuxAudioLoopback((channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
  });

  ipcMain.handle('audio-loopback:capabilities', event => {
    const trustedFrame = mainWindow && event.sender === mainWindow.webContents;
    if (!trustedFrame) return { supported: false, reason: 'untrusted-frame' };
    return linuxAudio.capabilities();
  });

  ipcMain.handle('audio-loopback:start', async event => {
    const trustedFrame = mainWindow && event.sender === mainWindow.webContents;
    if (!trustedFrame) return { ok: false, reason: 'untrusted-frame' };
    return linuxAudio.start();
  });

  ipcMain.handle('audio-loopback:stop', event => {
    const trustedFrame = mainWindow && event.sender === mainWindow.webContents;
    if (!trustedFrame) return { ok: false, reason: 'untrusted-frame' };
    return linuxAudio.stop();
  });
}

if (hasLock) {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(() => {
  // Remove Electron's default application menu globally. The Menu import is
  // still used below for the system tray context menu.
  Menu.setApplicationMenu(null);

  store = new NativeStore(path.join(app.getPath('userData'), 'spritenote'));
  registerIpc();
  registerCharacterIpc();
  registerDisplayMediaHandler();
  if (process.platform === 'linux') registerLinuxAudioIpc();

  if (startInBackground && !backgroundEnabled()) {
    app.quit();
    return;
  }

  scheduler = new ReminderScheduler({
    store,
    notify,
    onStateChange: state => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('store:runtime-update', state);
    },
  });
  scheduler.start();
  powerMonitor.on('resume', () => scheduler.tick());

  if (backgroundEnabled()) configureAutostart(true);
  updateTray();
  const needsAiRenderer = Boolean(store.load()?.notificationSettings?.aiPersonalized);
  if (!startInBackground || needsAiRenderer) createWindow({ show: !startInBackground });
  });

  app.on('activate', () => showWindow());
  app.on('window-all-closed', () => {
    if (!backgroundEnabled()) app.quit();
  });
  app.on('before-quit', () => {
    isQuitting = true;
    scheduler?.stop();
    linuxAudio?.stop();
  });
}
