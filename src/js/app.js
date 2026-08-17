// app.js — router, vistas, neofetch, frase random, comandos. Pega todo.

const $ = (id) => document.getElementById(id);
const qsa = (s) => [...document.querySelectorAll(s)];

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_UP = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DAYS_FULL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS_FULL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const fmtIsoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isoTodayApp = () => fmtIsoLocal(new Date());

function localDateTimeValue(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  return `${fmtIsoLocal(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function parseTaskDraft(raw, controlPri = 'lo', controlDue = '') {
  const chunks = String(raw || '').split(',').map(s => s.trim()).filter(Boolean);
  let pri = controlPri === 'hi' ? 'hi' : 'lo';
  if (controlPri === 'med') pri = 'med';
  let dueAt = controlDue || null;
  let dueError = false;
  const textChunks = [];

  chunks.forEach(chunk => {
    const low = chunk.toLowerCase();
    if (/^(prioridad\s*:?\s*)?(alta|high|urgente)$/.test(low)) { pri = 'hi'; return; }
    if (/^(prioridad\s*:?\s*)?(media|medio|medium)$/.test(low)) { pri = 'med'; return; }
    if (/^(prioridad\s*:?\s*)?(baja|low|normal)$/.test(low)) { pri = 'lo'; return; }

    const relative = low.match(/^vence\s+en\s*:?\s*(\d+)\s*(d[ií]as?|days?)?$/);
    if (relative) {
      const d = new Date();
      d.setDate(d.getDate() + Number(relative[1]));
      d.setHours(23, 59, 0, 0);
      dueAt = localDateTimeValue(d);
      return;
    }

    const exact = chunk.match(/^vence(?:\s+el|\s+en)?\s*:?\s*(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/i);
    if (exact) {
      const hh = String(exact[2] == null ? 23 : Number(exact[2])).padStart(2, '0');
      const candidate = `${exact[1]}T${hh}:${exact[3] || '59'}`;
      const parsedDate = new Date(candidate);
      if (isNaN(parsedDate.getTime()) || localDateTimeValue(parsedDate) !== candidate) dueError = true;
      else dueAt = candidate;
      return;
    }
    textChunks.push(chunk);
  });

  return { text: textChunks.join(', ').trim(), pri, dueAt, dueError };
}

const SESSION_START = Date.now();
const MUSIC_VISUALIZER_KEY = 'spritenote:music-visualizer';
const MUSIC_VISUALIZER_DEFAULTS = Object.freeze({
  bars: 36,
  sensitivity: 1.2,
  gap: 2,
  smoothing: .78,
  layout: 'linear',
  style: 'spectrum',
});

// ── Frases motivacionales / tips / poemas ───────────────────────
const QUOTES = [
  { kind: 'frase', text: 'La disciplina es elegir entre lo que quieres ahora y lo que quieres más.', author: 'Abraham Lincoln' },
  { kind: 'frase', text: 'No cuentes los días, haz que los días cuenten.', author: 'Muhammad Ali' },
  { kind: 'tip', text: 'Divide la tarea grande en pasos de 25 minutos. El método Pomodoro existe por algo.', author: 'tip de estudio' },
  { kind: 'poema', text: 'Caminante, no hay camino,\nse hace camino al andar.', author: 'Antonio Machado' },
  { kind: 'frase', text: 'El que mucho abarca, poco aprieta — enfócate en una cosa a la vez.', author: 'refrán' },
  { kind: 'tip', text: 'Explicar un tema en voz alta como si enseñaras revela lo que aún no entiendes.', author: 'técnica Feynman' },
  { kind: 'frase', text: 'La constancia vence lo que la dicha no alcanza.', author: 'Simón Bolívar' },
  { kind: 'poema', text: 'Aunque la mar esté brava\ny el viento sople al revés,\nrema, que la orilla espera.', author: 'anónimo' },
  { kind: 'tip', text: 'Guarda tus apuntes en markdown: simple hoy, portable siempre.', author: 'tip rice' },
  { kind: 'frase', text: 'Hecho es mejor que perfecto. Entrega y mejora después.', author: 'Sheryl Sandberg' },
  { kind: 'frase', text: 'Un río corta la roca no por su fuerza, sino por su persistencia.', author: 'proverbio' },
  { kind: 'tip', text: 'Revisa tus fechas importantes cada mañana. El futuro-tú lo agradecerá.', author: 'Spritenote' },
];

// ── Frases matutinas: café, mañana y madrugar (se muestran al amanecer) ──
const MORNING_QUOTES = [
  { kind: 'café', text: 'Primero el café, después el caos. ☕', author: 'ritual matutino' },
  { kind: 'mañana', text: 'Quien madruga encuentra el día con más horas para sí mismo.', author: 'refrán' },
  { kind: 'café', text: 'Un buen día empieza con granos recién molidos y una lista clara.', author: 'tip Spritenote' },
  { kind: 'mañana', text: 'La mañana es la página en blanco del día: escríbela con intención.', author: 'anónimo' },
  { kind: 'madrugar', text: 'No madrugues por obligación, madruga por la calma que nadie más aprovecha.', author: 'Spritenote' },
  { kind: 'café', text: 'El café no hace milagros... pero ayuda a empezarlos. ☕', author: 'sabiduría cafeinada' },
  { kind: 'mañana', text: 'Despertar temprano es ganarle al día la primera jugada.', author: 'proverbio' },
];

// ── Chuleta de Markdown (modo "guía" del editor de notas) ────────
const MD_CHEAT = `# Chuleta de Markdown

- **Título:** \`# \`, \`## \`, \`### \`
- **Negrita:** \`**texto**\`
- **Cursiva:** \`*texto*\`
- **Tachado:** \`~~texto~~\`
- **Código en línea:** texto entre acentos graves
- **Enlace:** \`[texto](url)\`
- **Cita:** \`> texto\`
- **Viñeta:** \`- elemento\`
- **Numerada:** \`1. elemento\`
- **Tarea:** \`- [ ] pendiente\` · \`- [x] hecha\`
- **Línea divisoria:** \`---\`

**Bloque de código** — abre y cierra con tres acentos graves en su propia línea:
\`\`\`python
def hola(nombre):
    return f"Hola, {nombre}"
\`\`\`

**Tabla** — separa columnas con barras y subraya el encabezado:
\`\`\`
| Materia | Nota |
|---------|------|
| Redes   | B    |
\`\`\`

Resultado:

| Materia | Nota |
|---------|------|
| Redes   | B    |
| Cálculo | A    |`;

const App = {
  currentView: 'home',
  currentNoteId: null,
  noteViewMode: 'split', // split | edit | read
  _saveTimer: null,

  init() {
    Themes.init();
    this._initCrt();
    this._initBoot();

    // sprite
    window.clawd = new ClawdSprite('clawd-canvas', (mood, pet) => {
      const icon = pet?.emoji || '🦀';
      const label = pet?.label || "Claw'd";
      const seg = $('sb-clawd-mood');
      if (seg) seg.textContent = icon + ' ' + mood;
      const lbl = $('sb-sprite-mood');
      if (lbl) lbl.textContent = `${label} · ${mood}`;
      const cp = $('cp-mood');
      if (cp) cp.textContent = `${icon} ${mood}`;
    });
    window.clawd.addMirror($('cp-sprite'), { role: 'compact' });
    window.addEventListener('spritenote:pet-change', e => this._onPetChange(e.detail || {}));
    this._initPhrase();
    if (!localStorage.getItem('spritenote:banner-gif')) {
      window.clawd.addMirror($('clawd-hero-gif'), { role: 'hero' });
    }
    this._initCompact();
    this._initCompactAuto();

    Command.init();
    this._registerCommands();
    Mode.set('NORMAL');

    this._applyUserToDOM();
    this._buildNeofetch();
    this._wireNav();
    this._initReminders();
    window.spritenote?.onNavigateReminder?.(id => {
      this._focusReminderId = id;
      this.navigate('reminders');
    });
    window.spritenote?.onStoreUpdate?.(state => {
      Store.applyNativeState(state);
      if (this.currentView === 'reminders') this.renderReminders();
      else this._renderNotificationStatus();
      if (this.currentView === 'ai') this._syncCharacterNotificationMessages();
    });
    this._wireThemeDots();
    this._startClock();
    this._initSystemMonitor();
    this._renderQuote();

    Themes.set(Themes.current, false);

    this.navigate('home');

    // En las mañanas, el companion arranca con su rutina (Claw'd → café). ☕
    const ms = window.clawd && window.clawd.getMorningState ? window.clawd.getMorningState() : null;
    if (this._timeOfDay() === 'morning' && ms && window.clawd && window.clawd.setState) {
      setTimeout(() => { if (window.clawd.state === 'idle') window.clawd.setState(ms); }, 900);
    }
  },

  // ── NEOFETCH (sidebar) ────────────────────────────────────────
  _buildNeofetch() {
    const el = $('neofetch');
    if (!el) return;

    // Longitud del separador = user@host
    const sepLen = Math.min((SysInfo.user ?? '?').length + SysInfo.hostname.length + 1, 22);
    const sep = '─'.repeat(sepLen);

    const nfRow = (key, val, cls = 'nf-row') =>
      val != null
        ? `<span class="nf-key">${key}</span><span class="nf-sep"> · </span><span class="${cls}">${val}</span><br>`
        : '';

    const render = () => {
      const tasks = Store.tasks.list();
      const done  = tasks.filter(t => t.done).length;
      const notes = Store.notes.list().length;
      const pct   = tasks.length ? Math.round(done / tasks.length * 100) : 0;

      el.innerHTML =
        `<span class="nf-user">${SysInfo.user ?? '?'}</span><span class="nf-sep">@</span><span class="nf-user">${SysInfo.hostname}</span><br>` +
        `<span class="nf-sep">${sep}</span><br>` +
        (!SysInfo.user
          ? `<span class="nf-key">user</span><span class="nf-sep"> · </span><span class="nf-hint">:user &lt;nombre&gt;</span><br>`
          : '') +
        nfRow('os',    escHtml(SysInfo.os)) +
        (SysInfo.arch    ? nfRow('arch',   escHtml(SysInfo.arch))   : '') +
        nfRow('cpu',   escHtml(SysInfo.cpu)) +
        (SysInfo.ram     ? nfRow('ram',    escHtml(SysInfo.ram))    : '') +
        (SysInfo.gpu     ? nfRow('gpu',    escHtml(SysInfo.gpu))    : '') +
        nfRow('res',   escHtml(SysInfo.resolution)) +
        (SysInfo.colorDepth ? nfRow('color', escHtml(SysInfo.colorDepth)) : '') +
        nfRow('locale', escHtml(SysInfo.locale)) +
        nfRow('tz',    escHtml(SysInfo.tz)) +
        `<span class="nf-sep">──────────────</span><br>` +
        nfRow('pet',   escHtml(window.clawd?.getPetLabel ? window.clawd.getPetLabel() : "Claw'd")) +
        nfRow('thm',   escHtml(Themes.label(Themes.current))) +
        nfRow('up',    escHtml(SysInfo.uptime())) +
        nfRow('notes', notes) +
        `<span class="nf-key">progreso</span><span class="nf-sep"> · </span>` +
        `<span class="nf-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" title="${done}/${tasks.length} tareas">` +
          `<span class="nf-progress-fill" style="width:${pct}%"></span>` +
        `</span>` +
        ` <span class="nf-row">${pct}%</span>`;
    };
    render();
    this._neofetchRender = render;
    setInterval(render, 30000);
  },

  _refreshNeofetch() { if (this._neofetchRender) this._neofetchRender(); },

  // ── Aplica usuario real a todos los prompts del DOM ──────────
  _applyUserToDOM() {
    const u = SysInfo.user ?? '?';
    // Prompts de vista (user@spritenote ~/inicio …)
    document.querySelectorAll('.nf-prompt-user').forEach(el => { el.textContent = u; });
  },

  // ── nav ───────────────────────────────────────────────────────
  _wireNav() {
    qsa('.nav-btn').forEach(b =>
      b.addEventListener('click', () => this.navigate(b.dataset.view)));
  },

  _wireThemeDots() {
    qsa('.theme-dot').forEach(d =>
      d.addEventListener('click', () => Themes.set(d.dataset.t)));
  },

  navigate(view) {
    this.currentView = view;
    qsa('.view').forEach(v => v.classList.remove('active'));
    qsa('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $(`view-${view}`).classList.add('active');

    const labels = { home: 'inicio', notes: 'notas', tasks: 'tareas', reminders: 'recordatorios', habits: 'hábitos', dates: 'fechas', calendar: 'calendario', ai: 'IA' };
    $('sb-view').textContent = labels[view] || view;

    if (view === 'home') this.renderHome();
    if (view === 'notes') this.renderNotes();
    if (view === 'tasks') this.renderTasks();
    if (view === 'reminders') this.renderReminders();
    if (view === 'habits') this.renderHabits();
    if (view === 'dates') this.renderDates();
    if (view === 'calendar') this.renderCalendar();
    if (view === 'ai') this.renderAI();
  },

  // ── clock + status bar ────────────────────────────────────────
  _startClock() {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      $('sb-clock').textContent = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${hh}:${mm}`;
    };
    tick();
    setInterval(tick, 1000 * 20);
  },

  // ── quote ─────────────────────────────────────────────────────
  // Franja horaria del día: 'morning' | 'day' | 'evening' | 'night'.
  _timeOfDay() {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return 'morning';
    if (h < 19) return 'day';
    if (h < 21) return 'evening';
    return 'night';
  },

  _renderQuote() {
    // En las mañanas mostramos frases sobre café, madrugar y empezar el día.
    const pool = this._timeOfDay() === 'morning' ? MORNING_QUOTES : QUOTES;
    const q = pool[Math.floor(Math.random() * pool.length)];
    const box = $('home-quote');
    if (!box) return;
    box.innerHTML =
      `<div class="q-kind">${q.kind} del día</div>` +
      `<div class="q-text">${escHtml(q.text).replace(/\n/g, '<br>')}</div>` +
      `<div class="q-author">— ${escHtml(q.author)}</div>`;
  },

  // ── Vista compacta (Hyprland / ventana pequeña) ──────────────
  _initCompact() {
    const cpClock = $('cp-clock');
    const cpDate  = $('cp-date');
    const cpUp    = $('cp-uptime');
    const cpMode  = $('cp-mode-label');

    // reloj compacto
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      if (cpClock) cpClock.textContent = `${hh}:${mm}`;
      if (cpDate) {
        const days = ['dom','lun','mar','mié','jue','vie','sáb'];
        const mon  = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
        cpDate.textContent = `${days[d.getDay()]} ${String(d.getDate()).padStart(2,'0')} ${mon[d.getMonth()]}`;
      }
    };
    tick();
    setInterval(tick, 10000);

    // uptime de sesión
    setInterval(() => {
      const ms = Date.now() - SESSION_START;
      const m  = Math.floor(ms / 60000);
      if (cpUp) cpUp.textContent = m < 60 ? `up ${m}m` : `up ${Math.floor(m/60)}h ${m%60}m`;
    }, 30000);

    // modo sincronizado con el global
    const origSet = Mode.set.bind(Mode);
    Mode.set = (m) => {
      origSet(m);
      if (cpMode) cpMode.textContent = m;
    };

    // input de comandos compacto
    const input = $('cp-input');
    const send  = $('cp-send');
    if (!input) return;

    const run = () => {
      const v = input.value.trim();
      if (!v) return;
      input.value = '';
      const isCmd = v.startsWith(':') || v.startsWith('/');
      if (isCmd) {
        const cmd = v.startsWith('/') ? ':' + v.slice(1) : v;
        Command._run(cmd);
      } else {
        // texto plano → prompt para el motor de IA activo
        this._cpSend(v);
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); run(); }
      else if (e.key === 'Escape') { e.preventDefault(); this._cpChatExit(); input.blur(); }
    });
    if (send) send.addEventListener('click', run);
    $('cp-chat-close')?.addEventListener('click', () => { this._cpChatExit(); input.focus(); });

    // usuario real en vista compacta
    const cpUser = $('cp-user');
    if (cpUser) cpUser.textContent = SysInfo.user ?? '?';

    // clic en sprite
    $('cp-sprite')?.addEventListener('click', () => window.clawd.poke());
  },

  // ── Chat de IA en la vista compacta ───────────────────────────
  _cpChatEnter() {
    $('compact')?.classList.add('cp-chatting');
    if (window.clawd?.setCompactGemini) window.clawd.setCompactGemini(true);
  },
  _cpChatExit()  {
    $('compact')?.classList.remove('cp-chatting');
    if (window.clawd?.setCompactGemini) window.clawd.setCompactGemini(false);
  },

  _cpAppend(role, html, { md = false } = {}) {
    const log = $('cp-chat');
    if (!log) return null;
    const row = document.createElement('div');
    row.className = 'chat-msg ' + role;
    const who = role === 'user' ? (SysInfo.user || 'tú')
              : role === 'error' ? 'error' : Gemini.providerLabel().toLowerCase();
    row.innerHTML =
      `<div class="cm-who">${escHtml(who)}</div>` +
      `<div class="cm-body ${md ? 'md' : ''}">${md ? renderMarkdown(html) : html}</div>`;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  },

  async _cpSend(text) {
    if (!Gemini.hasKey()) {
      const provider = Gemini.getProvider();
      Toast.show('warn', 'IA', `configura la API key de ${Gemini.providerLabel()}: <b>:ai key ${provider} &lt;tu_api_key&gt;</b>`);
      return;
    }
    this._cpChatEnter();
    this._cpAppend('user', escHtml(text).replace(/\n/g, '<br>'));
    clawd.setState('coffee');

    const pending = this._cpAppend('model', '<span class="cp-thinking">pensando<span class="cp-think-caret">▮</span></span>');
    const input = $('cp-input');
    if (input) input.disabled = true;

    try {
      const { text: answer, actions } = await Gemini.ask(text);
      const body = pending.querySelector('.cm-body');
      body.classList.add('md');
      const actionsHtml = (actions && actions.length)
        ? '<div class="cm-actions">' + actions.map(a =>
            `<div class="cm-action ca-${a.kind}"><span class="ca-ico">✦</span>${escHtml(a.summary)}</div>`).join('') + '</div>'
        : '';
      body.innerHTML = actionsHtml + renderMarkdown(answer);
      if (actions && actions.length) {
        clawd.setState('celebrate');
        actions.forEach(a => Toast.show('ai', `${Gemini.providerLabel().toLowerCase()} · acción`, escHtml(a.summary)));
        this._afterAiActions(actions);
      } else {
        clawd.setState('idea');
      }
    } catch (err) {
      pending.classList.remove('model');
      pending.classList.add('error');
      pending.querySelector('.cm-who').textContent = 'error';
      pending.querySelector('.cm-body').innerHTML = Gemini.friendlyError(err);
      clawd.setState('confused');
    } finally {
      if (input) { input.disabled = false; input.focus(); }
      const log = $('cp-chat'); if (log) log.scrollTop = log.scrollHeight;
    }
  },

  // ── Activación automática de la vista compacta (robusta, por JS) ──
  // No depende solo de la media query CSS: mide window.innerWidth/innerHeight
  // y alterna body.compact-force. Se dispara con ventana angosta O baja, útil
  // en tiling WMs (Hyprland) donde el tile puede quedar corto y ancho.
  COMPACT_W: 1040,  // cubre mosaicos de media pantalla (~960 px)
  COMPACT_H: 640,   // cubre ventanas bajas sin esperar al mínimo extremo
  _compactLock: null, // null = automático · true/false = forzado manual

  _compactViewportSize() {
    // clientWidth/clientHeight siguen el layout viewport de Chromium y resultan
    // más fiables que 100dvh cuando Wayland entrega los bounds finales tarde.
    const root = document.documentElement;
    const width = Math.max(1, Math.round(root?.clientWidth || window.visualViewport?.width || window.innerWidth || 1));
    const height = Math.max(1, Math.round(root?.clientHeight || window.visualViewport?.height || window.innerHeight || 1));
    return { width, height };
  },

  _syncCompactViewport() {
    const compact = $('compact');
    if (!compact) return;
    const { width, height } = this._compactViewportSize();

    // Variables útiles para depuración y para componentes que necesiten conocer
    // el tamaño real del tile sin depender de unidades dinámicas de viewport.
    compact.style.setProperty('--cp-viewport-w', `${width}px`);
    compact.style.setProperty('--cp-viewport-h', `${height}px`);
    compact.dataset.viewport = `${width}x${height}`;

    compact.classList.toggle('cp-vh-tight', height <= 520);
    compact.classList.toggle('cp-vh-short', height <= 450);
    compact.classList.toggle('cp-vh-tiny', height <= 360);
    compact.classList.toggle('cp-vh-micro', height <= 300);

    requestAnimationFrame(() => this._musicResize?.());
  },

  _initCompactAuto() {
    // marca que el control lo lleva el JS → desactiva el respaldo CSS
    document.documentElement.classList.add('js-compact');

    let raf = 0;
    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        this._applyCompact();
        this._syncCompactViewport();
      });
    };

    apply();
    window.addEventListener('resize', apply, { passive: true });

    // visualViewport cubre cambios que Chromium/Wayland puede reportar antes o
    // después del resize tradicional (tiling, fullscreen, decoración, escala).
    window.visualViewport?.addEventListener('resize', apply, { passive: true });

    // Hyprland puede fijar el tile definitivo después del primer frame. Un
    // ResizeObserver del layout viewport hace que no sea necesario volver la
    // ventana flotante para forzar un relayout.
    if (window.ResizeObserver) {
      this._compactViewportObserver = new ResizeObserver(apply);
      this._compactViewportObserver.observe(document.documentElement);
    }

    // Pulsos de arranque: baratos y deliberados. Cubren el caso donde el
    // compositor entrega los bounds finales durante los primeros cientos de ms.
    [40, 120, 280, 650, 1200].forEach(delay => setTimeout(apply, delay));

    // matchMedia como vía adicional para el cambio normal/compacto.
    if (window.matchMedia) {
      try {
        const mq = window.matchMedia(`(max-width: ${this.COMPACT_W - 1}px), (max-height: ${this.COMPACT_H - 1}px)`);
        const onChange = () => apply();
        mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
      } catch (e) { /* el observer/resize siguen cubriendo el caso */ }
    }
  },

  _applyCompact() {
    const { width, height } = this._compactViewportSize();
    let small;
    if (this._compactLock !== null) {
      small = this._compactLock; // override manual (:compact)
    } else {
      small = width < this.COMPACT_W || height < this.COMPACT_H;
    }
    document.body.classList.toggle('compact-force', small);
    this._syncCompactViewport();
  },

  // alterna/forza la vista compacta manualmente
  toggleCompact(arg) {
    arg = (arg || '').trim().toLowerCase();
    if (arg === 'auto') {
      this._compactLock = null;
      this._applyCompact();
      Toast.show('info', 'compact', 'modo automático (según tamaño de ventana)');
      return;
    }
    if (arg === 'on') this._compactLock = true;
    else if (arg === 'off') this._compactLock = false;
    else this._compactLock = !document.body.classList.contains('compact-force'); // toggle
    this._applyCompact();
    Toast.show('info', 'compact',
      (this._compactLock ? 'vista compacta forzada' : 'vista normal forzada') +
      ' · <span style="color:var(--text-faint)">:compact auto para volver</span>');
  },

  greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  },

  // ── Modal de confirmación estilizado (reemplaza window.confirm) ──
  // Devuelve una promesa que resuelve true (aceptar) o false (cancelar).
  confirm(opts = {}) {
    const {
      title = 'Confirmar',
      body = '¿Continuar?',
      okText = 'Aceptar',
      cancelText = 'Cancelar',
      danger = false,
      glyph = danger ? '⚠' : '?',
    } = opts;

    return new Promise((resolve) => {
      let overlay = $('modal-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        document.body.appendChild(overlay);
      }
      overlay.innerHTML = `
        <div class="modal-card ${danger ? 'danger' : ''}" role="alertdialog" aria-modal="true" aria-label="${escHtml(title)}">
          <div class="modal-head"><span class="modal-glyph">${glyph}</span><span>${escHtml(title)}</span></div>
          <div class="modal-body">${body}</div>
          <div class="modal-actions">
            <button class="btn" data-act="cancel">${escHtml(cancelText)}</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${escHtml(okText)}</button>
          </div>
        </div>`;
      overlay.classList.add('open');

      const prevFocus = document.activeElement;
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
        else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(true); }
      };
      const onBackdrop = (e) => { if (e.target === overlay) done(false); };
      const done = (val) => {
        overlay.classList.remove('open');
        overlay.innerHTML = '';
        document.removeEventListener('keydown', onKey, true);
        overlay.removeEventListener('click', onBackdrop);
        try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch (_) {}
        resolve(val);
      };

      document.addEventListener('keydown', onKey, true);
      overlay.addEventListener('click', onBackdrop);
      overlay.querySelector('[data-act="ok"]').addEventListener('click', () => done(true));
      overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => done(false));
      setTimeout(() => overlay.querySelector('[data-act="ok"]')?.focus(), 30);
    });
  },

  // frase personalizable bajo el gif del banner
  _initPhrase() {
    const el = $('clawd-phrase');
    if (!el) return;
    const saved = localStorage.getItem('spritenote:phrase');
    el.textContent = saved != null ? saved : 'reporta listo.';
    const save = () => localStorage.setItem('spritenote:phrase', el.textContent.trim());
    el.addEventListener('input', save);
    el.addEventListener('blur', save);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    });

    // Restaurar gif personalizado si fue guardado previamente
    const savedGif = localStorage.getItem('spritenote:banner-gif');
    if (savedGif) {
      const heroEl = $('clawd-hero-gif');
      if (heroEl) heroEl.src = savedGif;
    }
  },

  // ════════════════════ HOME ════════════════════
  renderHome() {
    this._refreshNeofetch();
    $('home-greet-title').textContent = this.greeting() + ', ' + (SysInfo.user ?? 'estudiante');

    // tareas pendientes
    const tasks = Store.tasks.list();
    const pending = tasks.filter(t => !t.done);
    const tl = $('home-tasks');
    tl.innerHTML = pending.length
      ? pending.slice(0, 5).map(t => `
        <div class="mini-row ${t.done ? 'done' : ''}" data-id="${t.id}">
          <span class="mr-check ${t.done ? 'done' : ''}">${t.done ? '✓' : ''}</span>
          <span class="mr-text">${escHtml(t.text)}</span>
          ${t.dueAt ? `<span class="countdown ${this._taskDueMeta(t.dueAt).cls}">${this._taskDueMeta(t.dueAt).label}</span>` : ''}
        </div>`).join('')
      : '<div class="mini-empty">— sin tareas, agrega una en :tasks —</div>';
    $('home-tasks-count').textContent = `${pending.length}`;
    tl.querySelectorAll('.mini-row').forEach(r =>
      r.addEventListener('click', () => { const t = Store.tasks.toggle(r.dataset.id); if (t && t.done) clawd.setState('celebrate'); this.renderHome(); }));

    // próximas fechas
    const dates = Store.dates.list()
      .map(d => ({ title: d.title, date: d.date, kind: 'date' }))
      .concat(Store.reminders.list().filter(r => !r.done).map(r => ({
        title: r.title, date: String(r.dueAt).slice(0, 10), dueAt: r.dueAt, kind: 'reminder',
      })))
      .sort((a, b) => String(a.dueAt || a.date).localeCompare(String(b.dueAt || b.date)));
    const dl = $('home-dates');
    dl.innerHTML = dates.length
      ? dates.slice(0, 4).map(d => {
          const cd = this._countdown(d.date);
          return `<div class="mini-row">
            <span class="mr-text">${d.kind === 'reminder' ? '◷ ' : ''}${escHtml(d.title)}</span>
            <span class="countdown ${cd.cls}">${cd.label}</span>
          </div>`;
        }).join('')
      : '<div class="mini-empty">— sin fechas importantes —</div>';

    // notas recientes
    const notes = Store.notes.list();
    const nl = $('home-notes');
    nl.innerHTML = notes.length
      ? notes.slice(0, 4).map(n => `
        <div class="mini-row" data-id="${n.id}">
          <span class="mr-text">${escHtml(n.title)}</span>
          <span class="mr-meta">${n.tag ? '#' + escHtml(n.tag) : ''}</span>
        </div>`).join('')
      : '<div class="mini-empty">— sin notas —</div>';
    nl.querySelectorAll('.mini-row').forEach(r =>
      r.addEventListener('click', () => { this.navigate('notes'); this._selectNote(r.dataset.id); }));
  },

  _countdown(iso) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(iso + 'T00:00:00');
    const days = Math.round((target - today) / 86400000);
    if (days < 0) return { label: 'pasó', cls: '' };
    if (days === 0) return { label: 'HOY', cls: 'today' };
    if (days === 1) return { label: 'mañana', cls: 'soon' };
    if (days <= 7) return { label: `en ${days} días`, cls: 'soon' };
    return { label: `en ${days} días`, cls: '' };
  },

  _taskDueMeta(dueAt) {
    if (!dueAt) return { label: 'sin fecha', cls: '' };
    const due = new Date(dueAt);
    if (isNaN(due.getTime())) return { label: 'fecha inválida', cls: '' };
    const now = new Date();
    const dateLabel = `${due.getDate()} ${MONTHS[due.getMonth()]} · ${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`;
    if (due < now) return { label: `venció ${dateLabel}`, cls: 'overdue' };
    if (fmtIsoLocal(due) === fmtIsoLocal(now)) return { label: `hoy · ${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`, cls: 'today' };
    return { label: `vence ${dateLabel}`, cls: '' };
  },

  _taskPriorityMeta(pri) {
    if (pri === 'hi') return { key: 'hi', label: '!alta' };
    if (pri === 'med') return { key: 'med', label: 'media' };
    return { key: 'lo', label: 'baja' };
  },

  _wireSortable(container, itemSelector, move, rerender) {
    let draggedId = null;
    const clearDropTargets = () => container.querySelectorAll(itemSelector).forEach(el =>
      el.classList.remove('drop-before', 'drop-after'));
    const clear = () => container.querySelectorAll(itemSelector).forEach(el => {
      el.classList.remove('dragging', 'drop-before', 'drop-after');
    });

    container.querySelectorAll(itemSelector).forEach(item => {
      const handle = item.querySelector('.drag-handle');
      if (!handle) return;
      handle.draggable = true;
      handle.addEventListener('dragstart', e => {
        draggedId = item.dataset.id;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedId);
      });
      handle.addEventListener('dragend', () => { draggedId = null; clear(); });
      item.addEventListener('dragover', e => {
        if (!draggedId || draggedId === item.dataset.id) return;
        e.preventDefault();
        clearDropTargets();
        item.classList.add(e.clientY < item.getBoundingClientRect().top + item.offsetHeight / 2 ? 'drop-before' : 'drop-after');
      });
      item.addEventListener('drop', e => {
        if (!draggedId || draggedId === item.dataset.id) return;
        e.preventDefault();
        const before = e.clientY < item.getBoundingClientRect().top + item.offsetHeight / 2;
        move(draggedId, item.dataset.id, before);
        draggedId = null;
        clear();
        rerender();
      });
    });
  },

  _wireNoteSortable(list) {
    let state = null;
    const items = () => [...list.querySelectorAll('.nl-item')];

    const animateMove = mutate => {
      const before = new Map(items().map(el => [el.dataset.id, el.getBoundingClientRect()]));
      mutate();
      items().forEach(el => {
        if (el === state?.item || typeof el.animate !== 'function') return;
        const first = before.get(el.dataset.id);
        const last = el.getBoundingClientRect();
        if (!first || first.top === last.top) return;
        el.animate([
          { transform: `translateY(${first.top - last.top}px)` },
          { transform: 'translateY(0)' },
        ], { duration: 170, easing: 'cubic-bezier(.2,.8,.2,1)' });
      });
    };

    const beginDrag = e => {
      if (!state || state.dragging) return;
      const rect = state.item.getBoundingClientRect();
      const ghost = state.item.cloneNode(true);
      ghost.classList.remove('active');
      ghost.classList.add('note-drag-ghost');
      ghost.style.width = rect.width + 'px';
      ghost.style.height = rect.height + 'px';
      ghost.style.left = rect.left + 'px';
      ghost.style.top = rect.top + 'px';
      document.body.appendChild(ghost);
      state.dragging = true;
      state.ghost = ghost;
      state.offsetX = e.clientX - rect.left;
      state.offsetY = e.clientY - rect.top;
      state.item.classList.add('note-drag-source');
      state.item.setPointerCapture?.(state.pointerId);
      document.body.classList.add('note-is-dragging');
    };

    const moveGhost = e => {
      const left = e.clientX - state.offsetX;
      const top = e.clientY - state.offsetY;
      state.ghost.style.transform = `translate3d(${left - parseFloat(state.ghost.style.left)}px, ${top - parseFloat(state.ghost.style.top)}px, 0) rotate(-.5deg) scale(1.025)`;

      const listRect = list.getBoundingClientRect();
      if (e.clientY < listRect.top + 32) list.scrollTop -= 12;
      else if (e.clientY > listRect.bottom - 32) list.scrollTop += 12;

      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.nl-item');
      if (!target || target === state.item || !list.contains(target)) return;
      const before = e.clientY < target.getBoundingClientRect().top + target.offsetHeight / 2;
      const alreadyThere = before ? state.item.nextElementSibling === target : target.nextElementSibling === state.item;
      if (alreadyThere) return;
      animateMove(() => list.insertBefore(state.item, before ? target : target.nextElementSibling));
    };

    const finish = (cancelled = false) => {
      if (!state) return;
      const { item, ghost, dragging, pointerId } = state;
      if (dragging) {
        document.body.classList.remove('note-is-dragging');
        item.releasePointerCapture?.(pointerId);
        if (cancelled) {
          ghost?.remove();
          item.classList.remove('note-drag-source');
          this._renderNoteList();
        } else {
          Store.notes.reorder(items().map(el => el.dataset.id));
          this._noteDragSuppressClick = true;
          setTimeout(() => { this._noteDragSuppressClick = false; }, 0);
          let revealed = false;
          const reveal = () => {
            if (revealed) return;
            revealed = true;
            ghost?.remove();
            item.classList.remove('note-drag-source');
            item.animate?.([
              { transform: 'scale(.985)', boxShadow: '0 0 0 transparent' },
              { transform: 'scale(1)', boxShadow: '0 0 12px color-mix(in srgb, var(--accent) 24%, transparent)' },
              { boxShadow: '0 0 0 transparent' },
            ], { duration: 260, easing: 'ease-out' });
          };
          if (ghost && typeof ghost.animate === 'function') {
            const target = item.getBoundingClientRect();
            const baseLeft = parseFloat(ghost.style.left);
            const baseTop = parseFloat(ghost.style.top);
            const dropTransform = `translate3d(${target.left - baseLeft}px, ${target.top - baseTop}px, 0) rotate(0) scale(1)`;
            const drop = ghost.animate([
              { transform: ghost.style.transform, opacity: .96 },
              { transform: dropTransform, opacity: .78 },
            ], { duration: 130, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
            drop.onfinish = reveal;
            drop.oncancel = reveal;
          } else reveal();
        }
      }
      state = null;
    };

    items().forEach(item => {
      item.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        state = { item, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, dragging: false };
      });
      item.addEventListener('pointermove', e => {
        if (!state || state.pointerId !== e.pointerId || state.item !== item) return;
        if (!state.dragging && Math.hypot(e.clientX - state.startX, e.clientY - state.startY) < 6) return;
        e.preventDefault();
        beginDrag(e);
        moveGhost(e);
      });
      item.addEventListener('pointerup', e => {
        if (state?.pointerId === e.pointerId) finish(false);
      });
      item.addEventListener('pointercancel', e => {
        if (state?.pointerId === e.pointerId) finish(true);
      });
    });
  },

  // ════════════════════ TAREAS ════════════════════
  renderTasks() {
    const tasks = Store.tasks.list();
    const done = tasks.filter(t => t.done).length;
    const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    $('tasks-progress-fill').style.width = pct + '%';
    $('tasks-progress-label').textContent = `${done}/${tasks.length}`;

    const list = $('tasks-list');
    list.innerHTML = tasks.length
      ? tasks.map(t => {
        const due = this._taskDueMeta(t.dueAt);
        const priority = this._taskPriorityMeta(t.pri);
        return `
        <div class="task-row ${t.done ? 'done' : ''}" data-id="${t.id}">
          <span class="drag-handle" title="arrastrar para ordenar" aria-hidden="true">⋮⋮</span>
          <span class="t-check ${t.done ? 'done' : ''}">${t.done ? '✓' : ''}</span>
          <span class="t-text">${escHtml(t.text)}</span>
          <label class="t-due-wrap ${due.cls}" title="vencimiento opcional">
            <span>${t.dueAt ? escHtml(due.label) : 'sin fecha'}</span>
            <input type="datetime-local" class="t-due" data-id="${t.id}" value="${t.dueAt || ''}" aria-label="editar vencimiento">
          </label>
          <button class="t-pri ${priority.key}" data-id="${t.id}" title="cambiar prioridad">${priority.label}</button>
          <button class="t-del" data-id="${t.id}" title="eliminar">×</button>
        </div>`;
      }).join('')
      : '<div class="empty-state"><span class="es-glyph">◇</span>sin tareas — escribe arriba y Enter</div>';

    list.querySelectorAll('.task-row').forEach(row => {
      row.querySelector('.t-check').addEventListener('click', () => {
        const t = Store.tasks.toggle(row.dataset.id);
        if (t && t.done) clawd.setState('celebrate');
        this.renderTasks();
      });
      row.querySelector('.t-text').addEventListener('click', () => {
        Store.tasks.toggle(row.dataset.id); this.renderTasks();
      });
    });
    list.querySelectorAll('.t-pri').forEach(btn =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = Store.tasks.list().find(x => x.id === btn.dataset.id);
        const next = t.pri === 'lo' ? 'med' : t.pri === 'med' ? 'hi' : 'lo';
        Store.tasks.setPri(btn.dataset.id, next);
        this.renderTasks();
      }));
    list.querySelectorAll('.t-due').forEach(input =>
      input.addEventListener('change', (e) => {
        e.stopPropagation();
        Store.tasks.setDue(input.dataset.id, input.value || null);
        this.renderTasks();
      }));
    list.querySelectorAll('.t-del').forEach(btn =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        Store.tasks.remove(btn.dataset.id);
        this.renderTasks();
      }));
    this._wireSortable(list, '.task-row', (id, targetId, before) => Store.tasks.move(id, targetId, before), () => this.renderTasks());
  },

  addTask(text, options = {}) {
    if (!text || !text.trim()) return;
    const task = parseTaskDraft(text, options.pri, options.dueAt);
    if (!task.text) { Toast.show('warn', 'tarea', 'escribe una descripción para la tarea'); return; }
    if (task.dueError) { Toast.show('warn', 'tarea', 'la fecha de vencimiento no es válida'); return; }
    Store.tasks.add(task.text, task.pri, task.dueAt);
    clawd.setState('workout');
    this._refreshNeofetch();
    if (this.currentView === 'tasks') this.renderTasks();
    if (this.currentView === 'home') this.renderHome();
  },

  _addTaskFromInput() {
    const input = $('task-input');
    const text = input.value.trim();
    if (!text) return;
    this.addTask(text, {
      pri: $('task-priority-input').value,
      dueAt: $('task-due-input').value || null,
    });
    input.value = '';
    $('task-priority-input').value = 'lo';
    $('task-due-input').value = '';
    this._updateTaskSyntaxHint();
    input.focus({ preventScroll: true });
  },

  _updateTaskSyntaxHint() {
    const hint = $('task-syntax-hint');
    const input = $('task-input');
    if (!hint || !input) return;
    const parsed = parseTaskDraft(input.value, $('task-priority-input')?.value, $('task-due-input')?.value);
    if (!input.value.trim()) {
      hint.textContent = 'ej. entregar reporte, alta, vence en 2 días';
      hint.className = 'task-syntax-hint';
      return;
    }
    if (parsed.dueError) {
      hint.textContent = 'fecha de vencimiento inválida';
      hint.className = 'task-syntax-hint error';
      return;
    }
    const priLabel = parsed.pri === 'hi' ? 'alta' : parsed.pri === 'med' ? 'media' : 'baja';
    const parts = [`prioridad ${priLabel}`];
    if (parsed.dueAt) parts.push(this._taskDueMeta(parsed.dueAt).label);
    else parts.push('sin vencimiento');
    hint.textContent = parts.join(' · ');
    hint.className = 'task-syntax-hint active';
  },

  // ════════════════════ RECORDATORIOS ════════════════════
  _initReminders() {
    const mode = $('notification-mode');
    const ai = $('notification-ai');
    const enable = $('notification-enable');
    const add = $('reminder-add-btn');
    const cfg = Store.notifications.get();

    if (mode) {
      mode.value = cfg.mode;
      mode.addEventListener('change', () => {
        Store.notifications.update({ mode: mode.value });
        this._renderNotificationStatus();
      });
    }
    if (ai) {
      ai.checked = cfg.aiPersonalized;
      ai.addEventListener('change', () => {
        Store.notifications.update({ aiPersonalized: ai.checked });
        this._renderNotificationStatus();
      });
    }
    enable?.addEventListener('click', () => this._toggleDesktopNotifications());
    $('background-toggle')?.addEventListener('click', () => this._toggleBackgroundMode());
    $('notification-test')?.addEventListener('click', () => this._testDesktopNotification());
    $('backup-export')?.addEventListener('click', () => this._exportBackup());
    $('backup-import')?.addEventListener('click', () => $('backup-import-file')?.click());
    $('backup-import-file')?.addEventListener('change', event => this._importBackup(event.target.files?.[0]));
    add?.addEventListener('click', () => this.addReminder());
    $('reminder-title-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.addReminder(); }
    });
    $('reminder-note-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.addReminder(); }
    });
    this._renderNotificationStatus();
    this._notificationTick();
    this._notificationTimer = setInterval(() => this._notificationTick(), 30000);
  },

  async _toggleDesktopNotifications() {
    const cfg = Store.notifications.get();
    if (cfg.desktopEnabled) {
      Store.notifications.update({ desktopEnabled: false });
      this._renderNotificationStatus();
      return;
    }
    if (window.spritenote?.isElectron) {
      Store.notifications.update({ desktopEnabled: true });
      this._renderNotificationStatus();
      Toast.show('info', 'notificaciones', 'notificaciones nativas activadas');
      return;
    }
    if (!('Notification' in window)) {
      Toast.show('warn', 'notificaciones', 'este navegador no ofrece notificaciones de escritorio');
      return;
    }
    let permission = Notification.permission;
    if (permission !== 'granted') permission = await Notification.requestPermission();
    const enabled = permission === 'granted';
    Store.notifications.update({ desktopEnabled: enabled });
    this._renderNotificationStatus();
    Toast.show(enabled ? 'info' : 'warn', 'notificaciones', enabled ? 'notificaciones de escritorio activadas' : 'permiso de notificaciones no concedido');
  },

  async _testDesktopNotification() {
    if (window.spritenote?.isElectron) {
      if (!Store.notifications.get().desktopEnabled) Store.notifications.update({ desktopEnabled: true });
      const result = await window.spritenote.notifications.test();
      this._renderNotificationStatus();
      Toast.show(result.sent ? 'info' : 'warn', 'notificaciones', result.sent ? 'prueba enviada' : 'el sistema no admite notificaciones');
      return;
    }
    const cfg = Store.notifications.get();
    if (!cfg.desktopEnabled || !('Notification' in window) || Notification.permission !== 'granted') {
      await this._toggleDesktopNotifications();
    }
    const ready = Store.notifications.get().desktopEnabled && 'Notification' in window && Notification.permission === 'granted';
    if (!ready) return;
    try {
      const identity = this._notificationIdentity('prueba');
      new Notification(identity.title, {
        body: 'Las notificaciones están listas.', icon: identity.characterAvatar || 'assets/logo.png', tag: 'spritenote-test',
      });
      Toast.show('info', 'notificaciones', 'prueba enviada');
    } catch (_) {
      Store.notifications.update({ desktopEnabled: false });
      this._renderNotificationStatus();
      Toast.show('warn', 'notificaciones', 'el navegador bloqueó la notificación de prueba');
    }
  },

  _renderNotificationStatus() {
    const status = $('notification-status');
    const button = $('notification-enable');
    const backgroundButton = $('background-toggle');
    const cfg = Store.notifications.get();
    const native = Boolean(window.spritenote?.isElectron);
    const supported = native || 'Notification' in window;
    const granted = native || (supported && Notification.permission === 'granted');
    const desktopOn = cfg.desktopEnabled && granted;
    if (button) button.textContent = desktopOn ? 'desactivar escritorio' : 'activar escritorio';
    if (backgroundButton) {
      backgroundButton.hidden = !native;
      backgroundButton.textContent = cfg.backgroundEnabled ? 'desactivar segundo plano' : 'activar segundo plano';
    }
    if (!status) return;
    const modeLabels = { basic: 'frecuencia baja', intermediate: 'frecuencia media', extreme: 'frecuencia alta' };
    const ai = cfg.aiPersonalized ? (Gemini.hasKey() ? 'IA activa' : 'IA sin API key; usa mensajes genéricos') : 'mensajes genéricos';
    const runtime = native
      ? `<span class="${cfg.backgroundEnabled ? 'on' : 'off'}">${cfg.backgroundEnabled ? 'segundo plano activo' : 'se cierra por completo al salir'}</span>`
      : 'mientras SpriteNote esté abierto';
    status.innerHTML = `<span class="${desktopOn ? 'on' : 'off'}">● ${desktopOn ? 'escritorio activo' : 'escritorio inactivo'}</span> · modo ${modeLabels[cfg.mode]} · ${ai} · ${runtime}`;
  },

  async _toggleBackgroundMode() {
    if (!window.spritenote?.background) return;
    const enabled = !Store.notifications.get().backgroundEnabled;
    Store.notifications.update({ backgroundEnabled: enabled });
    try {
      const result = await window.spritenote.background.setEnabled(enabled);
      this._renderNotificationStatus();
      const suffix = result.development ? ' (el autoarranque se registra en la app empaquetada)' : '';
      Toast.show('info', 'segundo plano', `${enabled ? 'activado' : 'desactivado'}${suffix}`);
    } catch (_) {
      Store.notifications.update({ backgroundEnabled: !enabled });
      this._renderNotificationStatus();
      Toast.show('warn', 'segundo plano', 'no se pudo cambiar el autoarranque');
    }
  },

  _exportBackup() {
    const preferences = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('spritenote:') && key !== 'spritenote:data:v1') {
        preferences[key] = localStorage.getItem(key);
      }
    }
    const payload = {
      format: 'spritenote-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: Store.snapshot(),
      preferences,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `spritenote-respaldo-${isoTodayApp()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    Toast.show('info', 'respaldo', 'respaldo JSON creado');
  },

  async _importBackup(file) {
    const input = $('backup-import-file');
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload?.format !== 'spritenote-backup' || !payload.data) throw new Error('Formato no reconocido');
      if (!confirm('Esto reemplazará los datos actuales de SpriteNote. ¿Continuar?')) return;
      Store.replace(payload.data);
      Object.entries(payload.preferences || {}).forEach(([key, value]) => {
        if (key.startsWith('spritenote:') && typeof value === 'string') localStorage.setItem(key, value);
      });
      Toast.show('info', 'respaldo', 'datos restaurados; SpriteNote se reiniciará');
      setTimeout(() => location.reload(), 400);
    } catch (error) {
      Toast.show('warn', 'respaldo', `no se pudo importar: ${escHtml(error.message)}`);
    } finally {
      if (input) input.value = '';
    }
  },

  addReminder() {
    const title = $('reminder-title-input').value.trim();
    const dueAt = $('reminder-due-input').value;
    const note = $('reminder-note-input').value.trim();
    if (!title || !dueAt) {
      Toast.show('warn', 'recordatorio', 'escribe el recordatorio y elige fecha y hora');
      return;
    }
    const reminder = Store.reminders.add(title, dueAt, note);
    if (!reminder) return;
    $('reminder-title-input').value = '';
    $('reminder-due-input').value = '';
    $('reminder-note-input').value = '';
    clawd.setState('idea');
    this.renderReminders();
  },

  renderReminders() {
    const list = $('reminders-list');
    if (!list) return;
    const reminders = Store.reminders.list();
    list.innerHTML = reminders.length ? reminders.map(r => {
      const due = this._taskDueMeta(r.dueAt);
      return `<div class="reminder-row ${r.done ? 'done' : ''} ${due.cls} ${r.id === this._focusReminderId ? 'notification-focus' : ''}" data-id="${r.id}">
        <button class="r-check" title="${r.done ? 'marcar pendiente' : 'marcar completado'}">${r.done ? '✓' : ''}</button>
        <div class="r-content">
          <div class="r-title">${escHtml(r.title)}</div>
          <div class="r-note">${escHtml(r.note || '')}</div>
        </div>
        <div class="r-when">${escHtml(due.label)}</div>
        <div class="r-actions">
          <button class="r-gcal" title="crear borrador en Google Calendar">+ gcal</button>
          <button class="r-del" title="eliminar">×</button>
        </div>
      </div>`;
    }).join('') : '<div class="empty-state"><span class="es-glyph">◷</span>sin recordatorios</div>';

    list.querySelectorAll('.reminder-row').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('.r-check').addEventListener('click', () => {
        const r = Store.reminders.toggle(id);
        if (r?.done) clawd.setState('celebrate');
        this.renderReminders();
      });
      row.querySelector('.r-gcal').addEventListener('click', () => {
        const r = Store.reminders.list().find(x => x.id === id);
        if (r) this._openGoogleCalendar(r);
      });
      row.querySelector('.r-del').addEventListener('click', () => {
        Store.reminders.remove(id);
        this.renderReminders();
      });
    });
    if (this._focusReminderId) {
      list.querySelector(`[data-id="${CSS.escape(this._focusReminderId)}"]`)?.scrollIntoView({ block: 'center' });
      this._focusReminderId = null;
    }
    this._renderNotificationStatus();
  },

  _openGoogleCalendar(reminder) {
    const start = new Date(reminder.dueAt);
    if (isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + 30 * 60000);
    const stamp = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: reminder.title,
      dates: `${stamp(start)}/${stamp(end)}`,
      details: [reminder.note, 'Creado en Spritenote'].filter(Boolean).join('\n\n'),
      ctz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    });
    window.open(`https://calendar.google.com/calendar/render?${params}`, '_blank', 'noopener');
  },

  _notificationIdentity(kind = 'recordatorio') {
    if (window.clawd?.getNotificationIdentity) return window.clawd.getNotificationIdentity(kind);
    const pet = window.clawd?.pet || {};
    const label = pet.label || (window.clawd?.getPetLabel?.()) || 'SpriteNote';
    const suffix = kind ? ` · ${kind}` : '';
    return {
      title: `${label} - SpriteNote${suffix}`,
      characterKey: pet.key || window.clawd?.getPetKey?.() || 'clawd',
      characterLabel: label,
      characterAvatar: pet.avatar || pet.assets?.idle || 'assets/logo.png',
    };
  },

  _notificationMessage(reminder, slot, dueMs) {
    return ReminderPolicy.message(reminder, slot);
  },

  _notificationChatMessageId(reminder, logKey) {
    return `notification:${String(reminder?.id || 'unknown').slice(0, 80)}:${String(logKey || 'due').slice(0, 100)}`;
  },

  _recordNotificationChatMessage(reminder, slot, logKey, message) {
    const identity = this._notificationIdentity('recordatorio');
    const id = this._notificationChatMessageId(reminder, logKey);
    const existed = Store.characterMessages?.has?.(identity.characterKey, id);
    const entry = Store.characterMessages?.add?.({
      id,
      characterKey: identity.characterKey,
      role: 'model',
      kind: 'recordatorio',
      source: 'notification',
      text: message,
      createdAt: Date.now(),
      reminderId: reminder?.id,
      notificationKey: logKey,
    });
    if (entry && !existed) {
      Gemini.appendCharacterMessage?.({
        characterKey: identity.characterKey,
        text: entry.text,
        mode: Gemini.getCharacterMode?.(identity.characterKey),
      });
    }
    this._syncCharacterNotificationMessages();
    return entry;
  },

  async _sendReminderNotification(reminder, slot, logKey, markNotified = true) {
    if (markNotified) Store.reminders.markNotified(reminder.id, logKey);
    const cfg = Store.notifications.get();
    let message = this._notificationMessage(reminder, slot);
    if (cfg.aiPersonalized && Gemini.hasKey() && typeof Gemini.notificationText === 'function') {
      try { message = await Gemini.notificationText({ reminder, stage: slot.stage, fallback: message }); }
      catch (_) { /* conserva el mensaje genérico */ }
    }
    this._recordNotificationChatMessage(reminder, slot, logKey, message);
    Toast.show('info', 'recordatorio', escHtml(message), 8000);
    if (!cfg.desktopEnabled) return;
    const identity = this._notificationIdentity('recordatorio');
    if (window.spritenote?.notifications?.show) {
      try {
        await window.spritenote.notifications.show({
          ...identity,
          kind: 'recordatorio',
          body: message,
          reminderId: reminder.id,
          urgent: cfg.mode === 'extreme' && slot.stage !== 'before',
        });
      } catch (_) { /* el aviso ya quedó registrado; conserva el toast local */ }
      return;
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(identity.title, {
        body: message,
        icon: identity.characterAvatar || 'assets/logo.png',
        tag: `spritenote-reminder-${reminder.id}-${logKey}`,
        requireInteraction: cfg.mode === 'extreme' && slot.stage !== 'before',
      });
      n.onclick = () => { window.focus(); this.navigate('reminders'); n.close(); };
    } catch (_) {
      Store.notifications.update({ desktopEnabled: false });
      this._renderNotificationStatus();
    }
  },

  async _notificationTick() {
    if (this._notificationBusy) return;
    const cfg = Store.notifications.get();
    if (window.spritenote?.isElectron && (!cfg.aiPersonalized || !cfg.desktopEnabled)) return;
    this._notificationBusy = true;
    try {
      const due = ReminderPolicy.dueNotifications(
        Store.reminders.list(),
        cfg.mode,
        Date.now(),
        24 * 60 * 60 * 1000,
      );
      const latest = ReminderPolicy.latestDueNotifications
        ? ReminderPolicy.latestDueNotifications(due)
        : due;
      for (const { reminder, slot, key } of latest) {
        due.filter(item => item.reminder.id === reminder.id)
          .forEach(item => Store.reminders.markNotified(reminder.id, item.key));
        await this._sendReminderNotification(reminder, slot, key, false);
      }
    } finally {
      this._notificationBusy = false;
    }
  },

  // ════════════════════ FECHAS ════════════════════
  renderDates() {
    const dates = Store.dates.list();
    const list = $('dates-list');
    list.innerHTML = dates.length
      ? dates.map(d => {
          const dt = new Date(d.date + 'T00:00:00');
          const cd = this._countdown(d.date);
          return `<div class="date-row" data-id="${d.id}">
            <div class="d-cal">
              <div class="d-day">${dt.getDate()}</div>
              <div class="d-mon">${MONTHS_UP[dt.getMonth()]}</div>
            </div>
            <div class="d-info">
              <div class="d-title">${escHtml(d.title)}</div>
              <div class="d-note">${escHtml(d.note || '')}</div>
            </div>
            <span class="countdown ${cd.cls}">${cd.label}</span>
            <button class="d-del" data-id="${d.id}" title="eliminar">×</button>
          </div>`;
        }).join('')
      : '<div class="empty-state"><span class="es-glyph">▣</span>sin fechas — agrega una arriba</div>';

    list.querySelectorAll('.d-del').forEach(btn =>
      btn.addEventListener('click', () => { Store.dates.remove(btn.dataset.id); this.renderDates(); }));
  },

  addDate() {
    const title = $('date-title-input').value.trim();
    const date = $('date-date-input').value;
    const note = $('date-note-input').value.trim();
    if (!title || !date) { Toast.show('warn', 'falta', 'pon título y fecha'); return; }
    Store.dates.add(title, date, note);
    $('date-title-input').value = '';
    $('date-date-input').value = '';
    $('date-note-input').value = '';
    clawd.setState('idea');
    this.renderDates();
  },

  // ════════════════════ NOTAS (mini-Notion) ════════════════════
  renderNotes() {
    const notes = Store.notes.list();
    if (!this.currentNoteId || !Store.notes.get(this.currentNoteId)) {
      this.currentNoteId = notes.length ? notes[0].id : null;
    }
    this._renderNoteList();
    this._renderNoteEditor();
  },

  _renderNoteList() {
    const notes = Store.notes.list();
    const list = $('notes-list-items');
    list.innerHTML = notes.length
      ? notes.map(n => `
        <div class="nl-item ${n.id === this.currentNoteId ? 'active' : ''}" data-id="${n.id}">
          <div class="nl-title"><span class="nl-glyph">▸</span>${escHtml(n.title)}</div>
          <div class="nl-meta">${this._relTime(n.updated)}${n.tag ? ' · <span class="nl-tag">#' + escHtml(n.tag) + '</span>' : ''}</div>
        </div>`).join('')
      : '<div class="mini-empty" style="padding:14px">sin notas</div>';
    list.querySelectorAll('.nl-item').forEach(it =>
      it.addEventListener('click', () => { if (!this._noteDragSuppressClick) this._selectNote(it.dataset.id); }));
    this._wireNoteSortable(list);
  },

  _selectNote(id) {
    this.currentNoteId = id;
    if (this.currentView !== 'notes') this.navigate('notes');
    else { this._renderNoteList(); this._renderNoteEditor(); }
  },

  _renderNoteEditor() {
    const pane = $('note-pane');
    const note = this.currentNoteId ? Store.notes.get(this.currentNoteId) : null;
    if (!note) {
      pane.innerHTML = `<div class="note-empty"><span style="font-size:24px">◉</span>
        <div>sin nota seleccionada</div>
        <button class="btn btn-primary btn-sm" onclick="App.newNote()">+ nueva nota</button></div>`;
      return;
    }
    pane.innerHTML = `
      <div class="note-toolbar">
        <input class="note-title" id="ed-title" value="${escHtml(note.title).replace(/"/g, '&quot;')}" placeholder="Título...">
        <input class="note-tag" id="ed-tag" value="${escHtml(note.tag || '').replace(/"/g, '&quot;')}" placeholder="#tag">
        <div class="seg-toggle" id="ed-seg">
          <button data-m="edit"  class="${this.noteViewMode === 'edit' ? 'active' : ''}">edit</button>
          <button data-m="split" class="${this.noteViewMode === 'split' ? 'active' : ''}">split</button>
          <button data-m="read"  class="${this.noteViewMode === 'read' ? 'active' : ''}">leer</button>
          <button data-m="guide" class="seg-guide ${this.noteViewMode === 'guide' ? 'active' : ''}" title="chuleta de Markdown">guía</button>
        </div>
        <button class="btn btn-danger btn-sm" id="ed-del">eliminar</button>
      </div>
      <div class="note-body ${this.noteViewMode}" id="ed-body">
        <textarea class="note-editor-ta" id="ed-content" spellcheck="false" placeholder="Escribe en markdown...  # título, - [ ] tarea, \`\`\`código\`\`\`">${escHtml(note.content)}</textarea>
        <div class="note-preview md" id="ed-preview"></div>
        <div class="note-guide md" id="ed-guide">
          <p class="noteguide-hint">📓 Guía rápida de Markdown — referencia mientras escribes. Para ejemplos completos abre la nota «Guía rápida de Markdown».</p>
          ${renderMarkdown(MD_CHEAT)}
        </div>
      </div>`;

    const ta = $('ed-content');
    const prev = $('ed-preview');
    const updatePreview = () => { prev.innerHTML = renderMarkdown(ta.value); };
    updatePreview();

    ta.addEventListener('input', () => {
      updatePreview();
      this._debouncedSave();
    });
    $('ed-title').addEventListener('input', () => this._debouncedSave());
    $('ed-tag').addEventListener('input', () => this._debouncedSave());

    $('ed-seg').querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => {
        this.noteViewMode = b.dataset.m;
        $('ed-body').className = 'note-body ' + this.noteViewMode;
        $('ed-seg').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      }));

    $('ed-del').addEventListener('click', async () => {
      const ok = await this.confirm({
        title: 'Eliminar nota',
        body: `¿Seguro que quieres eliminar <b>«${escHtml(note.title || 'Nota sin título')}»</b>?<br>Esta acción no se puede deshacer.`,
        okText: 'Eliminar', danger: true,
      });
      if (!ok) return;
      Store.notes.remove(this.currentNoteId);
      this.currentNoteId = null;
      this._refreshNeofetch();
      this.renderNotes();
    });
  },

  _debouncedSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      if (!this.currentNoteId) return;
      Store.notes.update(this.currentNoteId, {
        title: $('ed-title').value.trim() || 'Nota sin título',
        tag: $('ed-tag').value.trim().replace(/^#/, ''),
        content: $('ed-content').value,
      });
      this._renderNoteList();
    }, 400);
  },

  newNote() {
    const n = Store.notes.create();
    this.currentNoteId = n.id;
    this._refreshNeofetch();
    if (this.currentView !== 'notes') this.navigate('notes');
    else { this._renderNoteList(); this._renderNoteEditor(); }
    setTimeout(() => $('ed-title')?.select(), 50);
    clawd.setState('idea');
  },

  _relTime(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'ahora';
    if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    return `hace ${Math.floor(s / 86400)} d`;
  },

  // ════════════════════ HÁBITOS · CALIFICACIÓN · CALENDARIO ════════════════════
  GRADE_META: {
    P: { label: 'Perfecto',      cls: 'g-P', gif: 'celebracion', msg: '¡Día redondo! Cumpliste todo. 🦀' },
    A: { label: 'Casi perfecto', cls: 'g-A', gif: 'ejercicio',   msg: 'Muy bien — casi todo. Un último empujón mañana.' },
    B: { label: 'A medias',      cls: 'g-B', gif: 'timido',      msg: 'Cumpliste la mitad. Mañana subimos el listón.' },
    C: { label: 'Flojo',         cls: 'g-C', gif: 'confundido',  msg: 'Algo es algo. Retomemos el ritmo.' },
    D: { label: 'Desalineado',   cls: 'g-D', gif: 'mareado',     msg: 'Hoy se desalineó. Sin culpa: mañana es otro día.' },
  },
  _gradeMeta(letter) {
    return this.GRADE_META[letter] ||
      { label: 'sin datos', cls: 'g-_', gif: 'idea', msg: 'Agrega hábitos y empieza a marcarlos.' };
  },

  // ── Vista de hábitos ──────────────────────────────────────────
  renderHabits() {
    this._habitsWired || this._wireHabits();
    this._renderGradeCard($('habits-grade-card'));
    this._renderWeekStrip($('habits-week'));
    this._renderHabitList();
    this._renderWeeklyGoalList();
  },

  _wireHabits() {
    const input = $('habit-input');
    if (input) input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { this.addHabit(e.target.value); e.target.value = ''; }
    });
    const wgInput = $('weekly-goal-input');
    if (wgInput) wgInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { this.addWeeklyGoal(e.target.value); e.target.value = ''; }
    });
    $('habits-eval-btn')?.addEventListener('click', () => this.openEval());
    $('habits-advice-btn')?.addEventListener('click', () => this.askGeminiAboutHabits());
    this._habitsWired = true;
  },

  // Pide al motor activo que analice los hábitos y sugiera mejoras.
  askGeminiAboutHabits() {
    if (!Gemini.hasKey()) {
      this.navigate('ai');
      Toast.show('warn', 'IA', `configura la API key de ${Gemini.providerLabel()}: <b>:ai key ${Gemini.getProvider()} &lt;tu_api_key&gt;</b>`);
      return;
    }
    if (!Store.habits.list().length) {
      Toast.show('info', 'hábitos', 'agrega algunos hábitos primero para que pueda analizarlos');
      return;
    }
    if (!Gemini.getConfig().toolsEnabled) {
      Gemini.setTools(true);
      Toast.show('info', 'IA', 'activé las herramientas para poder analizar tus hábitos');
    }
    this.navigate('ai');
    const input = $('ai-input');
    if (input) input.value = 'Analiza mi cumplimiento de hábitos de las últimas 2 semanas y dame sugerencias concretas y realistas para mejorar los que más batallo.';
    this._aiSend();
  },

  _renderHabitList() {
    const today = isoTodayApp();
    const habits = Store.habits.list();
    const list = $('habits-list');
    if (!list) return;
    list.innerHTML = habits.length
      ? habits.map(h => {
          const done = Store.log.isDone(today, h.id);
          return `<div class="habit-row ${done ? 'done' : ''}" data-id="${h.id}">
            <span class="hb-check ${done ? 'done' : ''}">${done ? '✓' : ''}</span>
            <span class="hb-text">${escHtml(h.text)}</span>
            <button class="hb-del" data-id="${h.id}" title="eliminar">×</button>
          </div>`;
        }).join('')
      : '<div class="empty-state"><span class="es-glyph">❉</span>sin hábitos — agrega tus metas diarias arriba</div>';

    list.querySelectorAll('.habit-row').forEach(row => {
      row.querySelector('.hb-check').addEventListener('click', () => this._toggleHabit(row.dataset.id));
      row.querySelector('.hb-text').addEventListener('click', () => this._toggleHabit(row.dataset.id));
    });
    list.querySelectorAll('.hb-del').forEach(btn =>
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await this.confirm({
          title: 'Eliminar hábito',
          body: '¿Eliminar este hábito? También se quitará de tu registro diario.',
          okText: 'Eliminar', danger: true,
        });
        if (ok) { Store.habits.remove(btn.dataset.id); this.renderHabits(); }
      }));
  },

  _toggleHabit(id) {
    const today = isoTodayApp();
    Store.log.toggle(today, id);
    const g = Store.log.gradeFor(today);
    clawd.setState(g === 'P' ? 'celebrate' : g === 'A' ? 'heart' : 'coffee');
    if (this.currentView === 'habits') {
      this._renderGradeCard($('habits-grade-card'));
      this._renderWeekStrip($('habits-week'));
      this._renderHabitList();
    }
    if (this.currentView === 'calendar') this.renderCalendar();
    if (!$('daily-eval').hidden) this._renderEval();
  },

  addHabit(text) {
    text = (text || '').trim();
    if (!text) return;
    Store.habits.add(text);
    Toast.show('info', 'hábito', 'agregado: ' + escHtml(text));
    clawd.setState('coffee');
    if (this.currentView !== 'habits') this.navigate('habits');
    else this.renderHabits();
  },

  addWeeklyGoal(text) {
    text = (text || '').trim();
    if (!text) return;
    Store.weeklyGoals.add(text);
    Toast.show('info', 'meta semanal', 'agregada: ' + escHtml(text));
    clawd.setState('idea');
    if (this.currentView === 'habits') this._renderWeeklyGoalList();
  },

  _renderWeeklyGoalList() {
    const list = $('weekly-goals-list');
    if (!list) return;
    const goals = Store.weeklyGoals.list();
    const weekKey = Store.weeklyLog._weekKey();

    list.innerHTML = goals.length
      ? goals.map(g => {
          const done = Store.weeklyLog.isDone(weekKey, g.id);
          return `<div class="habit-row ${done ? 'done' : ''}" data-id="${g.id}">
            <span class="hb-check ${done ? 'done' : ''}">${done ? '✓' : ''}</span>
            <span class="hb-text">${escHtml(g.text)}</span>
            <button class="hb-del" data-id="${g.id}" title="eliminar">×</button>
          </div>`;
        }).join('')
      : '<div class="empty-state" style="padding:8px 0"><span class="es-glyph" style="font-size:16px">◈</span>sin metas semanales — agrega una arriba</div>';

    list.querySelectorAll('.habit-row').forEach(row => {
      row.querySelector('.hb-check').addEventListener('click', () => this._toggleWeeklyGoal(row.dataset.id));
      row.querySelector('.hb-text').addEventListener('click', () => this._toggleWeeklyGoal(row.dataset.id));
    });
    list.querySelectorAll('.hb-del').forEach(btn =>
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await this.confirm({ title: 'Eliminar meta semanal', body: '¿Eliminar esta meta semanal?', okText: 'Eliminar', danger: true });
        if (ok) { Store.weeklyGoals.remove(btn.dataset.id); this._renderWeeklyGoalList(); this._updateCalendarWeeklyAccum(); }
      }));

    const prog = $('weekly-goal-progress');
    if (prog) {
      const total = goals.length;
      const done = total ? Store.weeklyLog.doneCount(weekKey) : 0;
      prog.innerHTML = total
        ? `<div class="wgp-bar"><div class="wgp-fill" style="width:${Math.round(done/total*100)}%"></div></div>
           <span class="wgp-label">${done}/${total} esta semana</span>`
        : '';
    }
  },

  _toggleWeeklyGoal(id) {
    const weekKey = Store.weeklyLog._weekKey();
    Store.weeklyLog.toggle(weekKey, id);
    if (this.currentView === 'habits') this._renderWeeklyGoalList();
    this._updateCalendarWeeklyAccum();
  },

  _updateCalendarWeeklyAccum() {
    if (this.currentView === 'calendar') this.renderCalendar();
    // también actualiza el acumulado si está en vista de hábitos
    const weekKey = Store.weeklyLog._weekKey();
    const wPct = Store.weeklyLog.completionPct(weekKey);
    const grades = Store.log.weekGrades().map(d => d.grade);
    const accum = Store.log.weeklyAggregate(grades, wPct);
    const accEl = $('cal-week-accum');
    if (accEl) {
      const meta = this._gradeMeta(accum);
      accEl.textContent = accum ? accum + ' · ' + meta.label : '—';
      accEl.className = 'ws-accum ' + (accum ? meta.cls : 'g-_');
    }
  },

  // ── Tarjeta de calificación del día ───────────────────────────
  _renderGradeCard(el) {
    if (!el) return;
    const today = isoTodayApp();
    const total = Store.habits.list().length;
    const done = Store.log.doneCount(today);
    const grade = total ? (Store.log.gradeFor(today) || 'D') : null;
    const meta = this._gradeMeta(grade);
    el.className = 'grade-card ' + (grade ? meta.cls : 'g-_');
    el.innerHTML = `
      <div class="gc-letter">${grade || '—'}</div>
      <div class="gc-info">
        <div class="gc-label">calificación de hoy · ${grade ? escHtml(meta.label) : 'sin hábitos'}</div>
        <div class="gc-count">${done}/${total} hábitos cumplidos</div>
        <div class="gc-msg">${grade ? escHtml(meta.msg) : 'agrega tus metas diarias para empezar'}</div>
      </div>`;
  },

  // ── Tira semanal (Lun..Dom con calificaciones) ────────────────
  _renderWeekStrip(el) {
    if (!el) return;
    const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const week = Store.log.weekGrades();
    el.innerHTML = week.map(d => {
      const meta = this._gradeMeta(d.grade);
      const cls = d.grade ? meta.cls : (d.isFuture ? 'g-future' : 'g-none');
      return `<div class="ws-day ${d.isToday ? 'today' : ''}">
        <span class="wd-name">${DOW[d.dow]}</span>
        <span class="wd-grade ${cls}">${d.grade || (d.isFuture ? '·' : '—')}</span>
      </div>`;
    }).join('');
  },

  // ── Modal de evaluación (Claw'd al centro) ────────────────────
  openEval() {
    this._evalWired || this._wireEval();
    this._renderEval();
    const ov = $('daily-eval');
    ov.hidden = false;
    requestAnimationFrame(() => ov.classList.add('show'));
    localStorage.setItem('spritenote:evalSeen', isoTodayApp());
    // Al preguntar por tu día, el personaje reacciona con curiosidad/confusión.
    if (window.clawd && window.clawd.setState) window.clawd.setState('confused');
  },

  closeEval() {
    const ov = $('daily-eval');
    ov.classList.remove('show');
    setTimeout(() => { ov.hidden = true; }, 220);
  },

  // ── Check-in diario por hora (def. 20:00 / 8pm, ajustable) ──────
  _evalHour() {
    const h = parseInt(localStorage.getItem('spritenote:evalHour'), 10);
    return Number.isInteger(h) && h >= 0 && h <= 23 ? h : 20;
  },

  _maybeDailyEval() {
    if (!Store.habits.list().length) return;
    if (localStorage.getItem('spritenote:evalSeen') === isoTodayApp()) return;
    if (new Date().getHours() >= this._evalHour()) this.openEval();
  },

  // Intenta ahora y revisa periódicamente por si la app queda abierta hasta la hora.
  _scheduleDailyEval() {
    this._maybeDailyEval();
    clearInterval(this._evalTimer);
    this._evalTimer = setInterval(() => this._maybeDailyEval(), 5 * 60 * 1000);
  },

  _wireEval() {
    $('eval-close')?.addEventListener('click', () => this.closeEval());
    $('eval-done')?.addEventListener('click', () => this.closeEval());
    $('daily-eval')?.addEventListener('click', (e) => { if (e.target.id === 'daily-eval') this.closeEval(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('daily-eval').hidden) this.closeEval();
    });
    this._evalWired = true;
  },

  _renderEval() {
    const today = isoTodayApp();
    const habits = Store.habits.list();
    const total = habits.length;
    const done = Store.log.doneCount(today);
    const grade = total ? (Store.log.gradeFor(today) || 'D') : null;
    const meta = this._gradeMeta(grade);

    const d = new Date(today + 'T00:00:00');
    $('eval-date').textContent = `${DAYS_FULL[d.getDay()]} ${d.getDate()} de ${MONTHS_FULL[d.getMonth()]}`;

    const gifStateMap = {
      celebracion: 'celebrate',
      ejercicio:   'workout',
      timido:      'shy',
      confundido:  'confused',
      mareado:     'dizzy',
      idea:        'idea',
    };
    const evalImg = $('eval-clawd');
    const evalState = gifStateMap[meta.gif] || 'idea';
    evalImg.src = window.clawd?.getAssetFor ? window.clawd.getAssetFor(evalState) : 'assets/clawd-idea.gif';
    evalImg.alt = window.clawd?.getPetLabel ? window.clawd.getPetLabel() : "Claw'd";

    const gradeEl = $('eval-grade');
    gradeEl.textContent = grade || '—';
    gradeEl.className = 'eval-grade ' + (grade ? meta.cls : 'g-_');
    $('eval-gradelabel').textContent = grade ? meta.label : 'sin hábitos';
    $('eval-msg').textContent = grade ? meta.msg : 'Agrega hábitos en «Mejoras de hábitos» para evaluar tu día.';
    $('eval-count').textContent = total ? `${done} de ${total} hábitos cumplidos hoy` : '';

    const list = $('eval-list');
    list.innerHTML = habits.map(h => {
      const isDone = Store.log.isDone(today, h.id);
      return `<div class="eval-item ${isDone ? 'done' : ''}" data-id="${h.id}">
        <span class="ei-check ${isDone ? 'done' : ''}">${isDone ? '✓' : ''}</span>
        <span class="ei-text">${escHtml(h.text)}</span>
      </div>`;
    }).join('');
    list.querySelectorAll('.eval-item').forEach(it =>
      it.addEventListener('click', () => this._toggleHabit(it.dataset.id)));
  },

  // ── Vista de calendario ───────────────────────────────────────
  renderCalendar() {
    if (!this.calRef) this.calRef = new Date();
    this._calWired || this._wireCalendar();
    this._renderCalGrid();
    this._renderWeekStrip($('cal-week'));
    const grades = Store.log.weekGrades().map(d => d.grade);
    const weekKey = Store.weeklyLog._weekKey();
    const wPct = Store.weeklyLog.completionPct(weekKey);
    const accum = Store.log.weeklyAggregate(grades, wPct);
    const meta = this._gradeMeta(accum);
    const accEl = $('cal-week-accum');
    accEl.textContent = accum ? accum + ' · ' + meta.label : '—';
    accEl.className = 'ws-accum ' + (accum ? meta.cls : 'g-_');
    this._renderCalUpcoming();
  },

  _wireCalendar() {
    $('cal-prev')?.addEventListener('click', () => { this.calRef.setMonth(this.calRef.getMonth() - 1); this.renderCalendar(); });
    $('cal-next')?.addEventListener('click', () => { this.calRef.setMonth(this.calRef.getMonth() + 1); this.renderCalendar(); });
    $('cal-today')?.addEventListener('click', () => { this.calRef = new Date(); this.renderCalendar(); });
    this._calWired = true;
  },

  _renderCalGrid() {
    const ref = this.calRef;
    const y = ref.getFullYear(), m = ref.getMonth();
    $('cal-month-label').textContent = `${MONTHS_FULL[m]} ${y}`;
    const first = new Date(y, m, 1);
    const startDow = (first.getDay() + 6) % 7; // lunes = 0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const todayIso = isoTodayApp();

    const dateMap = {};
    Store.dates.list().forEach(dd => { (dateMap[dd.date] = dateMap[dd.date] || []).push(dd); });
    Store.reminders.list().filter(r => !r.done).forEach(r => {
      const date = String(r.dueAt || '').slice(0, 10);
      if (date) (dateMap[date] = dateMap[date] || []).push({
        title: r.title, note: r.note, reminder: true, time: String(r.dueAt).slice(11, 16),
      });
    });

    // Primera celda visible = lunes de la semana del día 1 (incluye días del
    // mes anterior). Se completa hasta llenar semanas enteras con el siguiente.
    const startCell = new Date(y, m, 1 - startDow);
    const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

    const DOWH = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    let html = '<div class="cal-dows">' + DOWH.map(d => `<div class="cal-dow">${d}</div>`).join('') + '</div>';
    html += '<div class="cal-cells">';
    for (let i = 0; i < totalCells; i++) {
      const cur = new Date(startCell);
      cur.setDate(startCell.getDate() + i);
      const iso = fmtIsoLocal(cur);
      const inMonth = cur.getMonth() === m;
      const grade = Store.log.gradeFor(iso);
      const meta = this._gradeMeta(grade);
      const dates = dateMap[iso] || [];
      const isToday = iso === todayIso;

      // Chips de eventos: hasta 2 visibles + "+N más".
      let evHtml = '';
      if (dates.length) {
        const shown = dates.slice(0, 2).map(ev => {
          const tip = (ev.title + (ev.note ? ' — ' + ev.note : '')).replace(/"/g, '&quot;');
          return `<span class="cc-ev ${ev.reminder ? 'reminder' : ''}" title="${tip}">${ev.reminder ? '◷ ' : ''}${escHtml(ev.title)}</span>`;
        }).join('');
        const more = dates.length > 2 ? `<span class="cc-more">+${dates.length - 2} más</span>` : '';
        evHtml = `<div class="cc-events">${shown}${more}</div>`;
      }

      html += `<div class="cal-cell ${inMonth ? '' : 'other'} ${isToday ? 'today' : ''}">
        <span class="cc-day">${cur.getDate()}</span>
        ${grade ? `<span class="cc-grade ${meta.cls}">${grade}</span>` : ''}
        ${evHtml}
      </div>`;
    }
    html += '</div>';
    $('cal-grid').innerHTML = html;
  },

  _renderCalUpcoming() {
    const todayIso = isoTodayApp();
    const dates = Store.dates.list().filter(d => d.date >= todayIso)
      .map(d => ({ ...d, kind: 'date' }));
    const reminders = Store.reminders.list().filter(r => !r.done && String(r.dueAt).slice(0, 10) >= todayIso)
      .map(r => ({ title: r.title, note: r.note, date: String(r.dueAt).slice(0, 10), dueAt: r.dueAt, kind: 'reminder' }));
    const up = dates.concat(reminders).sort((a, b) =>
      String(a.dueAt || a.date).localeCompare(String(b.dueAt || b.date))).slice(0, 6);
    const el = $('cal-upcoming');
    el.innerHTML = up.length
      ? up.map(d => {
          const cd = this._countdown(d.date);
          const dt = new Date(d.date + 'T00:00:00');
          return `<div class="mini-row">
            <span class="mr-text">${d.kind === 'reminder' ? '◷ ' : ''}${escHtml(d.title)}</span>
            <span class="mr-meta">${dt.getDate()} ${MONTHS[dt.getMonth()]}${d.dueAt ? ' · ' + escHtml(String(d.dueAt).slice(11, 16)) : ''}</span>
            <span class="countdown ${cd.cls}">${cd.label}</span>
          </div>`;
        }).join('')
      : '<div class="mini-empty">— sin fechas próximas —</div>';
  },

  // ════════════════════ GEMINI / CHAT ════════════════════
  renderAI() {
    this._aiWired || this._wireAI();
    this._aiRefreshState();
    // scroll al final por si ya había conversación
    const log = $('ai-log');
    if (log) log.scrollTop = log.scrollHeight;
    setTimeout(() => { if (Gemini.hasKey()) $('ai-input')?.focus(); }, 50);
  },

  _wireAI() {
    const input = $('ai-input');
    const send = $('ai-send');
    if (!input) return;

    const autosize = () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 160) + 'px';
    };
    input.addEventListener('input', autosize);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._aiSend();
      }
    });
    if (send) send.addEventListener('click', () => this._aiSend());

    // toggle de persona: Gemini estándar ↔ personaje (Claw'd / Femme)
    const tog = $('ai-persona');
    if (tog) tog.querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => this._aiSetPersona(b.dataset.p)));

    const personalitySel = $('ai-personality-select');
    if (personalitySel) personalitySel.addEventListener('change', () =>
      this._aiSetCharacterMode(personalitySel.value));

    const providerSel = $('ai-provider-select');
    if (providerSel) providerSel.addEventListener('change', () =>
      this._setAiProvider(providerSel.value));

    // dropdown de modelo de IA
    const modelSel = $('ai-model-select');
    if (modelSel) modelSel.addEventListener('change', () => {
      const { id, familyChanged, changed } = this._setAiModel(modelSel.value);
      Toast.show('ai', `${Gemini.providerLabel().toLowerCase()} · modelo`,
        `modelo → <b>${escHtml(id)}</b>${changed && familyChanged ? '<br><span style="color:var(--text-faint)">conversaciones reiniciadas</span>' : ''}`);
    });

    // dropdown de nivel de razonamiento
    const levelSel = $('ai-level-select');
    if (levelSel) levelSel.addEventListener('change', () => {
      if (Gemini.setLevel(levelSel.value)) {
        Toast.show('ai', 'gemini · nivel', `razonamiento → <b>${escHtml(levelSel.value)}</b>`);
        if (this.currentView === 'ai') this._aiSyncModelSelect();
      }
    });

    // foto de perfil del usuario (cabecera + clic en burbujas propias)
    const fileInput = $('ai-avatar-file');
    const meBtn = $('ai-me-av');
    if (meBtn && fileInput) meBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) this._aiSetAvatarFromFile(f);
      e.target.value = '';
    });
    // delegación: clic en cualquier avatar propio abre el selector de foto
    const log = $('ai-log');
    if (log && fileInput) log.addEventListener('click', (e) => {
      if (Gemini.getPersona() === 'character' && e.target.closest('.cm-avatar.user')) fileInput.click();
    });

    this._aiWired = true;
  },

  // Refresca el estado de la vista según haya o no API key.
  _aiRefreshState() {
    const cfg = Gemini.getConfig();
    this._aiSyncModelSelect();
    const keybox = $('ai-keybox');
    const wrap = $('ai-chat-wrap');
    const input = $('ai-input');
    const send = $('ai-send');
    if (keybox) keybox.hidden = cfg.hasKey;
    const keyCopy = $('ai-keybox-copy');
    const keyLink = $('ai-keybox-link');
    const keyCommand = $('ai-keybox-command');
    if (keyCopy) keyCopy.innerHTML = `Para chatear con <b>${escHtml(cfg.providerLabel)}</b> necesitas su API key. Se guarda <b>solo en este equipo</b> (en el perfil local de la app).`;
    if (keyLink) keyLink.textContent = cfg.provider === 'groq' ? 'console.groq.com/keys' : 'aistudio.google.com/apikey';
    if (keyCommand) keyCommand.textContent = `:ai key ${cfg.provider} <tu_api_key>`;
    if (wrap) wrap.classList.toggle('locked', !cfg.hasKey);
    if (input) {
      input.disabled = !cfg.hasKey;
      input.placeholder = cfg.hasKey
        ? `pregúntale algo a ${cfg.providerLabel}... (Enter envía · Shift+Enter salta línea)`
        : `configura tu API key con  :ai key ${cfg.provider} <tu_api_key>`;
    }
    if (send) send.disabled = !cfg.hasKey;
    // estilo de chat según persona (estándar vs personaje, avatares, etc.)
    this._aiApplyPersonaUI();
    // mensaje de bienvenida vacío
    const log = $('ai-log');
    if (log && !log.children.length && cfg.hasKey) {
      if (cfg.persona === 'character') {
        const label = (window.clawd && window.clawd.getPetLabel) ? window.clawd.getPetLabel() : "Claw'd";
        const emoji = (window.clawd && window.clawd.pet && window.clawd.pet.emoji) || '🦀';
        log.innerHTML = `<div class="chat-hello">
          <span class="ch-glyph">${emoji}</span>
          Estás chateando con <b>${escHtml(label)}</b>.<br>
          Escríbele como a un contacto — esta conversación es aparte del modo estándar.</div>`;
      } else {
        log.innerHTML = `<div class="chat-hello">
          <span class="ch-glyph">✦</span>
          Hola${SysInfo.user ? ' ' + escHtml(SysInfo.user) : ''}, soy ${escHtml(cfg.providerLabel)} conectado a Spritenote.<br>
          Pregúntame lo que quieras, o pídeme cosas como <b>«agrega el examen de redes el próximo viernes»</b> y lo pongo en tu calendario 🦀</div>`;
      }
    }
    const compactTitle = $('cp-ai-title');
    if (compactTitle) compactTitle.textContent = `✦ ${cfg.providerLabel.toLowerCase()}`;
  },

  _aiStatus(txt) { const s = $('ai-status'); if (s) s.textContent = txt; },

  _setAiProvider(provider) {
    const current = Gemini.getProvider();
    if (provider === current) return current;
    const log = $('ai-log');
    this._aiLogCache = this._aiLogCache || {};
    if (log) this._aiLogCache[Gemini.getConversationKey()] = log.innerHTML;
    const selected = Gemini.setProvider(provider);
    if (!selected) return false;
    if (log) log.innerHTML = this._aiLogCache[Gemini.getConversationKey()] || '';
    this._aiRefreshState();
    Toast.show('ai', 'motor de IA', `motor activo → <b>${escHtml(Gemini.providerLabel())}</b>`);
    return selected;
  },

  // Cambia el modelo (id o alias). Reinicia conversaciones si cambia la familia
  // (3.x ↔ 2.5) para no mezclar formatos internos de "thinking".
  _setAiModel(arg) {
    const provider = Gemini.getProvider();
    const cur = Gemini.getConfig().model;
    const id = Gemini.resolveModel(arg, provider);
    const familyChanged = Gemini.modelFamily(cur, provider) !== Gemini.modelFamily(id, provider);
    const changed = id !== cur;
    Gemini.setModel(arg, provider);
    if (changed && familyChanged) {
      Gemini.resetHistory('provider');
      const prefix = `${provider}:`;
      Object.keys(this._aiLogCache || {}).forEach(key => { if (key.startsWith(prefix)) delete this._aiLogCache[key]; });
      const log = $('ai-log'); if (log) log.innerHTML = '';
    }
    if (this.currentView === 'ai') this._aiRefreshState(); else this.navigate('ai');
    return { id, cur, familyChanged, changed };
  },

  // Sincroniza los dropdowns de modelo y nivel, y el indicador de herramientas.
  _aiSyncModelSelect() {
    const cfg = Gemini.getConfig();
    const providerSel = $('ai-provider-select');
    if (providerSel) {
      providerSel.innerHTML = Gemini.providerList()
        .map(p => `<option value="${escHtml(p.id)}">${escHtml(p.label)}</option>`).join('');
      providerSel.value = cfg.provider;
    }
    const sel = $('ai-model-select');
    if (sel) {
      const known = Gemini.modelList(cfg.provider);
      const ids = known.map(m => m.id);
      const opts = known.map(m => `<option value="${escHtml(m.id)}">${escHtml(m.label)}</option>`);
      if (!ids.includes(cfg.model)) opts.unshift(`<option value="${escHtml(cfg.model)}">${escHtml(cfg.model)} (personalizado)</option>`);
      sel.innerHTML = opts.join('');
      sel.value = cfg.model;
    }
    const levelSel = $('ai-level-select');
    if (levelSel) {
      if (!levelSel.children.length) {
        const labelMap = { minimal: 'minimal', low: 'low', medium: 'medium', high: 'high' };
        levelSel.innerHTML = Gemini.validLevels()
          .map(l => `<option value="${l}">${labelMap[l] || l}</option>`).join('');
      }
      levelSel.value = cfg.level;
      levelSel.hidden = cfg.provider !== 'gemini';
    }
    const meta = $('ai-model-meta');
    if (meta) meta.textContent = cfg.toolsEnabled ? '· 🛠️' : '';
  },

  // HTML del avatar para una fila de chat (modo personaje / WhatsApp).
  _aiAvatarHtml(role) {
    if (role === 'user') {
      const av = Gemini.getUserAvatar ? Gemini.getUserAvatar() : null;
      if (av) return `<img src="${av}" alt="yo">`;
      const initial = ((SysInfo.user || '?').trim().charAt(0) || '?').toUpperCase();
      return `<span class="av-initial">${escHtml(initial)}</span>`;
    }
    if (role === 'model') {
      const src = (window.clawd && window.clawd.getAvatar) ? window.clawd.getAvatar()
        : ((window.clawd && window.clawd.getAssetFor) ? window.clawd.getAssetFor('idle') : 'assets/clawd-avatar.png');
      return `<img src="${src}" alt="${escHtml((window.clawd && window.clawd.getPetLabel) ? window.clawd.getPetLabel() : "Claw'd")}">`;
    }
    return `<span class="av-initial">!</span>`;
  },

  // Añade una burbuja al log. role: 'user' | 'model' | 'error'. Devuelve el nodo.
  _aiAppend(role, html, { md = false } = {}) {
    const log = $('ai-log');
    // limpia el saludo si está presente
    const hello = log.querySelector('.chat-hello');
    if (hello) hello.remove();
    const row = document.createElement('div');
    row.className = 'chat-msg ' + role;
    const who = role === 'user' ? (SysInfo.user || 'tú')
              : role === 'error' ? 'error'
              : (Gemini.getPersona && Gemini.getPersona() === 'character' && window.clawd && window.clawd.getPetLabel)
                ? window.clawd.getPetLabel() : Gemini.providerLabel().toLowerCase();
    row.innerHTML =
      `<div class="cm-avatar ${role}" aria-hidden="true">${this._aiAvatarHtml(role)}</div>` +
      `<div class="cm-bubble">` +
        `<div class="cm-who">${escHtml(who)}</div>` +
        `<div class="cm-body ${md ? 'md' : ''}">${md ? renderMarkdown(html) : html}</div>` +
      `</div>`;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  },

  _syncCharacterNotificationMessages() {
    const log = $('ai-log');
    if (!log || typeof Gemini === 'undefined' || Gemini.getPersona?.() !== 'character') return;
    const characterKey = (window.clawd && window.clawd.getPetKey) ? window.clawd.getPetKey() : Store.preferences.getActiveCharacter();
    const entries = Store.characterMessages?.list?.(characterKey) || [];
    if (!entries.length) return;
    const rendered = new Set([...log.querySelectorAll('[data-character-message-id]')]
      .map(row => row.dataset.characterMessageId));
    entries.forEach(entry => {
      if (!entry?.id || !entry.text || rendered.has(entry.id)) return;
      const row = this._aiAppend(entry.role === 'user' ? 'user' : 'model', escHtml(entry.text).replace(/\n/g, '<br>'));
      if (!row) return;
      row.dataset.characterMessageId = entry.id;
      row.classList.add('notification-message');
      rendered.add(entry.id);
    });
    if (this._aiLogCache) this._aiLogCache[Gemini.getConversationKey()] = log.innerHTML;
  },

  // Aplica el modo persona (estándar vs personaje) a la UI del chat.
  _aiApplyPersonaUI() {
    const cfg = Gemini.getConfig();
    const character = cfg.persona === 'character';
    const log = $('ai-log');
    const wrap = $('ai-chat-wrap');
    if (log) log.classList.toggle('character', character);
    if (wrap) wrap.classList.toggle('persona-character', character);

    // botones del toggle
    const tog = $('ai-persona');
    if (tog) {
      tog.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.p === cfg.persona));
      const standardBtn = tog.querySelector('button[data-p="gemini"]');
      if (standardBtn) standardBtn.textContent = `✦ ${cfg.providerLabel}`;
      const charBtn = tog.querySelector('button[data-p="character"]');
      if (charBtn) {
        const emoji = (window.clawd && window.clawd.pet && window.clawd.pet.emoji) || '🦀';
        const label = (window.clawd && window.clawd.getPetLabel) ? window.clawd.getPetLabel() : "Claw'd";
        charBtn.textContent = `${emoji} ${label}`;
      }
    }

    // barra del personaje (solo en modo personaje): avatar + "en línea" + tu foto
    const peerbar = $('ai-peerbar');
    if (peerbar) peerbar.hidden = !character;
    if (character) {
      const av = $('ai-peer-av');
      if (av && window.clawd) av.src = window.clawd.getAvatar ? window.clawd.getAvatar() : window.clawd.getAssetFor?.('idle');
      const nm = $('ai-peer-name');
      if (nm) nm.textContent = (window.clawd && window.clawd.getPetLabel) ? window.clawd.getPetLabel() : "Claw'd";
      // avatar del usuario
      const img = $('ai-me-av-img');
      const ini = $('ai-me-av-initial');
      const uav = cfg.userAvatar;
      if (img && ini) {
        if (uav) { img.src = uav; img.style.display = ''; ini.style.display = 'none'; }
        else { img.removeAttribute('src'); img.style.display = 'none'; ini.style.display = ''; ini.textContent = ((SysInfo.user || '?').trim().charAt(0) || '?').toUpperCase(); }
      }
      const modeSelect = $('ai-personality-select');
      const modeWrap = $('ai-personality-wrap');
      const modes = Gemini.listCharacterModes();
      if (modeSelect) {
        modeSelect.innerHTML = modes.map(m => `<option value="${escHtml(m.key)}">${escHtml(m.label)}</option>`).join('');
        modeSelect.value = Gemini.getCharacterMode();
        modeSelect.disabled = modes.length < 2;
      }
      if (modeWrap) modeWrap.hidden = !modes.length;
    }

    // refresca avatares de mensajes ya existentes
    if (log) {
      log.querySelectorAll('.chat-msg').forEach(row => {
        const role = row.classList.contains('user') ? 'user' : row.classList.contains('error') ? 'error' : 'model';
        const avEl = row.querySelector('.cm-avatar');
        if (avEl) avEl.innerHTML = this._aiAvatarHtml(role);
      });
    }
    this._syncCharacterNotificationMessages();
  },

  _aiSetPersona(p) {
    p = p === 'character' ? 'character' : 'gemini';
    const prev = Gemini.getPersona();
    if (p === prev) return;
    // Conversaciones independientes: guarda el log actual y carga el del otro modo.
    const log = $('ai-log');
    if (log) {
      this._aiLogCache = this._aiLogCache || {};
      const prevKey = Gemini.getConversationKey();
      this._aiLogCache[prevKey] = log.innerHTML;
      Gemini.setPersona(p);
      log.innerHTML = this._aiLogCache[Gemini.getConversationKey()] || '';
    } else {
      Gemini.setPersona(p);
    }
    this._aiApplyPersonaUI();
    this._aiRefreshState(); // repinta saludo si el log del modo está vacío
    const label = p === 'character'
      ? ((window.clawd && window.clawd.getPetLabel) ? window.clawd.getPetLabel() : 'personaje')
      : Gemini.providerLabel();
    Toast.show('ai', 'IA', `modo de chat → <b>${escHtml(label)}</b>`);
  },

  _aiSetCharacterMode(mode) {
    const log = $('ai-log');
    this._aiLogCache = this._aiLogCache || {};
    const prevKey = Gemini.getConversationKey();
    if (log) this._aiLogCache[prevKey] = log.innerHTML;
    const selected = Gemini.setCharacterMode(mode);
    if (!selected) {
      Toast.show('warn', 'gemini · estilo', 'ese modo aún no tiene un system prompt configurado');
      this._aiApplyPersonaUI();
      return false;
    }
    if (Gemini.getPersona() !== 'character') Gemini.setPersona('character');
    if (log) log.innerHTML = this._aiLogCache[Gemini.getConversationKey()] || '';
    this._aiRefreshState();
    const active = Gemini.listCharacterModes().find(m => m.key === selected);
    Toast.show('ai', 'gemini · estilo', `personalidad → <b>${escHtml(active ? active.label : selected)}</b>`);
    return true;
  },

  _onPetChange({ previousKey, key }) {
    if (!previousKey || !key || typeof Gemini === 'undefined') return;
    const log = $('ai-log');
    if (Gemini.getPersona() === 'character' && log) {
      this._aiLogCache = this._aiLogCache || {};
      const oldMode = Gemini.getCharacterMode(previousKey);
      this._aiLogCache[`${Gemini.getProvider()}:character:${previousKey}:${oldMode}`] = log.innerHTML;
      log.innerHTML = this._aiLogCache[Gemini.getConversationKey()] || '';
    }
    if (this.currentView === 'ai') this._aiRefreshState();
  },

  // Lee una imagen, la recorta a un cuadrado y la guarda como avatar del usuario.
  _aiSetAvatarFromFile(file) {
    if (!file || !/^image\//.test(file.type)) { Toast.show('warn', 'foto', 'elige un archivo de imagen'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const S = 96;
        const c = document.createElement('canvas'); c.width = S; c.height = S;
        const ctx = c.getContext('2d');
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, S, S);
        let dataUrl;
        try { dataUrl = c.toDataURL('image/jpeg', 0.85); } catch (_) { dataUrl = reader.result; }
        Gemini.setUserAvatar(dataUrl);
        this._aiApplyPersonaUI();
        Toast.show('ai', 'foto', 'foto de perfil actualizada ✓');
      };
      img.onerror = () => Toast.show('warn', 'foto', 'no se pudo leer la imagen');
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  },

  async _aiSend() {
    const input = $('ai-input');
    const text = (input.value || '').trim();
    if (!text) return;
    if (!Gemini.hasKey()) {
      const provider = Gemini.getProvider();
      Toast.show('warn', 'IA', `configura la API key de ${Gemini.providerLabel()}: <b>:ai key ${provider} &lt;tu_api_key&gt;</b>`);
      return;
    }
    input.value = '';
    input.style.height = 'auto';

    this._aiAppend('user', escHtml(text).replace(/\n/g, '<br>'));
    clawd.setState('coffee');

    // burbuja "pensando…"
    const pending = this._aiAppend('model', '<span class="cm-dots"><i></i><i></i><i></i></span>');
    this._aiStatus('pensando…');
    const sendBtn = $('ai-send');
    if (sendBtn) sendBtn.disabled = true;
    input.disabled = true;

    try {
      const { text: answer, actions } = await Gemini.ask(text);
      const body = pending.querySelector('.cm-body');
      body.classList.add('md');
      const actionsHtml = (actions && actions.length)
        ? '<div class="cm-actions">' + actions.map(a =>
            `<div class="cm-action ca-${a.kind}"><span class="ca-ico">✦</span>${escHtml(a.summary)}</div>`).join('') + '</div>'
        : '';
      body.innerHTML = actionsHtml + renderMarkdown(answer);
      this._aiStatus('listo');
      // Aplica efectos secundarios de las acciones en la UI.
      if (actions && actions.length) {
        clawd.setState('celebrate');
        actions.forEach(a => Toast.show('ai', `${Gemini.providerLabel().toLowerCase()} · acción`, escHtml(a.summary)));
        this._afterAiActions(actions);
      } else {
        clawd.setState('idea');
      }
    } catch (err) {
      pending.classList.remove('model');
      pending.classList.add('error');
      pending.querySelector('.cm-who').textContent = 'error';
      pending.querySelector('.cm-body').innerHTML = Gemini.friendlyError(err);
      this._aiStatus('error');
      clawd.setState('confused');
      if ((err && err.message) === 'NO_KEY' || (err && err.message) === 'BAD_KEY') {
        this._aiRefreshState();
      }
    } finally {
      input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      $('ai-log').scrollTop = $('ai-log').scrollHeight;
      input.focus();
    }
  },

  // Refresca la UI afectada por las acciones que ejecutó Gemini.
  _afterAiActions(actions) {
    this._refreshNeofetch();
    const kinds = new Set(actions.map(a => a.kind));
    // Refresca la vista activa si corresponde (normalmente estamos en 'ai').
    if (kinds.has('fecha') && this.currentView === 'dates') this.renderDates();
    if (kinds.has('fecha') && this.currentView === 'calendar') this.renderCalendar();
    if (kinds.has('tarea') && this.currentView === 'tasks') this.renderTasks();
    if (kinds.has('recordatorio') && this.currentView === 'reminders') this.renderReminders();
    if (kinds.has('habito') && this.currentView === 'habits') this.renderHabits();
    if (kinds.has('nota') && this.currentView === 'notes') this.renderNotes();
  },

  // Maneja `:ai ...` y subcomandos (key / model / level / clear / forget).
  _aiCommand(a) {
    a = (a || '').trim();
    const [sub, ...rest] = a.split(/\s+/);
    const arg = rest.join(' ').trim();
    const low = sub.toLowerCase();

    // :ai key ...
    if (low === 'key') {
      const keyParts = arg.split(/\s+/).filter(Boolean);
      const explicitProvider = Gemini.providerList().some(p => p.id === (keyParts[0] || '').toLowerCase())
        ? keyParts.shift().toLowerCase() : null;
      const provider = explicitProvider || Gemini.getProvider();
      const keyValue = keyParts.join(' ').trim();
      const label = Gemini.providerLabel(provider);
      if (!keyValue) {
        const masked = Gemini.maskedKey(provider);
        Toast.show(masked ? 'ai' : 'warn', `${label.toLowerCase()} · key`,
          masked
            ? `key configurada: <b>${masked}</b><br><span style="color:var(--text-faint)">:ai key ${provider} &lt;nueva&gt; para cambiar · :ai key ${provider} clear para borrar</span>`
            : `sin API key de ${label}. usa <b>:ai key ${provider} &lt;tu_api_key&gt;</b>`);
        return;
      }
      if (keyValue.toLowerCase() === 'clear' || keyValue.toLowerCase() === 'remove') {
        Gemini.clearKey(provider);
        Toast.show('warn', `${label.toLowerCase()} · key`, `API key de ${label} eliminada de este equipo.`);
        if (this.currentView === 'ai') this._aiRefreshState();
        return;
      }
      Gemini.setKey(keyValue, provider);
      Toast.show('ai', `${label.toLowerCase()} · key`, `key guardada para ${label} (<b>${Gemini.maskedKey(provider)}</b>)`);
      clawd.setState('heart');
      if (provider === Gemini.getProvider()) {
        if (this.currentView === 'ai') this._aiRefreshState();
        else this.navigate('ai');
      }
      return;
    }

    // :ai forget  → atajo para borrar la key
    if (low === 'forget') {
      const provider = Gemini.providerList().some(p => p.id === arg.toLowerCase()) ? arg.toLowerCase() : Gemini.getProvider();
      const label = Gemini.providerLabel(provider);
      Gemini.clearKey(provider);
      Toast.show('warn', 'IA', `API key de ${label} eliminada.`);
      if (this.currentView === 'ai') this._aiRefreshState();
      return;
    }

    // :ai provider <gemini|groq>  → cambia el motor activo
    if (low === 'provider' || low === 'proveedor' || low === 'motor' || low === 'engine') {
      const target = arg.toLowerCase();
      if (!target) {
        Toast.show('info', 'motor de IA', `motor activo: <b>${escHtml(Gemini.providerLabel())}</b><br><span style="color:var(--text-faint)">:ai provider gemini · :ai provider groq</span>`);
        return;
      }
      if (!Gemini.providerList().some(p => p.id === target)) {
        Toast.show('warn', 'motor de IA', 'motor inválido. opciones: <b>gemini</b> · <b>groq</b>');
        return;
      }
      if (this.currentView !== 'ai') this.navigate('ai');
      this._setAiProvider(target);
      return;
    }

    // :ai model <id|alias>  → cambia el modelo (acepta atajos: 2.5, 3.5, pro…)
    if (low === 'model' || low === 'modelo' || low === 'use') {
      const cur = Gemini.getConfig().model;
      if (!arg) {
        const list = Gemini.modelList().map(m =>
          `<b>${escHtml(m.id)}</b>${m.id === cur ? '  ←' : ''} <span style="color:var(--text-faint)">· ${escHtml((m.aliases[0] || ''))}</span>`
        ).join('<br>');
        Toast.show('info', `${Gemini.providerLabel().toLowerCase()} · modelo`,
          `modelo actual: <b>${escHtml(cur)}</b><br><span style="color:var(--text-faint)">:ai model &lt;id o atajo&gt;</span><br>${list}`);
        return;
      }
      const { id, familyChanged, changed } = this._setAiModel(arg);
      Toast.show('ai', `${Gemini.providerLabel().toLowerCase()} · modelo`,
        `modelo → <b>${escHtml(id)}</b>${changed && familyChanged ? '<br><span style="color:var(--text-faint)">conversaciones reiniciadas (cambió la familia del modelo)</span>' : ''}`);
      return;
    }

    // :ai level <minimal|low|medium|high>
    if (low === 'level' || low === 'thinking') {
      if (Gemini.getProvider() !== 'gemini') {
        Toast.show('info', 'groq · nivel', 'el nivel de razonamiento configurable sólo se aplica a Gemini');
        return;
      }
      if (!arg) { Toast.show('info', 'gemini · level', `nivel actual: <b>${Gemini.getConfig().level}</b><br><span style="color:var(--text-faint)">opciones: ${Gemini.validLevels().join(' · ')}</span>`); return; }
      if (Gemini.setLevel(arg)) {
        Toast.show('ai', 'gemini · level', `razonamiento → <b>${escHtml(arg.toLowerCase())}</b>`);
        if (this.currentView === 'ai') this._aiRefreshState();
      } else {
        Toast.show('warn', 'gemini · level', `nivel inválido. opciones: ${Gemini.validLevels().join(' · ')}`);
      }
      return;
    }

    // :ai tools <on|off>  → activa/desactiva las capacidades agénticas
    if (low === 'tools' || low === 'herramientas') {
      const v = arg.toLowerCase();
      if (!v) {
        const on = Gemini.getConfig().toolsEnabled;
        Toast.show('info', 'IA · herramientas', `herramientas: <b>${on ? 'activadas' : 'desactivadas'}</b><br><span style="color:var(--text-faint)">:ai tools on / off · puede agregar fechas, tareas, recordatorios y hábitos</span>`);
        return;
      }
      if (['on', 'si', 'sí', 'activar', '1'].includes(v)) {
        Gemini.setTools(true);
        Toast.show('ai', 'IA · herramientas', `herramientas <b>activadas</b> — ${Gemini.providerLabel()} puede agregar fechas, tareas, recordatorios y hábitos`);
      } else if (['off', 'no', 'desactivar', '0'].includes(v)) {
        Gemini.setTools(false);
        Toast.show('warn', 'IA · herramientas', 'herramientas <b>desactivadas</b> — el motor solo responderá texto');
      } else {
        Toast.show('warn', 'IA · herramientas', 'uso: :ai tools on  /  :ai tools off');
        return;
      }
      if (this.currentView === 'ai') this._aiRefreshState();
      return;
    }

    // :ai persona <gemini|character|claw'd|femme>  → cambia el modo de chat
    if (low === 'persona' || low === 'modo' || low === 'character' || low === 'personaje') {
      let target = low === 'persona' || low === 'modo' ? arg.toLowerCase() : low;
      if (low === 'persona' || low === 'modo') {
        if (!target) {
          Toast.show('info', 'IA · persona', `modo actual: <b>${Gemini.getPersona() === 'character' ? 'personaje' : Gemini.providerLabel()}</b><br><span style="color:var(--text-faint)">:ai persona gemini · :ai persona personaje</span>`);
          return;
        }
      }
      const toChar = ['character', 'personaje', 'pet', 'mascota', 'char', 'on'].includes(target)
        || (window.clawd && window.clawd.resolvePet && window.clawd.resolvePet(target));
      const p = toChar ? 'character' : 'gemini';
      if (this.currentView !== 'ai') this.navigate('ai');
      this._aiSetPersona(p);
      return;
    }

    // :ai estilo <modo> → cambia la personalidad del personaje activo.
    if (low === 'estilo' || low === 'personalidad' || low === 'style') {
      const modes = Gemini.listCharacterModes();
      if (!arg) {
        const current = Gemini.getCharacterMode();
        const currentMode = modes.find(mode => mode.key === current);
        Toast.show('info', 'gemini · estilo',
          `personalidad actual: <b>${escHtml(currentMode?.label || current)}</b><br><span style="color:var(--text-faint)">disponibles: ${modes.map(m => escHtml(m.label)).join(' · ') || 'ninguna'}</span>`);
        return;
      }
      if (this.currentView !== 'ai') this.navigate('ai');
      this._aiSetCharacterMode(arg.toLowerCase());
      return;
    }

    // :ai avatar <reset>  → gestiona la foto de perfil del usuario
    if (low === 'avatar' || low === 'foto') {
      if (arg.toLowerCase() === 'reset' || arg.toLowerCase() === 'clear') {
        Gemini.clearUserAvatar();
        if (this.currentView === 'ai') this._aiApplyPersonaUI();
        Toast.show('info', 'gemini · foto', 'foto de perfil restablecida (inicial)');
        return;
      }
      if (this.currentView !== 'ai') this.navigate('ai');
      // abre el selector de archivo
      const fi = $('ai-avatar-file');
      if (fi) fi.click();
      else Toast.show('info', 'gemini · foto', 'abre la pestaña Gemini en modo personaje y toca tu avatar para cambiarlo');
      return;
    }

    // :ai clear / reset  → limpia la conversación del modo actual
    if (low === 'clear' || low === 'reset' || low === 'new') {
      Gemini.resetHistory();
      const log = $('ai-log');
      if (log) log.innerHTML = '';
      if (this._aiLogCache) this._aiLogCache[Gemini.getConversationKey()] = '';
      if (this.currentView === 'ai') this._aiRefreshState();
      else this.navigate('ai');
      Toast.show('info', 'IA', 'conversación reiniciada.');
      return;
    }

    // sin args → solo abre la vista
    if (!a) { this.navigate('ai'); return; }

    // cualquier otra cosa → es un prompt
    if (!Gemini.hasKey()) {
      this.navigate('ai');
      const provider = Gemini.getProvider();
      Toast.show('warn', 'IA', `primero configura la API key de ${Gemini.providerLabel()}: <b>:ai key ${provider} &lt;tu_api_key&gt;</b>`);
      return;
    }
    if (this.currentView !== 'ai') this.navigate('ai');
    const input = $('ai-input');
    if (input) { input.value = a; }
    this._aiSend();
  },



  // ════════════════════ CRT / BOOT / SYSTEM MONITOR ════════════════════
  _initCrt() {
    const saved = localStorage.getItem('spritenote:crt');
    this.crtOn = saved == null ? true : saved !== 'off';
    this._applyCrt();
    const btn = $('crt-toggle');
    if (btn) btn.addEventListener('click', () => this.setCrt(!this.crtOn));
  },

  _applyCrt() {
    document.documentElement.style.setProperty('--crt-op', this.crtOn ? '1' : '0');
    document.body.classList.toggle('crt-off', !this.crtOn);
    const lbl = $('crt-label');
    if (lbl) lbl.textContent = this.crtOn ? '● ON' : '○ OFF';
  },

  setCrt(on) {
    this.crtOn = !!on;
    localStorage.setItem('spritenote:crt', this.crtOn ? 'on' : 'off');
    this._applyCrt();
    Toast.show('info', 'crt', this.crtOn ? 'modo CRT activado' : 'modo CRT desactivado');
  },

  // ── helper: imprime una línea de boot con retraso ──────────────
  _bootLine(linesEl, text, cls = '') {
    const div = document.createElement('div');
    div.className = 'boot-line ' + cls;
    div.textContent = text;
    linesEl.appendChild(div);
  },

  // Etiqueta de fósforo del tema actual para el POST (ej. "VAPORWAVE").
  _phosphorLabel() {
    const lbl = Themes.label(Themes.current) || Themes.current;
    return String(lbl).toUpperCase();
  },

  _initBoot() {
    const overlay = $('boot-overlay');
    const linesEl = $('boot-lines');
    if (!overlay || !linesEl) return;
    this.booting = true;

    // ¿Primera vez? Si no hay marca de calibración, lanzamos el asistente.
    const firstRun = !localStorage.getItem('spritenote:onboarded');
    if (firstRun) this._bootFirstRun(overlay, linesEl);
    else this._bootReturning(overlay, linesEl);
  },

  // ── Boot normal (usuario que regresa): colores y datos del tema ──
  _bootReturning(overlay, linesEl) {
    const userName = SysInfo.user || 'user';
    const lines = [
      ['SPRITENOTE BIOS v2.1    (c) 1987 SpriteSoft Industries', 'dim'],
      ['CPU: Crustacean 6502 @ 1.79 MHz ........... OK', ''],
      ['Osciloscope buffer: 4096 samples .......... OK', ''],
      ['Vapor GRID renderer ....................... OK', ''],
      ['Detecting phosphor tube ................... ' + this._phosphorLabel(), ''],
      ['Loading /usr/local/bin/spritenote .......... OK', ''],
      ['Mounting ~/.local/share/spritenote ......... OK', ''],
      ['Starting companion daemon ................. [ OK ]', 'ok'],
      ['> boot complete. welcome back, ' + userName + '.', 'accent'],
    ];
    const finish = () => {
      if (!this.booting) return;
      this.booting = false;
      (this._bootTimers || []).forEach(clearTimeout);
      overlay.classList.add('done');
      document.removeEventListener('keydown', keySkip, true);
    };
    const keySkip = (e) => {
      if (!this.booting) return;
      e.preventDefault();
      e.stopPropagation();
      finish();
    };
    overlay.addEventListener('click', finish, { once: true });
    document.addEventListener('keydown', keySkip, true);
    this._bootTimers = [];
    lines.forEach(([text, cls], i) => {
      this._bootTimers.push(setTimeout(() => this._bootLine(linesEl, text, cls), 380 + i * 145));
    });
    this._bootTimers.push(setTimeout(finish, 380 + lines.length * 145 + 650));
  },

  // ── Boot de primera ejecución: POST corto → calibración ─────────
  _bootFirstRun(overlay, linesEl) {
    overlay.classList.add('calibrating'); // desactiva "click para saltar"
    const lines = [
      ['SPRITENOTE BIOS v2.1    (c) 1987 SpriteSoft Industries', 'dim'],
      ['POST .......................................... OK', ''],
      ['Detecting phosphor tube ................... ' + this._phosphorLabel(), ''],
      ['Scanning ~/.local/share/spritenote ......... VACÍO', ''],
      ['! primera ejecución detectada', 'ok'],
      ['> se requiere CALIBRACIÓN del companion', 'accent'],
    ];
    this._bootTimers = [];
    lines.forEach(([text, cls], i) => {
      this._bootTimers.push(setTimeout(() => this._bootLine(linesEl, text, cls), 300 + i * 150));
    });
    this._bootTimers.push(setTimeout(
      () => this._showCalibration(overlay),
      300 + lines.length * 150 + 350
    ));
  },

  // ── Panel de calibración (SETUP UTILITY) ───────────────────────
  _showCalibration(overlay) {
    if ($('boot-calib')) return; // ya visible
    const PETSOBJ = window.PETS || {};
    let selPet = (window.clawd && window.clawd.getPetKey && window.clawd.getPetKey())
      || localStorage.getItem('spritenote:pet') || 'clawd';
    if (!PETSOBJ[selPet]) selPet = Object.keys(PETSOBJ)[0] || 'clawd';
    let selTheme = Themes.current;

    const petCards = Object.values(PETSOBJ).map(p => `
      <button type="button" class="cal-pet${p.key === selPet ? ' sel' : ''}" data-pet="${p.key}">
        <img src="${p.avatar || p.assets.idle}" alt="${escHtml(p.label)}">
        <span class="cal-pet-name">${p.emoji} ${escHtml(p.label)}</span>
      </button>`).join('');

    const themeSwatches = (window.THEMES || []).map(t => `
      <button type="button" class="cal-theme${t === selTheme ? ' sel' : ''}" data-t="${t}" data-theme="${t}" title="${escHtml(Themes.label(t))}">
        <span class="cal-sw-bg"></span><span class="cal-sw-ac"></span>
        <span class="cal-sw-label">${escHtml(Themes.label(t))}</span>
      </button>`).join('');

    const panel = document.createElement('div');
    panel.id = 'boot-calib';
    panel.innerHTML = `
      <div class="cal-frame">
        <div class="cal-titlebar">
          <span>SPRITENOTE SETUP UTILITY · v2.1</span>
          <span class="cal-blink">primera ejecución</span>
        </div>
        <div class="cal-body">
          <div class="cal-lead">▸ CALIBRACIÓN DEL COMPANION — ajusta tus preferencias iniciales.</div>

          <div class="cal-field">
            <div class="cal-label"><span class="cal-num">[1]</span> MASCOTA PREFERIDA</div>
            <div class="cal-pets">${petCards}</div>
          </div>

          <div class="cal-field">
            <div class="cal-label"><span class="cal-num">[2]</span> TEMA POR DEFECTO</div>
            <div class="cal-themes">${themeSwatches}</div>
          </div>

          <div class="cal-field">
            <div class="cal-label"><span class="cal-num">[3]</span> NOMBRE DE USUARIO</div>
            <div class="cal-userrow">
              <span class="cal-prompt">login:</span>
              <input type="text" id="cal-user" maxlength="24" autocomplete="off" spellcheck="false" placeholder="tu nombre...">
            </div>
          </div>

          <button type="button" id="cal-go" class="cal-go">▸ INICIAR SPRITENOTE</button>
          <div class="cal-foot">se guarda solo en este equipo · puedes repetirla con <b>:calibrate</b></div>
        </div>
      </div>`;
    overlay.appendChild(panel);

    const userInput = panel.querySelector('#cal-user');
    if (userInput && SysInfo.user) userInput.value = SysInfo.user;

    // selección de mascota (vista previa en vivo detrás del overlay)
    panel.querySelectorAll('.cal-pet').forEach(btn => {
      btn.addEventListener('click', () => {
        selPet = btn.dataset.pet;
        panel.querySelectorAll('.cal-pet').forEach(b => b.classList.toggle('sel', b === btn));
        if (window.clawd && window.clawd.setPet) window.clawd.setPet(selPet);
      });
    });

    // selección de tema (recolorea el overlay en vivo)
    panel.querySelectorAll('.cal-theme').forEach(btn => {
      btn.addEventListener('click', () => {
        selTheme = btn.dataset.t;
        panel.querySelectorAll('.cal-theme').forEach(b => b.classList.toggle('sel', b === btn));
        Themes.set(selTheme, false);
      });
    });

    const go = () => this._finishCalibration(overlay, {
      pet: selPet,
      theme: selTheme,
      username: userInput ? userInput.value : '',
    });
    panel.querySelector('#cal-go').addEventListener('click', go);
    if (userInput) {
      userInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); go(); }
      });
      setTimeout(() => userInput.focus(), 60);
    }
  },

  // Aplica las elecciones de calibración a toda la app y las persiste.
  _applyCalibration({ pet, theme, username }) {
    if (theme) Themes.set(theme, false);

    if (pet) {
      localStorage.setItem('spritenote:pet', pet);
      if (window.clawd && window.clawd.setPet) window.clawd.setPet(pet);
    }

    const name = (username || '').trim();
    if (name) {
      localStorage.setItem('spritenote:username', name);
      SysInfo.user = name;
    }

    // Propaga el usuario a todo el DOM (prompts, neofetch, compacto, saludo).
    this._applyUserToDOM();
    const cpUser = $('cp-user');
    if (cpUser) cpUser.textContent = SysInfo.user ?? '?';
    const greetEl = $('home-greet-title');
    if (greetEl) greetEl.textContent = this.greeting() + ', ' + (SysInfo.user ?? 'estudiante');
    this._refreshNeofetch();

    localStorage.setItem('spritenote:onboarded', '1');
  },

  // Aplica + secuencia de cierre del overlay con confirmación.
  _finishCalibration(overlay, choices) {
    (this._bootTimers || []).forEach(clearTimeout);
    this._applyCalibration(choices);

    $('boot-calib')?.remove();
    overlay.classList.remove('calibrating');
    const linesEl = $('boot-lines');

    const petLabel = window.PETS?.[choices.pet]?.label || choices.pet;
    const conf = [
      ['> calibración aplicada.', 'ok'],
      ['  mascota .... ' + petLabel, 'dim'],
      ['  tema ....... ' + Themes.label(choices.theme), 'dim'],
      ['  usuario .... ' + (SysInfo.user || '—'), 'dim'],
      ['> boot complete. welcome, ' + (SysInfo.user || 'user') + '.', 'accent'],
    ];
    conf.forEach(([t, c], i) => setTimeout(() => this._bootLine(linesEl, t, c), i * 160));
    if (window.clawd && window.clawd.setState) setTimeout(() => window.clawd.setState('celebrate'), 200);

    setTimeout(() => {
      this.booting = false;
      overlay.classList.add('done');
      // Tras la PRIMERA calibración, ofrece el recorrido guiado.
      if (!localStorage.getItem('spritenote:toured')) {
        setTimeout(() => this.startTour(), 480);
      }
    }, conf.length * 160 + 1000);
  },

  // Re-ejecuta el asistente de calibración a voluntad (comando :calibrate).
  recalibrate() {
    const overlay = $('boot-overlay');
    const linesEl = $('boot-lines');
    if (!overlay || !linesEl) return;
    (this._bootTimers || []).forEach(clearTimeout);
    $('boot-calib')?.remove();
    linesEl.innerHTML = '';
    overlay.classList.remove('done');
    overlay.classList.add('calibrating');
    this.booting = true;
    this._bootLine(linesEl, '> recalibrando companion...', 'accent');
    this._showCalibration(overlay);
  },

  // ════════════════════ TOUR GUIADO ════════════════════
  // Pasos del recorrido. `before` corre antes de mostrar el paso
  // (p. ej. cambiar de vista). `sel` es el elemento a resaltar.
  _tourSteps() {
    return [
      {
        before: () => this.navigate('home'),
        sel: '#clawd-hero-wrap',
        title: 'Tu companion',
        text: 'Esta es tu mascota. Haz <b>clic</b> sobre ella para interactuar. Recorre tus personajes instalados con <code>:pet</code> o elige uno con <code>:pet &lt;id&gt;</code>.',
      },
      {
        sel: '#neofetch-wrap',
        title: 'Tu sistema',
        text: 'Aquí tienes un <b>neofetch</b> con datos de tu equipo y, abajo, tu barra de <b>progreso</b> de tareas pendientes.',
      },
      {
        sel: '#nav',
        title: 'Navegación',
        text: 'Muévete entre vistas con clic o con las <b>teclas 1–8</b>: inicio, notas, tareas, recordatorios, hábitos, fechas, calendario e IA.',
      },
      {
        sel: '#theme-switch',
        title: 'Temas y modo CRT',
        text: '<b>12 temas</b> phosphor (incluyendo Catppuccin). El arranque <b>recuerda el último</b> que usaste. ¿Te molesta el efecto de monitor antiguo? Apágalo en <b>CRT MODE</b>.',
      },
      {
        before: () => this.navigate('home'),
        sel: '.clawd-hero',
        title: 'Personaliza tu inicio',
        text: 'El gif de bienvenida y la <b>frase</b> de abajo son tuyos. Haz <b>clic en la frase</b> para editarla, y cambia el gif por cualquier imagen con <code>:gif &lt;url&gt;</code> (o <code>:gif reset</code> para volver a tu mascota).',
      },
      {
        before: () => { this.navigate('notes'); this._selectNote('md-guide'); },
        sel: '.notes-layout',
        title: 'Notas en Markdown',
        text: 'Tus notas usan <b>Markdown</b>. Si no lo conoces, incluimos la nota <b>«Guía rápida de Markdown»</b> con todo lo que necesitas: títulos, listas, tablas y más.',
      },
      {
        before: () => this.navigate('ai'),
        sel: '#view-ai .view-header',
        title: 'Asistente de IA',
        text: 'Chatea con Gemini o Groq para crear tareas, recordatorios, fechas y hábitos. Cambia el motor con <code>:ai provider</code> y configura su clave con <code>:ai key &lt;tu_key&gt;</code>.',
      },
      {
        before: () => this.navigate('home'),
        sel: '#sb-mode',
        title: 'Línea de comandos',
        text: 'Presiona <code>:</code> para abrir la línea de comandos. Empieza a escribir y verás una sugerencia en gris — pulsa <b>Tab</b> para autocompletar. Usa <code>:help</code> para ver todo.',
      },
    ];
  },

  startTour() {
    if (this._tourActive) return;
    localStorage.setItem('spritenote:toured', '1');
    this.steps = this._tourSteps();
    this._tourActive = true;
    this._tourIdx = 0;

    // crea elementos del tour
    this._tourSpot = document.createElement('div');
    this._tourSpot.id = 'tour-spot';
    this._tourCard = document.createElement('div');
    this._tourCard.id = 'tour-card';
    document.body.appendChild(this._tourSpot);
    document.body.appendChild(this._tourCard);

    this._tourKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.endTour(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); this._tourGo(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this._tourGo(-1); }
    };
    document.addEventListener('keydown', this._tourKey, true);
    this._tourReposition = () => this._tourPlace();
    window.addEventListener('resize', this._tourReposition);

    this._tourShow(0);
  },

  _tourGo(delta) {
    const next = this._tourIdx + delta;
    if (next < 0) return;
    if (next >= this.steps.length) { this.endTour(); return; }
    this._tourShow(next);
  },

  _tourShow(i) {
    this._tourIdx = i;
    const step = this.steps[i];
    if (step.before) { try { step.before(); } catch (_) {} }
    // espera un frame para que la vista/elemento exista y tenga layout
    requestAnimationFrame(() => requestAnimationFrame(() => this._tourRender(step)));
  },

  _tourRender(step) {
    const total = this.steps.length;
    const i = this._tourIdx;
    const isLast = i === total - 1;
    const dots = this.steps.map((_, k) => `<span class="tc-dot ${k === i ? 'on' : ''}"></span>`).join('');
    this._tourCard.innerHTML = `
      <div class="tc-bar">
        <span>RECORRIDO GUIADO</span>
        <span class="tc-step">${i + 1}/${total}</span>
      </div>
      <div class="tc-body">
        <div class="tc-title">${step.title}</div>
        <div class="tc-text">${step.text}</div>
      </div>
      <div class="tc-foot">
        <span class="tc-dots">${dots}</span>
        ${i > 0 ? '<button class="tc-btn" data-act="prev">‹ atrás</button>' : '<button class="tc-skip" data-act="skip">saltar</button>'}
        <button class="tc-btn primary" data-act="next">${isLast ? 'terminar ✓' : 'siguiente ›'}</button>
      </div>`;
    this._tourCard.querySelectorAll('[data-act]').forEach(b => {
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'next') this._tourGo(1);
        else if (act === 'prev') this._tourGo(-1);
        else if (act === 'skip') this.endTour();
      });
    });
    this._tourPlace();
  },

  _tourPlace() {
    if (!this._tourActive) return;
    const step = this.steps[this._tourIdx];
    const el = step.sel ? document.querySelector(step.sel) : null;
    const pad = 8;
    const vw = window.innerWidth, vh = window.innerHeight;

    if (el) {
      const r = el.getBoundingClientRect();
      this._tourSpot.style.opacity = '1';
      this._tourSpot.style.top = (r.top - pad) + 'px';
      this._tourSpot.style.left = (r.left - pad) + 'px';
      this._tourSpot.style.width = (r.width + pad * 2) + 'px';
      this._tourSpot.style.height = (r.height + pad * 2) + 'px';

      // coloca la tarjeta donde haya más espacio (debajo o encima; si no, al lado)
      const cardW = Math.min(330, vw * 0.86);
      const cardH = this._tourCard.offsetHeight || 200;
      let top, left;
      const spaceBelow = vh - r.bottom;
      const spaceRight = vw - r.right;
      if (spaceBelow > cardH + 24) {            // debajo
        top = r.bottom + 16; left = r.left;
      } else if (spaceRight > cardW + 24) {     // a la derecha
        top = r.top; left = r.right + 16;
      } else if (r.top > cardH + 24) {          // encima
        top = r.top - cardH - 16; left = r.left;
      } else {                                  // al lado izquierdo
        top = r.top; left = Math.max(16, r.left - cardW - 16);
      }
      left = Math.max(16, Math.min(left, vw - cardW - 16));
      top = Math.max(16, Math.min(top, vh - cardH - 16));
      this._tourCard.style.top = top + 'px';
      this._tourCard.style.left = left + 'px';
    } else {
      // sin objetivo: tarjeta centrada, sin foco
      this._tourSpot.style.opacity = '0';
      const cardW = Math.min(330, vw * 0.86);
      const cardH = this._tourCard.offsetHeight || 200;
      this._tourCard.style.top = (vh / 2 - cardH / 2) + 'px';
      this._tourCard.style.left = (vw / 2 - cardW / 2) + 'px';
    }
  },

  endTour() {
    if (!this._tourActive) return;
    this._tourActive = false;
    document.removeEventListener('keydown', this._tourKey, true);
    window.removeEventListener('resize', this._tourReposition);
    this._tourSpot?.remove();
    this._tourCard?.remove();
    this._tourSpot = this._tourCard = null;
    if (window.clawd && window.clawd.setState) window.clawd.setState('heart');
    Toast.show('info', 'recorrido', 'puedes repetirlo cuando quieras con <b>:tour</b>');
  },

  _loadMusicVisualizerSettings() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(MUSIC_VISUALIZER_KEY) || '{}'); }
    catch (_) { saved = {}; }
    const clamp = (value, min, max, fallback) => {
      const number = Number(value);
      return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
    };
    return {
      bars: Math.round(clamp(saved.bars, 12, 64, MUSIC_VISUALIZER_DEFAULTS.bars) / 2) * 2,
      sensitivity: clamp(saved.sensitivity, .5, 3, MUSIC_VISUALIZER_DEFAULTS.sensitivity),
      gap: Math.round(clamp(saved.gap, 0, 5, MUSIC_VISUALIZER_DEFAULTS.gap)),
      smoothing: clamp(saved.smoothing, 0, .95, MUSIC_VISUALIZER_DEFAULTS.smoothing),
      // Migración de 1.8.5: mirror ya representaba bajos al centro; centered
      // sólo cambiaba el anclaje vertical, por lo que vuelve a la escala normal.
      layout: saved.layout === 'mirror'
        ? 'bass-center'
        : (['linear', 'bass-center', 'bass-edges'].includes(saved.layout) ? saved.layout : MUSIC_VISUALIZER_DEFAULTS.layout),
      style: ['spectrum', 'digital', 'analog'].includes(saved.style) ? saved.style : MUSIC_VISUALIZER_DEFAULTS.style,
    };
  },

  _saveMusicVisualizerSettings() {
    localStorage.setItem(MUSIC_VISUALIZER_KEY, JSON.stringify(this._musicSettings));
  },

  _syncMusicVisualizerSettingsUI() {
    const settings = this._musicSettings;
    if (!settings) return;
    const assign = (id, value) => { if ($(id)) $(id).value = value; };
    assign('visualizer-bars', settings.bars);
    assign('visualizer-sensitivity', settings.sensitivity);
    assign('visualizer-gap', settings.gap);
    assign('visualizer-smoothing', settings.smoothing);
    if ($('visualizer-bars-value')) $('visualizer-bars-value').textContent = settings.bars;
    if ($('visualizer-sensitivity-value')) $('visualizer-sensitivity-value').textContent = `${settings.sensitivity.toFixed(1)}×`;
    if ($('visualizer-gap-value')) $('visualizer-gap-value').textContent = `${settings.gap}px`;
    if ($('visualizer-smoothing-value')) $('visualizer-smoothing-value').textContent = `${Math.round(settings.smoothing * 100)}%`;
    qsa('#visualizer-layout-options [data-layout]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.layout === settings.layout));
    });
    qsa('#visualizer-style-options [data-style]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.style === settings.style));
    });
    const layoutFieldset = document.querySelector('#visualizer-layout-options')?.closest('fieldset');
    if (layoutFieldset) layoutFieldset.disabled = settings.style === 'analog';
  },

  _updateMusicVisualizerSetting(key, value) {
    if (!this._musicSettings) return;
    this._musicSettings[key] = value;
    if (key === 'smoothing' && this._musicAnalyser) this._musicAnalyser.smoothingTimeConstant = value;
    this._saveMusicVisualizerSettings();
    this._syncMusicVisualizerSettingsUI();
  },

  _initMusicVisualizerSettings() {
    window.SettingsCenter?.init?.(this);
    this._syncMusicVisualizerSettingsUI();
  },

  _initMusicVisualizer() {
    const canvas = $('music-spectrum-canvas');
    const compactCanvas = $('cp-music-spectrum-canvas');
    const toggle = $('music-viz-toggle');
    const compactToggle = $('cp-music-viz-toggle');
    if (!canvas || !toggle) return;

    this._musicCanvas = canvas;
    this._musicCompactCanvas = compactCanvas;
    this._musicSettings = this._loadMusicVisualizerSettings();
    this._initMusicVisualizerSettings();
    this._musicColors = {};
    const refreshColors = () => {
      const style = getComputedStyle(document.documentElement);
      const lime = document.documentElement.dataset.theme === 'lime';
      this._musicColors = {
        accent: lime ? '#050900' : (style.getPropertyValue('--accent').trim() || '#7cffb2'),
        cyan: lime ? '#164800' : (style.getPropertyValue('--cyan').trim() || '#55ffff'),
        faint: lime ? '#071000' : (style.getPropertyValue('--text-faint').trim() || '#58665f'),
        mono: style.getPropertyValue('--mono').trim() || 'monospace',
      };
    };
    refreshColors();
    new MutationObserver(refreshColors).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    const resizeCanvas = target => {
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      target.width = Math.max(1, Math.round(rect.width * scale));
      target.height = Math.max(1, Math.round(rect.height * scale));
      target.getContext('2d').setTransform(scale, 0, 0, scale, 0, 0);
    };
    const resize = () => {
      resizeCanvas(canvas);
      resizeCanvas(compactCanvas);
      if (!this._musicAnalyser && !this._musicLinuxActive) this._drawMusicStandby();
    };
    this._musicResize = resize;
    this._musicResizeObserver = new ResizeObserver(resize);
    this._musicResizeObserver.observe(canvas);
    if (compactCanvas) this._musicResizeObserver.observe(compactCanvas);
    resize();

    const platform = window.spritenote?.platform;
    const windowsLoopback = Boolean(
      window.spritenote?.isElectron &&
      platform === 'win32' &&
      navigator.mediaDevices?.getDisplayMedia
    );
    const linuxLoopback = Boolean(
      window.spritenote?.isElectron &&
      platform === 'linux' &&
      window.spritenote?.audioLoopback
    );
    this._musicBackend = linuxLoopback ? 'linux' : (windowsLoopback ? 'windows' : null);
    this._musicSupported = windowsLoopback || linuxLoopback;

    if (linuxLoopback) {
      toggle.title = 'activar captura del audio del sistema vía PipeWire/PulseAudio';
      if (compactToggle) compactToggle.title = toggle.title;
      $('music-viz-message').textContent = 'PIPEWIRE LOOPBACK // STANDBY';
      window.spritenote.audioLoopback.capabilities().then(capabilities => {
        if (capabilities?.supported) return;
        this._musicSupported = false;
        toggle.disabled = true;
        toggle.title = capabilities?.installHint || 'instala libpulse para habilitar el visualizador';
        if (compactToggle) {
          compactToggle.disabled = true;
          compactToggle.title = toggle.title;
          $('cp-music-viz-status').textContent = 'NO LINK';
        }
        $('music-viz-status').textContent = 'NO LINK';
        $('music-viz-message').textContent = capabilities?.reason === 'parec-missing'
          ? 'PIPEWIRE LOOPBACK // LIBPULSE REQUIRED'
          : 'PIPEWIRE LOOPBACK // UNAVAILABLE';
      }).catch(() => {});
    } else if (!this._musicSupported) {
      toggle.disabled = true;
      toggle.title = 'el audio del sistema requiere Electron con un backend compatible';
      if (compactToggle) {
        compactToggle.disabled = true;
        compactToggle.title = toggle.title;
        $('cp-music-viz-status').textContent = 'NO LINK';
      }
      $('music-viz-status').textContent = 'NO LINK';
      $('music-viz-message').textContent = window.spritenote?.isElectron
        ? 'AUDIO LOOPBACK // UNSUPPORTED PLATFORM'
        : 'AUDIO LOOPBACK // ELECTRON REQUIRED';
    }

    toggle.addEventListener('click', () => this._toggleMusicVisualizer());
    compactToggle?.addEventListener('click', () => this._toggleMusicVisualizer());
    const resume = () => {
      if (this._musicStream && this._musicContext?.state === 'suspended') this._musicContext.resume().catch(() => {});
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
    window.addEventListener('focus', resume);
    window.addEventListener('beforeunload', () => this._stopMusicVisualizer());
  },

  _drawMusicStandby() {
    const canvas = this._musicCanvas;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / scale;
      const height = canvas.height / scale;
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.strokeStyle = this._musicColors?.faint || '#58665f';
      ctx.globalAlpha = .38;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(0, height - .5);
      ctx.lineTo(width, height - .5);
      ctx.stroke();
      ctx.restore();
    }

    // En compacto, standby queda limpio: la cuadrícula ambiental vive en CSS
    // y las barras sólo aparecen cuando existe señal real.
    const compact = this._musicCompactCanvas;
    if (compact) {
      const ctx = compact.getContext('2d');
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      ctx.clearRect(0, 0, compact.width / scale, compact.height / scale);
    }
  },

  async _toggleMusicVisualizer() {
    if (!this._musicSupported) return;
    if (this._musicStream || this._musicLinuxActive) {
      this._stopMusicVisualizer();
      return;
    }
    await this._startMusicVisualizer();
  },

  async _startMusicVisualizer() {
    if (this._musicBackend === 'linux') return this._startLinuxMusicVisualizer();

    const toggle = $('music-viz-toggle');
    const status = $('music-viz-status');
    const message = $('music-viz-message');
    toggle.disabled = true;
    const compactToggle = $('cp-music-viz-toggle');
    if (compactToggle) {
      compactToggle.disabled = true;
      compactToggle.setAttribute('aria-pressed', 'false');
      $('cp-music-viz-status').textContent = 'LINK';
    }
    status.textContent = 'LINKING';
    message.textContent = 'AUDIO LOOPBACK // CONNECTING...';
    let stream = null;
    let context = null;

    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: { width: 1, height: 1, frameRate: 1 },
      });
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error('Windows no entregó una pista de audio');
      }
      stream.getVideoTracks().forEach(track => { track.enabled = false; });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      context = new AudioContextClass();
      if (context.state === 'suspended') await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = this._musicSettings.smoothing;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -18;
      source.connect(analyser);

      this._musicStream = stream;
      this._musicContext = context;
      this._musicSource = source;
      this._musicAnalyser = analyser;
      this._musicFrequencyData = new Uint8Array(analyser.frequencyBinCount);
      audioTrack.addEventListener('ended', () => this._stopMusicVisualizer());

      toggle.disabled = false;
      toggle.setAttribute('aria-pressed', 'true');
      toggle.setAttribute('aria-label', 'detener captura del audio del sistema');
      toggle.title = 'detener captura del audio del sistema';
      $('music-viz-toggle-label').textContent = 'DETENER';
      toggle.querySelector('.music-viz-power').textContent = '■';
      toggle.closest('.sys-audio')?.classList.add('live');
      if (compactToggle) {
        compactToggle.disabled = false;
        compactToggle.setAttribute('aria-pressed', 'true');
        compactToggle.title = 'detener captura del audio del sistema';
        $('cp-music-viz-status').textContent = 'LIVE';
      }
      status.textContent = 'LIVE';
      message.textContent = 'AUDIO LOOPBACK // LISTENING';
      this._renderMusicSpectrum();
    } catch (error) {
      console.warn('[audio] Captura cancelada:', error);
      stream?.getTracks().forEach(track => track.stop());
      context?.close().catch(() => {});
      toggle.disabled = false;
      toggle.setAttribute('aria-pressed', 'false');
      toggle.setAttribute('aria-label', 'activar captura del audio del sistema');
      if (compactToggle) {
        compactToggle.disabled = false;
        compactToggle.setAttribute('aria-pressed', 'false');
        compactToggle.title = 'activar captura del audio del sistema';
        $('cp-music-viz-status').textContent = 'AUDIO';
      }
      status.textContent = 'STANDBY';
      message.textContent = error?.name === 'NotAllowedError'
        ? 'AUDIO LOOPBACK // CAPTURE CANCELLED'
        : 'AUDIO LOOPBACK // NO AUDIO TRACK';
      this._drawMusicStandby();
    }
  },

  async _startLinuxMusicVisualizer() {
    const toggle = $('music-viz-toggle');
    const status = $('music-viz-status');
    const message = $('music-viz-message');
    const compactToggle = $('cp-music-viz-toggle');
    toggle.disabled = true;
    if (compactToggle) {
      compactToggle.disabled = true;
      compactToggle.setAttribute('aria-pressed', 'false');
      $('cp-music-viz-status').textContent = 'LINK';
    }
    status.textContent = 'LINKING';
    message.textContent = 'PIPEWIRE LOOPBACK // CONNECTING...';

    try {
      const result = await window.spritenote.audioLoopback.start();
      if (!result?.ok) {
        const error = new Error(result?.error || result?.reason || 'No se pudo iniciar el loopback');
        error.loopbackResult = result;
        throw error;
      }

      this._musicLinuxActive = true;
      this._musicFrequencyData = new Uint8Array(128);
      this._musicLinuxUnsubFrame?.();
      this._musicLinuxUnsubEnded?.();
      this._musicLinuxUnsubFrame = window.spritenote.audioLoopback.onFrame(frame => {
        if (!this._musicLinuxActive || !Array.isArray(frame)) return;
        const release = Math.max(0, Math.min(.95, this._musicSettings?.smoothing ?? .68));
        const data = this._musicFrequencyData;
        const count = Math.min(data.length, frame.length);
        for (let i = 0; i < count; i += 1) {
          const incoming = Math.max(0, Math.min(255, Number(frame[i]) || 0));
          // Ataque deliberadamente rápido para que PipeWire se sienta inmediato;
          // el control SUAVIZADO gobierna principalmente la caída de las barras.
          const blend = incoming >= data[i] ? Math.min(.24, release * .28) : release;
          data[i] = Math.round(data[i] * blend + incoming * (1 - blend));
        }
      });
      this._musicLinuxUnsubEnded = window.spritenote.audioLoopback.onEnded(payload => {
        if (!this._musicLinuxActive) return;
        console.warn('[audio] Captura Linux finalizada:', payload);
        this._stopMusicVisualizer();
        if ($('music-viz-message')) $('music-viz-message').textContent = 'PIPEWIRE LOOPBACK // LOST LINK';
      });

      toggle.disabled = false;
      toggle.setAttribute('aria-pressed', 'true');
      toggle.setAttribute('aria-label', 'detener captura del audio del sistema');
      toggle.title = `detener captura vía ${result.backend || 'PipeWire/PulseAudio'}`;
      $('music-viz-toggle-label').textContent = 'DETENER';
      toggle.querySelector('.music-viz-power').textContent = '■';
      toggle.closest('.sys-audio')?.classList.add('live');
      if (compactToggle) {
        compactToggle.disabled = false;
        compactToggle.setAttribute('aria-pressed', 'true');
        compactToggle.title = `detener captura vía ${result.backend || 'PipeWire/PulseAudio'}`;
        $('cp-music-viz-status').textContent = 'LIVE';
      }
      status.textContent = 'LIVE';
      message.textContent = 'PIPEWIRE LOOPBACK // LISTENING';
      this._renderMusicSpectrum();
    } catch (error) {
      console.warn('[audio] No se pudo iniciar captura Linux:', error);
      const result = error?.loopbackResult || {};
      this._musicLinuxActive = false;
      this._musicFrequencyData = null;
      toggle.disabled = false;
      toggle.setAttribute('aria-pressed', 'false');
      toggle.setAttribute('aria-label', 'activar captura del audio del sistema');
      if (compactToggle) {
        compactToggle.disabled = false;
        compactToggle.setAttribute('aria-pressed', 'false');
        compactToggle.title = 'activar captura del audio del sistema';
        $('cp-music-viz-status').textContent = 'AUDIO';
      }
      status.textContent = 'STANDBY';
      if (result.reason === 'parec-missing') {
        message.textContent = 'PIPEWIRE LOOPBACK // INSTALL LIBPULSE';
        toggle.title = result.installHint || 'sudo pacman -S libpulse';
      } else {
        message.textContent = 'PIPEWIRE LOOPBACK // NO MONITOR SOURCE';
        toggle.title = result.installHint || error?.message || 'no se pudo abrir el monitor de audio';
      }
      this._drawMusicStandby();
    }
  },

  _renderMusicSpectrum() {
    const analyser = this._musicAnalyser;
    const canvas = this._musicCanvas;
    if ((!analyser && !this._musicLinuxActive) || !canvas) return;
    const data = this._musicFrequencyData;
    if (!data) return;
    if (analyser) analyser.getByteFrequencyData(data);

    const settings = this._musicSettings || MUSIC_VISUALIZER_DEFAULTS;
    const sampleForBar = (index, bars) => {
      const t = index / Math.max(1, bars - 1);
      const edgeDistance = Math.abs(index - (bars - 1) / 2) / Math.max(1, (bars - 1) / 2);
      let frequencyPosition = t;
      if (settings.layout === 'bass-center') frequencyPosition = edgeDistance;
      else if (settings.layout === 'bass-edges') frequencyPosition = 1 - edgeDistance;
      // Curva perceptual sencilla: reserva más espacio visual a bajos/medios.
      const position = Math.pow(Math.max(0, Math.min(1, frequencyPosition)), 1.55);
      const bin = Math.min(data.length - 1, 1 + Math.floor(position * (data.length - 3)));
      return Math.min(1, data[bin] / 255 * settings.sensitivity);
    };

    let energy = 0;
    for (let i = 1; i < data.length; i += 1) {
      const normalized = data[i] / 255;
      energy += normalized * normalized;
    }
    const rawAverage = Math.min(1, Math.sqrt(energy / Math.max(1, data.length - 1)) * settings.sensitivity * 1.65);
    const previousAnalog = this._musicAnalogLevel || 0;
    const analogBlend = rawAverage >= previousAnalog ? .18 : .78;
    this._musicAnalogLevel = previousAnalog * analogBlend + rawAverage * (1 - analogBlend);

    const drawAnalog = (target, ambient = false) => {
      if (!target) return 0;
      const ctx = target.getContext('2d');
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const width = target.width / scale;
      const height = target.height / scale;
      if (width <= 1 || height <= 1) return 0;
      ctx.clearRect(0, 0, width, height);

      const pad = ambient ? Math.max(12, width * .09) : 9;
      const gaugeX = pad;
      const gaugeY = ambient ? height * .10 : 5;
      const gaugeW = Math.max(10, width - pad * 2);
      const gaugeH = Math.max(18, height - gaugeY - (ambient ? height * .12 : 6));
      const cx = gaugeX + gaugeW / 2;
      const cy = gaugeY + gaugeH * .92;
      const radius = Math.min(gaugeW * .46, gaugeH * 1.28);
      const start = Math.PI * 1.14;
      const end = Math.PI * 1.86;

      ctx.save();
      ctx.globalAlpha = ambient ? .72 : .96;
      ctx.strokeStyle = this._musicColors.accent;
      ctx.fillStyle = this._musicColors.accent;
      ctx.lineWidth = ambient ? 1.2 : 1;
      ctx.shadowColor = this._musicColors.accent;
      ctx.shadowBlur = ambient ? 12 : 6;
      ctx.strokeRect(gaugeX + .5, gaugeY + .5, gaugeW - 1, gaugeH - 1);

      const ticks = [-42, -19, -12, -10, -7, -3, 0, 1];
      ctx.shadowBlur = 0;
      ctx.font = `${Math.max(7, Math.min(10, gaugeH * .14))}px ${this._musicColors.mono}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ticks.forEach((label, i) => {
        const a = start + (end - start) * i / (ticks.length - 1);
        const inner = radius * .77;
        const outer = radius * .91;
        const x1 = cx + Math.cos(a) * inner;
        const y1 = cy + Math.sin(a) * inner;
        const x2 = cx + Math.cos(a) * outer;
        const y2 = cy + Math.sin(a) * outer;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        if (!ambient || width > 420) {
          const tx = cx + Math.cos(a) * radius * .63;
          const ty = cy + Math.sin(a) * radius * .63;
          ctx.globalAlpha = ambient ? .48 : .72;
          ctx.fillText(String(label), tx, ty);
          ctx.globalAlpha = ambient ? .72 : .96;
        }
      });

      const needleAngle = start + (end - start) * Math.pow(Math.max(0, Math.min(1, this._musicAnalogLevel)), .72);
      ctx.strokeStyle = this._musicColors.cyan;
      ctx.shadowColor = this._musicColors.cyan;
      ctx.shadowBlur = ambient ? 18 : 8;
      ctx.lineWidth = ambient ? 2.2 : 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(needleAngle) * radius * .84, cy + Math.sin(needleAngle) * radius * .84);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = this._musicColors.cyan;
      ctx.beginPath(); ctx.arc(cx, cy, ambient ? 3.5 : 2.6, 0, Math.PI * 2); ctx.fill();
      if (!ambient || height > 180) {
        ctx.fillStyle = this._musicColors.accent;
        ctx.globalAlpha = ambient ? .50 : .70;
        ctx.font = `${Math.max(7, Math.min(10, gaugeH * .14))}px ${this._musicColors.mono}`;
        ctx.fillText('POWER LEVEL', cx, gaugeY + gaugeH * .72);
      }
      ctx.restore();
      return rawAverage;
    };

    const drawBars = (target, ambient = false) => {
      if (!target) return 0;
      const ctx = target.getContext('2d');
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const width = target.width / scale;
      const height = target.height / scale;
      if (width <= 1 || height <= 1) return 0;
      ctx.clearRect(0, 0, width, height);

      const bars = ambient ? Math.min(settings.bars, 52) : settings.bars;
      const gapBase = settings.style === 'digital'
        ? Math.max(2, settings.gap)
        : (ambient ? Math.max(2, settings.gap) : settings.gap);
      const gap = Math.min(gapBase, Math.max(0, (width - bars) / Math.max(1, bars - 1)));
      const barWidth = Math.max(1, (width - gap * (bars - 1)) / bars);
      const usableHeight = ambient ? height * .88 : height;
      const floor = height;
      const gradient = ctx.createLinearGradient(0, floor, 0, Math.max(0, floor - usableHeight));
      gradient.addColorStop(0, this._musicColors.accent);
      gradient.addColorStop(1, this._musicColors.cyan);
      ctx.fillStyle = gradient;
      ctx.shadowColor = this._musicColors.accent;
      ctx.shadowBlur = ambient ? 15 : 6;

      let total = 0;
      for (let index = 0; index < bars; index += 1) {
        const value = sampleForBar(index, bars);
        total += value;
        const x = index * (barWidth + gap);
        const barHeight = Math.max(ambient ? 1 : 2, Math.pow(value, .82) * usableHeight);

        if (settings.style === 'digital') {
          const segmentGap = ambient ? 2 : 1.5;
          const segmentHeight = Math.max(2, Math.min(6, height / 13));
          const pitch = segmentHeight + segmentGap;
          const segments = Math.max(1, Math.floor(barHeight / pitch));
          ctx.globalAlpha = ambient ? (.18 + value * .66) : (.58 + value * .42);
          for (let seg = 0; seg < segments; seg += 1) {
            const y = floor - (seg + 1) * pitch;
            ctx.fillRect(x, y, barWidth, segmentHeight);
          }
          if (segments > 0 && value > .07) {
            ctx.save();
            ctx.fillStyle = this._musicColors.cyan;
            ctx.globalAlpha = ambient ? .72 : .92;
            const y = floor - segments * pitch;
            ctx.fillRect(x, y, barWidth, Math.max(1.5, segmentHeight * .36));
            ctx.restore();
          }
        } else {
          ctx.globalAlpha = ambient ? (.16 + value * .64) : (.48 + value * .52);
          ctx.fillRect(x, floor - barHeight, barWidth, barHeight);
          if (ambient && value > .04) {
            ctx.globalAlpha = .045 + value * .12;
            ctx.fillRect(x, 0, barWidth, Math.min(height * .30, barHeight * .32));
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      return total / Math.max(1, bars);
    };

    const draw = (target, ambient = false) => settings.style === 'analog'
      ? drawAnalog(target, ambient)
      : drawBars(target, ambient);

    const average = draw(canvas, false);
    draw(this._musicCompactCanvas, true);

    const now = performance.now();
    if (!this._musicLastStatusAt || now - this._musicLastStatusAt > 350) {
      const transport = this._musicBackend === 'linux' ? 'PIPEWIRE LOOPBACK' : 'AUDIO LOOPBACK';
      $('music-viz-message').textContent = average > .025
        ? `${transport} // SIGNAL ${String(Math.round(average * 100)).padStart(2, '0')}%`
        : `${transport} // NO SIGNAL`;
      this._musicLastStatusAt = now;
    }
    this._musicFrame = requestAnimationFrame(() => this._renderMusicSpectrum());
  },

  _stopMusicVisualizer() {
    cancelAnimationFrame(this._musicFrame);
    this._musicFrame = null;
    const stream = this._musicStream;
    this._musicStream = null;
    stream?.getTracks().forEach(track => track.stop());
    const hadLinuxCapture = Boolean(this._musicLinuxActive);
    this._musicLinuxActive = false;
    this._musicLinuxUnsubFrame?.();
    this._musicLinuxUnsubEnded?.();
    this._musicLinuxUnsubFrame = null;
    this._musicLinuxUnsubEnded = null;
    if (hadLinuxCapture) window.spritenote?.audioLoopback?.stop?.()?.catch?.(() => {});
    try { this._musicSource?.disconnect(); } catch (_) { /* ya desconectado */ }
    this._musicContext?.close().catch(() => {});
    this._musicContext = null;
    this._musicSource = null;
    this._musicAnalyser = null;
    this._musicFrequencyData = null;

    const toggle = $('music-viz-toggle');
    if (toggle) {
      toggle.disabled = !this._musicSupported;
      toggle.setAttribute('aria-pressed', 'false');
      toggle.setAttribute('aria-label', 'activar captura del audio del sistema');
      toggle.title = 'activar captura del audio del sistema';
      $('music-viz-toggle-label').textContent = 'ACTIVAR';
      toggle.querySelector('.music-viz-power').textContent = '▶';
      toggle.closest('.sys-audio')?.classList.remove('live');
    }
    const compactToggle = $('cp-music-viz-toggle');
    if (compactToggle) {
      compactToggle.disabled = !this._musicSupported;
      compactToggle.setAttribute('aria-pressed', 'false');
      compactToggle.title = this._musicSupported ? 'activar captura del audio del sistema' : 'audio loopback no disponible';
    }
    if ($('cp-music-viz-status')) $('cp-music-viz-status').textContent = this._musicSupported ? 'AUDIO' : 'NO LINK';
    if ($('music-viz-status')) $('music-viz-status').textContent = this._musicSupported ? 'STANDBY' : 'NO LINK';
    if ($('music-viz-message') && this._musicSupported) {
      $('music-viz-message').textContent = this._musicBackend === 'linux'
        ? 'PIPEWIRE LOOPBACK // STANDBY'
        : 'AUDIO LOOPBACK // STANDBY';
    }
    this._drawMusicStandby();
  },

  _initSystemMonitor() {
    this._initMusicVisualizer();
    const oscLine = $('sys-osc-line');
    const oscLbl = $('sys-osc-pct');
    const gridLbl = $('sys-grid-rate');
    let osc = Array.from({ length: 96 }, () => 38);
    let tickCount = 0;

    const tick = () => {
      tickCount++;
      const oscPct = Math.round(58 + Math.random() * 12);
      const gridRate = +(Math.random() * 18 + 2).toFixed(1);

      // Línea tipo osciloscopio: fuerte al inicio, se estabiliza hacia la derecha.
      if (oscLine) {
        osc = osc.slice(1);
        const age = tickCount % 96;
        const decay = Math.max(.22, 1 - (age / 118));
        const center = 38 + Math.sin(Date.now() / 900) * 2;
        const spike = Math.random() < .13 ? (Math.random() - .5) * 50 : 0;
        const noise = (Math.random() - .5) * (24 * decay);
        osc.push(Math.max(4, Math.min(72, center + noise + spike)));
        const pts = osc.map((y, i) => `${(i / (osc.length - 1) * 320).toFixed(1)},${y.toFixed(1)}`).join(' ');
        oscLine.setAttribute('points', pts);
      }

      if (oscLbl) oscLbl.textContent = oscPct + '%';
      if (gridLbl) gridLbl.textContent = gridRate + 'K';
    };
    tick();
    setInterval(tick, 120);
  },

  // ════════════════════ COMANDOS ════════════════════
  _registerCommands() {
    const C = Command;
    C.register({ name: 'home', alias: ['h', 'inicio'], desc: 'ir al inicio', run: () => this.navigate('home') });
    C.register({ name: 'notes', alias: ['n', 'notas'], desc: 'ir a notas', run: () => this.navigate('notes') });
    C.register({ name: 'tasks', alias: ['t', 'tareas'], desc: 'ir a tareas', run: () => this.navigate('tasks') });
    C.register({ name: 'reminders', alias: ['recordatorios', 'reminder', 'recordar'], desc: 'ir a recordatorios', run: () => this.navigate('reminders') });
    C.register({ name: 'dates', alias: ['d', 'fechas'], desc: 'ir a fechas importantes', run: () => this.navigate('dates') });
    C.register({ name: 'new', alias: ['nueva'], desc: 'crear una nota nueva', run: () => this.newNote() });
    C.register({ name: 'add', argHint: '<tarea>', desc: 'agregar tarea rápida', run: (a) => { if (a) { this.addTask(a); Toast.show('info', 'tarea', 'agregada: ' + escHtml(a)); } } });
    C.register({
      name: 'gif', argHint: '<url|reset>', alias: ['banner'],
      desc: 'cambiar el gif del banner de inicio (url o "reset")',
      run: (a) => {
        a = a.trim();
        const heroEl = $('clawd-hero-gif');
        if (!heroEl) { Toast.show('warn', 'gif', 'elemento banner no encontrado'); return; }
        if (!a || a === 'reset') {
          localStorage.removeItem('spritenote:banner-gif');
          window.clawd?.addMirror?.(heroEl, { role: 'hero' });
          window.clawd?.setState?.('celebrate');
          Toast.show('info', 'gif', 'banner restaurado a la mascota activa');
          return;
        }
        // Validación básica de URL o ruta
        const isUrl = /^https?:\/\//i.test(a) || /^file:\/\//i.test(a) || /\.(gif|png|jpg|jpeg|webp|svg)(\?.*)?$/i.test(a);
        if (!isUrl) {
          Toast.show('warn', 'gif', 'usa una URL válida (.gif/.png/…) o "reset"');
          return;
        }
        // Prueba que carga antes de guardar
        const tmp = new Image();
        tmp.onload = () => {
          window.clawd?.removeMirror?.(heroEl);
          heroEl.src = a;
          localStorage.setItem('spritenote:banner-gif', a);
          Toast.show('info', 'gif', 'banner actualizado ✓ — se recordará en futuras sesiones');
          clawd.setState('heart');
        };
        tmp.onerror = () => {
          Toast.show('warn', 'gif', `no se pudo cargar: ${escHtml(a)}`);
        };
        tmp.src = a;
      },
    });
    C.register({
      name: 'theme', argHint: '<tema>', alias: ['tema'],
      sub: (window.THEMES || []).slice(),
      desc: 'cambiar tema: green/amber/mono/cyan/ember/synth/vapor/outrun/dos/matrix/lime',
      run: (a) => {
        a = a.trim().toLowerCase();
        if (!a) { Themes.next(); Toast.show('info', 'tema', '→ ' + Themes.label(Themes.current)); return; }
        const t = Themes.resolve(a);
        if (t) { Themes.set(t); Toast.show('info', 'tema', '→ ' + Themes.label(t)); }
        else Toast.show('warn', 'tema', 'no existe: ' + a);
      },
    });
    C.register({ name: 'habits', alias: ['habitos', 'mejoras'], desc: 'ir a mejoras de hábitos', run: () => this.navigate('habits') });
    C.register({ name: 'habit', argHint: '<texto>', alias: ['meta'], desc: 'agregar un hábito / meta diaria', run: (a) => { if (a) this.addHabit(a); else this.navigate('habits'); } });
    C.register({ name: 'eval', alias: ['checkin', 'dia', 'día'], desc: 'evaluar tu día (checklist diario)', run: () => this.openEval() });
    C.register({
      name: 'evalhour', argHint: '<0-23>', alias: ['horaeval', 'evalhora', 'checkin-hora'],
      desc: 'hora del check-in diario automático (def. 20 = 8pm)',
      run: (a) => {
        a = (a || '').trim();
        if (!a) {
          Toast.show('info', 'check-in', `hora actual: <b>${this._evalHour()}:00</b><br><span style="color:var(--text-faint)">:evalhour &lt;0-23&gt; para cambiar</span>`);
          return;
        }
        const h = parseInt(a, 10);
        if (!Number.isInteger(h) || h < 0 || h > 23) {
          Toast.show('warn', 'check-in', 'usa un número de 0 a 23 (hora del día)');
          return;
        }
        localStorage.setItem('spritenote:evalHour', String(h));
        this._scheduleDailyEval();
        const ampm = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
        Toast.show('info', 'check-in', `check-in diario a las <b>${h}:00</b> (${ampm})`);
      },
    });
    C.register({ name: 'compact', argHint: '[on|off|auto]', alias: ['compacto'], sub: ['on', 'off', 'auto'], desc: 'forzar/alternar la vista compacta', run: (a) => this.toggleCompact(a) });
    C.register({
      name: 'pet', argHint: '[id]', alias: ['mascota', 'companion', 'anime'],
      sub: Object.keys(window.PETS || { clawd: 1, femme: 1 }),
      desc: 'cambiar o recorrer personajes instalados',
      run: (a) => {
        const raw = a.trim().toLowerCase();
        const key = raw ? window.clawd.resolvePet(raw) : window.clawd.nextPet();
        if (!key) {
          const available = Object.keys(window.PETS || {}).join(', ');
          Toast.show('warn', 'mascota', 'no existe: ' + escHtml(raw) + '<br><span style="color:var(--text-faint)">disponibles: ' + escHtml(available) + '</span>');
          return;
        }
        if (raw) window.clawd.setPet(key);
        this._refreshNeofetch();
        Toast.show('info', 'mascota', '→ <b>' + escHtml(window.clawd.getPetLabel()) + '</b>');
      },
    });
    C.register({ name: 'crt', argHint: '[on|off]', alias: ['pantalla'], sub: ['on', 'off'], desc: 'activar/desactivar la capa CRT', run: (a) => { const v = a.trim().toLowerCase(); if (!v) this.setCrt(!this.crtOn); else if (['on','1','si','sí'].includes(v)) this.setCrt(true); else if (['off','0','no'].includes(v)) this.setCrt(false); else Toast.show('warn','crt','uso: :crt on / :crt off'); } });
    C.register({ name: 'calendar', alias: ['cal', 'calendario'], desc: 'ir al calendario', run: () => this.navigate('calendar') });
    C.register({
      name: 'ai', argHint: '<prompt|provider|key|model|level|tools|persona|estilo|avatar|clear>', alias: ['gemini', 'g'],
      sub: ['provider', 'key', 'model', 'level', 'tools', 'persona', 'estilo', 'avatar', 'clear', 'forget'],
      subDesc: {
        key: 'configurar tu API key',
        provider: 'elegir Gemini o Groq',
        model: 'cambiar modelo del motor activo',
        level: 'esfuerzo de razonamiento',
        tools: 'activar/desactivar acciones',
        persona: 'modo estándar ↔ personaje',
        estilo: 'personalidad del personaje',
        avatar: 'tu foto de perfil',
        clear: 'reiniciar conversación',
        forget: 'borrar la API key',
      },
      desc: 'chatear con Gemini o Groq · agrega fechas/tareas/recordatorios/hábitos · :ai key para configurar',
      run: (a) => this._aiCommand(a),
    });
    C.register({ name: 'help', alias: ['?'], desc: 'ver todos los comandos', run: () => this._showHelp() });
    if (!SysInfo.isNative || !SysInfo.user) {
      C.register({
        name: 'user', argHint: '<nombre>', alias: ['usuario'],
        desc: 'definir tu nombre de usuario',
        run: (a) => {
          a = a.trim();
          if (!a) {
            Toast.show('info', 'usuario', `usuario actual: <b>${escHtml(SysInfo.user ?? '?')}</b><br><span style="color:var(--text-faint)">:user &lt;nombre&gt; para cambiar</span>`);
            return;
          }
          localStorage.setItem('spritenote:username', a);
          SysInfo.user = a;
          this._applyUserToDOM();
          const cpUser = $('cp-user');
          if (cpUser) cpUser.textContent = a;
          $('home-greet-title').textContent = this.greeting() + ', ' + a;
          this._refreshNeofetch();
          Toast.show('info', 'usuario', `→ <b>${escHtml(a)}</b> guardado`);
          clawd.setState('heart');
        },
      });
    }
    C.register({
      name: 'calibrate', alias: ['calibrar', 'setup', 'calibracion', 'calibración'],
      desc: 'recalibrar mascota, tema y usuario',
      run: () => this.recalibrate(),
    });
    C.register({
      name: 'tour', alias: ['recorrido', 'tutorial', 'guia', 'guía'],
      desc: 'recorrido guiado por la app',
      run: () => this.startTour(),
    });
    C.register({
      name: 'reset', desc: 'restaurar datos de ejemplo',
      run: async () => {
        const ok = await this.confirm({
          title: 'Restaurar datos',
          body: 'Esto <b>borrará</b> tus notas, tareas, recordatorios, fechas y hábitos, y restaurará los datos de ejemplo. ¿Continuar?',
          okText: 'Borrar todo', danger: true,
        });
        if (!ok) return;
        Store.reset();
        this.currentNoteId = null;
        this._refreshNeofetch();
        this.navigate(this.currentView);
        clawd.setState('dizzy');
        Toast.show('warn', 'reset', 'datos restaurados');
      },
    });
  },

  _showHelp() {
    let overlay = $('help-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'help-overlay';
      document.body.appendChild(overlay);
    }
    const esc = window.escHtml || ((s) => s);
    const rows = Command.registry.map(c => {
      const aliases = (c.alias || []).length ? `<span class="hk-alias">${esc((c.alias || []).map(a => ':' + a).join(' '))}</span>` : '';
      const sub = Array.isArray(c.sub) && c.sub.length ? `<div class="hk-sub">${esc(c.sub.join(' · '))}</div>` : '';
      return `<div class="hk-row">
        <div class="hk-name">:${esc(c.name)}${c.argHint ? ' <span class="hk-arg">' + esc(c.argHint) + '</span>' : ''}</div>
        <div class="hk-info"><div class="hk-desc">${esc(c.desc || '')}</div>${aliases}${sub}</div>
      </div>`;
    }).join('');

    overlay.innerHTML = `
      <div class="help-card" role="dialog" aria-modal="true" aria-label="Comandos">
        <div class="help-head">
          <span>COMANDOS · ${Command.registry.length}</span>
          <button class="help-close" data-act="close" title="cerrar (Esc)">✕</button>
        </div>
        <div class="help-body">
          ${rows}
        </div>
        <div class="help-foot">
          teclas <b>1–8</b> cambian de vista · <b>:</b> abre comandos · <b>Tab</b> autocompleta · <b>Esc</b> cierra
        </div>
      </div>`;
    overlay.classList.add('open');

    const close = () => {
      overlay.classList.remove('open');
      overlay.innerHTML = '';
      document.removeEventListener('keydown', onKey, true);
      overlay.removeEventListener('click', onBackdrop);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
    const onBackdrop = (e) => { if (e.target === overlay) close(); };
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', onBackdrop);
    overlay.querySelector('[data-act="close"]').addEventListener('click', close);
  },
};

