'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { NativeStore } = require('../electron/storage');
const { ReminderScheduler } = require('../electron/scheduler');

test('notifica y registra una ocurrencia una sola vez', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spritenote-scheduler-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const now = Date.now();
  const store = new NativeStore(directory);
  store.save({
    reminders: [{ id: 'r1', title: 'Tomar agua', dueAt: new Date(now).toISOString(), done: false, notificationLog: {} }],
    notificationSettings: { mode: 'basic', desktopEnabled: true },
  });
  const notifications = [];
  const scheduler = new ReminderScheduler({ store, notify: item => notifications.push(item), now: () => now });
  scheduler.tick();
  scheduler.tick();
  assert.equal(notifications.length, 1);
  assert.equal(store.load().reminders[0].notificationLog['basic:due'], now);
});

test('tras una pausa larga envía sólo el slot más reciente', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spritenote-scheduler-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const now = Date.now();
  const store = new NativeStore(directory);
  store.save({
    reminders: [{ id: 'r1', title: 'Reunión', dueAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(), done: false, notificationLog: {} }],
    notificationSettings: { mode: 'extreme', desktopEnabled: true },
  });
  const notifications = [];
  new ReminderScheduler({ store, notify: item => notifications.push(item), now: () => now }).tick();
  assert.equal(notifications.length, 1);
  assert.match(notifications[0].body, /Venció hace 4 horas/);
  assert.ok(Object.keys(store.load().reminders[0].notificationLog).length > 1);
});

test('delega al renderer cuando la personalización con IA está activa', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spritenote-scheduler-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const now = Date.now();
  const store = new NativeStore(directory);
  store.save({
    reminders: [{ id: 'r1', title: 'Estudiar', dueAt: new Date(now).toISOString(), done: false, notificationLog: {} }],
    notificationSettings: { mode: 'basic', desktopEnabled: true, aiPersonalized: true },
  });
  const notifications = [];
  new ReminderScheduler({ store, notify: item => notifications.push(item), now: () => now }).tick();
  assert.equal(notifications.length, 0);
  assert.deepEqual(store.load().reminders[0].notificationLog, {});
});


test('envía identidad de personaje activo al notificador nativo', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spritenote-scheduler-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const now = Date.now();
  const store = new NativeStore(directory);
  store.save({
    activeCharacter: 'femme',
    reminders: [{ id: 'r1', title: 'Estudiar', dueAt: new Date(now).toISOString(), done: false, notificationLog: {} }],
    notificationSettings: { mode: 'basic', desktopEnabled: true },
  });
  const notifications = [];
  new ReminderScheduler({ store, notify: item => notifications.push(item), now: () => now }).tick();
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].kind, 'recordatorio');
  assert.equal(notifications[0].characterKey, 'femme');
});

test('guarda cada recordatorio enviado como mensaje del personaje', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spritenote-scheduler-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const now = Date.now();
  const store = new NativeStore(directory);
  store.save({
    activeCharacter: 'femme',
    reminders: [{ id: 'r1', title: 'Estudiar', dueAt: new Date(now).toISOString(), done: false, notificationLog: {} }],
    notificationSettings: { mode: 'basic', desktopEnabled: true },
  });
  const updates = [];
  new ReminderScheduler({ store, notify: () => {}, onStateChange: state => updates.push(state), now: () => now }).tick();
  const messages = store.load().characterMessages.femme;
  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, 'notification:r1:basic:due');
  assert.match(messages[0].text, /Estudiar/);
  assert.equal(updates.length, 1);
});
