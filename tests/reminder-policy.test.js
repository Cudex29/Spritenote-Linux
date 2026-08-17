'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ReminderPolicy = require('../shared/reminder-policy');

test('cada modo expone la intensidad prevista', () => {
  assert.equal(ReminderPolicy.profile('basic').length, 1);
  assert.equal(ReminderPolicy.profile('intermediate').length, 5);
  assert.equal(ReminderPolicy.profile('extreme').length, 12);
});

test('no vuelve a programar una notificación registrada', () => {
  const now = Date.now();
  const reminder = { id: 'r1', title: 'Entregar reporte', dueAt: new Date(now).toISOString(), notificationLog: {} };
  const [due] = ReminderPolicy.dueNotifications([reminder], 'basic', now);
  assert.equal(due.key, 'basic:due');
  reminder.notificationLog[due.key] = now;
  assert.deepEqual(ReminderPolicy.dueNotifications([reminder], 'basic', now), []);
});

test('colapsa avisos atrasados al más reciente de cada recordatorio', () => {
  const due = [
    { reminder: { id: 'r1' }, key: 'old', scheduledAt: 10 },
    { reminder: { id: 'r1' }, key: 'latest', scheduledAt: 20 },
    { reminder: { id: 'r2' }, key: 'other', scheduledAt: 15 },
  ];
  assert.deepEqual(
    ReminderPolicy.latestDueNotifications(due).map(item => item.key),
    ['latest', 'other'],
  );
});
