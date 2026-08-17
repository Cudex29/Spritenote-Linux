'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('spritenote', {
  isElectron: true,
  platform: process.platform,
  storage: {
    load: () => ipcRenderer.sendSync('store:load'),
    save: data => ipcRenderer.send('store:save', data),
  },
  background: {
    getState: () => ipcRenderer.sendSync('background:get-state'),
    setEnabled: enabled => ipcRenderer.invoke('background:set-enabled', Boolean(enabled)),
  },
  notifications: {
    test: () => ipcRenderer.invoke('notification:test'),
    show: payload => ipcRenderer.invoke('notification:show', payload),
  },
  audioLoopback: {
    capabilities: () => ipcRenderer.invoke('audio-loopback:capabilities'),
    start: () => ipcRenderer.invoke('audio-loopback:start'),
    stop: () => ipcRenderer.invoke('audio-loopback:stop'),
    onFrame: callback => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, frame) => callback(frame);
      ipcRenderer.on('audio-loopback:frame', listener);
      return () => ipcRenderer.removeListener('audio-loopback:frame', listener);
    },
    onEnded: callback => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('audio-loopback:ended', listener);
      return () => ipcRenderer.removeListener('audio-loopback:ended', listener);
    },
  },
  characters: {
    selectGif: request => ipcRenderer.invoke('characters:select-gif', request),
    selectAvatar: request => ipcRenderer.invoke('characters:select-avatar', request),
    importPackage: () => ipcRenderer.invoke('characters:import-package'),
    exportPackage: profile => ipcRenderer.invoke('characters:export-package', profile),
    removeAssets: key => ipcRenderer.invoke('characters:remove-assets', key),
  },
  onNavigateReminder: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, id) => callback(id);
    ipcRenderer.on('navigate:reminder', listener);
    return () => ipcRenderer.removeListener('navigate:reminder', listener);
  },
  onStoreUpdate: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('store:runtime-update', listener);
    return () => ipcRenderer.removeListener('store:runtime-update', listener);
  },
});
