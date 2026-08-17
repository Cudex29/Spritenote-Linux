// store.js — capa de datos local (localStorage). Sin backend.
// Reemplaza el antiguo api.js basado en fetch/FastAPI.

const STORE_KEY = 'spritenote:data:v1';

// ── Nota "profesor de Markdown" — chuleta para quien no conoce la sintaxis ──
const MD_GUIDE = `# 📓 Guía rápida de Markdown

Markdown da formato a tus notas escribiendo texto normal. Esta nota es tu chuleta: cada bloque muestra *cómo se escribe* y justo debajo verás *cómo se ve*. ¡Edítala y experimenta!

---

## 1. Títulos
Pon almohadillas \`#\` al inicio de la línea. Más almohadillas = título más pequeño.
\`\`\`
# Título grande
## Subtítulo
### Sub-subtítulo
\`\`\`

## 2. Texto con estilo
\`\`\`
**negrita**   *cursiva*   ~~tachado~~   \`código\`
\`\`\`
Se ve así: **negrita**, *cursiva*, ~~tachado~~ y \`código\`.

## 3. Listas con viñetas
Empieza cada línea con un guion \`-\`:
\`\`\`
- Manzanas
- Peras
- Plátanos
\`\`\`
- Manzanas
- Peras
- Plátanos

## 4. Listas numeradas
Empieza con \`1.\`, \`2.\`, \`3.\`...
\`\`\`
1. Primer paso
2. Segundo paso
3. Tercero
\`\`\`
1. Primer paso
2. Segundo paso
3. Tercero

## 5. Casillas (checklist)
\`\`\`
- [ ] pendiente
- [x] completado
\`\`\`
- [ ] Repasar apuntes
- [x] Leer la guía de Markdown

## 6. Citas
Empieza la línea con \`>\`:
\`\`\`
> texto citado
\`\`\`
> La constancia vence lo que la dicha no alcanza.

## 7. Enlaces
Texto entre corchetes y la dirección entre paréntesis:
\`\`\`
[texto del enlace](https://ejemplo.com)
\`\`\`
[Guía oficial de Markdown](https://www.markdownguide.org/)

## 8. Bloques de código
Abre y cierra el bloque con tres acentos graves en su propia línea (como en todos los ejemplos de arriba). Puedes escribir el lenguaje junto a los acentos de apertura:
\`\`\`python
def saludar(nombre):
    return f"Hola, {nombre} 🦀"

print(saludar("estudiante"))
\`\`\`

## 9. Tablas
Separa columnas con barras \`|\` y pon una fila de guiones bajo los encabezados:
\`\`\`
| Materia | Nota |
|---------|------|
| Redes   | B    |
\`\`\`
Resultado:

| Materia | Nota |
|---------|------|
| Sistemas Operativos | A |
| Redes | B |
| Cálculo | A |

## 10. Línea divisoria
Tres guiones \`---\` solos en una línea crean una separación:

---

> 💡 Tip: crea tus propias notas con el botón **+ nueva**. Todo lo que escribas se renderiza al instante en el panel de lectura.`;

function guideNote() {
  return {
    id: 'md-guide',
    title: 'Guía rápida de Markdown',
    tag: 'guía',
    updated: Date.now(),
    content: MD_GUIDE,
  };
}

