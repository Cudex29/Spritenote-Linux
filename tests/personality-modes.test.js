'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const AiIntent = require('../shared/ai-intent');

const root = path.join(__dirname, '..');

function loadPets(customCharacters = []) {
  const window = customCharacters.length ? { Store: { characters: { list: () => customCharacters } } } : {};
  const context = vm.createContext({ window, console, Date, Math, setTimeout, clearTimeout, setInterval });
  vm.runInContext(fs.readFileSync(path.join(root, 'src', 'js', 'sprite.js'), 'utf8'), context);
  return window.PETS;
}

function loadAiWithFemme(pets, fetchImpl, store = {}, configPatch = {}) {
  const writes = [];
  const config = {
    provider: 'groq',
    keys: { groq: 'gsk_test' },
    models: {},
    persona: 'character',
    characterModes: { femme: 'obsessive' },
    ...configPatch,
  };
  const window = {
    Store: store,
    AiIntent,
    PETS: pets,
    SysInfo: { user: 'Arturo' },
    clawd: { getPetKey: () => 'femme' },
  };
  const context = vm.createContext({
    window,
    console,
    fetch: fetchImpl,
    localStorage: {
      getItem: () => JSON.stringify(config),
      setItem: (_key, value) => writes.push(JSON.parse(value)),
    },
    Date,
    Intl,
    URL,
    escHtml: value => String(value),
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'src', 'js', 'gemini.js'), 'utf8'), context);
  return { ai: window.Gemini, writes };
}

test('Femme Soule expone normal y obsesivo, con normal por defecto', () => {
  const pets = loadPets();
  assert.equal(pets.femme.defaultPersonality, 'normal');
  assert.match(pets.femme.personalities.normal, /amiga del usuario desde hace tiempo/i);
  assert.match(pets.femme.personalities.normal, /Nunca declares tu amor/i);
  assert.match(pets.femme.personalities.obsessive, /obsesivamente enamorada del usuario/i);
  assert.match(pets.femme.personalities.obsessive, /Nunca rompas el personaje/i);
  assert.equal(pets.clawd.personalities.normal.includes("Eres Claw'd"), true);
});

test('carga personajes personalizados con reacciones y dos modos propios', () => {
  const pets = loadPets([{
    key: 'nova', label: 'Nova', emoji: '*', assets: { idle: 'file:///nova/idle.gif', phone: 'file:///nova/phone.gif' },
    personalities: { normal: 'Eres Nova en modo tranquilo y respondes con mensajes breves.', alternate: 'Eres Nova en modo energético y mantienes una voz muy expresiva.' },
    personalityLabels: { normal: 'tranquila', alternate: 'energética' },
  }]);
  assert.equal(pets.nova.label, 'Nova');
  assert.equal(pets.nova.assets.phone, 'file:///nova/phone.gif');
  assert.equal(pets.nova.personalityLabels.alternate, 'energética');
  assert.equal(pets.nova.custom, true);
  assert.equal(pets.nova.sidebarScale, 1);
});

test('Furina recibe una escala lateral legible que puede sobrescribirse', () => {
  const base = {
    key: 'furina', label: 'Furina', assets: { idle: 'file:///furina/idle.gif' },
    personalities: { normal: 'Furina responde de forma breve y natural.', alternate: 'Furina responde con mayor dramatismo y energía.' },
  };
  assert.equal(loadPets([base]).furina.sidebarScale, 1.3);
  assert.equal(loadPets([{ ...base, sidebarScale: 1.15 }]).furina.sidebarScale, 1.15);
});

