// themes.js — conmutador de temas phosphor/CRT + persistencia.
// 11 temas de alto contraste: green, amber, mono, cyan, ember, synthwave,
// vaporwave, outrun, dos blue, matrix y lime inverted.

const THEMES = ['green', 'amber', 'mono', 'cyan', 'ember', 'synth', 'vapor', 'outrun', 'dos', 'matrix', 'lime', 'catppuccin'];
const THEME_LABEL = {
  green: 'green',
  amber: 'amber',
  mono: 'ibm 5151',
  cyan: 'ice',
  ember: 'ember',
  synth: 'synthwave',
  vapor: 'vaporwave',
  outrun: 'outrun',
  dos: 'dos blue',
  matrix: 'matrix',
  lime: 'lime inv',
  catppuccin: 'catppuccin',
};
const THEME_ALIASES = {
  tokyo: 'cyan', 'tokyo-night': 'cyan', tokyonight: 'cyan',
  cat: 'catppuccin', catppuccin: 'catppuccin', dr: 'synth', dracula: 'synth',
  gru: 'amber', gruvbox: 'amber', phosphor: 'green', ice: 'cyan',
  ibm: 'mono', 'ibm5151': 'mono', 'ibm-5151': 'mono',
  synthwave: 'synth', vaporwave: 'vapor', 'dos-blue': 'dos',
  limeinv: 'lime', 'lime-inv': 'lime', osciloscope: 'cyan', grid: 'vapor',
};
const THEME_KEY = 'spritenote:theme';

const Themes = {
  current: 'vapor',

  init() {
    const saved = localStorage.getItem(THEME_KEY);
    this.set(this.resolve(saved) || 'vapor', false);
  },

  resolve(name) {
    const raw = (name || '').trim().toLowerCase();
    if (!raw) return null;
    return THEMES.includes(raw) ? raw : (THEME_ALIASES[raw] || null);
  },

  set(name, animate = true) {
    const resolved = this.resolve(name);
    if (!resolved) return false;
    this.current = resolved;
    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem(THEME_KEY, resolved);

    document.querySelectorAll('.theme-dot').forEach(d =>
      d.classList.toggle('active', d.dataset.t === resolved));

    const label = THEME_LABEL[resolved] || resolved;
    const seg = document.getElementById('sb-theme');
    if (seg) seg.textContent = label;
    const picker = document.getElementById('theme-current-label');
    if (picker) picker.textContent = label;

    requestAnimationFrame(() => {
      if (window.clawd && window.clawd.refreshPalette) window.clawd.refreshPalette();
    });

    if (animate && window.clawd) window.clawd.setState('heart');
    return true;
  },

  next() {
    const idx = THEMES.indexOf(this.current);
    this.set(THEMES[(idx + 1) % THEMES.length]);
  },

  label(name) { return THEME_LABEL[this.resolve(name) || name] || name; },
  list() { return THEMES.slice(); },
};

window.Themes = Themes;
window.THEMES = THEMES;