const SEED = {
  activeCharacter: 'clawd',
  customCharacters: {},
  tasks: [
    { id: 't1', text: 'Leer capítulo 4 de Sistemas Operativos', done: false, pri: 'hi' },
    { id: 't2', text: 'Entregar reporte de laboratorio de Redes', done: false, pri: 'hi' },
    { id: 't3', text: 'Responder correo del coordinador', done: true,  pri: 'lo' },
    { id: 't4', text: 'Hacer backup de dotfiles', done: false, pri: 'lo' },
    { id: 't5', text: 'Repasar apuntes de Cálculo', done: false, pri: 'lo' },
  ],
  reminders: [],
  characterMessages: {},
  notificationSettings: { mode: 'basic', desktopEnabled: false, aiPersonalized: false, backgroundEnabled: false },
  dates: [
    { id: 'd1', title: 'Examen parcial — Estructuras de Datos', date: isoInDays(3),  note: 'Aula B-204 · 09:00' },
    { id: 'd2', title: 'Entrega proyecto final — Bases de Datos', date: isoInDays(12), note: 'Subir a la plataforma antes de las 23:59' },
    { id: 'd3', title: 'Inscripción de materias', date: isoInDays(21), note: 'Periodo de altas y bajas' },
    { id: 'd4', title: 'Cumpleaños de mamá', date: isoInDays(34), note: 'Comprar algo bonito' },
  ],
  notes: [
    guideNote(),
    {
      id: 'n1',
      title: 'Apuntes — Sistemas Operativos',
      tag: 'clase',
      updated: Date.now() - 1000 * 60 * 60 * 2,
      content: `# Planificación de procesos

El **planificador** (scheduler) decide qué proceso usa la CPU.

## Algoritmos vistos
- [x] FCFS — first come, first served
- [x] SJF — shortest job first
- [ ] Round Robin — repasar el *quantum*
- [ ] Colas multinivel

> El objetivo es maximizar el uso de CPU y minimizar el tiempo de espera.

### Fórmula de tiempo de espera promedio
\`\`\`python
def avg_wait(burst_times):
    wait, total = 0, 0
    for i, b in enumerate(burst_times):
        total += wait
        wait += b
    return total / len(burst_times)

print(avg_wait([5, 3, 8, 6]))  # FCFS
\`\`\`

Recordar: \`quantum\` muy pequeño → mucho overhead de contexto.`
    },
    {
      id: 'n2',
      title: 'Redes — modelo OSI',
      tag: 'clase',
      updated: Date.now() - 1000 * 60 * 60 * 26,
      content: `# Modelo OSI — 7 capas

1. Física
2. Enlace de datos
3. Red
4. Transporte
5. Sesión
6. Presentación
7. Aplicación

## Mnemotecnia
> *"Para Estudiar Redes Toda Su Pinche Aplicación"*

| Capa | PDU | Ejemplo |
|------|-----|---------|
| Red | Paquete | IP |
| Transporte | Segmento | TCP/UDP |
| Aplicación | Datos | HTTP, DNS |

Pendiente: comparar con el modelo **TCP/IP** (4 capas).`
    },
    {
      id: 'n3',
      title: 'Dotfiles — config rápida',
      tag: 'rice',
      updated: Date.now() - 1000 * 60 * 60 * 70,
      content: `# Mi setup

\`\`\`bash
# instalar lo básico
sudo pacman -S neovim tmux kitty
# fuente
yay -S ttf-ibm-plex
\`\`\`

- [x] Instalar window manager
- [x] Configurar tmux status bar
- [ ] Terminar tema de neovim
- [ ] Subir dotfiles a git

*Rice en progreso...* 🦀`
    },
  ],

  // ── MEJORAS DE HÁBITOS (metas diarias) ──────────────────
  habits: [
    { id: 'hb1', text: 'Hacer ejercicio' },
    { id: 'hb2', text: 'Practicar guitarra 2 horas' },
    { id: 'hb3', text: 'No tomar refrescos de cola' },
    { id: 'hb4', text: 'Leer 20 minutos' },
    { id: 'hb5', text: 'Hábitos emocionales (meditar / journaling)' },
  ],

  // ── METAS SEMANALES (no afectan calificación diaria; sí el total semanal) ──
  weeklyGoals: [],
  weeklyLog: {},

  // Registro diario: { 'YYYY-MM-DD': { done: [habitIds], grade: 'P'|'A'|'B'|'C'|'D' } }
  // Se siembran un par de días previos para que el calendario muestre ejemplo.
  log: {
    [isoInDays(-1)]: { done: ['hb1', 'hb2', 'hb3', 'hb4', 'hb5'], grade: 'P' },
    [isoInDays(-2)]: { done: ['hb1'], grade: 'C' },
    [isoInDays(-3)]: { done: ['hb1', 'hb2', 'hb3', 'hb4'], grade: 'A' },
  },
};

function isoInDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function safeCharacterKey(value, fallback = 'clawd') {
  const clean = String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (clean || fallback).slice(0, 40);
}

