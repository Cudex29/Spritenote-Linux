'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { NativeStore } = require('../electron/storage');

test('guarda y recupera el estado nativo', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spritenote-store-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = new NativeStore(directory);
  store.save({ reminders: [], notificationSettings: { mode: 'basic' } });
  const loaded = new NativeStore(directory).load();
  assert.equal(loaded.notificationSettings.mode, 'basic');
});

test('conserva logs creados por el planificador ante escrituras atrasadas', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spritenote-store-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = new NativeStore(directory);
  store.save({ reminders: [{ id: 'r1', notificationLog: {} }] });
  store.mutate(state => { state.reminders[0].notificationLog['basic:due'] = 123; });
  store.save({ reminders: [{ id: 'r1', notificationLog: {} }] });
  assert.equal(store.load().reminders[0].notificationLog['basic:due'], 123);
});

test('conserva mensajes de personaje creados por notificaciones ante escrituras atrasadas', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spritenote-store-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = new NativeStore(directory);
  store.save({ characterMessages: { femme: [{ id: 'm1', role: 'model', text: 'No olvides estudiar.', createdAt: 100 }] } });
  store.save({ characterMessages: {} });
  assert.equal(store.load().characterMessages.femme[0].text, 'No olvides estudiar.');
});
