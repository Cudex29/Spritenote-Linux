'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const AiIntent = require('../shared/ai-intent');

function loadGemini(store) {
  const window = { Store: store };
  const context = vm.createContext({
    window,
    console,
    fetch: async () => { throw new Error('fetch no esperado'); },
    localStorage: { getItem: () => null, setItem: () => {} },
    Date,
    Intl,
    URL,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'gemini.js'), 'utf8'), context);
  return window.Gemini;
}

function loadRuntime({ store, config, fetchImpl }) {
  const writes = [];
  const window = { Store: store, AiIntent, PETS: null, SysInfo: null };
  const context = vm.createContext({
    window,
    console,
    fetch: fetchImpl,
    localStorage: {
      getItem: () => config == null ? null : JSON.stringify(config),
      setItem: (_key, value) => writes.push(JSON.parse(value)),
    },
    Date,
    Intl,
    URL,
    escHtml: value => String(value),
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'gemini.js'), 'utf8'), context);
  return { ai: window.Gemini, writes };
}

test('las herramientas de IA verifican tareas y notas en el Store', () => {
  const tasks = [];
  const notes = [];
  const store = {
    tasks: {
      add(text, pri, dueAt) { const item = { id: 't1', text, pri, dueAt }; tasks.push(item); return item; },
      list() { return tasks; },
    },
    notes: {
      create(title) { const item = { id: 'n1', title, content: '', tag: '' }; notes.push(item); return item; },
      update(id, patch) { const item = notes.find(note => note.id === id); Object.assign(item, patch); return item; },
      get(id) { return notes.find(note => note.id === id); },
    },
  };
  const gemini = loadGemini(store);
  const task = gemini.executeLocalTool('agregar_tarea', { texto: 'Entregar reporte', prioridad: 'alta' });
  const note = gemini.executeLocalTool('agregar_nota', { titulo: 'Ideas', contenido: 'Primera idea' });
  assert.equal(task.ok, true);
  assert.equal(tasks[0].text, 'Entregar reporte');
  assert.equal(note.ok, true);
  assert.equal(notes[0].content, 'Primera idea');
});

test('migra la key y el modelo anteriores como configuración de Gemini', () => {
  const { ai, writes } = loadRuntime({
    store: {},
    config: { apiKey: 'legacy-key', model: 'gemini-2.5-flash' },
    fetchImpl: async () => { throw new Error('fetch no esperado'); },
  });
  assert.equal(ai.getProvider(), 'gemini');
  assert.equal(ai.hasKey('gemini'), true);
  assert.equal(ai.getConfig('gemini').model, 'gemini-2.5-flash');
  ai.setProvider('groq');
  assert.equal(writes.at(-1).keys.gemini, 'legacy-key');
  assert.equal('apiKey' in writes.at(-1), false);
});


test('Groq usa el catálogo 2026 y migra los modelos retirados', () => {
  const cases = [
    ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b'],
    ['qwen/qwen3-32b', 'qwen/qwen3.6-27b'],
    ['llama-3.1-8b-instant', 'openai/gpt-oss-20b'],
  ];
  for (const [legacy, expected] of cases) {
    const { ai, writes } = loadRuntime({
      store: {},
      config: { provider: 'groq', keys: { groq: 'gsk_test' }, models: { groq: legacy } },
      fetchImpl: async () => { throw new Error('fetch no esperado'); },
    });
    assert.equal(ai.getConfig('groq').model, expected);
    assert.equal(writes.at(-1).models.groq, expected);
  }

  const { ai } = loadRuntime({
    store: {},
    config: { provider: 'groq', keys: { groq: 'gsk_test' }, models: {} },
    fetchImpl: async () => { throw new Error('fetch no esperado'); },
  });
  assert.equal(ai.getConfig('groq').model, 'openai/gpt-oss-120b');
  assert.deepEqual(
    Array.from(ai.modelList('groq'), m => m.id),
    ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b'],
  );
  assert.equal(ai.resolveModel('medio', 'groq'), 'qwen/qwen3.6-27b');
  assert.equal(ai.resolveModel('instant', 'groq'), 'openai/gpt-oss-20b');
});

