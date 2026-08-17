(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.REMINDER_PROFILES = api.REMINDER_PROFILES;
    root.ReminderPolicy = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MINUTE = 60000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  const REMINDER_PROFILES = {
    basic: [
      { key: 'due', offset: 0, stage: 'due' },
    ],
    intermediate: [
      { key: '2d', offset: -2 * DAY, stage: 'before' },
      { key: '1d', offset: -DAY, stage: 'before' },
      { key: '2h', offset: -2 * HOUR, stage: 'before' },
      { key: 'due', offset: 0, stage: 'due' },
      { key: 'after3h', offset: 3 * HOUR, stage: 'after' },
    ],
    extreme: [
      { key: '2d', offset: -2 * DAY, stage: 'before' },
      { key: '1d', offset: -DAY, stage: 'before' },
      { key: '12h', offset: -12 * HOUR, stage: 'before' },
      { key: '6h', offset: -6 * HOUR, stage: 'before' },
      { key: '3h', offset: -3 * HOUR, stage: 'before' },
      { key: '1h', offset: -HOUR, stage: 'before' },
      { key: '30m', offset: -30 * MINUTE, stage: 'before' },
      { key: 'due', offset: 0, stage: 'due' },
      { key: 'after1h', offset: HOUR, stage: 'after' },
      { key: 'after2h', offset: 2 * HOUR, stage: 'after' },
      { key: 'after4h', offset: 4 * HOUR, stage: 'after' },
      { key: 'after8h', offset: 8 * HOUR, stage: 'after' },
    ],
  };

  function profile(mode) {
    return REMINDER_PROFILES[mode] || REMINDER_PROFILES.basic;
  }

  function notificationKey(mode, slot) {
    return `${mode}:${slot.key}`;
  }

  function dueNotifications(reminders, mode, now = Date.now(), catchupMs = 10 * MINUTE) {
    const due = [];
    (Array.isArray(reminders) ? reminders : []).filter(r => r && !r.done).forEach(reminder => {
      const dueMs = new Date(reminder.dueAt).getTime();
      if (!Number.isFinite(dueMs)) return;
      profile(mode).forEach(slot => {
        const key = notificationKey(mode, slot);
        if (reminder.notificationLog && reminder.notificationLog[key]) return;
        const scheduledAt = dueMs + slot.offset;
        if (now >= scheduledAt && now - scheduledAt <= catchupMs) {
          due.push({ reminder, slot, key, scheduledAt });
        }
      });
    });
    return due;
  }

  function latestDueNotifications(due) {
    const latest = new Map();
    (Array.isArray(due) ? due : []).forEach(item => {
      const id = item?.reminder?.id;
      if (!id) return;
      const current = latest.get(id);
      if (!current || item.scheduledAt > current.scheduledAt) latest.set(id, item);
    });
    return Array.from(latest.values());
  }

  function message(reminder, slot) {
    const distance = Math.abs(slot.offset);
    const amount = distance >= DAY
      ? `${Math.round(distance / DAY)} día${distance >= 2 * DAY ? 's' : ''}`
      : distance >= HOUR
        ? `${Math.round(distance / HOUR)} hora${distance >= 2 * HOUR ? 's' : ''}`
        : `${Math.round(distance / MINUTE)} minutos`;
    if (slot.stage === 'before') return `${reminder.title} vence en ${amount}.`;
    if (slot.stage === 'after') return `¿Ya terminaste ${reminder.title}? Venció hace ${amount}.`;
    return `Es hora: ${reminder.title} vence ahora.`;
  }

  return { REMINDER_PROFILES, profile, notificationKey, dueNotifications, latestDueNotifications, message };
});