// Calificación del día a partir de hábitos cumplidos vs total.
//   P = perfecto (100%) · A = casi todo (≥75%) · B = la mitad (≥50%)
//   C = pocos (1–49%)   · D = desalineado (0%)  · null = sin hábitos
function gradeFromCounts(done, total) {
  if (!total) return null;
  if (done <= 0) return 'D';
  const r = done / total;
  if (r >= 1)    return 'P';
  if (r >= 0.75) return 'A';
  if (r >= 0.5)  return 'B';
  return 'C';
}

const Store = {
  _data: null,

  _load() {
    if (this._data) return this._data;
    try {
      const nativeData = window.spritenote?.storage?.load?.();
      const raw = nativeData ? null : localStorage.getItem(STORE_KEY);
      this._data = nativeData || (raw ? JSON.parse(raw) : structuredClone(SEED));
    } catch (e) {
      this._data = structuredClone(SEED);
    }
    // Migración: garantiza que existan las claves nuevas para datos viejos.
    let migrated = false;
    if (!Array.isArray(this._data.tasks)) { this._data.tasks = []; migrated = true; }
    if (!Array.isArray(this._data.reminders)) { this._data.reminders = []; migrated = true; }
    if (!this._data.characterMessages || typeof this._data.characterMessages !== 'object' || Array.isArray(this._data.characterMessages)) {
      this._data.characterMessages = {}; migrated = true;
    }
    Object.keys(this._data.characterMessages).forEach(key => {
      if (!Array.isArray(this._data.characterMessages[key])) { this._data.characterMessages[key] = []; migrated = true; }
    });
    if (!this._data.notificationSettings || typeof this._data.notificationSettings !== 'object') {
      this._data.notificationSettings = structuredClone(SEED.notificationSettings);
      migrated = true;
    }
    if (!['basic', 'intermediate', 'extreme'].includes(this._data.notificationSettings.mode)) {
      this._data.notificationSettings.mode = 'basic'; migrated = true;
    }
    if (typeof this._data.notificationSettings.desktopEnabled !== 'boolean') {
      this._data.notificationSettings.desktopEnabled = false; migrated = true;
    }
    if (typeof this._data.notificationSettings.aiPersonalized !== 'boolean') {
      this._data.notificationSettings.aiPersonalized = false; migrated = true;
    }
    if (typeof this._data.notificationSettings.backgroundEnabled !== 'boolean') {
      this._data.notificationSettings.backgroundEnabled = false; migrated = true;
    }
    if (!Array.isArray(this._data.habits)) this._data.habits = structuredClone(SEED.habits);
    if (!Array.isArray(this._data.weeklyGoals)) this._data.weeklyGoals = [];
    if (!this._data.weeklyLog || typeof this._data.weeklyLog !== 'object') this._data.weeklyLog = {};
    if (!this._data.log || typeof this._data.log !== 'object') this._data.log = {};
    if (!Array.isArray(this._data.notes)) this._data.notes = [];
    if (!this._data.customCharacters || typeof this._data.customCharacters !== 'object' || Array.isArray(this._data.customCharacters)) {
      this._data.customCharacters = {};
      migrated = true;
    }
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(String(this._data.activeCharacter || ''))) {
      this._data.activeCharacter = localStorage.getItem('spritenote:pet') || 'clawd';
      migrated = true;
    }
    this._data.tasks.forEach(t => {
      if (!Object.prototype.hasOwnProperty.call(t, 'dueAt')) { t.dueAt = null; migrated = true; }
      if (!['lo', 'med', 'hi'].includes(t.pri)) { t.pri = 'lo'; migrated = true; }
    });
    this._data.reminders.forEach(r => {
      if (!r.notificationLog || typeof r.notificationLog !== 'object') { r.notificationLog = {}; migrated = true; }
      if (typeof r.done !== 'boolean') { r.done = false; migrated = true; }
    });
    // Migración: siembra la nota "Guía rápida de Markdown" una sola vez,
    // también para instalaciones previas. Si el usuario la borra, no vuelve.
    if (!this._data._mdGuideSeeded) {
      if (!this._data.notes.some(n => n.id === 'md-guide')) {
        this._data.notes.unshift(guideNote());
      }
      this._data._mdGuideSeeded = true;
      migrated = true;
    }
    // Antes las notas se ordenaban por fecha en cada render. Desde aquí su
    // posición en el arreglo es el orden manual y ya no cambia al editarlas.
    if (!this._data._manualNoteOrder) {
      this._data.notes.sort((a, b) => (b.updated || 0) - (a.updated || 0));
      this._data._manualNoteOrder = true;
      migrated = true;
    }
    if (migrated) this._save();
    return this._data;
  },

  _save() {
    try {
      if (window.spritenote?.storage?.save) window.spritenote.storage.save(this._data);
      else localStorage.setItem(STORE_KEY, JSON.stringify(this._data));
    }
    catch (e) { console.warn('No se pudo guardar', e); }
  },

  snapshot() { return structuredClone(this._load()); },

  replace(nextData) {
    if (!nextData || typeof nextData !== 'object' || Array.isArray(nextData)) {
      throw new TypeError('Respaldo de SpriteNote inválido');
    }
    this._data = structuredClone(nextData);
    this._save();
    return this._data;
  },

  applyNativeState(nextData) {
    if (nextData && typeof nextData === 'object' && !Array.isArray(nextData)) {
      this._data = structuredClone(nextData);
    }
    return this._data;
  },

  _id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },

  reset() {
    this._data = structuredClone(SEED);
    this._save();
  },

  // ── TAREAS ──────────────────────────────────────────────
  tasks: {
    list() { return Store._load().tasks; },
    add(text, pri = 'lo', dueAt = null) {
      pri = ['lo', 'med', 'hi'].includes(pri) ? pri : 'lo';
      const t = { id: Store._id(), text, done: false, pri, dueAt: dueAt || null };
      Store._load().tasks.unshift(t);
      Store._save();
      return t;
    },
    toggle(id) {
      const t = Store._load().tasks.find(x => x.id === id);
      if (t) { t.done = !t.done; Store._save(); }
      return t;
    },
    setPri(id, pri) {
      const t = Store._load().tasks.find(x => x.id === id);
      if (t && ['lo', 'med', 'hi'].includes(pri)) { t.pri = pri; Store._save(); }
      return t;
    },
    setDue(id, dueAt) {
      const t = Store._load().tasks.find(x => x.id === id);
      if (t) { t.dueAt = dueAt || null; Store._save(); }
      return t;
    },
    move(id, targetId, before = true) {
      const tasks = Store._load().tasks;
      const from = tasks.findIndex(x => x.id === id);
      if (from < 0) return false;
      const [task] = tasks.splice(from, 1);
      let to = tasks.findIndex(x => x.id === targetId);
      if (to < 0) to = tasks.length;
      if (!before) to += 1;
      tasks.splice(to, 0, task);
      Store._save();
      return true;
    },
    remove(id) {
      const d = Store._load();
      d.tasks = d.tasks.filter(x => x.id !== id);
      Store._save();
    },
  },

  // ── RECORDATORIOS ───────────────────────────────────────
  reminders: {
    list() {
      return Store._load().reminders.slice().sort((a, b) => {
        if (!!a.done !== !!b.done) return a.done ? 1 : -1;
        return String(a.dueAt || '').localeCompare(String(b.dueAt || ''));
      });
    },
    add(title, dueAt, note = '') {
      title = String(title || '').trim();
      if (!title || !dueAt) return null;
      const r = {
        id: Store._id(), title, dueAt, note: String(note || '').trim(),
        done: false, createdAt: Date.now(), notificationLog: {},
      };
      Store._load().reminders.push(r);
      Store._save();
      return r;
    },
    toggle(id) {
      const r = Store._load().reminders.find(x => x.id === id);
      if (r) { r.done = !r.done; Store._save(); }
      return r;
    },
    markNotified(id, key) {
      const r = Store._load().reminders.find(x => x.id === id);
      if (!r) return false;
      if (!r.notificationLog || typeof r.notificationLog !== 'object') r.notificationLog = {};
      r.notificationLog[key] = Date.now();
      Store._save();
      return true;
    },
    remove(id) {
      const d = Store._load();
      d.reminders = d.reminders.filter(x => x.id !== id);
      Store._save();
    },
  },


  // ── MENSAJES DEL PERSONAJE ─────────────────────────────────
  // Historial ligero para mensajes que nacen fuera del chat, por ejemplo
  // recordatorios que llegan como notificación. Se guarda por personaje para
  // que parezcan mensajes recibidos reales al abrir su conversación.
  characterMessages: {
    list(characterKey) {
      const key = safeCharacterKey(characterKey, Store.preferences.getActiveCharacter());
      const bucket = Store._load().characterMessages?.[key] || [];
      return bucket.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(item => structuredClone(item));
    },
    has(characterKey, id) {
      const key = safeCharacterKey(characterKey, Store.preferences.getActiveCharacter());
      const cleanId = String(id || '').trim();
      if (!cleanId) return false;
      return (Store._load().characterMessages?.[key] || []).some(item => item.id === cleanId);
    },
    add(entry = {}) {
      const key = safeCharacterKey(entry.characterKey, Store.preferences.getActiveCharacter());
      const text = String(entry.text || entry.body || '').trim().slice(0, 1000);
      if (!text) return null;
      const id = String(entry.id || `character-message:${Store._id()}`).trim().slice(0, 140);
      const state = Store._load();
      if (!state.characterMessages || typeof state.characterMessages !== 'object' || Array.isArray(state.characterMessages)) {
        state.characterMessages = {};
      }
      if (!Array.isArray(state.characterMessages[key])) state.characterMessages[key] = [];
      const existing = state.characterMessages[key].find(item => item.id === id);
      if (existing) return structuredClone(existing);
      const message = {
        id,
        role: entry.role === 'user' ? 'user' : 'model',
        text,
        kind: String(entry.kind || 'mensaje').trim().slice(0, 40),
        source: String(entry.source || 'notification').trim().slice(0, 40),
        createdAt: Number(entry.createdAt) > 0 ? Number(entry.createdAt) : Date.now(),
      };
      if (entry.reminderId) message.reminderId = String(entry.reminderId).slice(0, 80);
      if (entry.notificationKey) message.notificationKey = String(entry.notificationKey).slice(0, 100);
      state.characterMessages[key].push(message);
      state.characterMessages[key].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      while (state.characterMessages[key].length > 200) state.characterMessages[key].shift();
      Store._save();
      return structuredClone(message);
    },
  },

  preferences: {
    getActiveCharacter() { return Store._load().activeCharacter || 'clawd'; },
    setActiveCharacter(key) {
      key = String(key || '').trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(key)) return Store._load().activeCharacter || 'clawd';
      if (Store._load().activeCharacter !== key) {
        Store._load().activeCharacter = key;
        Store._save();
      }
      return key;
    },
  },

  notifications: {
    get() { return { ...Store._load().notificationSettings }; },
    update(patch) {
      const cfg = Store._load().notificationSettings;
      if (patch && ['basic', 'intermediate', 'extreme'].includes(patch.mode)) cfg.mode = patch.mode;
      if (patch && typeof patch.desktopEnabled === 'boolean') cfg.desktopEnabled = patch.desktopEnabled;
      if (patch && typeof patch.aiPersonalized === 'boolean') cfg.aiPersonalized = patch.aiPersonalized;
      if (patch && typeof patch.backgroundEnabled === 'boolean') cfg.backgroundEnabled = patch.backgroundEnabled;
      Store._save();
      return { ...cfg };
    },
  },

  // Metadatos de personajes. Los GIF nativos viven fuera del JSON y aquí se
  // guardan sus URL, reacciones y system prompts.
  characters: {
    list() { return Object.values(Store._load().customCharacters).map(item => structuredClone(item)); },
    get(key) {
      const item = Store._load().customCharacters[String(key || '')];
      return item ? structuredClone(item) : null;
    },
    upsert(profile) {
      const key = String(profile?.key || '').trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(key)) throw new TypeError('ID de personaje inválido');
      Store._load().customCharacters[key] = structuredClone({ ...profile, key, updatedAt: Date.now() });
      Store._save();
      return this.get(key);
    },
    remove(key) {
      key = String(key || '');
      if (!Store._load().customCharacters[key]) return false;
      delete Store._load().customCharacters[key];
      Store._save();
      return true;
    },
  },

  // ── FECHAS IMPORTANTES ─────────────────────────────────
  dates: {
    list() {
      return Store._load().dates
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    add(title, date, note = '') {
      const d = { id: Store._id(), title, date, note };
      Store._load().dates.push(d);
      Store._save();
      return d;
    },
    remove(id) {
      const data = Store._load();
      data.dates = data.dates.filter(x => x.id !== id);
      Store._save();
    },
  },

  // ── NOTAS ──────────────────────────────────────────────
  notes: {
    list() { return Store._load().notes; },
    get(id) { return Store._load().notes.find(n => n.id === id); },
    create(title = 'Nota sin título') {
      const n = { id: Store._id(), title, tag: '', updated: Date.now(), content: '' };
      Store._load().notes.unshift(n);
      Store._save();
      return n;
    },
    update(id, patch) {
      const n = Store._load().notes.find(x => x.id === id);
      if (n) { Object.assign(n, patch, { updated: Date.now() }); Store._save(); }
      return n;
    },
    move(id, targetId, before = true) {
      const notes = Store._load().notes;
      const from = notes.findIndex(x => x.id === id);
      if (from < 0) return false;
      const [note] = notes.splice(from, 1);
      let to = notes.findIndex(x => x.id === targetId);
      if (to < 0) to = notes.length;
      if (!before) to += 1;
      notes.splice(to, 0, note);
      Store._save();
      return true;
    },
    reorder(ids) {
      const notes = Store._load().notes;
      const nextIds = Array.isArray(ids) ? ids : [];
      const byId = new Map(notes.map(n => [n.id, n]));
      const ordered = nextIds.map(id => byId.get(id)).filter(Boolean);
      notes.forEach(n => { if (!nextIds.includes(n.id)) ordered.push(n); });
      if (ordered.length !== notes.length) return false;
      Store._load().notes = ordered;
      Store._save();
      return true;
    },
    remove(id) {
      const d = Store._load();
      d.notes = d.notes.filter(x => x.id !== id);
      Store._save();
    },
  },

  // ── MEJORAS DE HÁBITOS ─────────────────────────────────
  habits: {
    list() { return Store._load().habits; },
    add(text) {
      text = (text || '').trim();
      if (!text) return null;
      const h = { id: Store._id(), text };
      Store._load().habits.push(h);
      Store._save();
      Store.log._recompute(isoToday());
      return h;
    },
    rename(id, text) {
      const h = Store._load().habits.find(x => x.id === id);
      if (h) { h.text = (text || '').trim() || h.text; Store._save(); }
      return h;
    },
    remove(id) {
      const d = Store._load();
      d.habits = d.habits.filter(x => x.id !== id);
      // limpia el id de TODOS los registros y recalcula solo el de hoy
      Object.values(d.log).forEach(e => {
        if (e && Array.isArray(e.done)) e.done = e.done.filter(x => x !== id);
      });
      Store._save();
      Store.log._recompute(isoToday());
    },
  },

  // ── REGISTRO DIARIO + CALIFICACIONES ───────────────────
  log: {
    // entrada cruda de un día (o vacía)
    get(iso) {
      const e = Store._load().log[iso];
      return e ? { done: e.done.slice(), grade: e.grade || null } : { done: [], grade: null };
    },
    isDone(iso, habitId) { return this.get(iso).done.includes(habitId); },

    // marca/desmarca un hábito en un día y recalcula su calificación
    toggle(iso, habitId) {
      const d = Store._load();
      const e = d.log[iso] || (d.log[iso] = { done: [], grade: null });
      const i = e.done.indexOf(habitId);
      if (i >= 0) e.done.splice(i, 1);
      else e.done.push(habitId);
      this._recompute(iso);
      return e;
    },

    // recalcula la calificación congelada de un día según los hábitos actuales
    _recompute(iso) {
      const d = Store._load();
      const e = d.log[iso];
      const total = d.habits.length;
      if (!e) return null;
      // descarta ids de hábitos ya inexistentes
      const valid = new Set(d.habits.map(h => h.id));
      e.done = e.done.filter(x => valid.has(x));
      e.grade = gradeFromCounts(e.done.length, total);
      // si un día queda sin nada marcado y no es relevante, igual guardamos D/null
      Store._save();
      return e.grade;
    },

    gradeFor(iso) {
      const e = Store._load().log[iso];
      return e ? (e.grade || null) : null;
    },

    doneCount(iso) { return this.get(iso).done.length; },

    // Calificaciones de la semana que contiene `iso` (lunes→domingo).
    // Devuelve [{ iso, dow, grade, isToday, isFuture }]
    weekGrades(iso = isoToday()) {
      const base = new Date(iso + 'T00:00:00');
      const dow = (base.getDay() + 6) % 7; // 0 = lunes
      const monday = new Date(base);
      monday.setDate(base.getDate() - dow);
      const todayIso = isoToday();
      const out = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const di = d.toISOString().slice(0, 10);
        out.push({
          iso: di,
          dow: i,
          grade: this.gradeFor(di),
          isToday: di === todayIso,
          isFuture: di > todayIso,
        });
      }
      return out;
    },

    // Calificación acumulada (promedio) de una lista de letras.
    aggregate(grades) {
      const pts = { P: 5, A: 4, B: 3, C: 2, D: 1 };
      const vals = grades.filter(g => g && pts[g]).map(g => pts[g]);
      if (!vals.length) return null;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const r = Math.round(avg);
      return ['', 'D', 'C', 'B', 'A', 'P'][r] || null;
    },

    // Calificación semanal combinando hábitos diarios + metas semanales (70/30).
    weeklyAggregate(grades, weeklyGoalPct = null) {
      const pts = { P: 5, A: 4, B: 3, C: 2, D: 1 };
      const vals = grades.filter(g => g && pts[g]).map(g => pts[g]);
      if (!vals.length) {
        if (weeklyGoalPct === null) return null;
        const wPts = Math.max(1, Math.round(weeklyGoalPct * 5));
        return ['', 'D', 'C', 'B', 'A', 'P'][wPts] || null;
      }
      const dailyAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (weeklyGoalPct === null) {
        return ['', 'D', 'C', 'B', 'A', 'P'][Math.round(dailyAvg)] || null;
      }
      const combined = dailyAvg * 0.7 + (weeklyGoalPct * 5) * 0.3;
      return ['', 'D', 'C', 'B', 'A', 'P'][Math.round(combined)] || null;
    },
  },

  // ── METAS SEMANALES ────────────────────────────────────
  weeklyGoals: {
    list() { return Store._load().weeklyGoals || []; },
    add(text) {
      text = (text || '').trim();
      if (!text) return null;
      const d = Store._load();
      if (!d.weeklyGoals) d.weeklyGoals = [];
      const g = { id: Store._id(), text };
      d.weeklyGoals.push(g);
      Store._save();
      return g;
    },
    remove(id) {
      const d = Store._load();
      if (!d.weeklyGoals) return;
      d.weeklyGoals = d.weeklyGoals.filter(x => x.id !== id);
      if (d.weeklyLog) {
        Object.values(d.weeklyLog).forEach(e => {
          if (e && Array.isArray(e.done)) e.done = e.done.filter(x => x !== id);
        });
      }
      Store._save();
    },
  },

  // ── REGISTRO DE METAS SEMANALES ────────────────────────
  weeklyLog: {
    _weekKey(iso = isoToday()) {
      const base = new Date(iso + 'T00:00:00');
      const dow = (base.getDay() + 6) % 7;
      const monday = new Date(base);
      monday.setDate(base.getDate() - dow);
      return `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
    },
    get(weekKey) {
      const d = Store._load();
      if (!d.weeklyLog) d.weeklyLog = {};
      const e = d.weeklyLog[weekKey];
      return e ? { done: e.done.slice() } : { done: [] };
    },
    toggle(weekKey, goalId) {
      const d = Store._load();
      if (!d.weeklyLog) d.weeklyLog = {};
      const e = d.weeklyLog[weekKey] || (d.weeklyLog[weekKey] = { done: [] });
      const i = e.done.indexOf(goalId);
      if (i >= 0) e.done.splice(i, 1);
      else e.done.push(goalId);
      Store._save();
      return e;
    },
    isDone(weekKey, goalId) { return this.get(weekKey).done.includes(goalId); },
    doneCount(weekKey) {
      const goals = Store.weeklyGoals.list();
      return this.get(weekKey).done.filter(id => goals.some(g => g.id === id)).length;
    },
    completionPct(weekKey) {
      const goals = Store.weeklyGoals.list();
      if (!goals.length) return null;
      const done = this.doneCount(weekKey);
      return done / goals.length;
    },
  },
};

window.Store = Store;