test('Groq ejecuta una mutación y confirma localmente con una sola solicitud', async () => {
  const tasks = [];
  const requests = [];
  const responses = [
    {
      ok: true,
      json: async () => ({ choices: [{ message: {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'agregar_tarea', arguments: '{"texto":"Comprar café","prioridad":"media"}' },
        }],
      } }] }),
    },
  ];
  const store = {
    tasks: {
      add(text, pri, dueAt) { const item = { id: 't1', text, pri, dueAt }; tasks.push(item); return item; },
      list() { return tasks; },
    },
  };
  const { ai } = loadRuntime({
    store,
    config: { provider: 'groq', keys: { groq: 'gsk_test' }, models: {} },
    fetchImpl: async (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body) });
      return responses.shift();
    },
  });

  const result = await ai.ask('Agrega una tarea para comprar café con prioridad media');
  assert.equal(tasks[0].pri, 'med');
  assert.equal(result.actions[0].kind, 'tarea');
  assert.equal(result.text, 'Listo.');
  assert.equal(requests[0].url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer gsk_test');
  assert.equal(requests[0].body.model, 'openai/gpt-oss-120b');
  assert.equal(requests[0].body.reasoning_format, 'hidden');
  assert.equal(requests[0].body.reasoning_effort, 'medium');
  assert.equal(requests[0].body.tool_choice.function.name, 'agregar_tarea');
  assert.equal(requests[0].body.parallel_tool_calls, false);
  assert.equal(requests[0].body.tools[0].function.parameters.type, 'object');
  assert.equal(requests.length, 1);
});


test('Groq instantáneo usa GPT-OSS 20B con razonamiento bajo y oculto', async () => {
  const requests = [];
  const { ai } = loadRuntime({
    store: {},
    config: {
      provider: 'groq',
      keys: { groq: 'gsk_test' },
      models: { groq: 'openai/gpt-oss-20b' },
      toolsEnabled: false,
    },
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'Hola' } }] }) };
    },
  });

  const result = await ai.ask('Hola');
  assert.equal(result.text, 'Hola');
  assert.equal(requests[0].model, 'openai/gpt-oss-20b');
  assert.equal(requests[0].reasoning_format, 'hidden');
  assert.equal(requests[0].reasoning_effort, 'low');
});

test('Groq ejecuta tarea y recordatorio en llamadas específicas y secuenciales', async () => {
  const tasks = [];
  const reminders = [];
  const requests = [];
  const toolMessage = (id, name, args) => ({
    ok: true,
    json: async () => ({ choices: [{ message: {
      role: 'assistant', content: null,
      tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
    } }] }),
  });
  const responses = [
    toolMessage('call_task', 'agregar_tarea', { texto: 'Bajar ropa' }),
    toolMessage('call_reminder', 'agregar_recordatorio', { titulo: 'Bajar ropa', vencimiento: '2026-06-24T15:00' }),
  ];
  const store = {
    tasks: {
      add(text, pri, dueAt) { const item = { id: 't1', text, pri, dueAt }; tasks.push(item); return item; },
      list() { return tasks; },
    },
    reminders: {
      add(title, dueAt, note) { const item = { id: 'r1', title, dueAt, note }; reminders.push(item); return item; },
      list() { return reminders; },
    },
  };
  const { ai } = loadRuntime({
    store,
    config: { provider: 'groq', keys: { groq: 'gsk_test' }, models: {} },
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return responses.shift();
    },
  });

  const result = await ai.ask('Agrega como tarea y recordatorio bajar ropa para dentro de 40 minutos');
  assert.equal(tasks.length, 1);
  assert.equal(reminders.length, 1);
  assert.deepEqual(Array.from(result.actions, item => item.kind), ['tarea', 'recordatorio']);
  assert.deepEqual(requests[0].tools.map(item => item.function.name), ['agregar_tarea']);
  assert.equal(requests[0].tool_choice.function.name, 'agregar_tarea');
  assert.deepEqual(requests[1].tools.map(item => item.function.name), ['agregar_recordatorio']);
  assert.equal(requests[1].tool_choice.function.name, 'agregar_recordatorio');
  assert.equal(requests.length, 2);
  assert.match(result.text, /2 acciones/);
});

test('pregunta ante una mutación ambigua sin llamar a la API', async () => {
  let fetched = false;
  const { ai } = loadRuntime({
    store: {},
    config: { provider: 'groq', keys: { groq: 'gsk_test' }, models: {} },
    fetchImpl: async () => { fetched = true; throw new Error('fetch no esperado'); },
  });
  const result = await ai.ask('Agrega comprar leche para mañana');
  assert.equal(fetched, false);
  assert.match(result.text, /tarea.*recordatorio.*nota/i);
  assert.equal(result.actions.length, 0);
  assert.equal(ai.history.length, 2);
});

