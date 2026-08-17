'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Linux audio IPC is registered before the main window is created', () => {
  const main = read('electron/main.js');
  const ready = main.slice(main.indexOf("app.whenReady().then"));
  const register = ready.indexOf("if (process.platform === 'linux') registerLinuxAudioIpc();");
  const create = ready.indexOf('createWindow({ show: !startInBackground })');
  assert.ok(register >= 0, 'registerLinuxAudioIpc() must be called on Linux');
  assert.ok(create >= 0, 'main window creation should exist');
  assert.ok(register < create, 'audio IPC must be registered before renderer startup');
});

test('preload exposes Linux audio loopback bridge', () => {
  const preload = read('electron/preload.js');
  for (const channel of [
    "audio-loopback:capabilities",
    "audio-loopback:start",
    "audio-loopback:stop",
    "audio-loopback:frame",
    "audio-loopback:ended",
  ]) assert.match(preload, new RegExp(channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('compact clock view contains ambient spectrum canvas and audio control', () => {
  const html = read('src/index.html');
  const css = read('src/css/sprite.css');
  const app = read('src/js/app.js');
  assert.match(html, /id="cp-music-spectrum-canvas"/);
  assert.match(html, /id="cp-music-viz-toggle"/);
  assert.match(css, /\.cp-ambient-viz\s*\{/);
  assert.match(app, /this\._musicCompactCanvas\s*=\s*compactCanvas/);
  assert.match(app, /draw\(this\._musicCompactCanvas, true\)/);
});

test('Linux package metadata keeps desktop integration and blocks unused Windows install script', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.desktopName, 'SpriteNote');
  assert.equal(pkg.allowScripts?.['electron-winstaller'], false);
  assert.equal(pkg.version, '1.8.11');
});

test('stale planning and Chromium documentation was removed from the Linux port', () => {
  for (const file of [
    'BACKGROUND_EXECUTION_PLAN.md',
    'GOOGLE_CALENDAR_PLAN.md',
    'LINUX_PORT.md',
    'tutorial_chromium.md',
  ]) assert.equal(fs.existsSync(path.join(root, file)), false, `${file} should be removed`);
  assert.equal(fs.existsSync(path.join(root, 'README.md')), true);
});


test('visualizer exposes frequency distributions and retro render styles', () => {
  const html = read('src/index.html');
  const app = read('src/js/app.js');
  for (const layout of ['linear', 'bass-center', 'bass-edges']) {
    assert.match(html, new RegExp(`data-layout="${layout}"`));
    assert.match(app, new RegExp(layout));
  }
  for (const style of ['spectrum', 'digital', 'analog']) {
    assert.match(html, new RegExp(`data-style="${style}"`));
    assert.match(app, new RegExp(style));
  }
  assert.match(app, /POWER LEVEL/);
});

test('Linux loopback uses low-latency capture and roughly 60 Hz delivery', () => {
  const audio = read('electron/linux-audio.js');
  assert.match(audio, /FRAME_INTERVAL_MS\s*=\s*16/);
  assert.match(audio, /--latency-msec=16/);
  const app = read('src/js/app.js');
  assert.match(app, /incoming >= data\[i\]/);
});

test('installer fixes PATH persistence and desktop launcher integration', () => {
  const installer = read('install.sh');
  assert.match(installer, /ensure_user_bin_path/);
  assert.match(installer, /\.bashrc/);
  assert.match(installer, /\.zshrc/);
  assert.match(installer, /fish\/conf\.d/);
  assert.match(installer, /com\.spritenote\.app\.desktop/);
  assert.match(installer, /update-desktop-database/);
  assert.match(installer, /pkill -x hyprlauncher/);
});

test('compact clock is container-responsive and keeps interaction controls in the centered safe-zone', () => {
  const html = read('src/index.html');
  const css = read('src/css/sprite.css');
  assert.match(html, /class="cp-bottom-stack"/);
  assert.match(html, /class="cp-bottom-stack"[\s\S]*?class="cp-hero-row"[\s\S]*?class="cp-input-wrap"[\s\S]*?class="cp-statusbar"/);
  assert.match(css, /container-type:\s*size/);
  assert.match(css, /Compact responsive v5 — centered safe-zone/);
  assert.match(css, /#compact:not\(\.cp-chatting\) \.cp-bottom-stack \{[\s\S]*?align-self:\s*center\s*!important/);
  assert.match(css, /@container \(max-height: 450px\)/);
  assert.match(css, /\.cp-input-wrap \{[\s\S]*?min-height:\s*38px;[\s\S]*?z-index:\s*8/);
  assert.match(css, /@container \(max-height: 360px\)[\s\S]*?\.cp-welcome,[\s\S]*?\.cp-mood \{ display: none; \}/);
  assert.match(css, /#compact:not\(\.cp-chatting\) \.cp-ambient-viz \{ opacity: \.90; \}/);
});


test('compact viewport tracks late Hyprland tile bounds without requiring a float-resize', () => {
  const css = read('src/css/sprite.css');
  const app = read('src/js/app.js');
  assert.match(css, /Compact responsive v4 — Hyprland\/Wayland tile-safe/);
  assert.match(css, /#compact \{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;[\s\S]*?height:\s*auto;/);
  assert.match(css, /#compact:not\(\.cp-chatting\) \.cp-bottom-stack \{[\s\S]*?height:\s*auto\s*!important;[\s\S]*?grid-template-rows:\s*auto auto auto auto\s*!important/);
  assert.match(app, /_compactViewportSize\(\)/);
  assert.match(app, /document\.documentElement/);
  assert.match(app, /new ResizeObserver\(apply\)/);
  assert.match(app, /window\.visualViewport\?\.addEventListener\('resize', apply/);
  assert.match(app, /\[40, 120, 280, 650, 1200\]\.forEach/);
  assert.match(app, /cp-vh-tight/);
  assert.match(app, /cp-vh-short/);
});

test('hardened Linux package uses patched Electron/builder and installer avoids force audit fixes', () => {
  const pkg = JSON.parse(read('package.json'));
  const installer = read('install.sh');
  assert.equal(pkg.devDependencies.electron, '42.9.1');
  assert.equal(pkg.devDependencies['electron-builder'], '26.15.7');
  assert.equal(pkg.overrides['fast-uri'], '3.1.4');
  assert.equal(pkg.overrides['js-yaml'], '4.3.1');
  assert.match(installer, /npm audit fix --no-fund/);
  assert.doesNotMatch(installer, /npm audit fix --force/);
  assert.match(installer, /npm test/);
  // npm install/audit fix genera package-lock.json localmente antes de correr esta suite.
  // No confundimos ese lockfile generado con uno viejo incluido en el ZIP: si existe,
  // validamos que use el registry público y que las dependencias críticas estén parcheadas.
  const lockPath = path.join(root, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    const lockText = fs.readFileSync(lockPath, 'utf8');
    assert.doesNotMatch(lockText, /applied-caas-gateway|packages\.applied-caas-gateway/, 'local lockfile must not reference the internal build registry');
    const lock = JSON.parse(lockText);
    const packages = lock.packages || {};
    if (packages['node_modules/electron']) {
      assert.equal(packages['node_modules/electron'].version, '42.9.1');
    }
    if (packages['node_modules/electron-builder']) {
      assert.equal(packages['node_modules/electron-builder'].version, '26.15.7');
    }
    if (packages['node_modules/fast-uri']) {
      assert.equal(packages['node_modules/fast-uri'].version, '3.1.4');
    }
    if (packages['node_modules/js-yaml']) {
      assert.equal(packages['node_modules/js-yaml'].version, '4.3.1');
    }
  }
});


test('compact clock layout keeps hero, prompt and status in a centered intrinsic safe-zone', () => {
  const css = read('src/css/sprite.css');
  assert.match(css, /Compact responsive v5 — centered safe-zone/);
  assert.match(css, /#compact:not\(\.cp-chatting\) \.cp-bottom-stack \{[\s\S]*?align-self:\s*center\s*!important;[\s\S]*?height:\s*auto\s*!important;[\s\S]*?grid-template-rows:\s*auto auto auto auto\s*!important/);
  assert.match(css, /#compact:not\(\.cp-chatting\) \.cp-hero-row \{[\s\S]*?height:\s*auto\s*!important;[\s\S]*?align-items:\s*center\s*!important/);
  assert.doesNotMatch(css.slice(css.lastIndexOf('Compact responsive v5')), /align-self:\s*end/);
});
