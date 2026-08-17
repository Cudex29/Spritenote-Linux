'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const AiIntent = require('../shared/ai-intent');

test('detecta escrituras locales y limita las herramientas posibles', () => {
  assert.deepEqual(AiIntent.mutationTools('Agrega una tarea para entregar el reporte'), ['agregar_tarea']);
  assert.deepEqual(AiIntent.mutationTools('Recuérdame tomar agua mañana'), ['agregar_recordatorio']);
  assert.deepEqual(AiIntent.mutationTools('Guarda esto en una nota'), ['agregar_nota']);
});

test('tarea diaria sigue siendo una tarea y no se convierte en hábito', () => {
  assert.deepEqual(AiIntent.mutationTools('Agrega como tarea diaria bajar la ropa'), ['agregar_tarea']);
  assert.deepEqual(
    AiIntent.mutationTools('Agrega como tarea y recordatorio bajar ropa en 40 minutos'),
    ['agregar_tarea', 'agregar_recordatorio'],
  );
  assert.deepEqual(
    AiIntent.mutationTools('Agrega como tarea diaria y recordatorio bajar ropa para dentro de 40 minutos'),
    ['agregar_tarea', 'agregar_recordatorio'],
  );
});

test('detecta solicitudes ambiguas o recurrencia no soportada', () => {
  const missingType = AiIntent.analyze('Agrega comprar leche para mañana');
  assert.equal(missingType.ambiguous, true);
  assert.match(missingType.question, /tarea.*recordatorio.*nota/i);

  const recurring = AiIntent.analyze('Crea una tarea que se repita todos los días');
  assert.equal(recurring.ambiguous, true);
  assert.match(recurring.question, /tarea normal.*hábito/i);

  const reminderWithoutTime = AiIntent.analyze('Recuérdame comprar leche mañana');
  assert.equal(reminderWithoutTime.ambiguous, true);
  assert.match(reminderWithoutTime.question, /fecha y hora/i);
  assert.deepEqual(AiIntent.clarificationTools('como una tarea normal'), ['agregar_tarea']);
});

test('no fuerza herramientas durante conversación normal', () => {
  assert.deepEqual(AiIntent.mutationTools('¿Cómo puedo organizar mejor mi semana?'), []);
});