// ── init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  App.init();
  window.App = App;

  // Toast de bienvenida si no hay nombre de usuario definido
  if (!SysInfo.user) {
    setTimeout(() => {
      Toast.show('info', '👋 bienvenido',
        'escribe <b>:user &lt;tu nombre&gt;</b> para personalizar tu neofetch',
        7000);
    }, 800);
  }

  // inputs de tareas / fechas
  $('task-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); App._addTaskFromInput(); }
  });
  $('task-input').addEventListener('input', () => App._updateTaskSyntaxHint());
  const taskInput = $('task-input');
  const returnToTask = () => requestAnimationFrame(() => taskInput.focus({ preventScroll: true }));
  $('task-priority-input').addEventListener('change', () => { App._updateTaskSyntaxHint(); returnToTask(); });
  $('task-due-input').addEventListener('change', () => { App._updateTaskSyntaxHint(); returnToTask(); });
  ['task-priority-input', 'task-due-input'].forEach(id => {
    $(id).addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); App._addTaskFromInput(); }
    });
  });
  $('date-add-btn').addEventListener('click', () => App.addDate());
  $('notes-new-btn').addEventListener('click', () => App.newNote());
  $('cmd-open-btn')?.addEventListener('click', () => Command.open());

  // Check-in diario: aparece al centro una vez al día, a partir de la hora
  // configurada (por defecto 20:00 / 8pm; ajustable con :evalhour).
  App._scheduleDailyEval();
});
window.App = App;