test('la respuesta a una aclaración fuerza la herramienta elegida', async () => {
  const tasks = [];
  const requests = [];
  const responses = [
    {
      ok: true,
      json: async () => ({ choices: [{ message: {
        role: 'assistant', content: null,
        tool_calls: [{ id: 'clarify_1', type: 'function', function: { name: 'agregar_tarea', arguments: '{"texto":"Hacer ejercicio"}' } }],
      } }] }),
    },
  ];
  const store = {
    tasks: {
      add(text, pri, dueAt) { const item = { id: 't1', text, pri, dueAt }; tasks.push(item); return item; },
      list() { return tasks; },
    },
  };
  const { ai } = loadRuntime({
    store,
    config: { provider: 'groq', keys: { groq: 'gsk_test' }, models: {} },
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return responses.shift();
    },
  });
  const question = await ai.ask('Crea una tarea que se repita todos los días para hacer ejercicio');
  assert.match(question.text, /tarea normal.*hábito/i);
  const result = await ai.ask('Una tarea normal');
  assert.equal(tasks.length, 1);
  assert.equal(result.actions[0].kind, 'tarea');
  assert.equal(requests[0].tool_choice.function.name, 'agregar_tarea');
  assert.equal(requests.length, 1);
});

test('Groq reintenta failed_generation con temperatura cero', async () => {
  const tasks = [];
  const requests = [];
  const responses = [
    {
      ok: false, status: 400,
      json: async () => ({ error: { message: "tool call validation failed: attempted to call tool 'agregar_habito'" } }),
    },
    {
      ok: true,
      json: async () => ({ choices: [{ message: {
        role: 'assistant', content: null,
        tool_calls: [{ id: 'retry_1', type: 'function', function: { name: 'agregar_tarea', arguments: '{"texto":"Reintento"}' } }],
      } }] }),
    },
  ];
  const store = {
    tasks: {
      add(text, pri, dueAt) { const item = { id: 't1', text, pri, dueAt }; tasks.push(item); return item; },
      list() { return tasks; },
    },
  };
  const { ai } = loadRuntime({
    store,
    config: { provider: 'groq', keys: { groq: 'gsk_test' }, models: {} },
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return responses.shift();
    },
  });
  await ai.ask('Agrega una tarea de reintento');
  assert.equal(tasks.length, 1);
  assert.equal(requests[0].temperature, 0.2);
  assert.equal(requests[1].temperature, 0);
  assert.equal(requests.length, 2);
});

test('Gemini también fuerza tarea y recordatorio en pasos separados', async () => {
  const tasks = [];
  const reminders = [];
  const requests = [];
  const candidate = parts => ({ ok: true, json: async () => ({ candidates: [{ content: { role: 'model', parts } }] }) });
  const responses = [
    candidate([{ functionCall: { id: 'g_task', name: 'agregar_tarea', args: { texto: 'Bajar ropa' } } }]),
    candidate([{ functionCall: { id: 'g_reminder', name: 'agregar_recordatorio', args: { titulo: 'Bajar ropa', vencimiento: '2026-06-24T15:00' } } }]),
  ];
  const store = {
    tasks: {
      add(text, pri, dueAt) { const item = { id: 't1', text, pri, dueAt }; tasks.push(item); return item; },
      list() { return tasks; },
    },
    reminders: {
      add(title, dueAt, note) { const item = { id: 'r1', title, dueAt, note }; reminders.push(item); return item; },
      list() { return reminders; },
    },
  };
  const { ai } = loadRuntime({
    store,
    config: { provider: 'gemini', keys: { gemini: 'gem_test' }, models: {} },
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return responses.shift();
    },
  });

  const result = await ai.ask('Agrega como tarea y recordatorio bajar ropa para dentro de 40 minutos');
  assert.deepEqual(Array.from(result.actions, item => item.kind), ['tarea', 'recordatorio']);
  assert.deepEqual(Array.from(requests[0].tools[0].functionDeclarations, item => item.name), ['agregar_tarea']);
  assert.deepEqual(Array.from(requests[1].tools[0].functionDeclarations, item => item.name), ['agregar_recordatorio']);
  assert.equal(requests.length, 2);
});