test('la versión con un solo modo migra a normal y usa ese prompt en Groq', async () => {
  const pets = loadPets();
  const requests = [];
  const { ai, writes } = loadAiWithFemme(pets, async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { role: 'assistant', content: 'Hola jaja.' } }] }),
    };
  });

  assert.deepEqual(Array.from(ai.listCharacterModes('femme'), mode => mode.key), ['normal', 'obsessive']);
  assert.equal(ai.getCharacterMode('femme'), 'normal');
  assert.equal(ai.getConversationKey(), 'groq:character:femme:normal');
  await ai.ask('Hola');

  const systemPrompt = requests[0].messages[0].content;
  assert.match(systemPrompt, /amiga del usuario desde hace tiempo/i);
  assert.match(systemPrompt, /El usuario se llama Arturo/);
  assert.match(systemPrompt, /Nunca declares tu amor/i);
  assert.match(systemPrompt, /No uses Markdown pesado/i);
  assert.doesNotMatch(systemPrompt, /obsesivamente enamorada/i);
  assert.equal(writes.at(-1).characterModes.femme, 'normal');
  assert.equal(writes.at(-1).characterModeVersions.femme, 2);
});

test('las confirmaciones locales respetan el modo obsesivo sin otra llamada', async () => {
  const pets = loadPets();
  const tasks = [];
  let requests = 0;
  let systemPrompt = '';
  const store = {
    tasks: {
      add(text, pri, dueAt) { const item = { id: 't1', text, pri, dueAt }; tasks.push(item); return item; },
      list() { return tasks; },
    },
  };
  const { ai } = loadAiWithFemme(pets, async (_url, options) => {
    requests++;
    systemPrompt = JSON.parse(options.body).messages[0].content;
    return {
      ok: true,
      json: async () => ({ choices: [{ message: {
        role: 'assistant', content: null,
        tool_calls: [{ id: 'femme_task', type: 'function', function: { name: 'agregar_tarea', arguments: '{"texto":"Practicar guitarra"}' } }],
      } }] }),
    };
  }, store);

  assert.equal(ai.getCharacterMode('femme'), 'normal');
  assert.equal(ai.setCharacterMode('obsesivo', 'femme'), 'obsessive');
  const result = await ai.ask('Agrega una tarea para practicar guitarra');
  assert.equal(tasks.length, 1);
  assert.equal(requests, 1);
  assert.match(systemPrompt, /obsesivamente enamorada del usuario/i);
  assert.match(result.text, /Listo, amor/);
  assert.match(result.text, /no tienes excusa/);
});

test('las confirmaciones locales del modo normal mantienen el cariño sutil', async () => {
  const pets = loadPets();
  const tasks = [];
  const store = {
    tasks: {
      add(text, pri, dueAt) { const item = { id: 't1', text, pri, dueAt }; tasks.push(item); return item; },
      list() { return tasks; },
    },
  };
  const { ai } = loadAiWithFemme(pets, async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: {
      role: 'assistant', content: null,
      tool_calls: [{ id: 'normal_task', type: 'function', function: { name: 'agregar_tarea', arguments: '{"texto":"Dormir temprano"}' } }],
    } }] }),
  }), store);

  const result = await ai.ask('Agrega una tarea para dormir temprano');
  assert.equal(ai.getCharacterMode('femme'), 'normal');
  assert.equal(tasks.length, 1);
  assert.match(result.text, /si no lo hago yo se te olvida/i);
  assert.doesNotMatch(result.text, /amor|plano astral/i);
});

test('normal y obsesivo mantienen conversaciones independientes', () => {
  const pets = loadPets();
  const { ai } = loadAiWithFemme(pets, async () => { throw new Error('fetch no esperado'); });
  assert.equal(ai.getCharacterMode('femme'), 'normal');
  ai.history.push({ role: 'user', content: 'conversación normal' });
  assert.equal(ai.setCharacterMode('obsesivo', 'femme'), 'obsessive');
  assert.equal(ai.history.length, 0);
  ai.history.push({ role: 'user', content: 'conversación obsesiva' });
  assert.equal(ai.setCharacterMode('normal', 'femme'), 'normal');
  assert.equal(ai.history[0].content, 'conversación normal');
});
