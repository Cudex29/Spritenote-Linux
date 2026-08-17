'use strict';

const ReminderPolicy = require('../shared/reminder-policy');

function safeCharacterKey(value, fallback = 'clawd') {
  const clean = String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (clean || fallback).slice(0, 40);
}

function addCharacterNotificationMessage(state, entry) {
  if (!state || typeof state !== 'object') return null;
  const characterKey = safeCharacterKey(entry.characterKey || state.activeCharacter, 'clawd');
  const text = String(entry.text || entry.body || '').trim().slice(0, 1000);
  if (!text) return null;
  if (!state.characterMessages || typeof state.characterMessages !== 'object' || Array.isArray(state.characterMessages)) {
    state.characterMessages = {};
  }
  if (!Array.isArray(state.characterMessages[characterKey])) state.characterMessages[characterKey] = [];
  const id = String(entry.id || `notification:${Date.now()}`).slice(0, 140);
  const existing = state.characterMessages[characterKey].find(item => item.id === id);
  if (existing) return existing;
  const message = {
    id,
    role: 'model',
    text,
    kind: String(entry.kind || 'recordatorio').slice(0, 40),
    source: 'notification',
    createdAt: Number(entry.createdAt) > 0 ? Number(entry.createdAt) : Date.now(),
  };
  if (entry.reminderId) message.reminderId = String(entry.reminderId).slice(0, 80);
  if (entry.notificationKey) message.notificationKey = String(entry.notificationKey).slice(0, 100);
  state.characterMessages[characterKey].push(message);
  state.characterMessages[characterKey].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  while (state.characterMessages[characterKey].length > 200) state.characterMessages[characterKey].shift();
  return message;
}

class ReminderScheduler {
  constructor({ store, notify, onStateChange, intervalMs = 30000, now = () => Date.now() }) {
    this.store = store;
    this.notify = notify;
    this.onStateChange = typeof onStateChange === 'function' ? onStateChange : null;
    this.intervalMs = intervalMs;
    this.now = now;
    this.timer = null;
    this.running = false;
  }

  start() {
    if (this.timer) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  tick() {
    if (this.running) return;
    const state = this.store.load();
    const config = state?.notificationSettings;
    if (!state || !config?.desktopEnabled) return;
    // La ventana oculta se encarga de redactar y mostrar los avisos con IA.
    // El scheduler nativo permanece como ruta confiable para mensajes genéricos.
    if (config.aiPersonalized) return;

    this.running = true;
    try {
      const due = ReminderPolicy.dueNotifications(
        state.reminders,
        config.mode,
        this.now(),
        24 * 60 * 60 * 1000,
      );
      ReminderPolicy.latestDueNotifications(due).forEach(({ reminder, slot, key }) => {
        const body = ReminderPolicy.message(reminder, slot);
        const nextState = this.store.mutate(latest => {
          const target = latest.reminders?.find(item => item.id === reminder.id);
          if (!target) return;
          if (!target.notificationLog || typeof target.notificationLog !== 'object') target.notificationLog = {};
          due.filter(item => item.reminder.id === reminder.id)
            .forEach(item => { target.notificationLog[item.key] = this.now(); });
          addCharacterNotificationMessage(latest, {
            id: `notification:${reminder.id}:${key}`,
            characterKey: latest.activeCharacter || state.activeCharacter || 'clawd',
            text: body,
            kind: 'recordatorio',
            createdAt: this.now(),
            reminderId: reminder.id,
            notificationKey: key,
          });
        });
        if (nextState) this.onStateChange?.(nextState);
        this.notify({
          kind: 'recordatorio',
          characterKey: state.activeCharacter || 'clawd',
          body,
          reminderId: reminder.id,
          urgent: config.mode === 'extreme' && slot.stage !== 'before',
        });
      });
    } finally {
      this.running = false;
    }
  }
}

module.exports = { ReminderScheduler, addCharacterNotificationMessage };
