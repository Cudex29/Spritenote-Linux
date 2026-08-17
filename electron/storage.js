'use strict';

const fs = require('node:fs');
const path = require('node:path');

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeCharacterMessages(value) {
  if (!isObject(value)) return {};
  const normalized = {};
  Object.entries(value).forEach(([key, list]) => {
    if (!Array.isArray(list)) return;
    normalized[key] = list.filter(item => isObject(item) && item.id && item.text);
  });
  return normalized;
}

function mergeCharacterMessages(current, incoming) {
  const merged = normalizeCharacterMessages(incoming.characterMessages);
  const currentMessages = normalizeCharacterMessages(current.characterMessages);
  Object.entries(currentMessages).forEach(([key, list]) => {
    if (!Array.isArray(merged[key])) merged[key] = [];
    const seen = new Set(merged[key].map(item => item.id));
    list.forEach(item => {
      if (seen.has(item.id)) return;
      merged[key].push(item);
      seen.add(item.id);
    });
  });
  Object.keys(merged).forEach(key => {
    merged[key].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    while (merged[key].length > 200) merged[key].shift();
  });
  incoming.characterMessages = merged;
  return incoming;
}

function mergeNotificationLogs(current, incoming) {
  if (!isObject(current) || !isObject(incoming)) return incoming;
  const currentById = new Map((current.reminders || []).map(item => [item.id, item]));
  if (Array.isArray(incoming.reminders)) {
    incoming.reminders.forEach(reminder => {
      const saved = currentById.get(reminder.id);
      if (!saved) return;
      reminder.notificationLog = {
        ...(isObject(reminder.notificationLog) ? reminder.notificationLog : {}),
        ...(isObject(saved.notificationLog) ? saved.notificationLog : {}),
      };
    });
  }
  return mergeCharacterMessages(current, incoming);
}

class NativeStore {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'spritenote-data-v2.json');
    this.backup = `${this.file}.bak`;
    this.state = null;
  }

  load() {
    if (this.state) return structuredClone(this.state);
    try {
      const source = fs.existsSync(this.file) ? this.file : this.backup;
      const parsed = JSON.parse(fs.readFileSync(source, 'utf8'));
      this.state = isObject(parsed) ? parsed : null;
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('[storage] No se pudo leer el estado:', error.message);
      this.state = null;
    }
    return this.state ? structuredClone(this.state) : null;
  }

  save(nextState) {
    if (!isObject(nextState)) throw new TypeError('El estado de SpriteNote debe ser un objeto');
    const next = mergeNotificationLogs(this.state, structuredClone(nextState));
    fs.mkdirSync(this.directory, { recursive: true });
    const temporary = `${this.file}.tmp`;
    const serialized = `${JSON.stringify(next, null, 2)}\n`;
    const descriptor = fs.openSync(temporary, 'w');
    try {
      fs.writeFileSync(descriptor, serialized, 'utf8');
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    if (process.platform === 'win32' && fs.existsSync(this.file)) {
      if (fs.existsSync(this.backup)) fs.unlinkSync(this.backup);
      fs.renameSync(this.file, this.backup);
      try {
        fs.renameSync(temporary, this.file);
        fs.unlinkSync(this.backup);
      } catch (error) {
        if (!fs.existsSync(this.file) && fs.existsSync(this.backup)) fs.renameSync(this.backup, this.file);
        throw error;
      }
    } else {
      fs.renameSync(temporary, this.file);
    }
    this.state = next;
    return structuredClone(this.state);
  }

  mutate(mutator) {
    const state = this.load();
    if (!state) return null;
    mutator(state);
    return this.save(state);
  }
}

module.exports = { NativeStore, mergeNotificationLogs, mergeCharacterMessages };