test('las consultas conservan la segunda solicitud para interpretar resultados', async () => {
  const requests = [];
  const responses = [
    {
      ok: true,
      json: async () => ({ choices: [{ message: {
        role: 'assistant', content: null,
        tool_calls: [{ id: 'query_1', type: 'function', function: { name: 'consultar_agenda', arguments: '{}' } }],
      } }] }),
    },
    { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'No tienes pendientes.' } }] }) },
  ];
  const store = {
    dates: { list: () => [] },
    tasks: { list: () => [] },
    reminders: { list: () => [] },
    habits: { list: () => [] },
  };
  const { ai } = loadRuntime({
    store,
    config: { provider: 'groq', keys: { groq: 'gsk_test' }, models: {} },
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return responses.shift();
    },
  });
  const result = await ai.ask('¿Qué tengo pendiente?');
  assert.equal(result.text, 'No tienes pendientes.');
  assert.equal(requests.length, 2);
  assert.equal(requests[1].messages.at(-1).tool_call_id, 'query_1');
});

test('una nota inferida por el contexto también confirma sin solicitud adicional', async () => {
  const notes = [];
  const requests = [];
  const response = {
    ok: true,
    json: async () => ({ choices: [{ message: {
      role: 'assistant', content: null,
      tool_calls: [{
        id: 'note_1', type: 'function',
        function: { name: 'agregar_nota', arguments: '{"titulo":"Checklist","contenido":"Ordenar el cuarto"}' },
      }],
    } }] }),
  };
  const store = {
    notes: {
      create(title) { const item = { id: 'n1', title, content: '', tag: '' }; notes.push(item); return item; },
      update(id, patch) { const item = notes.find(note => note.id === id); Object.assign(item, patch); return item; },
      get(id) { return notes.find(note => note.id === id); },
    },
  };
  const { ai } = loadRuntime({
    store,
    config: { provider: 'groq', keys: { groq: 'gsk_test' }, models: {} },
    fetchImpl: async (_url, options) => { requests.push(JSON.parse(options.body)); return response; },
  });
  const result = await ai.ask('Claro');
  assert.equal(notes.length, 1);
  assert.equal(result.actions[0].kind, 'nota');
  assert.equal(result.text, 'Listo.');
  assert.equal(requests.length, 1);
});

test('mantiene historiales separados al cambiar de motor', () => {
  const { ai } = loadRuntime({
    store: {},
    config: { provider: 'gemini', keys: { gemini: 'a', groq: 'b' }, models: {} },
    fetchImpl: async () => { throw new Error('fetch no esperado'); },
  });
  ai.history.push({ role: 'user', parts: [{ text: 'Gemini' }] });
  ai.setProvider('groq');
  assert.equal(ai.history.length, 0);
  ai.history.push({ role: 'user', content: 'Groq' });
  ai.setProvider('gemini');
  assert.equal(ai.history[0].parts[0].text, 'Gemini');
});

test('Groq normaliza errores de credenciales y límite sin conservar el turno fallido', async () => {
  for (const [status, expected] of [[401, 'BAD_KEY'], [429, 'RATE_LIMIT']]) {
    const { ai } = loadRuntime({
      store: {},
      config: { provider: 'groq', keys: { groq: 'gsk_test' }, models: {} },
      fetchImpl: async () => ({
        ok: false,
        status,
        json: async () => ({ error: { message: 'fallo simulado' } }),
      }),
    });
    await assert.rejects(ai.ask('Hola'), error => error.message === expected);
    assert.equal(ai.history.length, 0);
  }
});

test('Groq distingue un 403 de permisos de modelo de una API key inválida', async () => {
  const { ai } = loadRuntime({
    store: {},
    config: { provider: 'groq', keys: { groq: 'gsk_test' }, models: { groq: 'openai/gpt-oss-120b' } },
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: {
        message: 'The model `openai/gpt-oss-120b` is blocked at the project level.',
        type: 'permissions_error',
        code: 'model_permission_blocked_project',
      } }),
    }),
  });
  await assert.rejects(ai.ask('Hola'), error => {
    assert.equal(error.message, 'MODEL_PERMISSION');
    assert.equal(error.model, 'openai/gpt-oss-120b');
    assert.equal(error.code, 'model_permission_blocked_project');
    assert.match(error.detail, /blocked at the project level/);
    const friendly = ai.friendlyError(error);
    assert.match(friendly, /permisos \(403\)/);
    assert.match(friendly, /Organization → Limits/);
    assert.match(friendly, /Projects → Limits/);
    return true;
  });
  assert.equal(ai.history.length, 0);
});
