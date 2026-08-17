// command.js — línea de comandos estilo vim (:) + indicador de modo.
// Modos: NORMAL · INSERT (editando) · COMMAND (línea : abierta).
// Incluye stub :ai / :gemini reservado para integración futura.

const Mode = {
  current: 'NORMAL',
  set(m) {
    this.current = m;
    const seg = document.getElementById('sb-mode');
    if (!seg) return;
    seg.textContent = m;
    seg.classList.remove('insert', 'command');
    if (m === 'INSERT') seg.classList.add('insert');
    if (m === 'COMMAND') seg.classList.add('command');
  },
};

const Command = {
  registry: [],
  suggestions: [],
  selIdx: 0,

  register(spec) { this.registry.push(spec); },

  init() {
    this.cmdline = document.getElementById('cmdline');
    this.input = document.getElementById('cmd-input');
    this.suggestEl = document.getElementById('cmd-suggest');
    this.ghostEl = document.getElementById('cmd-ghost');

    this.input.addEventListener('input', () => this._renderSuggest());
    this.input.addEventListener('keydown', (e) => this._onKey(e));

    // abrir con ":" cuando no se está escribiendo en un campo
    document.addEventListener('keydown', (e) => {
      const a = document.activeElement;
      const typing = /^(INPUT|TEXTAREA)$/.test(a?.tagName) || a?.isContentEditable;
      if (e.key === ':' && !typing && !this.isOpen()) {
        e.preventDefault();
        this.open();
      } else if (e.key === 'Escape') {
        if (this.isOpen()) { e.preventDefault(); this.close(); }
        else if (typing) a.blur();
      } else if (!typing && !this.isOpen() && /^[1-9]$/.test(e.key)) {
        // navegación rápida por número (modo NORMAL)
        const nav = ['home', 'notes', 'tasks', 'reminders', 'habits', 'dates', 'calendar', 'ai'];
        if (nav[+e.key - 1]) { e.preventDefault(); window.App.navigate(nav[+e.key - 1]); }
      }
    });

    // INSERT cuando se enfoca un campo de texto editable
    document.addEventListener('focusin', (e) => {
      if (this.isOpen()) return;
      const t = e.target;
      if ((/^(INPUT|TEXTAREA)$/.test(t.tagName) && t.type !== 'date' && t.type !== 'checkbox')
          || t.isContentEditable) {
        Mode.set('INSERT');
      }
    });
    document.addEventListener('focusout', () => {
      if (!this.isOpen()) setTimeout(() => {
        const a = document.activeElement;
        if (!(/^(INPUT|TEXTAREA)$/.test(a?.tagName) || a?.isContentEditable)) Mode.set('NORMAL');
      }, 10);
    });
  },

  isOpen() { return this.cmdline.classList.contains('open'); },

  open(prefill = '') {
    this.cmdline.classList.add('open');
    this.input.value = prefill;
    Mode.set('COMMAND');
    this._renderSuggest();
    this.input.focus();
  },

  close() {
    this.cmdline.classList.remove('open');
    this.suggestEl.classList.remove('open');
    if (this.ghostEl) this.ghostEl.innerHTML = '';
    this.input.value = '';
    Mode.set('NORMAL');
  },

  _find(token) {
    token = (token || '').toLowerCase();
    return this.registry.find(c => c.name === token || (c.alias || []).includes(token)) || null;
  },

  _matches(q) {
    q = q.replace(/^:/, '');
    const lead = q.replace(/^\s+/, '');
    const sp = lead.indexOf(' ');
    if (sp === -1) {
      // un solo token → comandos cuyo nombre/alias empiece igual
      const head = lead.trim().toLowerCase();
      if (!head) return this.registry.slice();
      return this.registry.filter(c =>
        c.name.startsWith(head) || (c.alias || []).some(a => a.startsWith(head)));
    }
    // dos tokens → sugerir SUBCOMANDOS del comando (si los declara)
    const cmdTok = lead.slice(0, sp).toLowerCase();
    const subPart = lead.slice(sp + 1);
    if (subPart.trim().includes(' ')) return []; // ya pasó del subcomando
    const cmd = this._find(cmdTok);
    if (!cmd || !Array.isArray(cmd.sub)) return [];
    const sh = subPart.trim().toLowerCase();
    return cmd.sub.filter(s => s.startsWith(sh)).map(s => ({
      _sub: true, parent: cmd, sub: s,
      name: cmd.name + ' ' + s, argHint: '',
      desc: (cmd.subDesc && cmd.subDesc[s]) || '',
    }));
  },

  _renderSuggest() {
    const raw = this.input.value;
    this.suggestions = this._matches(raw);
    this.selIdx = 0;
    if (!this.suggestions.length) {
      this.suggestEl.classList.remove('open');
      this._renderGhost();
      return;
    }
    this.suggestEl.innerHTML = this.suggestions.map((c, i) =>
      `<div class="cmd-sug-item ${i === 0 ? 'sel' : ''}">
        <span class="cs-cmd">:${c.name}${c.argHint ? ' ' + c.argHint : ''}</span>
        <span class="cs-desc">${c.desc}</span>
      </div>`).join('');
    this.suggestEl.classList.add('open');
    this._renderGhost();
  },

  // Calcula la mejor finalización para lo escrito, según la sugerencia
  // resaltada. Completa el nombre del comando o, si ya hay un comando con
  // subcomandos, el subcomando (p. ej. :ai ke → :ai key).
  _completionFor(raw) {
    const hadColon = /^\s*:/.test(raw);
    const body = raw.replace(/^\s*:?/, ''); // conserva espacios internos
    const c = this.suggestions[this.selIdx] || this.suggestions[0];
    if (!c) return null;

    if (c._sub) {
      const sp = body.indexOf(' ');
      if (sp === -1) return null;
      const partial = body.slice(sp + 1);
      if (partial.includes(' ')) return null;
      const head = partial.toLowerCase();
      const full = c.sub;
      if (!full.startsWith(head) || full.length <= head.length) return null;
      return { hadColon, kind: 'sub', full, suffix: full.slice(head.length) };
    }

    if (body.includes(' ')) return null; // ya pasó el nombre del comando
    const head = body.toLowerCase();
    let full = null;
    if (c.name.startsWith(head)) full = c.name;
    else { const al = (c.alias || []).find(a => a.startsWith(head)); if (al) full = al; }
    if (!full || full.length <= head.length) return null;
    return { hadColon, kind: 'cmd', full, argHint: c.argHint, suffix: full.slice(head.length) };
  },

  // Dibuja el texto fantasma: lo tecleado transparente + el sufijo en gris.
  _renderGhost() {
    if (!this.ghostEl) return;
    const comp = this._completionFor(this.input.value);
    if (!comp || !comp.suffix) { this.ghostEl.innerHTML = ''; return; }
    const esc = window.escHtml || ((s) => s);
    this.ghostEl.innerHTML =
      `<span class="g-typed">${esc(this.input.value)}</span>` +
      `<span class="g-suffix">${esc(comp.suffix)}</span>`;
  },

  _onKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this._run(this.input.value);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const comp = this._completionFor(this.input.value);
      if (comp) {
        if (comp.kind === 'sub') {
          this.input.value = this.input.value + comp.suffix + ' ';
        } else {
          this.input.value = (comp.hadColon ? ':' : '') + comp.full + (comp.argHint ? ' ' : '');
        }
        this._renderSuggest();
      } else {
        // sin sufijo que completar: usa la sugerencia resaltada tal cual
        const c = this.suggestions[this.selIdx];
        if (c && c._sub) {
          const hadColon = /^\s*:/.test(this.input.value);
          this.input.value = (hadColon ? ':' : '') + c.parent.name + ' ' + c.sub + ' ';
          this._renderSuggest();
        } else if (c) {
          const hadColon = /^\s*:/.test(this.input.value);
          this.input.value = (hadColon ? ':' : '') + c.name + (c.argHint ? ' ' : '');
          this._renderSuggest();
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selIdx = Math.min(this.selIdx + 1, this.suggestions.length - 1);
      this._updateSel();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selIdx = Math.max(this.selIdx - 1, 0);
      this._updateSel();
    }
  },

  _updateSel() {
    [...this.suggestEl.children].forEach((el, i) =>
      el.classList.toggle('sel', i === this.selIdx));
    this._renderGhost();
  },

  _run(raw) {
    const text = raw.replace(/^:/, '').trim();
    if (!text) { this.close(); return; }
    const parts = text.split(/\s+/);
    // Si hay un subcomando resaltado y solo se escribió "<cmd> <prefijo>",
    // ejecuta el subcomando completo (p. ej. :ai ke ↵ → :ai key).
    const sel = this.suggestions[this.selIdx];
    if (sel && sel._sub && parts.length === 2) {
      this.close();
      sel.parent.run(sel.sub);
      return;
    }
    const [head, ...rest] = parts;
    const args = rest.join(' ');
    const cmd = this.registry.find(c =>
      c.name === head || (c.alias || []).includes(head)) ||
      (sel && !sel._sub ? sel : null);
    this.close();
    if (cmd) cmd.run(args);
    else {
      if (window.clawd) window.clawd.setState('confused');
      Toast.show('warn', 'error', `comando desconocido: ${head} — escribe :help`);
    }
  },
};

// ── Toasts ───────────────────────────────────────────────────────
const Toast = {
  show(kind, head, body, ms = 4200) {
    const wrap = document.getElementById('toast-wrap');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `<div class="t-head">${head}</div><div class="t-body">${body}</div>`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 260);
    }, ms);
  },
};

window.Mode = Mode;
window.Command = Command;
window.Toast = Toast;
